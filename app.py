from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import os
import joblib
from datetime import datetime

app = Flask(__name__)

# =========================
# MODEL
# =========================
model = joblib.load("model/gb_model.pkl")

# =========================
# DATA STORAGE
# =========================
DATA_PATH = "data/storage.csv"

COLUMNS = [
    "Year",
    "Month",
    "Total Consumption (Cubic Meters)",
    "Bill Amount"
]

def init():
    os.makedirs("data", exist_ok=True)
    if not os.path.exists(DATA_PATH):
        df = pd.DataFrame(columns=COLUMNS)
        df.to_csv(DATA_PATH, index=False)

init()

def load():
    return pd.read_csv(DATA_PATH)

def save(df):
    df.to_csv(DATA_PATH, index=False)

# =========================
# FRONTEND
# =========================
@app.route("/")
def home():
    return render_template("index.html")

# =========================
# ADD RECORD
# =========================
@app.route("/api/add", methods=["POST"])
def add():
    try:
        d = request.json
        df = load()

        new_row = {
            "Year": int(d["Year"]),
            "Month": int(d["Month"]),
            "Total Consumption (Cubic Meters)": float(d["Consumption"]),
            "Bill Amount": float(d["Bill"]),
        }

        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        save(df)

        return jsonify({"message": "Record added successfully"})

    except Exception as e:
        return jsonify({"error": str(e)})

# =========================
# UPLOAD FILE
# =========================
@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        file = request.files["file"]
        ext = file.filename.split(".")[-1].lower()

        if ext == "csv":
            df_new = pd.read_csv(file)
        elif ext == "json":
            df_new = pd.read_json(file)
        else:
            return jsonify({"error": "Only CSV and JSON allowed"})

        missing = [c for c in COLUMNS if c not in df_new.columns]
        if missing:
            return jsonify({
                "error": "Invalid format",
                "missing": missing
            })

        df = load()
        df = pd.concat([df, df_new], ignore_index=True)
        save(df)

        return jsonify({"message": "File uploaded successfully", "rows": len(df_new)})

    except Exception as e:
        return jsonify({"error": str(e)})

# =========================
# DASHBOARD
# =========================
@app.route("/api/dashboard")
def dashboard():
    df = load()

    if df.empty:
        return jsonify({"error": "No data"})

    return jsonify({
        "total": float(df["Total Consumption (Cubic Meters)"].sum()),
        "avg": float(df["Total Consumption (Cubic Meters)"].mean()),
        "bill": float(df["Bill Amount"].sum()),
        "count": len(df)
    })

# =========================
# FORECAST (FIXED)
# =========================
@app.route("/api/forecast")
def forecast():
    df = load()

    if len(df) < 2:
        return jsonify({"error": "Not enough data"})

    X = np.arange(len(df)).reshape(-1, 1)

    history_pred = model.predict(X)

    future_X = np.arange(len(df), len(df) + 3).reshape(-1, 1)
    future_pred = model.predict(future_X)

    return jsonify({
        "history_actual": df["Total Consumption (Cubic Meters)"].tolist(),
        "history_predicted": history_pred.tolist(),
        "future_3_months": future_pred.tolist()
    })

# =========================
# REPORTS
# =========================
@app.route("/api/data")
def data():
    df = load()
    return jsonify(df.to_dict(orient="records"))

# =========================
# ANOMALY
# =========================
@app.route("/api/anomaly")
def anomaly():
    df = load()

    if df.empty:
        return jsonify([])

    mean = df["Total Consumption (Cubic Meters)"].mean()
    std = df["Total Consumption (Cubic Meters)"].std()
    threshold = mean + (1.5 * std)

    df["status"] = df["Total Consumption (Cubic Meters)"].apply(
        lambda x: "ANOMALY" if x > threshold else "NORMAL"
    )

    return jsonify(df.to_dict(orient="records"))

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
