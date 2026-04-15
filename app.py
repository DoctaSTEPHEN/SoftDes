from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import os
import joblib
from datetime import datetime

app = Flask(__name__)

DATA_PATH = "data/storage.csv"

# -----------------------------
# LOAD MODEL
# -----------------------------
model = joblib.load("model/gb_model.pkl")


# -----------------------------
# INIT STORAGE
# -----------------------------
def init_storage():
    if not os.path.exists(DATA_PATH):
        df = pd.DataFrame(columns=[
            "Year", "Month", "Consumption", "Bill", "Branch", "DateAdded"
        ])
        df.to_csv(DATA_PATH, index=False)

init_storage()


# -----------------------------
# LOAD DATA
# -----------------------------
def load_data():
    return pd.read_csv(DATA_PATH)


def save_data(df):
    df.to_csv(DATA_PATH, index=False)


# -----------------------------
# DASHBOARD
# -----------------------------
@app.route("/dashboard", methods=["GET"])
def dashboard():
    df = load_data()

    if df.empty:
        return jsonify({"message": "No data yet"})

    total_usage = df["Consumption"].sum()
    avg_usage = df["Consumption"].mean()
    total_bill = df["Bill"].sum()

    return jsonify({
        "total_usage": total_usage,
        "avg_usage": avg_usage,
        "total_bill": total_bill,
        "entries": len(df)
    })


# -----------------------------
# RECORD (MANUAL INPUT)
# -----------------------------
@app.route("/record/manual", methods=["POST"])
def add_record():
    try:
        data = request.json

        df = load_data()

        new_entry = {
            "Year": data["Year"],
            "Month": data["Month"],
            "Consumption": data["Consumption"],
            "Bill": data["Bill"],
            "Branch": data.get("Branch", "Main"),
            "DateAdded": datetime.now()
        }

        df = pd.concat([df, pd.DataFrame([new_entry])], ignore_index=True)

        save_data(df)

        return jsonify({"message": "Record added successfully"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# RECORD (UPLOAD CSV)
# -----------------------------
@app.route("/record/upload", methods=["POST"])
def upload_file():
    try:
        file = request.files["file"]
        df_new = pd.read_csv(file)

        df = load_data()

        df = pd.concat([df, df_new], ignore_index=True)

        save_data(df)

        return jsonify({"message": "File uploaded successfully"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# REPORTS (GET ALL DATA)
# -----------------------------
@app.route("/reports", methods=["GET"])
def get_reports():
    df = load_data()
    return df.to_json(orient="records")


# -----------------------------
# DELETE RECORD
# -----------------------------
@app.route("/reports/delete/<int:index>", methods=["DELETE"])
def delete_record(index):
    df = load_data()

    if index >= len(df):
        return jsonify({"error": "Invalid index"}), 400

    df = df.drop(index).reset_index(drop=True)
    save_data(df)

    return jsonify({"message": "Deleted successfully"})


# -----------------------------
# UPDATE RECORD
# -----------------------------
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


# -----------------------------
# FORECAST
# -----------------------------
@app.route("/forecast", methods=["GET"])
def forecast_data():
    df = load_data()

    if df.empty:
        return jsonify({"error": "No data"}), 400

    n = len(df)

    time_idx = np.arange(n).reshape(-1, 1)
    month = df["Month"].values.reshape(-1, 1)

    X = np.hstack([time_idx, month])

    preds = model.predict(X)

    return jsonify({"forecast": preds.tolist()})


# -----------------------------
# VISUALIZATION DATA
# -----------------------------
@app.route("/visualize", methods=["GET"])
def visualize():
    df = load_data()

    return jsonify({
        "months": df["Month"].tolist(),
        "consumption": df["Consumption"].tolist(),
        "bill": df["Bill"].tolist()
    })


# -----------------------------
# ANOMALY DETECTION
# -----------------------------
@app.route("/anomaly", methods=["GET"])
def anomaly():
    df = load_data()

    avg = df["Consumption"].mean()

    flags = [
        "Anomaly" if x > avg * 1.5 else "Normal"
        for x in df["Consumption"]
    ]

    return jsonify(flags)


# -----------------------------
# RUN
# -----------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
