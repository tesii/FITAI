from supabase import create_client
import numpy as np

import pandas as pd
from sklearn.linear_model import LinearRegression

# ─────────────────────────────
# CONNECT TO SUPABASE
# ─────────────────────────────
SUPABASE_URL = "https://ojzeaqememaevlxcyabn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qemVhcWVtZW1hZXZseGN5YWJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NDE4MiwiZXhwIjoyMDg5MzMwMTgyfQ.SZjM-GDeytgFEPeKAlgUwZu2lYOaQJ8dIAI9bVoGgq4"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)



USER_ID = "1017d7cc-20eb-4230-b72d-f24ba04a65df"



# ─────────────────────────────
# FETCH ALL DATA (PAGINATION SAFE)
# ─────────────────────────────
all_data = []
page = 0
page_size = 1000

while True:
    response = (
        supabase
        .table("user_exercise_logs")
        .select("""
            created_at,
            sets,
            reps,
            weight_used,
            exercises(name)
        """)
        .eq("user_id", USER_ID)
        .order("created_at")
        .order("id")
        .range(page * page_size, (page + 1) * page_size - 1)
        .execute()
    )

    batch = response.data

    if not batch:
        break

    all_data.extend(batch)
    page += 1

df = pd.DataFrame(all_data)

if df.empty:
    print("❌ No workout data found")
    exit()

# ─────────────────────────────
# CLEAN DATA
# ─────────────────────────────

# Extract exercise name
df["exercise_name"] = df["exercises"].apply(
    lambda x: x["name"] if x else None
)

# IMPORTANT: remove time (normalize to date only)
df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce").dt.normalize()
print("\nRAW NULL CHECK")
print(df[["sets", "reps", "weight_used", "exercise_name"]].isna().sum())
df = df.dropna(subset=["created_at"])

# Convert numeric fields
for col in ["sets", "reps", "weight_used"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

df = df.dropna(subset=["sets", "reps", "weight_used", "exercise_name"])

print(f"✅ Total rows loaded: {len(df)}")

# ─────────────────────────────
# WEEK INDEX (FROM FIRST DATE)
# ─────────────────────────────

start_date = df["created_at"].min()

df["week_index"] = (
    (df["created_at"] - start_date).dt.days // 7
) + 1

# ─────────────────────────────
# DEBUG (optional but useful)
# ─────────────────────────────
print("\n📅 Dates:")
print(df["created_at"].dt.date.value_counts().sort_index())

print("\n📊 Weeks:")
print(df["week_index"].value_counts().sort_index())

# ─────────────────────────────
# GROUP BY EXERCISE + WEEK
# ─────────────────────────────
weekly_df = (
    df.groupby(["exercise_name", "week_index"])
    .agg({
        "sets": "mean",
        "reps": "mean",
        "weight_used": "mean"
    })
    .reset_index()
)

# ─────────────────────────────
# TRAIN + PREDICT NEXT WEEK
# ─────────────────────────────
results = {}

for exercise in weekly_df["exercise_name"].unique():

    ex_df = weekly_df[
        weekly_df["exercise_name"] == exercise
    ].sort_values("week_index")

    # need at least 2 weeks
    if len(ex_df) < 2:
        continue

    X = ex_df[["week_index"]]
    y_weight = ex_df["weight_used"]

    model = LinearRegression()
    model.fit(X, y_weight)

    # predict NEXT week after latest week
    next_week = ex_df["week_index"].max() + 1

    prediction = model.predict(np.array([[next_week]]))[0]

    results[exercise] = {
        "last_week": int(ex_df["week_index"].max()),
        "next_week": int(next_week),
        "predicted_weight": float(prediction)
    }

# ─────────────────────────────
# OUTPUT
# ─────────────────────────────
print("\n📊 NEXT WEEK WORKOUT PREDICTIONS\n")

if not results:
    print("❌ Not enough data for predictions")

for exercise, data in results.items():

    print(f"🏋️ Exercise: {exercise}")
    print(f"📅 Last Week: {data['last_week']}")
    print(f"➡️ Next Week: {data['next_week']}")
    print(f"💪 Predicted Weight: {round(data['predicted_weight'], 2)} kg")
    print("-" * 40)