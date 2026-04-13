from flask import Flask, request, jsonify
import pandas as pd
import joblib
from utils.model_utils import forecast, load_model
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

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
# FRONTEND PAGE
# -----------------------------
@app.route("/")
def home():
    return render_template("index.html")
    
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


# -----------------------------
# RUN APP
# -----------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
