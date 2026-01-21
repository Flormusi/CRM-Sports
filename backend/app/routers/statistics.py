from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..database import get_db
from sqlalchemy import text
from pathlib import Path
import os

router = APIRouter(
    prefix="/statistics",
    tags=["statistics"]
)

@router.get("/sales-summary", 
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_sales_summary(db: Session = Depends(get_db)):
    try:
        sales_summary = """
            SELECT 
                u.username,
                COUNT(DISTINCT c.id) as total_clients,
                COUNT(DISTINCT d.id) as total_deals,
                COALESCE(SUM(d.amount), 0) as total_pipeline,
                COUNT(DISTINCT a.id) as total_activities
            FROM users u
            LEFT JOIN clients c ON c.owner_id = u.id
            LEFT JOIN deals d ON d.owner_id = u.id
            LEFT JOIN activities a ON a.deal_id = d.id
            WHERE u.role = 'sales_rep'
            GROUP BY u.username
        """
        
        sales_data = db.execute(text(sales_summary)).fetchall()
        stage_data = db.execute(text(stage_summary)).fetchall()
        
        if not sales_data and not stage_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No sales data found"
            )
        
        return {
            "success": True,
            "data": {
                "sales_summary": [
                    {
                        "username": row[0],
                        "total_clients": row[1],
                        "total_deals": row[2],
                        "total_pipeline": float(row[3]),
                        "total_activities": row[4]
                    } for row in sales_data
                ],
                "stage_summary": [
                    {
                        "stage": row[0],
                        "deal_count": row[1],
                        "total_amount": float(row[2])
                    } for row in stage_data
                ]
            },
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching sales summary: {str(e)}"
        )

@router.get("/dashboard",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        # Get total counts
        total_clients = db.query(Client).count()
        total_deals = db.query(Deal).count()
        total_activities = db.query(Activity).count()

        # Get deals by status
        deals_by_status = db.query(
            Deal.status,
            func.count(Deal.id).label("count"),
            func.sum(Deal.amount).label("total_amount")
        ).group_by(Deal.status).all()

        # Get recent activities
        recent_activities = db.query(Activity).order_by(
            Activity.created_at.desc()
        ).limit(5).all()

        if not deals_by_status and not recent_activities:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No dashboard data found"
            )

        return {
            "success": True,
            "data": {
                "total_clients": total_clients,
                "total_deals": total_deals,
                "total_activities": total_activities,
                "deals_by_status": deals_by_status,
                "recent_activities": recent_activities
            },
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching dashboard statistics: {str(e)}"
        )

@router.get("/performance-metrics",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_performance_metrics(db: Session = Depends(get_db)):
    try:
        monthly_metrics = """
            SELECT 
                DATE_TRUNC('month', d.created_at) as month,
                COUNT(d.id) as deals_count,
                SUM(CASE WHEN d.status = 'won' THEN d.amount ELSE 0 END) as revenue,
                COUNT(DISTINCT c.id) as new_clients
            FROM deals d
            LEFT JOIN clients c ON c.id = d.client_id
            GROUP BY DATE_TRUNC('month', d.created_at)
            ORDER BY month DESC
            LIMIT 12
        """
        
        results = db.execute(text(monthly_metrics)).fetchall()
        
        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No performance metrics data found"
            )
        
        return {
            "success": True,
            "data": [
                {
                    "month": row[0].strftime("%Y-%m"),
                    "deals_count": row[1],
                    "revenue": float(row[2] or 0),
                    "new_clients": row[3]
                } for row in results
            ],
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching performance metrics: {str(e)}"
        )

@router.get("/sports-distribution")
async def get_sports_distribution(db: Session = Depends(get_db)):
    sports_metrics = """
        SELECT 
            c.sport,
            COUNT(c.id) as client_count,
            COUNT(DISTINCT d.id) as deals_count,
            COALESCE(SUM(CASE WHEN d.status = 'won' THEN d.amount ELSE 0 END), 0) as revenue
        FROM clients c
        LEFT JOIN deals d ON d.client_id = c.id
        GROUP BY c.sport
        ORDER BY client_count DESC
    """
    
    activity_by_sport = """
        SELECT 
            c.sport,
            COUNT(a.id) as activity_count,
            a.type as activity_type
        FROM clients c
        LEFT JOIN activities a ON a.client_id = c.id
        GROUP BY c.sport, a.type
    """
    
    sports_data = db.execute(text(sports_metrics)).fetchall()
    activity_data = db.execute(text(activity_by_sport)).fetchall()
    
    return {
        "sports_metrics": [
            {
                "sport": row[0],
                "client_count": row[1],
                "deals_count": row[2],
                "revenue": float(row[3])
            } for row in sports_data
        ],
        "activity_distribution": [
            {
                "sport": row[0],
                "activity_count": row[1],
                "activity_type": row[2]
            } for row in activity_data
        ]
    }
@router.get("/activity-trends",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_activity_trends(db: Session = Depends(get_db)):
    try:
        daily_activity_trends = """
            SELECT 
                DATE_TRUNC('day', a.created_at) as day,
                a.type,
                COUNT(a.id) as activity_count,
                COUNT(DISTINCT c.id) as clients_involved,
                COUNT(DISTINCT d.id) as deals_involved,
                STRING_AGG(DISTINCT d.product_category, ', ') as supplements_discussed
            FROM activities a
            LEFT JOIN clients c ON c.id = a.client_id
            LEFT JOIN deals d ON d.id = a.deal_id
            WHERE a.created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('day', a.created_at), a.type
            ORDER BY day DESC
        """
        
        activity_completion = """
            SELECT 
                a.type,
                COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN a.status = 'pending' THEN 1 END) as pending,
                AVG(EXTRACT(EPOCH FROM (a.completed_at - a.created_at))/3600)::float as avg_completion_hours,
                COUNT(DISTINCT d.product_category) as supplement_types_involved
            FROM activities a
            LEFT JOIN deals d ON d.id = a.deal_id
            WHERE a.created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY a.type
        """
        
        trends_data = db.execute(text(daily_activity_trends)).fetchall()
        completion_data = db.execute(text(activity_completion)).fetchall()
        
        if not trends_data and not completion_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No activity trends data found"
            )
        
        return {
            "success": True,
            "data": {
                "daily_trends": [
                    {
                        "date": row[0].strftime("%Y-%m-%d"),
                        "activity_type": row[1],
                        "count": row[2],
                        "clients_involved": row[3],
                        "deals_involved": row[4],
                        "supplements_discussed": row[5]
                    } for row in trends_data
                ],
                "completion_metrics": [
                    {
                        "activity_type": row[0],
                        "completed": row[1],
                        "pending": row[2],
                        "avg_completion_hours": float(row[3] if row[3] else 0),
                        "supplement_types_involved": row[4]
                    } for row in completion_data
                ]
            },
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching activity trends: {str(e)}"
        )
@router.get("/supplement-analytics",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
@cache(expire=timedelta(hours=1))  # Cache for 1 hour
async def get_supplement_analytics(
    db: Session = Depends(get_db),
    period: str = "all"  # Options: "all", "year", "quarter", "month"
):
    try:
        time_filter = ""
        if period == "year":
            time_filter = "WHERE d.created_at >= CURRENT_DATE - INTERVAL '1 year'"
        elif period == "quarter":
            time_filter = "WHERE d.created_at >= CURRENT_DATE - INTERVAL '3 months'"
        elif period == "month":
            time_filter = "WHERE d.created_at >= CURRENT_DATE - INTERVAL '1 month'"
        
        supplement_performance = f"""
            SELECT 
                d.product_category,
                COUNT(d.id) as total_sales,
                COALESCE(SUM(d.amount), 0) as revenue
                COUNT(DISTINCT c.id) as unique_customers,
                COUNT(CASE WHEN d.status = 'won' THEN 1 END)::float / COUNT(d.id) * 100 as conversion_rate,
                AVG(d.amount) as avg_order_value,
                COUNT(CASE WHEN d2.id IS NOT NULL THEN 1 END)::float / COUNT(DISTINCT c.id) * 100 as repeat_purchase_rate
            FROM deals d
            LEFT JOIN clients c ON c.id = d.client_id
            LEFT JOIN deals d2 ON d2.client_id = c.id 
                AND d2.product_category = d.product_category 
                AND d2.created_at > d.created_at
            GROUP BY d.product_category
            ORDER BY revenue DESC
        """
        
        sport_preferences = """
            SELECT 
                c.sport,
                d.product_category,
                COUNT(d.id) as sales_count,
                COALESCE(SUM(d.amount), 0) as total_revenue,
                COUNT(DISTINCT c.id) as unique_athletes,
                AVG(d.amount) as avg_athlete_spend
            FROM clients c
            JOIN deals d ON d.client_id = c.id
            WHERE d.status = 'won'
            GROUP BY c.sport, d.product_category
            ORDER BY total_revenue DESC
        """
        
        supplement_data = db.execute(text(supplement_performance)).fetchall()
        preferences_data = db.execute(text(sport_preferences)).fetchall()
        
        if not supplement_data and not preferences_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No supplement analytics data found"
            )
        
        return {
            "success": True,
            "data": {
                "supplement_metrics": [
                    {
                        "category": row[0],
                        "total_sales": row[1],
                        "revenue": float(row[2]),
                        "unique_customers": row[3],
                        "conversion_rate": float(row[4]),
                        "avg_order_value": float(row[5] or 0),
                        "repeat_purchase_rate": float(row[6] or 0)
                    } for row in supplement_data
                ],
                "sport_preferences": [
                    {
                        "sport": row[0],
                        "product_category": row[1],
                        "sales_count": row[2],
                        "revenue": float(row[3]),
                        "unique_athletes": row[4],
                        "avg_athlete_spend": float(row[5] or 0)
                    } for row in preferences_data
                ]
            },
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching supplement analytics: {str(e)}"
        )
@router.get("/seasonal-trends",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_seasonal_trends(db: Session = Depends(get_db)):
    try:
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
        
        return {
            "success": True,
            "data": {
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
            },
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
                COUNT(CASE WHEN order_count > 1 THEN 1 END) as returning_customers,
                AVG(order_count) as avg_orders_per_customer,
                AVG(EXTRACT(EPOCH FROM (last_order_date - first_order_date))/86400)::float as avg_days_between_orders
            FROM customer_orders
            GROUP BY product_category, sport
            ORDER BY returning_customers DESC
        """
        
        retention_analysis = """
            SELECT 
                d1.product_category,
                COUNT(DISTINCT d1.client_id) as initial_customers,
                COUNT(DISTINCT d2.client_id) as retained_customers,
                COUNT(DISTINCT d2.client_id)::float / COUNT(DISTINCT d1.client_id) * 100 as retention_rate
            FROM deals d1
            LEFT JOIN deals d2 ON d1.client_id = d2.client_id 
                AND d2.created_at > d1.created_at
                AND d2.created_at <= d1.created_at + INTERVAL '3 months'
                AND d2.product_category = d1.product_category
            WHERE d1.status = 'won'
            GROUP BY d1.product_category
        """
        
        reorder_data = db.execute(text(reorder_metrics)).fetchall()
        retention_data = db.execute(text(retention_analysis)).fetchall()
        
        if not reorder_data and not retention_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No reorder data found"
            )
        
        return {
            "success": True,
            "data": {
                "reorder_patterns": [
                    {
                        "product_category": row[0],
                        "sport": row[1],
                        "total_customers": row[2],
                        "returning_customers": row[3],
                        "avg_orders_per_customer": float(row[4]),
                        "avg_days_between_orders": float(row[5] or 0)
                    } for row in reorder_data
                ],
                "retention_metrics": [
                    {
                        "product_category": row[0],
                        "initial_customers": row[1],
                        "retained_customers": row[2],
                        "retention_rate": float(row[3])
                    } for row in retention_data
                ]
            },
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching reorder analytics: {str(e)}"
        )
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
        stock_metrics = f"""
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
        
        stock_data = db.execute(text(stock_metrics)).fetchall()
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
@router.get("/recommendations/{client_id}",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "Client not found"}
    })
async def get_client_recommendations(client_id: int, db: Session = Depends(get_db)):
    try:
        # Get client's purchase history and preferences
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
        
        # Find related supplement categories
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
        
        # Get trending supplements
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
@router.get("/customer-segments",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_customer_segments(db: Session = Depends(get_db)):
    try:
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
@router.get("/seasonal-trends",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "No data found"}
    })
async def get_seasonal_trends(db: Session = Depends(get_db)):
    try:
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
        
        return {
            "success": True,
            "data": {
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
            },
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
                COUNT(CASE WHEN order_count > 1 THEN 1 END) as returning_customers,
                AVG(order_count) as avg_orders_per_customer,
                AVG(EXTRACT(EPOCH FROM (last_order_date - first_order_date))/86400)::float as avg_days_between_orders
            FROM customer_orders
            GROUP BY product_category, sport
            ORDER BY returning_customers DESC
        """
        
        retention_analysis = """
            SELECT 
                d1.product_category,
                COUNT(DISTINCT d1.client_id) as initial_customers,
                COUNT(DISTINCT d2.client_id) as retained_customers,
                COUNT(DISTINCT d2.client_id)::float / COUNT(DISTINCT d1.client_id) * 100 as retention_rate
            FROM deals d1
            LEFT JOIN deals d2 ON d1.client_id = d2.client_id 
                AND d2.created_at > d1.created_at
                AND d2.created_at <= d1.created_at + INTERVAL '3 months'
                AND d2.product_category = d1.product_category
            WHERE d1.status = 'won'
            GROUP BY d1.product_category
        """
        
        reorder_data = db.execute(text(reorder_metrics)).fetchall()
        retention_data = db.execute(text(retention_analysis)).fetchall()
        
        if not reorder_data and not retention_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No reorder data found"
            )
        
        return {
            "success": True,
            "data": {
                "reorder_patterns": [
                    {
                        "product_category": row[0],
                        "sport": row[1],
                        "total_customers": row[2],
                        "returning_customers": row[3],
                        "avg_orders_per_customer": float(row[4]),
                        "avg_days_between_orders": float(row[5] or 0)
                    } for row in reorder_data
                ],
                "retention_metrics": [
                    {
                        "product_category": row[0],
                        "initial_customers": row[1],
                        "retained_customers": row[2],
                        "retention_rate": float(row[3])
                    } for row in retention_data
                ]
            },
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching reorder analytics: {str(e)}"
        )
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
        stock_metrics = f"""
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
        
        stock_data = db.execute(text(stock_metrics)).fetchall()
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
@router.get("/recommendations/{client_id}",
    response_model=StatisticsResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Database error"},
        404: {"model": ErrorResponse, "description": "Client not found"}
    })
async def get_client_recommendations(client_id: int, db: Session = Depends(get_db)):
    try:
        # Get client's purchase history and preferences
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
        
        # Find related supplement categories
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
        
        # Get trending supplements
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