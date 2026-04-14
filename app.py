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
        data = request.get_json()["data"]
        df = pd.DataFrame(data)

        # -----------------------------
        # 1. FORECAST NEXT 3 MONTHS
        # -----------------------------
        steps = 3
        predictions = forecast(model, df, steps=steps)

        # -----------------------------
        # 2. GENERATE FUTURE MONTHS
        # -----------------------------
        last_year = df.iloc[-1]["Year"]
        last_month = df.iloc[-1]["Month"]

        future_results = []
        alerts = []
        maintenance = []

        for i in range(steps):
            month = last_month + i + 1
            year = last_year

            if month > 12:
                month -= 12
                year += 1

            pred = predictions[i]

            consumption = float(pred[0]) if isinstance(pred, (list, tuple)) else float(pred)
            bill = float(pred[1]) if isinstance(pred, (list, tuple)) else None

            # -----------------------------
            # 3. ANOMALY DETECTION
            # -----------------------------
            avg = df["Total Consumption"].mean()

            if consumption > avg * 1.3:  # 30% higher than normal
                alerts.append({
                    "type": "anomaly",
                    "message": f"High water consumption predicted for {month}/{year}"
                })

            # -----------------------------
            # 4. QUARTERLY MAINTENANCE
            # -----------------------------
            if month in [3, 6, 9, 12]:
                maintenance.append({
                    "type": "maintenance",
                    "message": f"Scheduled maintenance reminder for {month}/{year}"
                })

            future_results.append({
                "Year": int(year),
                "Month": int(month),
                "Predicted Consumption": round(consumption, 2),
                "Predicted Bill": round(bill, 2) if bill else None
            })

        # -----------------------------
        # RESPONSE
        # -----------------------------
        return jsonify({
            "forecast": future_results,
            "alerts": alerts,
            "maintenance": maintenance
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
