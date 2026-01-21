from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from .models import DealStage

class ClientBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class Client(ClientBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class DealBase(BaseModel):
    amount: float
    stage: DealStage = DealStage.LEAD

class DealCreate(DealBase):
    client_id: int

class Deal(DealBase):
    id: int
    client_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ActivityBase(BaseModel):
    type: str
    description: str

class ActivityCreate(ActivityBase):
    deal_id: int

class Activity(ActivityBase):
    id: int
    deal_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str