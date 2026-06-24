import psycopg2

DB_URI = "postgresql://postgres.qhqynnxpeyhnjtiyifsi:DSS301_Project@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

def alter_table():
    conn = psycopg2.connect(DB_URI)
    cur = conn.cursor()
    try:
        cur.execute("ALTER TABLE fact_orders ADD COLUMN customer_address TEXT;")
        conn.commit()
        print("Successfully added customer_address column to fact_orders.")
    except Exception as e:
        conn.rollback()
        print(f"Error (column might already exist): {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    alter_table()
