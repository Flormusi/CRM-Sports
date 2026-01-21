from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from ...database import get_db
from ...schemas.statistics import StatisticsResponse, ErrorResponse
from ...services.cache import CacheService

router = APIRouter()

@router.get("/seasonal-trends",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_seasonal_trends(db: Session = Depends(get_db)):
    try:
        # Try to get from cache first
        cache_key = "seasonal_trends"
        cached_data = CacheService.get(cache_key)
        
        if cached_data:
            return {
                "success": True,
                "data": cached_data,
                "error": None
            }

        # If not in cache, query database
        seasonal_analysis = """
            SELECT 
                EXTRACT(MONTH FROM d.created_at) as month,
                d.product_category,
                COUNT(d.id) as sales_count,
                COALESCE(SUM(d.amount), 0) as revenue,
                COUNT(DISTINCT c.id) as unique_buyers,
                c.sport as primary_sport,
                AVG(d.amount) as avg_order_value,
                COUNT(CASE WHEN d2.id IS NOT NULL THEN 1 END) as repeat_orders
            FROM deals d
            JOIN clients c ON c.id = d.client_id
            LEFT JOIN deals d2 ON d2.client_id = c.id 
                AND d2.product_category = d.product_category
                AND d2.created_at > d.created_at
                AND d2.created_at <= d.created_at + INTERVAL '30 days'
            WHERE d.status = 'won'
            GROUP BY EXTRACT(MONTH FROM d.created_at), d.product_category, c.sport
            ORDER BY month, revenue DESC
        """
        
        popular_combinations = """
            SELECT 
                d1.product_category as product1,
                d2.product_category as product2,
                COUNT(*) as combination_count,
                c.sport,
                EXTRACT(MONTH FROM d1.created_at) as month,
                AVG(d1.amount + d2.amount) as avg_combo_value
            FROM deals d1
            JOIN deals d2 ON d1.client_id = d2.client_id 
                AND d1.id < d2.id 
                AND d1.created_at >= CURRENT_DATE - INTERVAL '12 months'
                AND d2.created_at >= CURRENT_DATE - INTERVAL '12 months'
                AND d2.created_at <= d1.created_at + INTERVAL '30 days'
            JOIN clients c ON c.id = d1.client_id
            WHERE d1.status = 'won' AND d2.status = 'won'
            GROUP BY d1.product_category, d2.product_category, c.sport, EXTRACT(MONTH FROM d1.created_at)
            ORDER BY month, combination_count DESC
        """
        
        seasonal_data = db.execute(text(seasonal_analysis)).fetchall()
        combinations_data = db.execute(text(popular_combinations)).fetchall()
        
        if not seasonal_data and not combinations_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No seasonal trends data found"
            )
        
        # Store in cache for 1 hour
        response_data = {
            "seasonal_patterns": [
                {
                    "month": int(row[0]),
                    "product_category": row[1],
                    "sales_count": row[2],
                    "revenue": float(row[3]),
                    "unique_buyers": row[4],
                    "primary_sport": row[5],
                    "avg_order_value": float(row[6] or 0),
                    "repeat_orders": row[7]
                } for row in seasonal_data
            ],
            "popular_combinations": [
                {
                    "product1": row[0],
                    "product2": row[1],
                    "frequency": row[2],
                    "sport": row[3],
                    "month": int(row[4]),
                    "avg_combo_value": float(row[5] or 0)
                } for row in combinations_data
            ]
        }
        
        CacheService.set(cache_key, response_data, 3600)  # Cache for 1 hour
        
        return {
            "success": True,
            "data": response_data,
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching seasonal trends: {str(e)}"
        )

@router.get("/reorder-analytics",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_reorder_analytics(db: Session = Depends(get_db)):
    try:
        reorder_metrics = """
            WITH customer_orders AS (
                SELECT 
                    c.id as client_id,
                    c.sport,
                    d.product_category,
                    COUNT(d.id) as order_count,
                    MAX(d.created_at) as last_order_date,
                    MIN(d.created_at) as first_order_date,
                    COUNT(DISTINCT DATE_TRUNC('month', d.created_at)) as unique_months
                FROM clients c
                JOIN deals d ON d.client_id = c.id
                WHERE d.status = 'won'
                GROUP BY c.id, c.sport, d.product_category
            )
            SELECT 
                product_category,
                sport,
                COUNT(*) as total_customers,
                AVG(order_count) as avg_orders_per_customer,
                AVG(unique_months) as avg_active_months,
                COUNT(CASE WHEN order_count > 1 THEN 1 END) as repeat_customers
            FROM customer_orders
            GROUP BY product_category, sport
            ORDER BY total_customers DESC
        """
        
        results = db.execute(text(reorder_metrics)).fetchall()
        
        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No reorder analytics data found"
            )
        
        return {
            "success": True,
            "data": [
                {
                    "product_category": row[0],
                    "sport": row[1],
                    "total_customers": row[2],
                    "avg_orders_per_customer": float(row[3]),
                    "avg_active_months": float(row[4]),
                    "repeat_customers": row[5]
                } for row in results
            ],
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching reorder analytics: {str(e)}"
        )