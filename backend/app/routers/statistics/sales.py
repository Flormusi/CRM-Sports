from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from ...database import get_db
from ...schemas.statistics import StatisticsResponse, ErrorResponse

router = APIRouter()

@router.get("/sales-summary",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_sales_summary(db: Session = Depends(get_db)):
    try:
        sales_query = """
            SELECT 
                DATE_TRUNC('month', d.created_at) as month,
                COUNT(d.id) as total_sales,
                SUM(d.amount) as revenue,
                COUNT(DISTINCT d.client_id) as unique_customers,
                AVG(d.amount) as avg_order_value
            FROM deals d
            WHERE d.status = 'won'
                AND d.created_at >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', d.created_at)
            ORDER BY month DESC
        """
        
        results = db.execute(text(sales_query)).fetchall()
        
        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No sales data found"
            )
        
        return {
            "success": True,
            "data": [
                {
                    "month": row[0].strftime("%Y-%m"),
                    "total_sales": row[1],
                    "revenue": float(row[2]),
                    "unique_customers": row[3],
                    "avg_order_value": float(row[4])
                } for row in results
            ],
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching sales summary: {str(e)}"
        )