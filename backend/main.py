import os
import joblib
import pandas as pd
import numpy as np
import requests
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Drone Fleet Dispatching API", version="1.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_URI = "postgresql://postgres.qhqynnxpeyhnjtiyifsi:DSS301_Project@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model", "logistic_model.pkl")

WAREHOUSE_X = 10.8411
WAREHOUSE_Y = 106.8102
MIN_BATTERY_LEVEL = 30

# Initialize connection pool
try:
    db_pool = SimpleConnectionPool(
        minconn=1,
        maxconn=15,
        dsn=DB_URI
    )
    print("[SUCCESS] Database connection pool initialized.")
except Exception as e:
    print(f"Error initializing connection pool: {e}")
    db_pool = None

@contextmanager
def db_connection():
    if db_pool is None:
        raise HTTPException(status_code=500, detail="Database connection pool is not initialized.")
    conn = db_pool.getconn()
    try:
        yield conn
    finally:
        db_pool.putconn(conn)

# Load ML model
pipeline_model = None
if os.path.exists(MODEL_PATH):
    try:
        pipeline_model = joblib.load(MODEL_PATH)
        print("[SUCCESS] AI Model loaded successfully.")
    except Exception as e:
        print(f"Error loading model from {MODEL_PATH}: {e}")
else:
    print(f"WARNING: AI Model file not found at {MODEL_PATH}")

# Helper: Compute distance in km
def compute_km(x1: float, y1: float, x2: float, y2: float) -> float:
    raw_dist = abs(x1 - x2) + abs(y1 - y2)
    if raw_dist < 1.0:
        return round(raw_dist * 111.0, 2)
    else:
        return round(raw_dist * 0.03, 2)

# Pydantic Schemas
class OrderCreate(BaseModel):
    Order_ID: Optional[str] = None
    Customer_X: float
    Customer_Y: float
    Total_Weight_Gram: float

class OrderResponse(BaseModel):
    Order_ID: str
    Customer_X: float
    Customer_Y: float
    Total_Weight_Gram: float

class DroneResponse(BaseModel):
    Drone_ID: str
    drone_id: str
    Current_X: float
    Current_Y: float
    Battery_Level: int
    Status: str
    drone_model: str
    drone_size: str
    manufacturer: str
    propeller_count: int
    max_carry_weight: float

class RiskAnalysisRequest(BaseModel):
    order_id: str

class DroneRecommendation(BaseModel):
    Drone_ID: str
    Model: str
    Pin_Hien_Tai: str
    Suc_Tai_Max: str
    Trang_Thai_AI: str

# Endpoints
@app.get("/api/orders", response_model=List[OrderResponse])
def get_orders():
    try:
        with db_connection() as conn:
            df = pd.read_sql("SELECT order_id AS \"Order_ID\", customer_x AS \"Customer_X\", customer_y AS \"Customer_Y\", total_weight_gram AS \"Total_Weight_Gram\" FROM fact_orders ORDER BY order_id", conn)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc đơn hàng: {e}")

@app.post("/api/orders", response_model=OrderResponse)
def create_order(order: OrderCreate):
    try:
        with db_connection() as conn:
            cur = conn.cursor()
            order_id = order.Order_ID
            if not order_id:
                cur.execute("SELECT count(*) FROM fact_orders")
                count = cur.fetchone()[0]
                order_id = f"ORD-{count + 1:03d}"
                
            cur.execute(
                "INSERT INTO fact_orders (order_id, customer_x, customer_y, total_weight_gram) VALUES (%s, %s, %s, %s)",
                (order_id, order.Customer_X, order.Customer_Y, order.Total_Weight_Gram)
            )
            conn.commit()
            cur.close()
        return {
            "Order_ID": order_id,
            "Customer_X": order.Customer_X,
            "Customer_Y": order.Customer_Y,
            "Total_Weight_Gram": order.Total_Weight_Gram
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi tạo đơn hàng: {e}")

@app.get("/api/drones", response_model=List[DroneResponse])
def get_drones():
    try:
        with db_connection() as conn:
            df_drones = pd.read_sql("""
                SELECT 
                    s.drone_id AS "Drone_ID",
                    s.drone_id AS drone_id,
                    s.current_x AS "Current_X",
                    s.current_y AS "Current_Y",
                    s.battery_level AS "Battery_Level",
                    s.status AS "Status",
                    d.drone_model,
                    d.drone_size,
                    d.manufacturer,
                    d.propeller_count,
                    d.max_carry_weight
                FROM fact_drone_status s
                LEFT JOIN dim_drones d ON s.drone_id = d.drone_id
                ORDER BY s.drone_id
            """, conn)
        
        # Fill missing specifications with fallback values
        df_drones['drone_model'] = df_drones['drone_model'].fillna("FlyHigh 300")
        df_drones['drone_size'] = df_drones['drone_size'].fillna("Medium")
        df_drones['manufacturer'] = df_drones['manufacturer'].fillna("AeroCorp")
        df_drones['propeller_count'] = df_drones['propeller_count'].fillna(4).astype(int)
        df_drones['max_carry_weight'] = df_drones['max_carry_weight'].fillna(5.0)
        
        return df_drones.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lấy thông tin drone: {e}")

@app.post("/api/drones/reset")
def reset_drones():
    try:
        with db_connection() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE fact_drone_status SET status = 'Ready'")
            conn.commit()
            cur.close()
        return {"message": "Đã đặt lại trạng thái Ready cho toàn bộ đội bay."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi reset đội bay: {e}")

@app.post("/api/drones/{drone_id}/status")
def update_status(drone_id: str, status: str = Body(..., embed=True)):
    try:
        with db_connection() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE fact_drone_status SET status = %s WHERE drone_id = %s", (status, drone_id))
            conn.commit()
            rows_updated = cur.rowcount
            cur.close()
        if rows_updated == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy drone id.")
        return {"message": f"Đã cập nhật trạng thái drone {drone_id} sang {status}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi cập nhật trạng thái: {e}")

@app.get("/api/weather/wind")
def get_weather():
    url = f"https://api.open-meteo.com/v1/forecast?latitude={WAREHOUSE_X}&longitude={WAREHOUSE_Y}&current=wind_speed_10m,weather_code,precipitation"
    try:
        response = requests.get(url, timeout=3)
        data = response.json()
        current = data.get('current', {})
        wind_speed_ms = round(float(current.get('wind_speed_10m', 12.6)) / 3.6, 2)  # km/h -> m/s
        weather_code = int(current.get('weather_code', 0))
        precipitation = float(current.get('precipitation', 0.0))
        return {
            "wind_speed": wind_speed_ms,
            "weather_code": weather_code,
            "precipitation": precipitation,
            "is_live": True
        }
    except Exception as e:
        print(f"Weather API error: {e}")
        return {
            "wind_speed": 3.5,
            "weather_code": 0,
            "precipitation": 0.0,
            "is_live": False
        }

@app.post("/api/analyze-risk", response_model=List[DroneRecommendation])
def analyze_risk(payload: RiskAnalysisRequest):
    global pipeline_model
    if pipeline_model is None:
        if os.path.exists(MODEL_PATH):
            pipeline_model = joblib.load(MODEL_PATH)
        else:
            raise HTTPException(status_code=500, detail="Không tìm thấy file bộ não AI. Vui lòng train lại mô hình!")

    try:
        # Fetch order context and drones statuses and specs
        with db_connection() as conn:
            df_order = pd.read_sql("SELECT order_id, customer_x, customer_y, total_weight_gram FROM fact_orders WHERE order_id = %s", conn, params=(payload.order_id,))
            if df_order.empty:
                raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")
            
            weight_kg = float(df_order['total_weight_gram'].values[0]) / 1000.0
            cust_x_val = float(df_order['customer_x'].values[0])
            cust_y_val = float(df_order['customer_y'].values[0])

            df_drones = pd.read_sql("""
                SELECT 
                    s.drone_id,
                    s.current_x,
                    s.current_y,
                    s.battery_level,
                    s.status,
                    d.drone_model,
                    d.drone_size,
                    d.manufacturer,
                    d.propeller_count,
                    d.max_carry_weight
                FROM fact_drone_status s
                LEFT JOIN dim_drones d ON s.drone_id = d.drone_id
            """, conn)
        
        df_drones['drone_model'] = df_drones['drone_model'].fillna("FlyHigh 300")
        df_drones['drone_size'] = df_drones['drone_size'].fillna("Medium")
        df_drones['manufacturer'] = df_drones['manufacturer'].fillna("AeroCorp")
        df_drones['propeller_count'] = df_drones['propeller_count'].fillna(4).astype(int)
        df_drones['max_carry_weight'] = df_drones['max_carry_weight'].fillna(5.0)

        # Determine warehouse coord
        if cust_x_val < 90.0:
            wh_x, wh_y = WAREHOUSE_X, WAREHOUSE_Y
        else:
            try:
                wh_x = float(df_drones['current_x'].iloc[0])
                wh_y = float(df_drones['current_y'].iloc[0])
            except Exception:
                wh_x, wh_y = 113.0, 179.0

        dist_km = compute_km(wh_x, wh_y, cust_x_val, cust_y_val)

        # Get live wind
        wind_data = get_weather()
        live_wind = wind_data["wind_speed"]

        # Filters: Ready, Battery >= 30, Carry Capacity >= Weight
        valid_drones = df_drones[
            (df_drones['status'] == 'Ready') & 
            (df_drones['battery_level'] >= MIN_BATTERY_LEVEL) & 
            (df_drones['max_carry_weight'] >= weight_kg)
        ].copy()

        approved_list = []
        if not valid_drones.empty:
            for _, drone in valid_drones.iterrows():
                w_ratio = weight_kg / float(drone['max_carry_weight'])
                ow_flag = 1 if w_ratio > 1.0 else 0
                sim_risk = (live_wind * 0.12) + (w_ratio * 0.4) + (dist_km * 0.05)
                
                # Predict risk using ML Model
                X_live = pd.DataFrame([{
                    'application': 'Package Delivery', 'drone_size': drone['drone_size'],
                    'drone_model': drone['drone_model'], 'manufacturer': drone['manufacturer'],
                    'propeller_count': int(drone['propeller_count']), 'max_carry_weight': float(drone['max_carry_weight']),
                    'actual_carry_weight': weight_kg, 'payload_type': 'Package', 'payload_description': 'Consumer goods',
                    'altitude': 60, 'distance_flown': dist_km, 'gps_accuracy': 2.1, 'wind_speed': live_wind,
                    'overweight_flag': ow_flag, 'weight_ratio': w_ratio, 'risk_score': sim_risk,
                    'flight_duration': 30.0, 'battery_remaining': float(drone['battery_level']) - 10.0,
                    'obstacles_encountered': 'No', 'notes': np.nan
                }])
                
                ai_label = pipeline_model.predict(X_live)[0]
                if ai_label == "Completed":
                    approved_list.append({
                        "Drone_ID": drone['drone_id'],
                        "Model": drone['drone_model'],
                        "Pin_Hien_Tai": f"{drone['battery_level']}%",
                        "Suc_Tai_Max": f"{drone['max_carry_weight']} kg",
                        "Trang_Thai_AI": "Completed 🟢 (An Toàn)"
                    })

        return approved_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi thực hiện phân tích rủi ro: {e}")
