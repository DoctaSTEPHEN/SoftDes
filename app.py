from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import os
import joblib
from datetime import datetime

app = Flask(__name__)

# =========================
# LOAD MODEL
# =========================
model = joblib.load("model/gb_model.pkl")

DATA_PATH = "data/storage.csv"

# =========================
# INIT STORAGE
# =========================
def init_storage():
    os.makedirs("data", exist_ok=True)

    if not os.path.exists(DATA_PATH):
        df = pd.DataFrame(columns=[
            "Year", "Month", "Consumption", "Bill", "Date"
        ])
        df.to_csv(DATA_PATH, index=False)

init_storage()

def load_data():
    return pd.read_csv(DATA_PATH)

def save_data(df):
    df.to_csv(DATA_PATH, index=False)

# =========================
# HOME PAGE
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
        data = request.json

        df = load_data()

        new_row = {
            "Year": int(data["Year"]),
            "Month": int(data["Month"]),
            "Consumption": float(data["Consumption"]),
            "Bill": float(data["Bill"]),
            "Date": datetime.now().isoformat()
        }

        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        save_data(df)

        return jsonify({"message": "Record added successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================
# GET DATA
# =========================
@app.route("/api/data")
def get_data():
    df = load_data()
    return jsonify(df.to_dict(orient="records"))

# =========================
# DASHBOARD
# =========================
@app.route("/api/dashboard")
def dashboard():
    df = load_data()

    if df.empty:
        return jsonify({"message": "No data"})

    return jsonify({
        "total": df["Consumption"].sum(),
        "avg": df["Consumption"].mean(),
        "bill": df["Bill"].sum(),
        "count": len(df)
    })

# =========================
# FORECAST
# =========================
@app.route("/api/forecast")
def forecast():
    df = load_data()

    if len(df) < 3:
        return jsonify({"error": "Not enough data"})

    X = np.arange(len(df)).reshape(-1, 1)
    y = df["Consumption"].values

    preds = model.predict(X)

    return jsonify({
        "forecast": preds.tolist(),
        "next": float(preds[-1])
    })

# =========================
# ANOMALY DETECTION
# =========================
@app.route("/api/anomaly")
def anomaly():
    df = load_data()

    mean = df["Consumption"].mean()
    std = df["Consumption"].std()

    threshold = mean + 1.5 * std

    df["status"] = df["Consumption"].apply(
        lambda x: "ANOMALY" if x > threshold else "NORMAL"
    )

    return jsonify(df.to_dict(orient="records"))

# =========================
# MAINTENANCE ALERT (QUARTERLY)
# =========================
@app.route("/api/maintenance")
def maintenance():
    df = load_data()

    if df.empty:
        return jsonify({"alert": False})

    latest_month = int(df.iloc[-1]["Month"])

    # every 3 months trigger
    if latest_month % 3 == 0:
        return jsonify({
            "alert": True,
            "message": "Quarterly maintenance required!"
        })

    return jsonify({"alert": False})

# =========================
# RUN
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
