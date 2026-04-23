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

# =========================
# MODEL
# =========================
try:
    model = joblib.load("model/gb_model.pkl")
except:
    from sklearn.ensemble import GradientBoostingRegressor
    model = GradientBoostingRegressor()
    model.fit([[0, 1], [1, 2], [2, 3]], [100, 120, 140])

# =========================
# DATA STORE
# =========================
data_store = pd.DataFrame(
    columns=["Year", "Month", "Consumption", "Bill"]
)

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
    required = ["Year", "Month", "Consumption", "Bill"]

    for r in required:
        if r not in data or str(data[r]).strip() == "":
            return jsonify({
                "error": f"Missing entry value: {r}"
            }), 400

    try:
        row = {
            "Year": int(data["Year"]),
            "Month": int(float(data["Month"])),
            "Consumption": float(data["Consumption"]),
            "Bill": float(data["Bill"])
        }

        data_store = pd.concat(
            [data_store, pd.DataFrame([row])],
            ignore_index=True
        )

        return jsonify({
            "message": "added",
            "rows": len(data_store)
        })

    except Exception as e:
        return jsonify({
            "error": f"Invalid input format: {str(e)}"
        }), 400


# =========================
# DASHBOARD
# =========================
@app.route("/api/dashboard")
def dashboard():

    if data_store.empty:
        return jsonify({
            "total": 0,
            "avg": 0,
            "bill": 0,
            "records": 0
        })

    return jsonify({
        "total": float(data_store["Consumption"].sum()),
        "avg": float(data_store["Consumption"].mean()),
        "bill": float(data_store["Bill"].mean()),
        "records": len(data_store)
    })


# =========================
# DATA
# =========================
@app.route("/api/data")
def get_data():

    if data_store.empty:
        return jsonify([])

    df = data_store.sort_values(
        ["Year", "Month"]
    ).reset_index(drop=True)

    return jsonify(df.to_dict("records"))


# =========================
# UPLOAD
# =========================
@app.route("/api/upload", methods=["POST"])
def upload():
    global data_store

    try:
        if "file" not in request.files:
            return jsonify({
                "error": "No file uploaded"
            }), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({
                "error": "Empty filename"
            }), 400

        content = file.read()
        df = None

        try:
            df = pd.read_csv(
                io.BytesIO(content),
                delimiter=None,
                engine="python"
            )
        except:
            pass

        if df is None:
            try:
                df = pd.read_csv(
                    io.BytesIO(content),
                    sep="\t"
                )
            except:
                pass

        if df is None:
            try:
                df = pd.read_excel(
                    io.BytesIO(content)
                )
            except:
                pass

        if df is None:
            return jsonify({
                "error": "Cannot parse file format"
            }), 400

        df.columns = [
            str(c).strip().lower()
            for c in df.columns
        ]

        def find(name):
            for c in df.columns:
                if name in c:
                    return c
            return None

        y = find("year")
        m = find("month")
        c = find("consumption")
        b = find("bill")

        if not all([y, m, c, b]):
            return jsonify({
                "error":
                "Missing required columns"
            }), 400

        df = df[[y, m, c, b]]
        df.columns = [
            "Year",
            "Month",
            "Consumption",
            "Bill"
        ]

        for col in df.columns:
            df[col] = pd.to_numeric(
                df[col],
                errors="coerce"
            )

        df = df.dropna()

        data_store = pd.concat(
            [data_store, df],
            ignore_index=True
        )

        return jsonify({
            "message": "Upload success",
            "rows_added": len(df)
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


# =========================
# ANOMALY (UPGRADED)
# Rules:
# Consumption > mean + 2std
# OR Bill > mean_bill + 2std
# OR Consumption +30% from last month
# =========================
@app.route("/api/anomaly")
def anomaly():

    if data_store.empty:
        return jsonify([])

    df = data_store.copy()

    df = df.sort_values(
        ["Year", "Month"]
    ).reset_index(drop=True)

    mean_c = df["Consumption"].mean()
    std_c = df["Consumption"].std()

    mean_b = df["Bill"].mean()
    std_b = df["Bill"].std()

    cons_limit = mean_c + (2 * std_c if std_c > 0 else 0)
    bill_limit = mean_b + (2 * std_b if std_b > 0 else 0)

    status_list = []

    prev_consumption = None

    for _, row in df.iterrows():

        current_c = row["Consumption"]
        current_b = row["Bill"]

        is_anomaly = False

        # Rule 1
        if current_c > cons_limit:
            is_anomaly = True

        # Rule 2
        if current_b > bill_limit:
            is_anomaly = True

        # Rule 3
        if prev_consumption is not None:
            if current_c > prev_consumption * 1.30:
                is_anomaly = True

        status_list.append(
            "ANOMALY" if is_anomaly else "NORMAL"
        )

        prev_consumption = current_c

    df["status"] = status_list

    return jsonify(df.to_dict("records"))


# =========================
# FORECAST
# =========================
@app.route("/api/forecast")
def forecast():

    if data_store.empty or len(data_store) < 3:
        return jsonify({
            "error": "Need at least 3 records"
        })

    df = data_store.sort_values(
        ["Year", "Month"]
    ).reset_index(drop=True)

    df["Index"] = np.arange(len(df))

    X = df[["Index", "Month", "Consumption"]]
    y = df["Bill"]

    model.fit(X, y)

    history = y.tolist()

    last_index = len(df)
    last_month = int(df["Month"].iloc[-1])

    avg_consumption = df["Consumption"].mean()

    future_rows = []
    labels = []

    for i in range(3):

        month = ((last_month + i) % 12) + 1

        future_rows.append([
            last_index + i,
            month,
            avg_consumption
        ])

        labels.append(f"F{i+1}")

    future = model.predict(
        np.array(future_rows)
    ).tolist()

    return jsonify({
        "labels":
        [f"{r.Year}-{r.Month}"
         for _, r in df.iterrows()] + labels,

        "history_actual": history,
        "future_bill": future
    })


# =========================
# MAINTENANCE
# =========================
@app.route("/api/maintenance", methods=["POST"])
def maintenance():

    try:
        data = request.json

        base_date = datetime.strptime(
            data["date"],
            "%Y-%m-%d"
        )

        next_date = base_date + timedelta(days=90)

        return jsonify({
            "next_maintenance":
            next_date.strftime("%Y-%m-%d")
        })

    except:
        return jsonify({
            "error": "Invalid date format"
        }), 400


# =========================
# RESET
# =========================
@app.route("/api/reset", methods=["POST"])
def reset():
    global data_store

    data_store = data_store.iloc[0:0]

    return jsonify({
        "message": "reset done"
    })


# =========================
# RUN
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
