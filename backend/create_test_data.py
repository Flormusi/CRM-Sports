from app.database import SessionLocal
from app.models import User, Client, Deal, Activity, DealStage
from app.core.security import get_password_hash

def create_test_data():
    db = SessionLocal()
    try:
        # Create a test sales rep
        sales_rep = User(
            email="sales@crmsports.com",
            username="sales_rep1",
            hashed_password=get_password_hash("sales123"),
            role="sales_rep",
            is_active=True
        )
        db.add(sales_rep)
        db.flush()  # Get the ID without committing

        # Create a test client
        client = Client(
            name="Sports Club",
            email="contact@sportsclub.com",
            phone="123-456-7890",
            company="Sports Club Inc.",
            owner_id=sales_rep.id
        )
        db.add(client)
        db.flush()

        # Create a test deal
        deal = Deal(
            client_id=client.id,
            owner_id=sales_rep.id,
            stage=DealStage.CONTACT_MADE,
            amount=5000.00
        )
        db.add(deal)
        db.flush()

        # Create a test activity
        activity = Activity(
            deal_id=deal.id,
            type="call",
            description="Initial contact call with client"
        )
        db.add(activity)
        
        db.commit()
        print("Test data created successfully!")
        
    except Exception as e:
        print("Error creating test data:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()