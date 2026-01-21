from app.database import SessionLocal
from sqlalchemy import text

def check_roles():
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT DISTINCT role FROM users")).fetchall()
        print("Current roles in database:", result)
    except Exception as e:
        print("Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    check_roles()