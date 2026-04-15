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
    model.fit([[0, 1], [1, 2], [2, 3]], [100, 120, 140])
    print("⚠️ Dummy trained model used")

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
# ADD RECORD
# =========================
@app.route("/api/add", methods=["POST"])
def add_record():
    global data_store
    data = request.json

    try:
        new_row = {
            "Year": int(data["Year"]),
            "Month": int(data["Month"]),
            "Consumption": float(data["Consumption"]),
            "Bill": float(data["Bill"])
        }

        data_store = pd.concat([data_store, pd.DataFrame([new_row])], ignore_index=True)

        return jsonify({"message": "added", "rows": len(data_store)})

    except Exception as e:
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
        return jsonify({"total": 0, "avg": 0, "bill": 0})

    return jsonify({
        "total": float(data_store["Consumption"].sum()),
        "avg": float(data_store["Consumption"].mean()),
        "bill": float(data_store["Bill"].sum())
    })

# =========================
# UPLOAD FIXED
# =========================
@app.route("/api/upload", methods=["POST"])
def upload():
    global data_store

    try:
        file = request.files["file"]
        content = file.read()

        try:
            df = pd.read_csv(io.BytesIO(content))
        except:
            df = pd.read_json(io.BytesIO(content))

        df.columns = [c.strip().lower() for c in df.columns]

        def find(col_list):
            for c in df.columns:
                for n in col_list:
                    if n in c:
                        return c
            return None

        y = find(["year"])
        m = find(["month"])
        c = find(["consumption", "usage"])
        b = find(["bill", "amount"])

        df = df[[y, m, c, b]]
        df.columns = ["Year", "Month", "Consumption", "Bill"]

        data_store = pd.concat([data_store, df], ignore_index=True)

        return jsonify({"rows_added": len(df)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================
# FORECAST (BILL ONLY)
# =========================
@app.route("/api/forecast")
def forecast():
    if data_store.empty or len(data_store) < 3:
        return jsonify({"error": "Need at least 3 records"})

    df = data_store.sort_values(["Year", "Month"]).reset_index(drop=True)

    history_bill = df["Bill"].tolist()

    X = np.column_stack([
        np.arange(len(df)),
        df["Month"].values
    ])

    last_index = len(df)
    last_month = int(df["Month"].iloc[-1])

    future_X = []
    labels = []

    for i in range(3):
        idx = last_index + i
        month = ((last_month + i - 1) % 12) + 1

        future_X.append([idx, month])
        labels.append(f"F{i+1}")

    future_bill = model.predict(np.array(future_X)).tolist()

    return jsonify({
        "labels": [f"{r.Year}-{r.Month}" for _, r in df.iterrows()] + labels,
        "history_actual": history_bill,
        "future_bill": future_bill
    })

# =========================
# ANOMALY
# =========================
@app.route("/api/anomaly")
def anomaly():
    if data_store.empty:
        return jsonify([])

    mean = data_store["Consumption"].mean()
    std = data_store["Consumption"].std()

    threshold = mean + 2 * std if std > 0 else mean

    df = data_store.copy()
    df["status"] = df["Consumption"].apply(lambda x: "ANOMALY" if x > threshold else "NORMAL")

    return jsonify(df.to_dict("records"))

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(debug=True)
