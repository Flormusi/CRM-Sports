from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base

class DealStage(str, enum.Enum):
    LEAD = "lead"
    CONTACT_MADE = "contact_made"
    PROPOSAL_SENT = "proposal_sent"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    SALES_REP = "sales_rep"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String(50), default=UserRole.SALES_REP)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    deals = relationship("Deal", back_populates="owner")
    clients = relationship("Client", back_populates="owner")

class Deal(Base):
    __tablename__ = "deals"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"))
    owner_id = Column(Integer, ForeignKey("users.id"))
    stage = Column(Enum(DealStage), default=DealStage.LEAD)
    amount = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    client = relationship("Client", back_populates="deals")
    owner = relationship("User", back_populates="deals")
    activities = relationship("Activity", back_populates="deal")

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    company = Column(String)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    deals = relationship("Deal", back_populates="client")
    owner = relationship("User", back_populates="clients")

class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"))
    type = Column(String)
    description = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    deal = relationship("Deal", back_populates="activities")