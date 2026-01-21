from app.database import SessionLocal
from sqlalchemy import text

def reset_migrations():
    db = SessionLocal()
    try:
        # Drop alembic_version table if exists
        db.execute(text("DROP TABLE IF EXISTS alembic_version"))
        db.commit()
        print("Successfully reset alembic version")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_migrations()