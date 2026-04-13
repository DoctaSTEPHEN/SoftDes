from flask import Flask, request, jsonify
import pandas as pd
import joblib
from utils.model_utils import forecast, load_model

app = Flask(__name__)

# -----------------------------
# LOAD MODEL
# -----------------------------
model = load_model()

# -----------------------------
# HEALTH CHECK
# -----------------------------
@app.route("/")
def home():
    return "Water Forecasting API Running"


# -----------------------------
# FORECAST API
# -----------------------------
@app.route("/forecast", methods=["POST"])
def predict():
    try:
        data = request.json["data"]
        df = pd.DataFrame(data)

        predictions = forecast(model, df, steps=len(df))

        return jsonify({
            "forecast": predictions
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)