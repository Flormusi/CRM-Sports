from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from ...database import get_db
from ...schemas.statistics import StatisticsResponse, ErrorResponse

router = APIRouter()

@router.get("/product-analytics",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_product_analytics(db: Session = Depends(get_db)):
    try:
        product_metrics = """
            SELECT 
                p.category,
                COUNT(DISTINCT p.id) as product_count,
                SUM(d.quantity) as total_units_sold,
                AVG(d.amount) as avg_price,
                COUNT(DISTINCT d.client_id) as unique_customers,
                COUNT(DISTINCT d.id) as total_sales
            FROM products p
            LEFT JOIN deals d ON d.product_id = p.id AND d.status = 'won'
            GROUP BY p.category
            ORDER BY total_units_sold DESC
        """
        
        results = db.execute(text(product_metrics)).fetchall()
        
        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No product analytics data found"
            )
        
        return {
            "success": True,
            "data": [
                {
                    "category": row[0],
                    "product_count": row[1],
                    "total_units_sold": row[2],
                    "avg_price": float(row[3] or 0),
                    "unique_customers": row[4],
                    "total_sales": row[5]
                } for row in results
            ],
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching product analytics: {str(e)}"
        )