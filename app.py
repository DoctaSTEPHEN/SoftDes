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
# STORAGE
# =========================
DATA_PATH = "data/storage.csv"

REQUIRED_COLUMNS = [
    "Year",
    "Month",
    "Total Consumption (Cubic Meters)",
    "Bill Amount"
]

def init_storage():
    os.makedirs("data", exist_ok=True)
    if not os.path.exists(DATA_PATH):
        df = pd.DataFrame(columns=REQUIRED_COLUMNS + ["Date"])
        df.to_csv(DATA_PATH, index=False)

init_storage()

def load_data():
    return pd.read_csv(DATA_PATH)

def save_data(df):
    df.to_csv(DATA_PATH, index=False)

def validate_columns(df):
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    return missing

# =========================
# FRONTEND
# =========================
@app.route("/")
def index():
    return render_template("index.html")

# =========================
# ADD SINGLE RECORD
# =========================
@app.route("/api/add", methods=["POST"])
def add():
    try:
        data = request.json
        df = load_data()

        new_row = {
            "Year": int(data["Year"]),
            "Month": int(data["Month"]),
            "Total Consumption (Cubic Meters)": float(data["Consumption"]),
            "Bill Amount": float(data["Bill"]),
            "Date": datetime.now().isoformat()
        }

        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        save_data(df)

        return jsonify({"message": "Record added"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================
# FILE UPLOAD (CSV / JSON)
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
            return jsonify({"error": "Only CSV and JSON allowed"}), 400

        missing = validate_columns(df_new)
        if missing:
            return jsonify({
                "error": "Invalid file format",
                "missing_columns": missing
            }), 400

        df = load_data()
        df = pd.concat([df, df_new], ignore_index=True)
        save_data(df)

        return jsonify({
            "message": "Upload successful",
            "rows_added": len(df_new)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================
# DASHBOARD
# =========================
@app.route("/api/dashboard")
def dashboard():
    df = load_data()

    if df.empty:
        return jsonify({"message": "No data"})

    return jsonify({
        "total": float(df["Total Consumption (Cubic Meters)"].sum()),
        "avg": float(df["Total Consumption (Cubic Meters)"].mean()),
        "bill": float(df["Bill Amount"].sum()),
        "count": len(df)
    })

# =========================
# REPORTS
# =========================
@app.route("/api/data")
def data():
    df = load_data()
    return jsonify(df.to_dict(orient="records"))

# =========================
# FORECAST (HISTORY + FUTURE)
# =========================
@app.route("/api/forecast")
def forecast():
    df = load_data()

    if len(df) < 3:
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
# ANOMALY DETECTION
# =========================
@app.route("/api/anomaly")
def anomaly():
    df = load_data()

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
# MAINTENANCE ALERT
# =========================
@app.route("/api/maintenance")
def maintenance():
    df = load_data()

    if df.empty:
        return jsonify({"alert": False})

    last_month = int(df.iloc[-1]["Month"])

    if last_month % 3 == 0:
        return jsonify({
            "alert": True,
            "message": "Quarterly maintenance due!"
        })

    return jsonify({"alert": False})

# =========================
# RUN
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
