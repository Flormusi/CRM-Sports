from app.database import SessionLocal
from sqlalchemy import text

def summarize_crm_data():
    db = SessionLocal()
    try:
        # Get summary by sales rep
        sales_summary = """
            SELECT 
                u.username,
                COUNT(DISTINCT c.id) as total_clients,
                COUNT(DISTINCT d.id) as total_deals,
                SUM(d.amount) as total_pipeline,
                COUNT(DISTINCT a.id) as total_activities
            FROM users u
            LEFT JOIN clients c ON c.owner_id = u.id
            LEFT JOIN deals d ON d.owner_id = u.id
            LEFT JOIN activities a ON a.deal_id = d.id
            WHERE u.role = 'sales_rep'
            GROUP BY u.username
        """
        
        print("\nSales Rep Summary:")
        print("-----------------")
        results = db.execute(text(sales_summary)).fetchall()
        for row in results:
            print(f"\nSales Rep: {row[0]}")
            print(f"Total Clients: {row[1]}")
            print(f"Total Deals: {row[2]}")
            print(f"Total Pipeline: ${row[3]:,.2f}")
            print(f"Total Activities: {row[4]}")

        # Get deal stages summary
        stage_summary = """
            SELECT 
                d.stage,
                COUNT(*) as deal_count,
                SUM(d.amount) as total_amount
            FROM deals d
            GROUP BY d.stage
        """
        
        print("\nDeal Stage Summary:")
        print("-----------------")
        results = db.execute(text(stage_summary)).fetchall()
        for row in results:
            print(f"\nStage: {row[0]}")
            print(f"Number of Deals: {row[1]}")
            print(f"Total Amount: ${row[2]:,.2f}")

    except Exception as e:
        print("Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    summarize_crm_data()