from app.database import SessionLocal
from app.models import User
from app.core.security import get_password_hash

def create_admin():
    db = SessionLocal()
    try:
        admin = User(
            email="admin@crmsports.com",
            username="admin",
            hashed_password=get_password_hash("admin123"),  # Change this password
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
        print("Admin user created successfully!")
    except Exception as e:
        print("Error creating admin:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()