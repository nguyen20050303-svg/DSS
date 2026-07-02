import pandas as pd
import numpy as np
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

# Determine absolute path to the directory containing this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Read clean telemetry dataset (v2 - expanded with high-wind failure cases)
df = pd.read_csv(os.path.join(SCRIPT_DIR, "clean_telemetry_v2.csv"))

# 2. Define binary target variable
df['flight_target'] = df['flight_status'].apply(lambda x: "Completed" if x == "Completed" else "Non-completed")

# 3. Define features X and target y
# Drop columns that are identifiers, admin metadata, or non-physical descriptors
# that don't meaningfully affect flight safety prediction
drop_cols = [
    "flight_status", "flight_target",
    "drone_id", "operator_id", "regulatory_approval_id", "flight_date",
    # Non-physical / redundant descriptors:
    "application", "drone_size", "drone_model", "manufacturer",
    "payload_type", "payload_description", "notes",
    # Auto-index columns that may exist in CSV
    "Unnamed: 0", "Unnamed: 0.1"
]
X = df.drop(columns=[col for col in drop_cols if col in df.columns])
y = df['flight_target']

print(f"[INFO] Training on {len(df)} rows")
print(f"[INFO] Features used ({len(X.columns)}): {X.columns.tolist()}")
print(f"[INFO] Label distribution:\n{y.value_counts()}\n")

# 4. Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# 5. Preprocessing pipeline
numeric_features = X.select_dtypes(include=["int64", "float64"]).columns.tolist()
categorical_features = X.select_dtypes(include=["object"]).columns.tolist()

numeric_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler())
])

categorical_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(handle_unknown="ignore"))
])

preprocessor = ColumnTransformer(transformers=[
    ("num", numeric_transformer, numeric_features),
    ("cat", categorical_transformer, categorical_features)
])

# 6. Train model
log_model = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced"))
])

log_model.fit(X_train, y_train)

# 7. Evaluate on test set
y_pred = log_model.predict(X_test)
print("[EVALUATION] Classification Report:")
print(classification_report(y_test, y_pred))

# 8. Save model
os.makedirs(os.path.join(os.path.dirname(SCRIPT_DIR), "model"), exist_ok=True)
joblib.dump(log_model, os.path.join(os.path.dirname(SCRIPT_DIR), "model", "logistic_model.pkl"))
print("[SUCCESS] Model trained and saved successfully as 'model/logistic_model.pkl'")
