from app.database import SessionLocal
from sqlalchemy import text

def set_admin(email: str):
    db = SessionLocal()
    try:
        db.execute(
            text("UPDATE users SET role = 'admin' WHERE email = :email"),
            {"email": email}
        )
        db.commit()
        print(f"User {email} has been set as admin")
    except Exception as e:
        print("Error:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    admin_email = "your.email@example.com"  # Replace with actual admin email
    set_admin(admin_email)