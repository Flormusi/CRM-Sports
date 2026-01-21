from app.database import SessionLocal
from sqlalchemy import text

def verify_relationships():
    db = SessionLocal()
    try:
        # Query to get sales rep with their clients and deals
        query = """
            SELECT 
                u.username, u.email, u.role,
                c.name as client_name, c.email as client_email,
                d.amount as deal_amount, d.stage as deal_stage,
                a.type as activity_type, a.description as activity_desc
            FROM users u
            LEFT JOIN clients c ON c.owner_id = u.id
            LEFT JOIN deals d ON d.client_id = c.id
            LEFT JOIN activities a ON a.deal_id = d.id
            WHERE u.role = 'sales_rep'
        """
        result = db.execute(text(query)).fetchall()
        
        print("\nSales Rep Relationships:")
        for row in result:
            print("\nUser:", row[0])
            print("- Email:", row[1])
            print("- Role:", row[2])
            print("- Client:", row[3])
            print("- Client Email:", row[4])
            print("- Deal Amount:", row[5])
            print("- Deal Stage:", row[6])
            print("- Activity Type:", row[7])
            print("- Activity Description:", row[8])
            
    except Exception as e:
        print("Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    verify_relationships()