import pandas as pd
import numpy as np

# -----------------------------
# LOAD + CLEAN FUNCTION
# -----------------------------
def load_and_clean(path):
    df = pd.read_csv(path)

    df["Year"] = df["Year"].astype(int)
    df["Month"] = df["Month"].astype(int)

    df["Total Consumption (Cubic Meters)"] = df[
        "Total Consumption (Cubic Meters)"
    ].astype(float)

    df["Bill Amount"] = df["Bill Amount"].astype(str).str.replace(",", "").astype(float)

    # -----------------------------
    # CREATE DATE
    # -----------------------------
    df["Date"] = pd.to_datetime(df[["Year", "Month"]].assign(Day=1))
    df = df.sort_values("Date").reset_index(drop=True)

    # -----------------------------
    # FILL MISSING MONTHS
    # -----------------------------
    full_range = pd.date_range(df["Date"].min(), df["Date"].max(), freq="MS")
    full_df = pd.DataFrame({"Date": full_range})

    full_df["Year"] = full_df["Date"].dt.year
    full_df["Month"] = full_df["Date"].dt.month

    df = pd.merge(full_df, df, on=["Year", "Month"], how="left")

    # -----------------------------
    # INTERPOLATION
    # -----------------------------
    df["Total Consumption (Cubic Meters)"] = df[
        "Total Consumption (Cubic Meters)"
    ].interpolate()

    df["Bill Amount"] = df["Bill Amount"].interpolate()

    return df