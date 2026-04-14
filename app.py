from flask import Flask, request, jsonify, render_template
import pandas as pd
import joblib
import os
from utils.model_utils import forecast, load_model
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

model = load_model()

@app.route("/")
def home():
    return render_template("index.html")


# -----------------------------
# JSON INPUT (MAIN API)
# -----------------------------
@app.route("/forecast", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        # get inputs
        records = data.get("data", [])
        maintenance_month = data.get("maintenance_month", None)

        df = pd.DataFrame(records)

        steps = 3
        predictions = forecast(model, df, steps=steps)

        last_year = int(df.iloc[-1]["Year"])
        last_month = int(df.iloc[-1]["Month"])

        results = []
        alerts = []
        maintenance = []

        avg = df["Total Consumption"].mean()

        for i in range(steps):
            month = last_month + i + 1
            year = last_year

            if month > 12:
                month -= 12
                year += 1

            pred = predictions[i]

            consumption = float(pred[0]) if isinstance(pred, (list, tuple)) else float(pred)
            bill = float(pred[1]) if isinstance(pred, (list, tuple)) else None

            # anomaly detection
            if consumption > avg * 1.3:
                alerts.append(f"High consumption at {month}/{year}")

            # maintenance (USER-DEFINED)
            if maintenance_month and int(month) == int(maintenance_month):
                maintenance.append(f"Maintenance scheduled at {month}/{year}")

            results.append({
                "Year": year,
                "Month": month,
                "Consumption": consumption,
                "Bill": bill
            })

        return jsonify({
            "forecast": results,
            "alerts": alerts,
            "maintenance": maintenance
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500        
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
