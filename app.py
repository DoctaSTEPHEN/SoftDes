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

# =====================================
# MODEL
# =====================================
try:
    model = joblib.load("model/gb_model.pkl")
except:
    from sklearn.ensemble import GradientBoostingRegressor
    model = GradientBoostingRegressor()
    model.fit([[0, 1], [1, 2], [2, 3]], [1000, 1500, 2000])

# =====================================
# DATA STORE
# =====================================
data_store = pd.DataFrame(
    columns=["Year", "Month", "Consumption", "Bill"]
)

# =====================================
# HOME
# =====================================
@app.route("/")
def home():
    return render_template("index.html")


# =====================================
# ADD RECORD
# =====================================
@app.route("/api/add", methods=["POST"])
def add_record():
    global data_store

    try:
        data = request.json

        row = {
            "Year": int(data["Year"]),
            "Month": int(data["Month"]),
            "Consumption": float(data["Consumption"]),
            "Bill": float(data["Bill"])
        }

        data_store = pd.concat(
            [data_store, pd.DataFrame([row])],
            ignore_index=True
        )

        return jsonify({"message": "added"})

    except Exception as e:
        return jsonify({"error": str(e)}), 400


# =====================================
# UPLOAD FILE
# =====================================
@app.route("/api/upload", methods=["POST"])
def upload_file():
    global data_store

    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({"error": "No selected file"}), 400

        content = file.read()

        if file.filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.lower().endswith(".json"):
            df = pd.read_json(io.BytesIO(content))
        else:
            return jsonify({"error": "Only CSV or JSON"}), 400

        df.columns = [x.strip() for x in df.columns]

        required = ["Year", "Month", "Consumption", "Bill"]

        for col in required:
            if col not in df.columns:
                return jsonify({"error": f"Missing {col} column"}), 400

        df = df[required]

        data_store = pd.concat(
            [data_store, df],
            ignore_index=True
        )

        return jsonify({"message": "uploaded"})

    except Exception as e:
        return jsonify({"error": str(e)}), 400


# =====================================
# DASHBOARD
# =====================================
@app.route("/api/dashboard")
def dashboard():

    if data_store.empty:
        return jsonify({
            "total": 0,
            "avg": 0,
            "bill": 0
        })

    return jsonify({
        "total": float(data_store["Consumption"].sum()),
        "avg": float(data_store["Consumption"].mean()),
        "bill": float(data_store["Bill"].mean())
    })


# =====================================
# GET DATA
# =====================================
@app.route("/api/data")
def get_data():

    if data_store.empty:
        return jsonify([])

    df = data_store.sort_values(
        ["Year", "Month"]
    ).reset_index(drop=True)

    return jsonify(df.to_dict("records"))


# =====================================
# DELETE SINGLE ROW
# =====================================
@app.route("/api/delete/<int:index>", methods=["POST"])
def delete_row(index):
    global data_store

    try:
        if index < 0 or index >= len(data_store):
            return jsonify({"error": "Invalid row"}), 400

        data_store = data_store.drop(
            data_store.index[index]
        ).reset_index(drop=True)

        return jsonify({"message": "deleted"})

    except Exception as e:
        return jsonify({"error": str(e)}), 400


# =====================================
# EDIT ROW
# =====================================
@app.route("/api/edit/<int:index>", methods=["POST"])
def edit_row(index):
    global data_store

    try:
        data = request.json

        data_store.loc[index, "Year"] = int(data["Year"])
        data_store.loc[index, "Month"] = int(data["Month"])
        data_store.loc[index, "Consumption"] = float(data["Consumption"])
        data_store.loc[index, "Bill"] = float(data["Bill"])

        return jsonify({"message": "updated"})

    except Exception as e:
        return jsonify({"error": str(e)}), 400


# =====================================
# FORECAST
# =====================================
@app.route("/api/forecast")
def forecast():

    if len(data_store) < 3:
        return jsonify({"error": "Need 3 records"})

    try:
        df = data_store.sort_values(
            ["Year", "Month"]
        ).reset_index(drop=True)

        history = df["Bill"].astype(float).tolist()

        X = np.column_stack([
            np.arange(len(df)),
            df["Month"].astype(int).values,
            df["Consumption"].astype(float).values
        ])

        y = df["Bill"].astype(float).values

        model.fit(X, y)

        last_index = len(df)
        last_month = int(df["Month"].iloc[-1])

        avg_cons = float(df["Consumption"].tail(6).mean())

        future_X = []
        labels = []

        for i in range(1, 4):
            month = ((last_month + i - 1) % 12) + 1

            future_X.append([
                last_index + i,
                month,
                avg_cons
            ])

            labels.append(f"F{i}")

        pred = model.predict(np.array(future_X))

        pred = [round(float(x), 2) for x in pred]

        old_labels = [
            f"{int(r.Year)}-{int(r.Month):02d}"
            for _, r in df.iterrows()
        ]

        return jsonify({
            "labels": old_labels + labels,
            "history_actual": history,
            "future_bill": pred
        })

    except Exception as e:
        return jsonify({"error": str(e)})


# =====================================
# ANOMALY CHECK
# BOTH CONSUMPTION + BILL
# =====================================
@app.route("/api/anomaly")
def anomaly():

    if data_store.empty:
        return jsonify([])

    df = data_store.copy()

    c_mean = df["Consumption"].mean()
    c_std = df["Consumption"].std()

    b_mean = df["Bill"].mean()
    b_std = df["Bill"].std()

    if pd.isna(c_std):
        c_std = 0

    if pd.isna(b_std):
        b_std = 0

    c_limit = c_mean + (1.5 * c_std)
    b_limit = b_mean + (1.5 * b_std)

    def detect(row):
        if row["Consumption"] > c_limit:
            return "ANOMALY"
        if row["Bill"] > b_limit:
            return "ANOMALY"
        return "NORMAL"

    df["status"] = df.apply(detect, axis=1)

    return jsonify(df.to_dict("records"))


# =====================================
# RESET ALL
# =====================================
@app.route("/api/reset", methods=["POST"])
def reset():
    global data_store

    data_store = data_store.iloc[0:0]

    return jsonify({"message": "reset done"})


# =====================================
# MAINTENANCE DATE +90 DAYS
# =====================================
@app.route("/api/maintenance", methods=["POST"])
def maintenance():

    try:
        data = request.json

        base = datetime.strptime(
            data["date"],
            "%Y-%m-%d"
        )

        next_date = base + timedelta(days=90)

        return jsonify({
            "next_maintenance":
            next_date.strftime("%Y-%m-%d")
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400


# =====================================
# RUN
# =====================================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
