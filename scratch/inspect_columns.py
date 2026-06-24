import psycopg2

DB_URI = "postgresql://postgres.qhqynnxpeyhnjtiyifsi:DSS301_Project@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

def inspect():
    conn = psycopg2.connect(DB_URI)
    cur = conn.cursor()
    
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fact_orders'")
    print("Columns in fact_orders:")
    for row in cur.fetchall():
        print(f" - {row[0]}: {row[1]}")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    inspect()
