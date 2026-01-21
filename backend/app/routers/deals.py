from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..auth.utils import get_current_user
from ..auth.permissions import require_admin, require_sales_or_admin

router = APIRouter(
    prefix="/deals",
    tags=["deals"]
)

@router.post("/", response_model=schemas.Deal)
def create_deal(
    deal: schemas.DealCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_sales_or_admin())
):
    # Verify client exists
    client = db.query(models.Client).filter(models.Client.id == deal.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    db_deal = models.Deal(**deal.dict())
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    return db_deal

@router.get("/", response_model=List[schemas.Deal])
def get_deals(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    deals = db.query(models.Deal).offset(skip).limit(limit).all()
    return deals

@router.get("/{deal_id}", response_model=schemas.Deal)
def get_deal(
    deal_id: int, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal

@router.put("/{deal_id}", response_model=schemas.Deal)
def update_deal(
    deal_id: int, 
    deal: schemas.DealCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_sales_or_admin())
):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if db_deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    for key, value in deal.dict().items():
        setattr(db_deal, key, value)
    
    db.commit()
    db.refresh(db_deal)
    return db_deal

@router.delete("/{deal_id}")
def delete_deal(
    deal_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin())
):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    db.delete(deal)
    db.commit()
    return {"message": "Deal deleted successfully"}