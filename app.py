from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import io
import os
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# =========================
# MODEL
# =========================
try:
    model = joblib.load("model/gb_model.pkl")
except:
    from sklearn.ensemble import GradientBoostingRegressor
    model = GradientBoostingRegressor()
    model.fit([[0, 1], [1, 2], [2, 3]], [100, 120, 140])

# =========================
# DATA STORE
# =========================
data_store = pd.DataFrame(columns=["Year", "Month", "Consumption", "Bill"])


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

    data = request.json

    required = ["Year", "Month", "Consumption", "Bill"]

    # FIXED validation
    for r in required:
        if r not in data or str(data[r]).strip() == "":
            return jsonify({"error": f"Missing entry value: {r}"}), 400

    try:
        row = {
            "Year": int(data["Year"]),
            "Month": int(float(data["Month"])),
            "Consumption": float(data["Consumption"]),
            "Bill": float(data["Bill"])
        }

        data_store = pd.concat([data_store, pd.DataFrame([row])], ignore_index=True)

        return jsonify({"message": "added", "rows": len(data_store)})

    except Exception as e:
        return jsonify({"error": f"Invalid input format: {str(e)}"}), 400


# =========================
# DASHBOARD (NO DUPLICATES)
# =========================
@app.route("/api/dashboard")
def dashboard():
    if data_store.empty:
        return jsonify({
            "total": 0,
            "avg": 0,
            "bill": 0,
            "records": 0
        })

    return jsonify({
        "total": float(data_store["Consumption"].sum()),
        "avg": float(data_store["Consumption"].mean()),
        "bill": float(data_store["Bill"].sum()),
        "records": len(data_store)
    })


# =========================
# GET DATA (NO DUPLICATES)
# =========================
@app.route("/api/data")
def get_data():
    if data_store.empty:
        return jsonify([])

    df = data_store.sort_values(["Year", "Month"]).reset_index(drop=True)
    return jsonify(df.to_dict("records"))


# =========================
# UPLOAD (FIXED TSV/CSV AUTO DETECT)
# =========================
@app.route("/api/upload", methods=["POST"])
def upload():
    global data_store

    try:
        if "file" not in request.files:
            return jsonify({"error": "Missing file upload"}), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({"error": "Missing file upload"}), 400

        content = file.read()

        # FIX: auto-detect CSV / TSV
        try:
            df = pd.read_csv(io.BytesIO(content), sep=None, engine="python")
        except:
            try:
                df = pd.read_json(io.BytesIO(content))
            except:
                return jsonify({"error": "Unsupported file format"}), 400

        # normalize column names
        df.columns = [c.strip().lower() for c in df.columns]

        def find(col_list):
            for c in df.columns:
                for n in col_list:
                    if n in c:
                        return c
            return None

        y = find(["year"])
        m = find(["month"])
        c = find(["consumption"])
        b = find(["bill"])

        if not all([y, m, c, b]):
            return jsonify({"error": "Missing required columns"}), 400

        df = df[[y, m, c, b]]
        df.columns = ["Year", "Month", "Consumption", "Bill"]

        data_store = pd.concat([data_store, df], ignore_index=True)

        return jsonify({"rows_added": len(df)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================
# ANOMALY
# =========================
@app.route("/api/anomaly")
def anomaly():

    if data_store.empty:
        return jsonify([])

    mean = data_store["Consumption"].mean()
    std = data_store["Consumption"].std()

    threshold = mean + (2 * std if std > 0 else 0)

    df = data_store.copy()
    df["status"] = df["Consumption"].apply(
        lambda x: "ANOMALY" if x > threshold else "NORMAL"
    )

    return jsonify(df.to_dict("records"))


# =========================
# FORECAST
# =========================
@app.route("/api/forecast")
def forecast():

    if data_store.empty or len(data_store) < 3:
        return jsonify({"error": "Need at least 3 records"})

    df = data_store.sort_values(["Year", "Month"]).reset_index(drop=True)

    history = df["Bill"].tolist()

    X = np.column_stack([
        np.arange(len(df)),
        df["Month"].values
    ])

    last_month = int(df["Month"].iloc[-1])
    last_index = len(df)

    future_X = []
    labels = []

    for i in range(3):
        month = ((last_month + i - 1) % 12) + 1
        future_X.append([last_index + i, month])
        labels.append(f"F{i+1}")

    future = model.predict(np.array(future_X)).tolist()

    return jsonify({
        "labels": [f"{r.Year}-{r.Month}" for _, r in df.iterrows()] + labels,
        "history_actual": history,
        "future_bill": future
    })


# =========================
# MAINTENANCE
# =========================
@app.route("/api/maintenance", methods=["POST"])
def maintenance():

    try:
        data = request.json

        base_date = datetime.strptime(
            data["date"],
            "%Y-%m-%d"
        )

        next_date = base_date + timedelta(days=90)

        return jsonify({
            "next_maintenance": next_date.strftime("%Y-%m-%d")
        })

    except:
        return jsonify({"error": "Invalid date format"}), 400


# =========================
# RESET
# =========================
@app.route("/api/reset", methods=["POST"])
def reset():
    global data_store
    data_store = data_store.iloc[0:0]
    return jsonify({"message": "reset done"})


# =========================
# RUN
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
