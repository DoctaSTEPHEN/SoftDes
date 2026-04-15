from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import os
import io
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Fix CORS issues

# =========================
# LOAD MODEL (WITH ERROR HANDLING)
# =========================
try:
    model = joblib.load("model/gb_model.pkl")
except:
    # Create dummy model if missing
    from sklearn.ensemble import GradientBoostingRegressor
    model = GradientBoostingRegressor()
    print("⚠️ Using dummy model - train your own model!")

# =========================
# IN-MEMORY STORAGE (PERSISTENT)
# =========================
data_store = pd.DataFrame(columns=["Year", "Month", "Consumption", "Bill"])

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
    try:
        global data_store
        data = request.json

        new_row = {
            "Year": int(data["Year"]),
            "Month": int(data["Month"]),
            "Consumption": float(data["Consumption"]),
            "Bill": float(data["Bill"])
        }

        data_store = pd.concat([data_store, pd.DataFrame([new_row])], ignore_index=True)
        return jsonify({"message": "Record added successfully", "rows": len(data_store)})

    except Exception as e:
        return jsonify({"error": str(e)}), 400

# =========================
# GET DATA
# =========================
@app.route("/api/data")
def get_data():
    return jsonify(data_store.to_dict("records"))

# =========================
# DASHBOARD
# =========================
@app.route("/api/dashboard")
def dashboard():
    if data_store.empty:
        return jsonify({"message": "No data yet", "total": 0, "avg": 0, "bill": 0})

    return jsonify({
        "total": float(data_store["Consumption"].sum()),
        "avg": float(data_store["Consumption"].mean()),
        "bill": float(data_store["Bill"].sum()),
        "count": len(data_store)
    })

# =========================
# UPLOAD CSV / JSON (🔥 FIXED)
# =========================
@app.route("/api/upload", methods=["POST"])
def upload():
    global data_store
    
    try:
        print("📁 UPLOAD REQUEST RECEIVED")  # Debug log
        
        # Handle both file and raw data
        if "file" in request.files:
            file = request.files["file"]
            print(f"📄 File received: {file.filename}")  # Debug
            
            if file.filename == "" or not file:
                return jsonify({"error": "No file selected"}), 400
            
            # Read file properly for Render
            content = file.stream.read()
            file.close()
            
            # Decode and process
            try:
                df = pd.read_csv(io.BytesIO(content))
                print(f"✅ CSV loaded: {len(df)} rows")
            except:
                try:
                    df = pd.read_json(io.BytesIO(content))
                    print(f"✅ JSON loaded: {len(df)} rows")
                except:
                    return jsonify({"error": "Invalid CSV/JSON"}), 400
        else:
            return jsonify({"error": "No file in request"}), 400

        # Normalize column names (case insensitive)
        df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]
        
        print(f"📊 Columns found: {list(df.columns)}")  # Debug

        # Flexible column mapping
        col_mapping = {}
        for col in df.columns:
            if any(x in col for x in ['year', 'yr']):
                col_mapping['year'] = col
            elif any(x in col for x in ['month', 'mon']):
                col_mapping['month'] = col
            elif any(x in col for x in ['consumption', 'usage', 'meter']):
                col_mapping['consumption'] = col
            elif any(x in col for x in ['bill', 'amount', 'cost', 'charge']):
                col_mapping['bill'] = col

        # Rename to standard
        df = df.rename(columns=col_mapping)

        # Ensure we have required columns
        required_cols = ['year', 'month', 'consumption', 'bill']
        available_cols = [col for col in required_cols if col in df.columns]
        
        if len(available_cols) < 3:
            return jsonify({
                "error": f"Need Year, Month, Consumption/Bill. Found: {list(df.columns)}"
            }), 400

        # Clean data
        df = df[available_cols].dropna()
        df['year'] = pd.to_numeric(df['year'], errors='coerce').fillna(2023).astype(int)
        df['month'] = pd.to_numeric(df['month'], errors='coerce').fillna(1).clip(1,12).astype(int)
        df['consumption'] = pd.to_numeric(df['consumption'], errors='coerce').fillna(0)
        df['bill'] = pd.to_numeric(df['bill'], errors='coerce').fillna(0)

        if df.empty:
            return jsonify({"error": "No valid data after cleaning"}), 400

        # Add to global store (deduplicate)
        df_standard = df[['year', 'month', 'consumption', 'bill']].copy()
        df_standard.columns = ['Year', 'Month', 'Consumption', 'Bill']
        
        data_store = pd.concat([data_store, df_standard], ignore_index=True)
        data_store = data_store.drop_duplicates(subset=['Year', 'Month']).reset_index(drop=True)
        
        print(f"💾 Added {len(df)} rows. Total: {len(data_store)}")  # Debug

        return jsonify({
            "success": True,
            "rows_added": len(df),
            "total_rows": len(data_store),
            "sample": data_store.tail(3).to_dict('records')
        })

    except Exception as e:
        print(f"❌ Upload error: {str(e)}")  # Debug log
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Server error: {str(e)}"}), 500
# =========================
# FORECAST (🔥 FIXED)
# =========================
@app.route("/api/forecast")
def forecast():
    try:
        if data_store.empty or len(data_store) < 3:
            return jsonify({
                "error": "Need at least 3 records for forecast",
                "history_actual": [],
                "history_predicted": [],
                "future_3_months": [0, 0, 0]
            })

        # Prepare features: index + month
        X = np.column_stack([
            np.arange(len(data_store)),
            data_store["Month"] % 12 + 1
        ])

        # Historical predictions
        history_pred = model.predict(X).tolist()

        # Future predictions (next 3 months)
        last_idx = len(data_store)
        last_month = data_store["Month"].iloc[-1]
        future_X = []
        
        for i in range(3):
            next_idx = last_idx + i
            next_month = (last_month + i - 1) % 12 + 1
            future_X.append([next_idx, next_month])
        
        future_pred = model.predict(np.array(future_X)).tolist()

        return jsonify({
            "history_actual": data_store["Consumption"].tolist(),
            "history_predicted": history_pred,
            "future_3_months": future_pred
        })

    except Exception as e:
        return jsonify({
            "error": str(e),
            "history_actual": [],
            "history_predicted": [],
            "future_3_months": [0, 0, 0]
        })

# =========================
# ANOMALY DETECTION
# =========================
@app.route("/api/anomaly")
def anomaly():
    if data_store.empty:
        return jsonify([])

    try:
        mean_cons = data_store["Consumption"].mean()
        std_cons = data_store["Consumption"].std()
        threshold = mean_cons + (2 * std_cons) if std_cons > 0 else mean_cons * 2

        df = data_store.copy()
        df["status"] = df["Consumption"].apply(
            lambda x: "ANOMALY" if x > threshold else "NORMAL"
        )

        return jsonify(df[["Year", "Month", "Consumption", "status"]].to_dict("records"))
    except:
        return jsonify([])

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
