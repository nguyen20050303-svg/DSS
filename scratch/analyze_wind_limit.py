import os
import joblib
import pandas as pd
import numpy as np

SCRIPT_DIR = r"c:\Users\DELL\OneDrive\Desktop\DSS301\DSS\backend"
MODEL_PATH = os.path.join(os.path.dirname(SCRIPT_DIR), "model", "logistic_model.pkl")

if os.path.exists(MODEL_PATH):
    model = joblib.load(MODEL_PATH)
    print("Model loaded.")
    
    min_batt = 30.0 # default config
    
    # 8-propeller, max_carry_weight = 20.0 kg
    # Categories:
    # application: 'Agricultural Spraying'
    # drone_size: 'Large'
    # drone_model: 'CropMaster'
    # manufacturer: 'AgriDrones'
    # payload_type: 'Liquid Tank'
    # payload_description: 'Pesticide solution'
    
    for actual_carry_weight in [0.0, 10.0, 20.0]:
        print(f"\n--- Payload: {actual_carry_weight} kg ---")
        for dist_km in [1.0, 2.0, 5.0, 10.0]:
            approved_wind_limit = 0.0
            failed_reason = ""
            # Scan wind speeds from 0.0 to 100.0 m/s with 0.1 step
            for wind in np.arange(0.0, 100.0, 0.1):
                # 1. battery check
                # propeller_count = 8, max_carry_weight = 20.0, battery_level = 100.0
                # base_rate_per_km = 2.5 + (0.25 * 8) = 4.5
                # wind_penalty = wind * max(0.10 - 0.005 * 8, 0.01) = wind * max(0.06, 0.01) = wind * 0.06
                wind_penalty = wind * max(0.10 - 0.005 * 8, 0.01) # = wind * 0.06
                weight_ratio = actual_carry_weight / 20.0
                weight_penalty = 0.30 * weight_ratio
                rate_go = 4.5 * (1.0 + weight_penalty + wind_penalty)
                consumed_go = dist_km * rate_go
                rate_back = 4.5 * (1.0 + wind_penalty)
                consumed_back = dist_km * rate_back
                est_consumed = round(consumed_go + consumed_back, 2)
                est_remaining = max(100.0 - est_consumed, 0.0)
                
                is_battery_safe = est_remaining >= min_batt
                meets_criteria = (100.0 >= min_batt) and (20.0 >= actual_carry_weight) and is_battery_safe
                
                is_approved = False
                reason = ""
                
                if not meets_criteria:
                    is_approved = False
                    reason = "Battery unsafe (under 30%)"
                else:
                    ow_flag = 1 if weight_ratio > 1.0 else 0
                    sim_risk = (wind * 0.12) + (weight_ratio * 0.4) + (dist_km * 0.05)
                    
                    X_test = pd.DataFrame([{
                        'application': 'Agricultural Spraying',
                        'drone_size': 'Large',
                        'drone_model': 'CropMaster',
                        'manufacturer': 'AgriDrones',
                        'propeller_count': 8,
                        'max_carry_weight': 20.0,
                        'actual_carry_weight': actual_carry_weight,
                        'payload_type': 'Liquid Tank',
                        'payload_description': 'Pesticide solution',
                        'altitude': 30, # typical for spraying
                        'flight_duration': 30.0,
                        'distance_flown': dist_km,
                        'gps_accuracy': 3.5,
                        'wind_speed': wind,
                        'overweight_flag': ow_flag,
                        'weight_ratio': weight_ratio,
                        'risk_score': sim_risk,
                        'battery_remaining': est_remaining,
                        'obstacles_encountered': 'No',
                        'notes': np.nan
                    }])
                    
                    pred = model.predict(X_test)[0]
                    if pred == "Completed":
                        is_approved = True
                    else:
                        is_approved = False
                        reason = "AI model predicted Non-completed"
                        
                if not is_approved:
                    approved_wind_limit = wind - 0.1
                    failed_reason = reason
                    break
            else:
                approved_wind_limit = 100.0
                failed_reason = "No limit under 100 m/s"
                
            print(f"  Distance: {dist_km} km -> Max approved wind: {approved_wind_limit:.1f} m/s (Failed due to: {failed_reason})")
else:
    print("Model not found")
