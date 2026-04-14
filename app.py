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

        # FIX: always forecast next 3 months
        steps = 3

        predictions = forecast(model, df, steps=steps)

        return jsonify({
            "forecast_months": steps,
            "forecast": predictions
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# CSV UPLOAD SUPPORT (NEW)
# -----------------------------
@app.route("/forecast_csv", methods=["POST"])
def forecast_csv():
    try:
        file = request.files["file"]
        df = pd.read_csv(file)

        predictions = forecast(model, df)

        return jsonify({
            "forecast": predictions.tolist()
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
