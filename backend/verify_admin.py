from app.database import SessionLocal
from sqlalchemy import text

def verify_admin():
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT email, username, role FROM users WHERE role = 'admin'")).fetchall()
        print("Admin users in database:", result)
    except Exception as e:
        print("Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    verify_admin()