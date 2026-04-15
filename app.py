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
        print("📁 Upload request received")
        print("📥 FILE KEYS:", request.files.keys())

        file = request.files.get("file")

        if not file or file.filename == "":
            return jsonify({"error": "No file uploaded"}), 400

        content = file.read()

        # Try CSV first
        try:
            df = pd.read_csv(io.BytesIO(content))
            print(f"✅ CSV loaded: {len(df)} rows")
        except:
            try:
                df = pd.read_json(io.BytesIO(content))
                print(f"✅ JSON loaded: {len(df)} rows")
            except:
                return jsonify({"error": "Invalid file format"}), 400

        # Normalize column names
        df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]
        print("📊 Columns:", df.columns.tolist())

        # Flexible mapping
        col_map = {}
        for col in df.columns:
            if "year" in col:
                col_map["year"] = col
            elif "month" in col:
                col_map["month"] = col
            elif "consumption" in col or "usage" in col:
                col_map["consumption"] = col
            elif "bill" in col or "amount" in col:
                col_map["bill"] = col

        df = df.rename(columns=col_map)

        # Check required columns
        if not all(col in df.columns for col in ["year", "month"]):
            return jsonify({
                "error": f"Missing required columns. Found: {list(df.columns)}"
            }), 400

        # Clean data
        df = df.dropna()
        df["year"] = pd.to_numeric(df["year"], errors="coerce").fillna(2023).astype(int)
        df["month"] = pd.to_numeric(df["month"], errors="coerce").fillna(1).clip(1,12).astype(int)
        df["consumption"] = pd.to_numeric(df.get("consumption", 0), errors="coerce").fillna(0)
        df["bill"] = pd.to_numeric(df.get("bill", 0), errors="coerce").fillna(0)

        if df.empty:
            return jsonify({"error": "No valid data"}), 400

        # Standard format
        df_standard = df[["year", "month", "consumption", "bill"]].copy()
        df_standard.columns = ["Year", "Month", "Consumption", "Bill"]

        # Save
        data_store = pd.concat([data_store, df_standard], ignore_index=True)
        data_store = data_store.drop_duplicates(subset=["Year", "Month"])

        print(f"💾 Added {len(df)} rows. Total: {len(data_store)}")

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
        if len(data_store) < 3:
            return jsonify({
                "error": "Need at least 3 records",
                "history_actual": [],
                "history_predicted": [],
                "future_3_months": [0,0,0]
            })

        X = np.column_stack([
            np.arange(len(data_store)),
            data_store["Month"]
        ])

        history_pred = model.predict(X).tolist()

        last_idx = len(data_store)
        last_month = data_store["Month"].iloc[-1]

        future_X = [
            [last_idx+i, (last_month+i-1)%12+1]
            for i in range(3)
        ]

        future_pred = model.predict(np.array(future_X)).tolist()

        return jsonify({
            "history_actual": data_store["Consumption"].tolist(),
            "history_predicted": history_pred,
            "future_3_months": future_pred
        })

    except Exception as e:
        return jsonify({"error": str(e)})

# =========================
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
