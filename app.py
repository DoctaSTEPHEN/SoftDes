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

        # Accept BOTH:
        # { "data": [...] } OR just [...]
        if isinstance(data, dict):
            data = data.get("data", [])

        df = pd.DataFrame(data)

        # Ensure correct columns
        if "Year" not in df or "Month" not in df:
            return jsonify({"error": "Year and Month required"}), 400

        steps = 3
        predictions = forecast(model, df, steps=steps)

        last_year = int(df.iloc[-1]["Year"])
        last_month = int(df.iloc[-1]["Month"])

        results = []
        alerts = []
        maintenance = []

        avg = df["Total Consumption"].mean() if "Total Consumption" in df else 0

        for i in range(steps):
            month = last_month + i + 1
            year = last_year

            if month > 12:
                month -= 12
                year += 1

            pred = predictions[i]

            consumption = float(pred[0]) if isinstance(pred, (list, tuple)) else float(pred)
            bill = float(pred[1]) if isinstance(pred, (list, tuple)) else None

            # anomaly
            if avg and consumption > avg * 1.3:
                alerts.append(f"High consumption at {month}/{year}")

            # maintenance
            if month in [3, 6, 9, 12]:
                maintenance.append(f"Maintenance at {month}/{year}")

            results.append({
                "Year": year,
                "Month": month,
                "Consumption": round(consumption, 2),
                "Bill": round(bill, 2) if bill else None
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
