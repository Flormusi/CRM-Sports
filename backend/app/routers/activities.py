from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..auth.utils import get_current_user
from ..auth.permissions import require_admin, require_sales_or_admin

router = APIRouter(
    prefix="/activities",
    tags=["activities"]
)

@router.post("/", response_model=schemas.Activity)
def create_activity(
    activity: schemas.ActivityCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_sales_or_admin())
):
    # Verify deal exists
    deal = db.query(models.Deal).filter(models.Deal.id == activity.deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    db_activity = models.Activity(**activity.dict())
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity

# Add similar protection to other activity endpoints

@router.get("/deal/{deal_id}", response_model=List[schemas.Activity])
def get_deal_activities(
    deal_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_sales_or_admin())
):
    activities = db.query(models.Activity).filter(models.Activity.deal_id == deal_id).all()
    return activities

@router.get("/{activity_id}", response_model=schemas.Activity)
def get_activity(
    activity_id: int, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity

@router.put("/{activity_id}", response_model=schemas.Activity)
def update_activity(
    activity_id: int, 
    activity: schemas.ActivityCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_sales_or_admin())
):
    db_activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if db_activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Verify new deal exists if deal_id is being updated
    if activity.deal_id != db_activity.deal_id:
        deal = db.query(models.Deal).filter(models.Deal.id == activity.deal_id).first()
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")
    
    for key, value in activity.dict().items():
        setattr(db_activity, key, value)
    
    db.commit()
    db.refresh(db_activity)
    return db_activity

@router.delete("/{activity_id}")
def delete_activity(
    activity_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin())
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    db.delete(activity)
    db.commit()
    return {"message": "Activity deleted successfully"}