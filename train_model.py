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

# 1. Read clean telemetry dataset
df = pd.read_csv("clean_telemetry.csv")

# 2. Define binary target variable
df['flight_target'] = df['flight_status'].apply(lambda x: "Completed" if x == "Completed" else "Non-completed")

# 3. Define features X and target y
drop_cols = ["flight_status", "flight_target", "drone_id", "operator_id", "regulatory_approval_id", "flight_date"]
X = df.drop(columns=drop_cols)
y = df['flight_target']

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

# 7. Save model
os.makedirs("output", exist_ok=True)
joblib.dump(log_model, "logistic_model.pkl")
joblib.dump(log_model, "output/logistic_model.pkl")
print("✔ Model trained and saved successfully as 'logistic_model.pkl'")
