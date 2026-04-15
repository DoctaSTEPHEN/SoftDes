from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import io
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# =========================
# MODEL
# =========================
try:
    model = joblib.load("model/gb_model.pkl")
except:
    from sklearn.ensemble import GradientBoostingRegressor
    model = GradientBoostingRegressor()
    model.fit([[0, 1], [1, 2], [2, 3]], [100, 120, 140])

data_store = pd.DataFrame(columns=["Year", "Month", "Consumption", "Bill"])

# =========================
# HOME
# =========================
@app.route("/")
def home():
    return render_template("index.html")


# =========================
# MAINTENANCE
# =========================
@app.route("/api/maintenance/today")
def maintenance_today():
    try:
        today = datetime.now().strftime("%Y-%m-%d")

        # optional rule: every 90 days from earliest record or fixed cycle
        if data_store.empty:
            return jsonify({"is_today": False})

        # take last record date as base
        last = data_store.iloc[-1]

        base_date = datetime(int(last["Year"]), int(last["Month"]), 1)
        next_maintenance = base_date.replace(day=1)

        # simple quarterly approximation (90 days)
        next_maintenance = next_maintenance + timedelta(days=90)

        is_today = next_maintenance.strftime("%Y-%m-%d") == today

        return jsonify({
            "is_today": is_today,
            "date": next_maintenance.strftime("%Y-%m-%d")
        })

    except Exception as e:
        return jsonify({"error": str(e), "is_today": False})

# =========================
# ADD RECORD (ERROR HANDLING)
# =========================
@app.route("/api/add", methods=["POST"])
def add_record():
    global data_store
    data = request.json

    required = ["Year", "Month", "Consumption", "Bill"]

    # missing entry validation
    for r in required:
        if r not in data or data[r] in ["", None]:
            return jsonify({"error": f"Missing entry value: {r}"}), 400

    try:
        row = {
            "Year": int(data["Year"]),
            "Month": int(data["Month"]),
            "Consumption": float(data["Consumption"]),
            "Bill": float(data["Bill"])
        }

        data_store = pd.concat([data_store, pd.DataFrame([row])], ignore_index=True)

        return jsonify({"message": "added", "rows": len(data_store)})

    except:
        return jsonify({"error": "Invalid input format"}), 400

# =========================
# UPLOAD (FULL ERROR HANDLING)
# =========================
@app.route("/api/upload", methods=["POST"])
def upload():
    global data_store

    try:
        if "file" not in request.files:
            return jsonify({"error": "Missing file upload"}), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({"error": "Missing file upload"}), 400

        if not (file.filename.endswith(".csv") or file.filename.endswith(".json")):
            return jsonify({"error": "Unsupported file upload"}), 400

        content = file.read()

        try:
            df = pd.read_csv(io.BytesIO(content))
        except:
            try:
                df = pd.read_json(io.BytesIO(content))
            except:
                return jsonify({"error": "Unsupported file upload"}), 400

        df.columns = [c.strip().lower() for c in df.columns]

        def find(names):
            for c in df.columns:
                for n in names:
                    if n in c:
                        return c
            return None

        y = find(["year"])
        m = find(["month"])
        c = find(["consumption"])
        b = find(["bill"])

        if not all([y, m, c, b]):
            return jsonify({"error": "Missing required columns"}), 400

        df = df[[y, m, c, b]]
        df.columns = ["Year", "Month", "Consumption", "Bill"]

        data_store = pd.concat([data_store, df], ignore_index=True)

        return jsonify({"rows_added": len(df)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================
# ANOMALY API
# =========================
@app.route("/api/anomaly")
def anomaly():
    if data_store.empty:
        return jsonify([])

    mean = data_store["Consumption"].mean()
    std = data_store["Consumption"].std()
    threshold = mean + 2 * std if std > 0 else mean

    df = data_store.copy()
    df["status"] = df["Consumption"].apply(
        lambda x: "ANOMALY" if x > threshold else "NORMAL"
    )

    return jsonify(df.to_dict("records"))

# =========================
# MAINTENANCE CALCULATOR
# =========================
@app.route("/api/maintenance", methods=["POST"])
def maintenance():
    data = request.json

    try:
        date_str = data.get("date")  # format: YYYY-MM-DD
        base_date = datetime.strptime(date_str, "%Y-%m-%d")

        next_maintenance = base_date + timedelta(days=90)

        return jsonify({
            "next_maintenance": next_maintenance.strftime("%Y-%m-%d")
        })

    except:
        return jsonify({"error": "Invalid date format (use YYYY-MM-DD)"}), 400

# =========================
# FORECAST (BILL ONLY)
# =========================
@app.route("/api/forecast")
def forecast():
    if data_store.empty or len(data_store) < 3:
        return jsonify({"error": "Need at least 3 records"})

    df = data_store.sort_values(["Year", "Month"]).reset_index(drop=True)

    history = df["Bill"].tolist()

    X = np.column_stack([np.arange(len(df)), df["Month"].values])

    last_month = int(df["Month"].iloc[-1])
    last_index = len(df)

    future_X = []
    labels = []

    for i in range(3):
        month = ((last_month + i - 1) % 12) + 1
        future_X.append([last_index + i, month])
        labels.append(f"F{i+1}")

    future = model.predict(np.array(future_X)).tolist()

    return jsonify({
        "labels": [f"{r.Year}-{r.Month}" for _, r in df.iterrows()] + labels,
        "history_actual": history,
        "future_bill": future
    })

# =========================
# RESET
# =========================
@app.route("/api/reset", methods=["POST"])
def reset():
    global data_store
    data_store = data_store.iloc[0:0]
    return jsonify({"message": "reset done"})

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
