import os
import sys
import subprocess
import pandas as pd
import numpy as np

# Ensure psycopg2-binary is installed
try:
    import psycopg2
    from psycopg2 import extras
except ImportError:
    print("Installing psycopg2-binary...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
    import psycopg2
    from psycopg2 import extras

# Determine absolute path to the directory containing this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_URI = "postgresql://postgres.qhqynnxpeyhnjtiyifsi:DSS301_Project@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

def migrate():
    print("Connecting to Supabase PostgreSQL...")
    conn = psycopg2.connect(DB_URI)
    cur = conn.cursor()
    
    # 1. Create tables
    print("Creating tables...")
    create_tables_sql = """
    DROP TABLE IF EXISTS fact_drone_status CASCADE;
    DROP TABLE IF EXISTS dim_drones CASCADE;
    DROP TABLE IF EXISTS fact_orders CASCADE;
    
    CREATE TABLE dim_drones (
        drone_id VARCHAR(50) PRIMARY KEY,
        drone_model VARCHAR(100),
        drone_size VARCHAR(50),
        manufacturer VARCHAR(100),
        propeller_count INT,
        max_carry_weight DOUBLE PRECISION
    );

    CREATE TABLE fact_drone_status (
        drone_id VARCHAR(50) PRIMARY KEY REFERENCES dim_drones(drone_id) ON DELETE CASCADE,
        current_x DOUBLE PRECISION,
        current_y DOUBLE PRECISION,
        battery_level INT,
        status VARCHAR(50)
    );

    CREATE TABLE fact_orders (
        order_id VARCHAR(50) PRIMARY KEY,
        customer_x DOUBLE PRECISION,
        customer_y DOUBLE PRECISION,
        total_weight_gram DOUBLE PRECISION
    );
    """
    cur.execute(create_tables_sql)
    conn.commit()
    print("Tables created successfully.")

    # 2. Migrate dim_drones (from clean_telemetry.csv specifications)
    telemetry_path = os.path.join(SCRIPT_DIR, "clean_telemetry.csv")
    if os.path.exists(telemetry_path):
        print(f"Reading specifications from {telemetry_path}...")
        df_telemetry = pd.read_csv(telemetry_path)
        df_specs = df_telemetry[['drone_id', 'drone_model', 'drone_size', 'manufacturer', 'propeller_count', 'max_carry_weight']].drop_duplicates(subset=['drone_id'])
        
        # Clean data for database insertion
        df_specs = df_specs.replace({np.nan: None})
        
        print(f"Inserting {len(df_specs)} drone specifications into dim_drones...")
        insert_specs_query = """
        INSERT INTO dim_drones (drone_id, drone_model, drone_size, manufacturer, propeller_count, max_carry_weight)
        VALUES %s
        ON CONFLICT (drone_id) DO NOTHING;
        """
        records = [tuple(x) for x in df_specs.to_numpy()]
        extras.execute_values(cur, insert_specs_query, records)
        conn.commit()
    else:
        print(f"Warning: {telemetry_path} not found. Cannot populate dim_drones specs.")

    # 3. Migrate fact_drone_status (from fact_drone_status.csv)
    drone_status_path = os.path.join(SCRIPT_DIR, "fact_drone_status.csv")
    if os.path.exists(drone_status_path):
        print(f"Reading drone statuses from {drone_status_path}...")
        try:
            df_status = pd.read_csv(drone_status_path, sep=';')
            if 'Drone_ID' not in df_status.columns and 'drone_id' not in df_status.columns:
                df_status = pd.read_csv(drone_status_path, sep=',')
        except Exception:
            df_status = pd.read_csv(drone_status_path)
        
        # Map local Drone_ID (numeric like 0, 1, 2) to match telemetry spec (D001, D002...)
        status_id_col = 'Drone_ID' if 'Drone_ID' in df_status.columns else 'drone_id'
        df_status['drone_id_mapped'] = df_status[status_id_col].apply(lambda x: f"D{int(x)+1:03d}" if str(x).isdigit() else str(x))
        
        # Select and rename columns for DB
        df_status_db = df_status[['drone_id_mapped', 'Current_X', 'Current_Y', 'Battery_Level', 'Status']].copy()
        df_status_db.columns = ['drone_id', 'current_x', 'current_y', 'battery_level', 'status']
        df_status_db = df_status_db.replace({np.nan: None})
        
        print(f"Inserting {len(df_status_db)} drone statuses into fact_drone_status...")
        insert_status_query = """
        INSERT INTO fact_drone_status (drone_id, current_x, current_y, battery_level, status)
        VALUES %s
        ON CONFLICT (drone_id) DO UPDATE SET
            current_x = EXCLUDED.current_x,
            current_y = EXCLUDED.current_y,
            battery_level = EXCLUDED.battery_level,
            status = EXCLUDED.status;
        """
        records = [tuple(x) for x in df_status_db.to_numpy()]
        extras.execute_values(cur, insert_status_query, records)
        conn.commit()
    else:
        print(f"Warning: {drone_status_path} not found.")

    # 4. Migrate fact_orders (from fact_orders.csv)
    orders_path = os.path.join(SCRIPT_DIR, "fact_orders.csv")
    if os.path.exists(orders_path):
        print(f"Reading orders from {orders_path}...")
        try:
            df_orders = pd.read_csv(orders_path, sep=';')
            if 'Order_ID' not in df_orders.columns:
                df_orders = pd.read_csv(orders_path, sep=',')
        except Exception:
            df_orders = pd.read_csv(orders_path)
            
        df_orders.columns = ['order_id', 'customer_x', 'customer_y', 'total_weight_gram']
        df_orders['order_id'] = df_orders['order_id'].astype(str)
        df_orders = df_orders.replace({np.nan: None})
        
        print(f"Inserting {len(df_orders)} orders into fact_orders...")
        insert_orders_query = """
        INSERT INTO fact_orders (order_id, customer_x, customer_y, total_weight_gram)
        VALUES %s
        ON CONFLICT (order_id) DO NOTHING;
        """
        records = [tuple(x) for x in df_orders.to_numpy()]
        extras.execute_values(cur, insert_orders_query, records)
        conn.commit()
    else:
        print(f"Warning: {orders_path} not found.")

    cur.close()
    conn.close()
    print("[SUCCESS] Database migration completed successfully!")

if __name__ == "__main__":
    migrate()
