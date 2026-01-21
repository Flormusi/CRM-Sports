from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime
import enum

class DealStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    WON = "won"
    LOST = "lost"

class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    amount = Column(Float)
    status = Column(Enum(DealStatus), default=DealStatus.PENDING)
    
    # Foreign Keys
    client_id = Column(Integer, ForeignKey("clients.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    client = relationship("Client", back_populates="deals")
    user = relationship("User", back_populates="deals")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)