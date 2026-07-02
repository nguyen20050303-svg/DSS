import os
import joblib
import pandas as pd
import numpy as np

SCRIPT_DIR = r"c:\Users\DELL\OneDrive\Desktop\DSS301\DSS\backend"
MODEL_PATH = os.path.join(os.path.dirname(SCRIPT_DIR), "model", "logistic_model.pkl")

model = joblib.load(MODEL_PATH)
df = pd.read_csv(os.path.join(SCRIPT_DIR, "clean_telemetry_v2.csv"))

min_batt = 30.0

# Get all unique (propeller_count, max_carry_weight) combinations from data
combos = df[['propeller_count', 'max_carry_weight']].drop_duplicates().sort_values(['propeller_count', 'max_carry_weight'])
print(f"Total unique (propeller_count, max_carry_weight) combos: {len(combos)}\n")

results = []

for _, row in combos.iterrows():
    prop = int(row['propeller_count'])
    max_w = float(row['max_carry_weight'])
    
    # base_rate_per_km = 2.5 + 0.25 * propeller_count
    base_rate = 2.5 + 0.25 * prop
    # wind_penalty_factor = max(0.10 - 0.005 * prop, 0.01)
    wpf = max(0.10 - 0.005 * prop, 0.01)
    
    # Test with 3 payload levels: 0%, 50%, 100% of max
    for payload_pct, label in [(0.0, "0% (empty)"), (0.5, "50%"), (1.0, "100% (full)")]:
        actual_carry = max_w * payload_pct
        weight_ratio = actual_carry / max_w if max_w > 0 else 0.0
        weight_penalty = 0.30 * weight_ratio
        ow_flag = 0  # not overweight since <= max
        
        # Test across distances
        for dist_km in [1.0, 5.0]:
            max_wind_found = None
            block_reason = ""
            
            for wind in np.arange(0.0, 30.0, 0.1):
                wind_penalty = wind * wpf
                rate_go = base_rate * (1.0 + weight_penalty + wind_penalty)
                consumed_go = dist_km * rate_go
                rate_back = base_rate * (1.0 + wind_penalty)
                consumed_back = dist_km * rate_back
                est_consumed = round(consumed_go + consumed_back, 2)
                est_remaining = max(100.0 - est_consumed, 0.0)

                if est_remaining < min_batt:
                    max_wind_found = wind - 0.1
                    block_reason = "Battery"
                    break

                sim_risk = (wind * 0.12) + (weight_ratio * 0.4) + (dist_km * 0.05)

                X_test = pd.DataFrame([{
                    'propeller_count': prop,
                    'max_carry_weight': max_w,
                    'actual_carry_weight': actual_carry,
                    'altitude': 60,
                    'flight_duration': 30.0,
                    'distance_flown': dist_km,
                    'battery_remaining': est_remaining,
                    'gps_accuracy': 2.1,
                    'wind_speed': wind,
                    'overweight_flag': ow_flag,
                    'weight_ratio': weight_ratio,
                    'risk_score': sim_risk,
                    'obstacles_encountered': 'No',
                }])

                pred = model.predict(X_test)[0]
                if pred != "Completed":
                    max_wind_found = wind - 0.1
                    block_reason = "AI"
                    break
            else:
                max_wind_found = 30.0
                block_reason = "No limit"

            results.append({
                'Propellers': prop,
                'Max_Carry(kg)': max_w,
                'Payload': label,
                'Carry(kg)': actual_carry,
                'Dist(km)': dist_km,
                'Max_Wind(m/s)': round(max_wind_found, 1),
                'Blocked_by': block_reason
            })

df_results = pd.DataFrame(results)
# Print grouped by propeller + max carry
for (prop, max_w), group in df_results.groupby(['Propellers', 'Max_Carry(kg)']):
    print(f"=== {prop} canh, tai max {max_w} kg ===")
    print(group[['Payload', 'Carry(kg)', 'Dist(km)', 'Max_Wind(m/s)', 'Blocked_by']].to_string(index=False))
    print()
