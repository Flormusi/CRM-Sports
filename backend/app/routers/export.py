from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.export import ExportService
from typing import Optional

router = APIRouter(prefix="/export", tags=["export"])

@router.get("/deals")
async def export_deals(
    format: str = "csv",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    
    query = """
        SELECT 
            d.id,
            d.created_at,
            d.status,
            d.amount,
            d.quantity,
            p.name as product_name,
            p.category as product_category,
            c.name as client_name,
            c.email as client_email,
            u.username as sales_rep
        FROM deals d
        JOIN products p ON p.id = d.product_id
        JOIN clients c ON c.id = d.client_id
        JOIN users u ON u.id = d.owner_id
        WHERE (:start_date IS NULL OR d.created_at >= :start_date)
        AND (:end_date IS NULL OR d.created_at <= :end_date)
        ORDER BY d.created_at DESC
    """
    
    params = {"start_date": start_date, "end_date": end_date}
    
    if format.lower() == "csv":
        content = export_service.export_to_csv(query, params)
        media_type = "text/csv"
        filename = "deals_export.csv"
    else:
        content = export_service.export_to_excel(query, params)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "deals_export.xlsx"
    
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )