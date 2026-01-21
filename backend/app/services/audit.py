from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, Dict, Any

class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def log_activity(
        self,
        user_id: int,
        action: str,
        resource_type: str,
        resource_id: Optional[int],
        details: Dict[str, Any]
    ):
        query = """
            INSERT INTO audit_log (
                user_id, action, resource_type, 
                resource_id, details, created_at
            ) VALUES (
                :user_id, :action, :resource_type,
                :resource_id, :details, :created_at
            )
        """
        
        self.db.execute(
            text(query),
            {
                "user_id": user_id,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "details": json.dumps(details),
                "created_at": datetime.utcnow()
            }
        )
        self.db.commit()