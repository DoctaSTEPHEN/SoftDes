from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import os
import io

app = Flask(__name__)
CORS(app)

# =========================
# LOAD MODEL
# =========================
try:
    model = joblib.load("model/gb_model.pkl")
    print("✅ Model loaded")
except:
    from sklearn.ensemble import GradientBoostingRegressor
    model = GradientBoostingRegressor()
    print("⚠️ Using dummy model")

# =========================
# IN-MEMORY STORAGE
# =========================
data_store = pd.DataFrame(columns=["Year", "Month", "Consumption", "Bill"])

# =========================
# DEBUG LOGGER
# =========================
@app.after_request
def log_request(response):
    print(f"📡 {request.method} {request.path} → {response.status}")
    return response

# =========================
# HOME
# =========================
@app.route("/")
def home():
    return render_template("index.html")

# =========================
# ADD RECORD (FIXED)
# =========================
@app.route("/api/add", methods=["POST"])
def add_record():
    global data_store
    try:
        data = request.json
        print("📥 ADD DATA:", data)

        # Validate input
        required = ["Year", "Month", "Consumption", "Bill"]
        for field in required:
            if field not in data or data[field] in [None, ""]:
                return jsonify({"error": f"Missing {field}"}), 400

        new_row = {
            "Year": int(data["Year"]),
            "Month": int(data["Month"]),
            "Consumption": float(data["Consumption"]),
            "Bill": float(data["Bill"])
        }

        data_store = pd.concat(
            [data_store, pd.DataFrame([new_row])],
            ignore_index=True
        )

        print(f"✅ Record added. Total rows: {len(data_store)}")

        return jsonify({
            "message": "Record added",
            "rows": len(data_store)
        })

    except Exception as e:
        print("❌ ADD ERROR:", str(e))
        return jsonify({"error": str(e)}), 400

# =========================
# GET DATA
# =========================
@app.route("/api/data")
def get_data():
    return jsonify(data_store.to_dict("records"))

# =========================
# DASHBOARD
# =========================
@app.route("/api/dashboard")
def dashboard():
    if data_store.empty:
        return jsonify({
            "total": 0,
            "avg": 0,
            "bill": 0
        })

    return jsonify({
        "total": float(data_store["Consumption"].sum()),
        "avg": float(data_store["Consumption"].mean()),
        "bill": float(data_store["Bill"].sum())
    })

# =========================
# UPLOAD (FULLY FIXED)
# =========================
@app.route("/api/upload", methods=["POST"])
def upload():
    global data_store

    try:
        print("📁 UPLOAD REQUEST RECEIVED")

        # =========================
        # 1. GET FILE
        # =========================
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({"error": "Empty filename"}), 400

        content = file.read()

        # =========================
        # 2. LOAD FILE (CSV / JSON)
        # =========================
        try:
            df = pd.read_csv(io.BytesIO(content))
            print("✅ CSV loaded")
        except:
            try:
                df = pd.read_json(io.BytesIO(content))
                print("✅ JSON loaded")
            except:
                return jsonify({"error": "Invalid file format"}), 400

        if df.empty:
            return jsonify({"error": "Empty dataset"}), 400

        # =========================
        # 3. NORMALIZE COLUMN NAMES
        # =========================
        df.columns = [
            str(c).strip().lower().replace(" ", "_")
            for c in df.columns
        ]

        print("📊 Columns:", list(df.columns))

        # =========================
        # 4. SAFE COLUMN DETECTION
        # =========================
        def find_col(possible_names):
            for col in df.columns:
                for name in possible_names:
                    if name in col:
                        return col
            return None

        year_col = find_col(["year", "yr"])
        month_col = find_col(["month", "mon"])
        cons_col = find_col(["consumption", "usage", "meter"])
        bill_col = find_col(["bill", "amount", "cost", "charge"])

        if not all([year_col, month_col, cons_col, bill_col]):
            return jsonify({
                "error": f"Missing required columns. Found: {list(df.columns)}"
            }), 400

        # =========================
        # 5. STANDARDIZE DATAFRAME
        # =========================
        df = df[[year_col, month_col, cons_col, bill_col]].copy()
        df.columns = ["Year", "Month", "Consumption", "Bill"]

        # =========================
        # 6. SAFE TYPE CONVERSION (FIXED BUG HERE)
        # =========================
        df["Year"] = pd.to_numeric(df["Year"], errors="coerce").fillna(2023)
        df["Month"] = pd.to_numeric(df["Month"], errors="coerce").fillna(1)
        df["Consumption"] = pd.to_numeric(df["Consumption"], errors="coerce").fillna(0)
        df["Bill"] = pd.to_numeric(df["Bill"], errors="coerce").fillna(0)

        df["Month"] = df["Month"].clip(1, 12)

        df = df.astype({
            "Year": int,
            "Month": int
        })

        # =========================
        # 7. REMOVE INVALID ROWS
        # =========================
        df = df.dropna()

        if df.empty:
            return jsonify({"error": "No valid rows after cleaning"}), 400

        # =========================
        # 8. MERGE INTO STORE
        # =========================
        data_store = pd.concat([data_store, df], ignore_index=True)

        # remove duplicates
        data_store = data_store.drop_duplicates(subset=["Year", "Month"])

        print(f"💾 Total rows: {len(data_store)}")

        # =========================
        # 9. RESPONSE
        # =========================
        return jsonify({
            "success": True,
            "rows_added": len(df),
            "total_rows": len(data_store)
        })

    except Exception as e:
        print("❌ UPLOAD ERROR:", str(e))
        return jsonify({"error": str(e)}), 500
# =========================
# FORECAST
# =========================
@app.route("/api/forecast")
def forecast():
    try:
        if data_store.empty or len(data_store) < 3:
            return jsonify({
                "error": "Need at least 3 records",
                "labels": [],
                "history_actual": [],
                "future_3_months": []
            })

        # ===== HISTORY =====
        history = data_store["Consumption"].tolist()

        X = np.column_stack([
            np.arange(len(history)),
            (data_store["Month"] % 12 + 1)
        ])

        history_pred = model.predict(X).tolist()

        # ===== FUTURE =====
        last_index = len(history)
        last_month = int(data_store["Month"].iloc[-1])

        future_X = []
        future_labels = []
        future_values = []

        for i in range(3):
            idx = last_index + i
            month = ((last_month + i - 1) % 12) + 1

            future_X.append([idx, month])
            future_labels.append(f"F{i+1}")

        future_values = model.predict(np.array(future_X)).tolist()

        return jsonify({
            "labels": [f"M{i+1}" for i in range(len(history))] + future_labels,
            "history_actual": history,
            "history_predicted": history_pred,
            "future_3_months": future_values
        })

    except Exception as e:
        return jsonify({
            "error": str(e),
            "labels": [],
            "history_actual": [],
            "future_3_months": []
        })# =========================
# ANOMALY
# =========================
@app.route("/api/anomaly")
def anomaly():
    try:
        if data_store.empty:
            return jsonify([])

        mean = data_store["Consumption"].mean()
        std = data_store["Consumption"].std()
        threshold = mean + (2 * std if std > 0 else mean)

        df = data_store.copy()
        df["status"] = df["Consumption"].apply(
            lambda x: "ANOMALY" if x > threshold else "NORMAL"
        )

        return jsonify(df.to_dict("records"))

    except:
        return jsonify([])

# =========================
# RUN
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
