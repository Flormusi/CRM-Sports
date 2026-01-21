from app.database import SessionLocal
from sqlalchemy import text

def cleanup_duplicates():
    db = SessionLocal()
    try:
        # First, identify and keep only the earliest activity for each combination
        query = """
            DELETE FROM activities a1 USING (
                SELECT id, deal_id,
                       ROW_NUMBER() OVER (
                           PARTITION BY deal_id, 
                           CASE 
                               WHEN type = 'call' AND description LIKE '%Initial contact%' THEN 'initial_call'
                               ELSE type 
                           END
                           ORDER BY created_at
                       ) as rnum
                FROM activities
            ) a2
            WHERE a1.id = a2.id AND a2.rnum > 1;
        """
        
        result = db.execute(text(query))
        db.commit()
        print(f"Removed {result.rowcount} duplicate activities")
        
    except Exception as e:
        print("Error:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_duplicates()