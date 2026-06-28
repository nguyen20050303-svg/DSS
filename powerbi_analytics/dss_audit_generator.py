import os
import joblib
import pandas as pd
import numpy as np
import requests
import psycopg2

# Database configuration
DB_URI = "postgresql://postgres.qhqynnxpeyhnjtiyifsi:DSS301_Project@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

# Resolve absolute paths relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(os.path.dirname(SCRIPT_DIR), "model", "logistic_model.pkl")
OUTPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "dss_output_validation.csv")

def load_system_config():
    """Load warehouse configuration from database."""
    default_config = {
        "warehouse_x": 10.8411,
        "warehouse_y": 106.8102,
        "min_battery_level": 10
    }
    try:
        conn = psycopg2.connect(DB_URI)
        cur = conn.cursor()
        cur.execute("SELECT warehouse_x, warehouse_y, min_battery_level FROM dim_system_config WHERE id = 1")
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return {
                "warehouse_x": float(row[0]),
                "warehouse_y": float(row[1]),
                "min_battery_level": int(row[2])
            }
    except Exception as e:
        print(f"[Warning] Error reading system configuration: {e}. Using defaults.")
    return default_config

def get_live_wind(wh_x, wh_y):
    """Fetch live wind speed from Open-Meteo API."""
    url = f"https://api.open-meteo.com/v1/forecast?latitude={wh_x}&longitude={wh_y}&current=wind_speed_10m"
    try:
        response = requests.get(url, timeout=5)
        if response.ok:
            data = response.json()
            current = data.get('current', {})
            wind_speed_ms = round(float(current.get('wind_speed_10m', 12.6)) / 3.6, 2)  # km/h -> m/s
            print(f"[Live Weather] Wind speed: {wind_speed_ms} m/s")
            return wind_speed_ms
    except Exception as e:
        print(f"[Warning] Failed to fetch weather API: {e}. Using fallback 3.5 m/s.")
    return 3.5

def compute_km(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate Manhattan distance approximation in km."""
    raw_dist = abs(x1 - x2) + abs(y1 - y2)
    if raw_dist < 1.0:
        return round(raw_dist * 111.0, 2)
    else:
        return round(raw_dist * 0.03, 2)

def estimate_battery_consumption(dist_km: float, weight_kg: float, wind_speed: float, max_carry_weight: float, propeller_count: int) -> float:
    """
    Calculate dynamic roundtrip battery consumption.
    Go Leg: loaded with package weight.
    Return Leg: empty.
    """
    base_rate_per_km = 2.5 + (0.25 * propeller_count)
    wind_penalty = wind_speed * max(0.10 - 0.005 * propeller_count, 0.01)
    
    # 1. Delivery Leg (Go)
    weight_ratio = weight_kg / max(max_carry_weight, 0.1)
    weight_penalty = 0.30 * weight_ratio
    rate_go = base_rate_per_km * (1.0 + weight_penalty + wind_penalty)
    consumed_go = dist_km * rate_go
    
    # 2. Return Leg (Back)
    rate_back = base_rate_per_km * (1.0 + wind_penalty)
    consumed_back = dist_km * rate_back
    
    # Total
    return round(consumed_go + consumed_back, 2)

def generate_audit_data():
    print("==================================================")
    print(" DSS DECISION AUDIT & POWER BI INTEGRATION SCRIPT ")
    print("==================================================")
    
    # 1. Load ML Model Pipeline
    if not os.path.exists(MODEL_PATH):
        print(f"[Error] AI Model not found at: {MODEL_PATH}")
        print("Please train the model first.")
        return
    
    print("[1/5] Loading AI model...")
    pipeline_model = joblib.load(MODEL_PATH)
    print(f"      Successfully loaded: {MODEL_PATH}")
    
    # 2. Load Config & Weather Context
    print("[2/5] Fetching configuration and weather data...")
    config = load_system_config()
    wh_x = config["warehouse_x"]
    wh_y = config["warehouse_y"]
    min_batt = config["min_battery_level"]
    wind_speed = get_live_wind(wh_x, wh_y)
    
    # 3. Connect to database to fetch orders and drones
    print("[3/5] Querying orders and drones fleets from database...")
    try:
        conn = psycopg2.connect(DB_URI)
        
        # Fetch all orders (pending, assigned, success, failed, etc.)
        df_orders = pd.read_sql("""
            SELECT order_id, customer_x, customer_y, total_weight_gram, status 
            FROM fact_orders 
            ORDER BY order_id
        """, conn)
        
        # Fetch all drones specs and status
        df_drones = pd.read_sql("""
            SELECT 
                s.drone_id, s.battery_level, s.status,
                d.drone_model, d.drone_size, d.manufacturer, d.propeller_count, d.max_carry_weight
            FROM fact_drone_status s
            LEFT JOIN dim_drones d ON s.drone_id = d.drone_id
        """, conn)
        
        conn.close()
    except Exception as e:
        print(f"[Error] Failed to connect to database: {e}")
        return
        
    # Pre-process Drones defaults
    df_drones['drone_model'] = df_drones['drone_model'].fillna("FlyHigh 300")
    df_drones['drone_size'] = df_drones['drone_size'].fillna("Medium")
    df_drones['manufacturer'] = df_drones['manufacturer'].fillna("AeroCorp")
    df_drones['propeller_count'] = df_drones['propeller_count'].fillna(4).astype(int)
    df_drones['max_carry_weight'] = df_drones['max_carry_weight'].fillna(5.0)

    print(f"      Total orders found: {len(df_orders)}")
    print(f"      Total drones found: {len(df_drones)}")
    
    # 4. Generate recommendations matrix
    print("[4/5] Running DSS Decision algorithm and AI prediction matrix...")
    
    # Filter only drones that are ready to fly
    ready_drones = df_drones[df_drones['status'] == 'Ready']
    if ready_drones.empty:
        print("[Warning] No Ready drones found in the database. Recommendations will be empty.")
    
    rows = []
    
    for _, order in df_orders.iterrows():
        order_id = order['order_id']
        cust_x = float(order['customer_x'])
        cust_y = float(order['customer_y'])
        weight_kg = float(order['total_weight_gram']) / 1000.0
        order_status = order['status'] or 'Pending'
        
        dist_km = compute_km(wh_x, wh_y, cust_x, cust_y)
        
        for _, drone in ready_drones.iterrows():
            drone_id = drone['drone_id']
            max_carry = float(drone['max_carry_weight'])
            propellers = int(drone['propeller_count'])
            battery_current = int(drone['battery_level'])
            
            # Calculate metrics
            w_ratio = weight_kg / max_carry
            ow_flag = 1 if w_ratio > 1.0 else 0
            sim_risk = (wind_speed * 0.12) + (w_ratio * 0.4) + (dist_km * 0.05)
            
            est_consumed = estimate_battery_consumption(dist_km, weight_kg, wind_speed, max_carry, propellers)
            est_remaining = max(float(battery_current) - est_consumed, 0.0)
            is_battery_safe = est_remaining >= min_batt
            
            # Constraints check
            meets_criteria = (battery_current >= min_batt) and (max_carry >= weight_kg) and is_battery_safe
            
            is_approved = False
            ai_recommendation = "Non-completed"
            
            if meets_criteria:
                # Prepare payload for scikit-learn model
                X_live = pd.DataFrame([{
                    'application': 'Package Delivery',
                    'drone_size': drone['drone_size'],
                    'drone_model': drone['drone_model'],
                    'manufacturer': drone['manufacturer'],
                    'propeller_count': propellers,
                    'max_carry_weight': max_carry,
                    'actual_carry_weight': weight_kg,
                    'payload_type': 'Package',
                    'payload_description': 'Consumer goods',
                    'altitude': 60,
                    'distance_flown': dist_km,
                    'gps_accuracy': 2.1,
                    'wind_speed': wind_speed,
                    'overweight_flag': ow_flag,
                    'weight_ratio': w_ratio,
                    'risk_score': sim_risk,
                    'flight_duration': 30.0,
                    'battery_remaining': est_remaining,
                    'obstacles_encountered': 'No',
                    'notes': np.nan
                }])
                
                prediction = pipeline_model.predict(X_live)[0]
                if prediction == "Completed":
                    is_approved = True
                    ai_recommendation = "Completed"
            
            rows.append({
                "Order_ID": order_id,
                "Order_Status": order_status,
                "Order_Weight_KG": round(weight_kg, 2),
                "Distance_KM": dist_km,
                "Wind_Speed_m_s": wind_speed,
                "Drone_ID": drone_id,
                "Drone_Model": drone['drone_model'],
                "Propeller_Count": propellers,
                "Max_Carry_Weight_KG": max_carry,
                "Weight_Ratio": round(w_ratio * 100, 2),
                "Current_Battery": battery_current,
                "Est_Battery_Consumed": est_consumed,
                "Est_Battery_Remaining": round(est_remaining, 2),
                "Is_Battery_Safe": "Safe" if is_battery_safe else "Low Battery / Unsafe",
                "Risk_Score": round(sim_risk, 4),
                "Is_Approved": "Approved" if is_approved else "Rejected",
                "AI_Recommendation": ai_recommendation
            })
            
    # 5. Export to CSV
    print("[5/5] Exporting dataset to CSV...")
    df_out = pd.DataFrame(rows)
    df_out.to_csv(OUTPUT_CSV_PATH, index=False, encoding='utf-8-sig')
    print(f"[SUCCESS] Audit dataset successfully generated at:")
    print(f"          {OUTPUT_CSV_PATH}")
    print("==================================================")

if __name__ == "__main__":
    generate_audit_data()
