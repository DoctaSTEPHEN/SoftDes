import joblib
import numpy as np

# -----------------------------
# LOAD MODEL
# -----------------------------
def load_model(path="model/gb_model.pkl"):
    return joblib.load(path)


# -----------------------------
# FORECAST FUNCTION
# -----------------------------
def forecast(model, df, steps=12):
    last_idx = len(df) - 1
    last_month = df["Month"].iloc[-1]

    predictions = []

    for i in range(steps):
        last_idx += 1
        next_month = (last_month % 12) + 1

        X = np.array([[last_idx, next_month]])
        pred = model.predict(X)[0]

        predictions.append(pred)
        last_month = next_month

    return predictions


# -----------------------------
# EVALUATION
# -----------------------------
def evaluate(actual, predicted):
    actual = np.array(actual)
    predicted = np.array(predicted)

    mae = np.mean(abs(actual - predicted))
    rmse = np.sqrt(np.mean((actual - predicted) ** 2))
    error_rate = np.mean(abs((actual - predicted) / actual)) * 100

    return {
        "MAE": mae,
        "RMSE": rmse,
        "Error Rate (%)": error_rate
    }