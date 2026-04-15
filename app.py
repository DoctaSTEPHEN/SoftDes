from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import os
import joblib
from datetime import datetime
from pymongo import MongoClient

app = Flask(__name__)

# =============================
# CONFIG
# =============================
DATA_PATH = "data/storage.csv"

# =============================
# SAFE MODEL LOADING
# =============================
try:
    model = joblib.load("model/gb_model.pkl")
except Exception as e:
    model = None
    print("Model load failed:", e)

# =============================
# MONGO SAFE CONNECTION
# =============================
MONGO_URI = os.getenv("MONGO_URI")

client = None
db = None
collection = None

if MONGO_URI:
    try:
        client = MongoClient(MONGO_URI)
        db = client["water_db"]
        collection = db["records"]
    except Exception as e:
        print("MongoDB connection failed:", e)

# =============================
# INIT STORAGE
# =============================
def init_storage():
    os.makedirs("data", exist_ok=True)

    if not os.path.exists(DATA_PATH):
        df = pd.DataFrame(columns=[
            "Year", "Month", "Consumption", "Bill", "Branch", "DateAdded"
        ])
        df.to_csv(DATA_PATH, index=False)

init_storage()

# =============================
# LOAD / SAVE CSV
# =============================
def load_data():
    try:
        return pd.read_csv(DATA_PATH)
    except:
        return pd.DataFrame()

def save_data(df):
    df.to_csv(DATA_PATH, index=False)

# =============================
# ROOT (FIXED ERROR)
# =============================
@app.route("/")
def home():
    return jsonify({
        "message": "Water API is running 🚀",
        "routes": [
            "/dashboard",
            "/record/manual",
            "/record/upload",
            "/reports",
            "/forecast",
            "/visualize",
            "/anomaly"
        ]
    })

# =============================
# DASHBOARD
# =============================
@app.route("/dashboard")
def dashboard():
    df = load_data()

    if df.empty:
        return jsonify({"message": "No data yet"})

    return jsonify({
        "total_usage": float(df["Consumption"].sum()),
        "avg_usage": float(df["Consumption"].mean()),
        "total_bill": float(df["Bill"].sum()),
        "entries": len(df)
    })

# =============================
# ADD RECORD
# =============================
@app.route("/record/manual", methods=["POST"])
def add_record():
    try:
        data = request.json

        new_entry = {
            "Year": data["Year"],
            "Month": data["Month"],
            "Consumption": data["Consumption"],
            "Bill": data["Bill"],
            "Branch": data.get("Branch", "Main"),
            "DateAdded": datetime.now().isoformat()
        }

        df = load_data()
        df = pd.concat([df, pd.DataFrame([new_entry])], ignore_index=True)
        save_data(df)

        if collection is not None:
            collection.insert_one(new_entry)

        return jsonify({"message": "Record added successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =============================
# UPLOAD CSV
# =============================
@app.route("/record/upload", methods=["POST"])
def upload_file():
    try:
        file = request.files["file"]
        df_new = pd.read_csv(file)

        df = load_data()
        df = pd.concat([df, df_new], ignore_index=True)
        save_data(df)

        if collection is not None:
            collection.insert_many(df_new.to_dict(orient="records"))

        return jsonify({"message": "File uploaded successfully"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =============================
# REPORTS
# =============================
@app.route("/reports")
def get_reports():
    df = load_data()
    return df.to_json(orient="records")

# =============================
# DELETE
# =============================
@app.route("/reports/delete/<int:index>", methods=["DELETE"])
def delete_record(index):
    df = load_data()

    if index >= len(df):
        return jsonify({"error": "Invalid index"}), 400

    df = df.drop(index).reset_index(drop=True)
    save_data(df)

    return jsonify({"message": "Deleted successfully"})

# =============================
# UPDATE
# =============================
@app.route("/reports/update/<int:index>", methods=["PUT"])
def update_record(index):
    try:
        df = load_data()
        data = request.json

        df.loc[index, "Consumption"] = data["Consumption"]
        df.loc[index, "Bill"] = data["Bill"]

        save_data(df)

        return jsonify({"message": "Updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =============================
# FORECAST
# =============================
@app.route("/forecast")
def forecast_data():
    df = load_data()

    if df.empty:
        return jsonify({"error": "No data"}), 400

    if model is None:
        return jsonify({"error": "Model not loaded"}), 500

    n = len(df)

    time_idx = np.arange(n).reshape(-1, 1)
    month = df["Month"].values.reshape(-1, 1)

    X = np.hstack([time_idx, month])

    preds = model.predict(X)

    return jsonify({
        "forecast": preds.tolist(),
        "next_month": float(preds[-1])
    })

# =============================
# VISUALIZATION
# =============================
@app.route("/visualize")
def visualize():
    df = load_data()

    return jsonify({
        "months": df["Month"].tolist(),
        "consumption": df["Consumption"].tolist(),
        "bill": df["Bill"].tolist()
    })

# =============================
# ANOMALY DETECTION
# =============================
@app.route("/anomaly")
def anomaly():
    df = load_data()

    if df.empty:
        return jsonify({"error": "No data"})

    mean = df["Consumption"].mean()
    std = df["Consumption"].std()

    threshold = mean + (1.5 * std)

    df["status"] = df["Consumption"].apply(
        lambda x: "Anomaly" if x > threshold else "Normal"
    )

    return jsonify(df[["Month", "Consumption", "status"]].to_dict(orient="records"))

# =============================
# RUN
# =============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
