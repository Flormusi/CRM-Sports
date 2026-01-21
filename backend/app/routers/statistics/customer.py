from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from ...database import get_db
from ...schemas.statistics import StatisticsResponse, ErrorResponse
from ...services.recommender import RecommenderService
from ...services.cache import CacheService

router = APIRouter()

@router.get("/customer-segments",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
@router.get("/customer-segments")
async def get_customer_segments(db: Session = Depends(get_db)):
    try:
        # Check cache first
        cache_key = "customer_segments"
        cached_data = CacheService.get(cache_key)
        
        if cached_data:
            return {
                "success": True,
                "data": cached_data,
                "error": None
            }
            
        customer_segments = """
            WITH customer_metrics AS (
                SELECT 
                    c.id,
                    COUNT(d.id) as purchase_count,
                    COALESCE(SUM(d.amount), 0) as total_spent,
                    MAX(d.created_at) as last_purchase,
                    COUNT(DISTINCT d.product_category) as category_count
                FROM clients c
                LEFT JOIN deals d ON d.client_id = c.id AND d.status = 'won'
                GROUP BY c.id
            )
            SELECT 
                CASE 
                    WHEN total_spent > 1000 AND purchase_count > 5 THEN 'VIP'
                    WHEN total_spent > 500 OR purchase_count > 3 THEN 'Regular'
                    ELSE 'New'
                END as segment,
                COUNT(*) as customer_count,
                AVG(total_spent) as avg_spend,
                AVG(purchase_count) as avg_purchases,
                AVG(category_count) as avg_categories
            FROM customer_metrics
            GROUP BY 
                CASE 
                    WHEN total_spent > 1000 AND purchase_count > 5 THEN 'VIP'
                    WHEN total_spent > 500 OR purchase_count > 3 THEN 'Regular'
                    ELSE 'New'
                END
        """
        
        results = db.execute(text(customer_segments)).fetchall()
        
        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No customer segmentation data found"
            )
        
        return {
            "success": True,
            "data": [
                {
                    "segment": row[0],
                    "customer_count": row[1],
                    "avg_spend": float(row[2]),
                    "avg_purchases": float(row[3]),
                    "avg_categories": float(row[4])
                } for row in results
            ],
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating customer segments: {str(e)}"
        )

@router.get("/recommendations/{client_id}",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "Client not found"}
    })
async def get_client_recommendations(client_id: int, db: Session = Depends(get_db)):
    try:
        client_profile = """
            SELECT 
                STRING_AGG(DISTINCT d.product_category, ',') as purchased_categories,
                COUNT(d.id) as total_purchases,
                AVG(d.amount) as avg_spend,
                MAX(d.created_at) as last_purchase_date
            FROM deals d
            WHERE d.client_id = :client_id AND d.status = 'won'
            GROUP BY d.client_id
        """
        
        related_supplements = """
            SELECT 
                d2.product_category,
                COUNT(d2.id) as purchase_count,
                AVG(d2.amount) as avg_price
            FROM deals d1
            JOIN deals d2 ON d2.product_category != d1.product_category
            WHERE d1.client_id = :client_id
                AND d2.status = 'won'
                AND d2.product_category NOT IN (
                    SELECT DISTINCT product_category 
                    FROM deals 
                    WHERE client_id = :client_id AND status = 'won'
                )
            GROUP BY d2.product_category
            ORDER BY purchase_count DESC
            LIMIT 5
        """
        
        trending_supplements = """
            SELECT 
                d.product_category,
                COUNT(d.id) as recent_sales,
                AVG(d.amount) as avg_price
            FROM deals d
            WHERE d.created_at >= CURRENT_DATE - INTERVAL '30 days'
                AND d.status = 'won'
                AND d.product_category NOT IN (
                    SELECT DISTINCT product_category 
                    FROM deals 
                    WHERE client_id = :client_id AND status = 'won'
                )
            GROUP BY d.product_category
            ORDER BY recent_sales DESC
            LIMIT 3
        """
        
        profile = db.execute(text(client_profile), {"client_id": client_id}).fetchone()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )
        
        related = db.execute(text(related_supplements), {"client_id": client_id}).fetchall()
        trending = db.execute(text(trending_supplements), {"client_id": client_id}).fetchall()
        
        return {
            "success": True,
            "data": {
                "purchase_history": {
                    "purchased_categories": profile[0].split(',') if profile[0] else [],
                    "total_purchases": profile[1],
                    "avg_spend": float(profile[2] or 0),
                    "last_purchase": profile[3].strftime("%Y-%m-%d") if profile[3] else None
                },
                "recommended_supplements": [
                    {
                        "category": row[0],
                        "popularity": row[1],
                        "avg_price": float(row[2] or 0),
                        "recommendation_type": "related"
                    } for row in related
                ],
                "trending_supplements": [
                    {
                        "category": row[0],
                        "recent_sales": row[1],
                        "avg_price": float(row[2] or 0)
                    } for row in trending
                ]
            },
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating recommendations: {str(e)}"
        )

@router.get("/client-insights/{client_id}",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "Client not found"}
    })
async def get_client_insights(client_id: int, db: Session = Depends(get_db)):
    try:
        # Check cache first
        cache_key = f"client_insights_{client_id}"
        cached_data = CacheService.get(cache_key)
        
        if cached_data:
            return {
                "success": True,
                "data": cached_data,
                "error": None
            }

        # Get recommendations
        recommender = RecommenderService(db)
        product_recommendations = recommender.get_product_recommendations(client_id)

        # Get client profile and history
        client_query = """
            SELECT 
                c.name,
                c.sport,
                COUNT(d.id) as total_purchases,
                COALESCE(SUM(d.amount), 0) as total_spent,
                MAX(d.created_at) as last_purchase,
                COUNT(DISTINCT d.product_category) as categories_bought
            FROM clients c
            LEFT JOIN deals d ON d.client_id = c.id AND d.status = 'won'
            WHERE c.id = :client_id
            GROUP BY c.id, c.name, c.sport
        """
        
        client_data = db.execute(text(client_query), {"client_id": client_id}).fetchone()
        
        if not client_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )

        response_data = {
            "client_profile": {
                "name": client_data[0],
                "sport": client_data[1],
                "total_purchases": client_data[2],
                "total_spent": float(client_data[3]),
                "last_purchase": client_data[4].strftime("%Y-%m-%d") if client_data[4] else None,
                "categories_bought": client_data[5]
            },
            "recommended_products": product_recommendations
        }

        # Add purchase prediction and churn analysis
        prediction = db.execute(text(next_purchase_query), {"client_id": client_id}).fetchone()
        churn_data = db.execute(text(churn_query), {"client_id": client_id}).fetchone()
        
        response_data.update({
            "purchase_prediction": {
                "avg_days_between_purchases": float(prediction[0]) if prediction and prediction[0] else None,
                "predicted_next_purchase": prediction[1].strftime("%Y-%m-%d") if prediction and prediction[1] else None
            },
            "churn_analysis": {
                "risk_level": churn_data[0] if churn_data else "Unknown",
                "days_inactive": churn_data[1].days if churn_data and churn_data[1] else None
            }
        })

        # Cache for 1 hour
        CacheService.set(cache_key, response_data, 3600)

        return {
            "success": True,
            "data": response_data,
            "error": None
        }

        # Add purchase prediction
        next_purchase_query = """
            WITH purchase_intervals AS (
                SELECT 
                    client_id,
                    created_at,
                    LAG(created_at) OVER (PARTITION BY client_id ORDER BY created_at) as prev_purchase,
                    EXTRACT(EPOCH FROM (
                        created_at - LAG(created_at) OVER (PARTITION BY client_id ORDER BY created_at)
                    ))/86400 as days_between
                FROM deals
                WHERE status = 'won'
            )
            SELECT 
                AVG(days_between) as avg_interval,
                MAX(created_at) + (AVG(days_between) * INTERVAL '1 day') as predicted_next
            FROM purchase_intervals
            WHERE client_id = :client_id AND days_between IS NOT NULL
        """
        
        prediction = db.execute(text(next_purchase_query), {"client_id": client_id}).fetchone()
        
        response_data["purchase_prediction"] = {
            "avg_days_between_purchases": float(prediction[0]) if prediction[0] else None,
            "predicted_next_purchase": prediction[1].strftime("%Y-%m-%d") if prediction[1] else None
        }

        # Add to client-insights endpoint
                churn_query = """
                    SELECT 
                        CASE 
                            WHEN MAX(d.created_at) < CURRENT_DATE - INTERVAL '90 days' THEN 'High'
                            WHEN MAX(d.created_at) < CURRENT_DATE - INTERVAL '60 days' THEN 'Medium'
                            ELSE 'Low'
                        END as churn_risk,
                        CURRENT_DATE - MAX(d.created_at) as days_since_last_purchase
                    FROM deals d
                    WHERE d.client_id = :client_id AND d.status = 'won'
                """
                
                churn_data = db.execute(text(churn_query), {"client_id": client_id}).fetchone()
                
                response_data["churn_analysis"] = {
                    "risk_level": churn_data[0] if churn_data else "Unknown",
                    "days_inactive": churn_data[1].days if churn_data and churn_data[1] else None
                }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching client insights: {str(e)}"
        )