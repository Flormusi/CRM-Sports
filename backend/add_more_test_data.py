from app.database import SessionLocal
from app.models import User, Client, Deal, Activity, DealStage
from app.core.security import get_password_hash
from datetime import datetime, timedelta

def add_more_test_data():
    db = SessionLocal()
    try:
        # Create another sales rep
        sales_rep2 = User(
            email="sales2@crmsports.com",
            username="sales_rep2",
            hashed_password=get_password_hash("sales123"),
            role="sales_rep",
            is_active=True
        )
        db.add(sales_rep2)
        db.flush()

        # Create more clients
        clients_data = [
            {
                "name": "City Gym",
                "email": "manager@citygym.com",
                "phone": "555-0123",
                "company": "City Gym Ltd",
                "owner_id": sales_rep2.id
            },
            {
                "name": "School Athletics",
                "email": "sports@school.edu",
                "phone": "555-0124",
                "company": "School District",
                "owner_id": sales_rep2.id
            }
        ]

        for client_data in clients_data:
            client = Client(**client_data)
            db.add(client)
            db.flush()

            # Create deal for each client
            deal = Deal(
                client_id=client.id,
                owner_id=sales_rep2.id,
                stage=DealStage.PROPOSAL_SENT,
                amount=10000.00 if "Gym" in client.name else 7500.00
            )
            db.add(deal)
            db.flush()

            # Add activities for each deal
            activities = [
                {
                    "deal_id": deal.id,
                    "type": "email",
                    "description": f"Sent initial proposal to {client.name}"
                },
                {
                    "deal_id": deal.id,
                    "type": "meeting",
                    "description": f"Product demonstration with {client.name}"
                }
            ]

            for activity_data in activities:
                activity = Activity(**activity_data)
                db.add(activity)

        db.commit()
        print("Additional test data created successfully!")
        
    except Exception as e:
        print("Error creating additional test data:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_more_test_data()