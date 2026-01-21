from app.database import SessionLocal
from sqlalchemy import text

def verify_tables():
    db = SessionLocal()
    try:
        # Check all tables structure
        tables = ['users', 'deals', 'clients', 'activities']
        for table in tables:
            result = db.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")).fetchall()
            print(f"\n{table.upper()} table structure:")
            for col in result:
                print(f"- {col[0]}: {col[1]}")
    except Exception as e:
        print("Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    verify_tables()