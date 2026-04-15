from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import joblib
import os
from datetime import datetime

app = Flask(__name__)

# =========================
# LOAD MODEL
# =========================
model = joblib.load("model/gb_model.pkl")

# =========================
# IN-MEMORY STORAGE (NO DB)
# =========================
data_store = pd.DataFrame(columns=[
    "Year", "Month", "Consumption", "Bill"
])

# =========================
# HOME
# =========================
@app.route("/")
def home():
    return render_template("index.html")

# =========================
# ADD RECORD
# =========================
@app.route("/api/add", methods=["POST"])
def add_record():
    try:
        global data_store

        data = request.json

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

        return jsonify({"message": "Record added successfully"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        return jsonify({"message": "No data yet"})

    return jsonify({
        "total": float(data_store["Consumption"].sum()),
        "avg": float(data_store["Consumption"].mean()),
        "bill": float(data_store["Bill"].sum()),
        "count": len(data_store)
    })

# =========================
# UPLOAD CSV / JSON (FIXED)
# =========================
@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        global data_store

        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        filename = file.filename.lower()

        # READ FILE
        if filename.endswith(".csv"):
            df = pd.read_csv(file)
        elif filename.endswith(".json"):
            df = pd.read_json(file)
        else:
            return jsonify({"error": "Only CSV and JSON allowed"}), 400

        # REQUIRED COLUMNS
        required = ["Year", "Month", "Consumption", "Bill"]

        missing = [c for c in required if c not in df.columns]
        if missing:
            return jsonify({
                "error": "Invalid file format",
                "missing": missing
            }), 400

        df = df[required].dropna()

        # TYPE FIX
        df["Year"] = df["Year"].astype(int)
        df["Month"] = df["Month"].astype(int)
        df["Consumption"] = df["Consumption"].astype(float)
        df["Bill"] = df["Bill"].astype(float)

        # ADD TO MEMORY
        data_store = pd.concat([data_store, df], ignore_index=True)

        return jsonify({
            "message": "Upload successful",
            "rows_uploaded": len(df)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================
# FORECAST
# =========================
@app.route("/api/forecast")
def forecast():
    if data_store.empty or len(data_store) < 3:
        return jsonify({"error": "Not enough data"})

    X = np.arange(len(data_store)).reshape(-1, 1)

    history_pred = model.predict(X)

    future_X = np.arange(len(data_store), len(data_store) + 3).reshape(-1, 1)
    future_pred = model.predict(future_X)

    return jsonify({
        "history_actual": data_store["Consumption"].tolist(),
        "history_predicted": history_pred.tolist(),
        "future_3_months": future_pred.tolist()
    })

# =========================
# VISUALIZATION
# =========================
@app.route("/api/visualize")
def visualize():
    return jsonify({
        "months": data_store["Month"].tolist(),
        "consumption": data_store["Consumption"].tolist(),
        "bill": data_store["Bill"].tolist()
    })

# =========================
# ANOMALY DETECTION
# =========================
@app.route("/api/anomaly")
def anomaly():
    if data_store.empty:
        return jsonify([])

    mean = data_store["Consumption"].mean()
    std = data_store["Consumption"].std()

    threshold = mean + (1.5 * std)

    df = data_store.copy()
    df["status"] = df["Consumption"].apply(
        lambda x: "ANOMALY" if x > threshold else "NORMAL"
    )

    return jsonify(df.to_dict("records"))

# =========================
# RUN
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
