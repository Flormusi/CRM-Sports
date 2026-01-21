from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from ...database import get_db
from ...schemas.statistics import StatisticsResponse, ErrorResponse

router = APIRouter()

@router.get("/inventory-analytics",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_inventory_analytics(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    try:
        stock_metrics = """
            SELECT 
                p.product_category,
                p.name,
                p.current_stock,
                p.reorder_point,
                p.optimal_stock,
                COUNT(d.id) as monthly_sales,
                COALESCE(AVG(d.quantity), 0) as avg_order_quantity,
                p.current_stock / NULLIF(COUNT(d.id), 0) as weeks_of_inventory
            FROM products p
            LEFT JOIN deals d ON d.product_id = p.id 
                AND d.created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY p.id, p.product_category, p.name, p.current_stock, p.reorder_point, p.optimal_stock
            ORDER BY weeks_of_inventory ASC
            LIMIT :limit OFFSET :skip
        """
        
        restock_analysis = """
            SELECT 
                p.product_category,
                p.name,
                COUNT(r.id) as restock_count,
                AVG(r.quantity) as avg_restock_quantity,
                AVG(EXTRACT(EPOCH FROM (r.created_at - r.requested_at))/3600)::float as avg_restock_time,
                MAX(r.created_at) as last_restock_date
            FROM products p
            LEFT JOIN restocks r ON r.product_id = p.id
                AND r.created_at >= CURRENT_DATE - INTERVAL '90 days'
            GROUP BY p.product_category, p.name
        """
        
        stock_data = db.execute(text(stock_metrics), {"limit": limit, "skip": skip}).fetchall()
        restock_data = db.execute(text(restock_analysis)).fetchall()
        
        if not stock_data and not restock_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No inventory data found"
            )
        
        return {
            "success": True,
            "data": {
                "stock_levels": [
                    {
                        "product_category": row[0],
                        "product_name": row[1],
                        "current_stock": row[2],
                        "reorder_point": row[3],
                        "optimal_stock": row[4],
                        "monthly_sales": row[5],
                        "avg_order_quantity": float(row[6]),
                        "weeks_of_inventory": float(row[7] if row[7] else 0)
                    } for row in stock_data
                ],
                "restock_metrics": [
                    {
                        "product_category": row[0],
                        "product_name": row[1],
                        "restock_count": row[2],
                        "avg_restock_quantity": float(row[3] or 0),
                        "avg_restock_time_hours": float(row[4] or 0),
                        "last_restock_date": row[5].strftime("%Y-%m-%d") if row[5] else None
                    } for row in restock_data
                ]
            },
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching inventory analytics: {str(e)}"
        )