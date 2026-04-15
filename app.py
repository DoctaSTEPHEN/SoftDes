from flask import Flask, render_template, request, jsonify
from pymongo import MongoClient
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
# MONGODB SETUP (SAFE)
# =========================
MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise Exception("MONGO_URI not set in environment variables")

client = MongoClient(MONGO_URI)

db = client["water_db"]
collection = db["records"]

# =========================
# HOME PAGE
# =========================
@app.route("/")
def home():
    return render_template("index.html")

# =========================
# SAFE DATA FETCH
# =========================
def get_dataframe():
    data = list(collection.find({}, {"_id": 0}))
    df = pd.DataFrame(data)

    if df.empty:
        return df

    # ensure correct types
    try:
        df["Year"] = df["Year"].astype(int)
        df["Month"] = df["Month"].astype(int)
        df["Consumption"] = df["Consumption"].astype(float)
        df["Bill"] = df["Bill"].astype(float)
    except:
        pass

    return df

# =========================
# ADD SINGLE RECORD
# =========================
@app.route("/api/add", methods=["POST"])
def add_record():
    try:
        data = request.json

        if not data:
            return jsonify({"error": "No input data"}), 400

        record = {
            "Year": int(data["Year"]),
            "Month": int(data["Month"]),
            "Consumption": float(data["Consumption"]),
            "Bill": float(data["Bill"]),
            "created_at": datetime.now().isoformat()
        }

        collection.insert_one(record)

        return jsonify({
            "message": "Record added successfully"
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to add record",
            "details": str(e)
        }), 500

# =========================
# GET ALL DATA
# =========================
@app.route("/api/data")
def get_data():
    df = get_dataframe()
    return jsonify(df.to_dict("records"))

# =========================
# DASHBOARD
# =========================
@app.route("/api/dashboard")
def dashboard():
    df = get_dataframe()

    if df.empty:
        return jsonify({"message": "No data yet"})

    return jsonify({
        "total": float(df["Consumption"].sum()),
        "avg": float(df["Consumption"].mean()),
        "bill": float(df["Bill"].sum()),
        "count": len(df)
    })

# =========================
# UPLOAD (CSV + JSON FIXED)
# =========================
@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        filename = file.filename.lower()

        # -------- READ FILE --------
        if filename.endswith(".csv"):
            df = pd.read_csv(file)
        elif filename.endswith(".json"):
            df = pd.read_json(file)
        else:
            return jsonify({"error": "Only CSV and JSON allowed"}), 400

        # -------- VALIDATE COLUMNS --------
        required = ["Year", "Month", "Consumption", "Bill"]
        missing = [c for c in required if c not in df.columns]

        if missing:
            return jsonify({
                "error": "Invalid file format",
                "missing_columns": missing,
                "required": required
            }), 400

        df = df[required].dropna()

        # -------- TYPE SAFETY --------
        df["Year"] = df["Year"].astype(int)
        df["Month"] = df["Month"].astype(int)
        df["Consumption"] = df["Consumption"].astype(float)
        df["Bill"] = df["Bill"].astype(float)

        # -------- INSERT --------
        collection.insert_many(df.to_dict("records"))

        return jsonify({
            "message": "Upload successful",
            "rows_uploaded": len(df)
        })

    except Exception as e:
        return jsonify({
            "error": "Upload failed",
            "details": str(e)
        }), 500

# =========================
# FORECAST (SAFE + FIXED)
# =========================
@app.route("/api/forecast")
def forecast():
    df = get_dataframe()

    if df.empty or len(df) < 3:
        return jsonify({"error": "Not enough data for forecasting"})

    try:
        X = np.arange(len(df)).reshape(-1, 1)

        history_pred = model.predict(X)

        future_X = np.arange(len(df), len(df) + 3).reshape(-1, 1)
        future_pred = model.predict(future_X)

        return jsonify({
            "history_actual": df["Consumption"].tolist(),
            "history_predicted": history_pred.tolist(),
            "future_3_months": future_pred.tolist()
        })

    except Exception as e:
        return jsonify({
            "error": "Forecast failed",
            "details": str(e)
        }), 500

# =========================
# VISUALIZATION
# =========================
@app.route("/api/visualize")
def visualize():
    df = get_dataframe()

    return jsonify({
        "months": df["Month"].tolist() if not df.empty else [],
        "consumption": df["Consumption"].tolist() if not df.empty else [],
        "bill": df["Bill"].tolist() if not df.empty else []
    })

# =========================
# ANOMALY DETECTION (IMPROVED)
# =========================
@app.route("/api/anomaly")
def anomaly():
    df = get_dataframe()

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
