from flask import Flask, render_template, request, jsonify
from pymongo import MongoClient
import pandas as pd
import numpy as np
import joblib
import os
from datetime import datetime

app = Flask(__name__)

# =========================
# MODEL
# =========================
model = joblib.load("model/gb_model.pkl")

# =========================
# MONGODB SETUP
# =========================
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)

db = client["water_db"]
collection = db["records"]

# =========================
# FRONTEND
# =========================
@app.route("/")
def home():
    return render_template("index.html")

# =========================
# ADD SINGLE RECORD
# =========================
@app.route("/api/add", methods=["POST"])
def add_record():
    try:
        data = request.json

        record = {
            "Year": int(data["Year"]),
            "Month": int(data["Month"]),
            "Consumption": float(data["Consumption"]),
            "Bill": float(data["Bill"]),
            "created_at": datetime.now()
        }

        collection.insert_one(record)

        return jsonify({"message": "Record added successfully"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================
# GET ALL DATA
# =========================
@app.route("/api/data")
def get_data():
    data = list(collection.find({}, {"_id": 0}))
    return jsonify(data)

# =========================
# DASHBOARD
# =========================
@app.route("/api/dashboard")
def dashboard():
    data = list(collection.find({}, {"_id": 0}))
    df = pd.DataFrame(data)

    if df.empty:
        return jsonify({"message": "No data yet"})

    return jsonify({
        "total": float(df["Consumption"].sum()),
        "avg": float(df["Consumption"].mean()),
        "bill": float(df["Bill"].sum()),
        "count": len(df)
    })

# =========================
# UPLOAD FILE (CSV / JSON)
# =========================
@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        file = request.files["file"]
        ext = file.filename.split(".")[-1].lower()

        if ext == "csv":
            df = pd.read_csv(file)
        elif ext == "json":
            df = pd.read_json(file)
        else:
            return jsonify({"error": "Only CSV and JSON allowed"}), 400

        required = ["Year", "Month", "Consumption", "Bill"]
        missing = [c for c in required if c not in df.columns]

        if missing:
            return jsonify({
                "error": "Invalid file format",
                "missing": missing
            }), 400

        collection.insert_many(df.to_dict("records"))

        return jsonify({
            "message": "Upload successful",
            "rows": len(df)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================
# FORECAST (WORKING FIXED)
# =========================
@app.route("/api/forecast")
def forecast():
    data = list(collection.find({}, {"_id": 0}))
    df = pd.DataFrame(data)

    if df.empty or len(df) < 3:
        return jsonify({"error": "Not enough data"})

    X = np.arange(len(df)).reshape(-1, 1)

    history_pred = model.predict(X)

    future_X = np.arange(len(df), len(df) + 3).reshape(-1, 1)
    future_pred = model.predict(future_X)

    return jsonify({
        "history_actual": df["Consumption"].tolist(),
        "history_predicted": history_pred.tolist(),
        "future_3_months": future_pred.tolist()
    })

# =========================
# VISUALIZATION DATA
# =========================
@app.route("/api/visualize")
def visualize():
    data = list(collection.find({}, {"_id": 0}))
    df = pd.DataFrame(data)

    return jsonify({
        "months": df["Month"].tolist() if not df.empty else [],
        "consumption": df["Consumption"].tolist() if not df.empty else [],
        "bill": df["Bill"].tolist() if not df.empty else []
    })

# =========================
# ANOMALY DETECTION
# =========================
@app.route("/api/anomaly")
def anomaly():
    data = list(collection.find({}, {"_id": 0}))
    df = pd.DataFrame(data)

    if df.empty:
        return jsonify([])

    mean = df["Consumption"].mean()
    std = df["Consumption"].std()
    threshold = mean + (1.5 * std)

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
