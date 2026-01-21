from fastapi import APIRouter, Depends, HTTPException, status
from ..services.cache import CacheService
from ..auth.dependencies import get_current_admin_user
from sqlalchemy.orm import Session
from ..database import get_db
from sqlalchemy import text

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/cache/clear/{cache_key}")
async def clear_cache(cache_key: str, _=Depends(get_current_admin_user)):
    try:
        CacheService.delete(cache_key)
        return {"success": True, "message": f"Cache {cache_key} cleared successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing cache: {str(e)}"
        )

@router.post("/cache/clear-all")
async def clear_all_cache(_=Depends(get_current_admin_user)):
    try:
        CacheService.clear_all()
        return {"success": True, "message": "All cache cleared successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing all cache: {str(e)}"
        )

@router.get("/system-stats")
async def get_system_stats(db: Session = Depends(get_db), _=Depends(get_current_admin_user)):
    try:
        stats_query = """
            SELECT
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM clients) as total_clients,
                (SELECT COUNT(*) FROM deals WHERE status = 'won') as completed_deals,
                (SELECT COALESCE(SUM(amount), 0) FROM deals WHERE status = 'won') as total_revenue,
                (SELECT COUNT(*) FROM products WHERE current_stock < reorder_point) as low_stock_items
        """
        
        stats = db.execute(text(stats_query)).fetchone()
        
        return {
            "success": True,
            "data": {
                "users": stats[0],
                "clients": stats[1],
                "completed_deals": stats[2],
                "total_revenue": float(stats[3]),
                "low_stock_alerts": stats[4]
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching system stats: {str(e)}"
        )

@router.post("/maintenance-mode")
async def toggle_maintenance_mode(
    enable: bool,
    _=Depends(get_current_admin_user)
):
    try:
        # Implementation would depend on your maintenance mode strategy
        # Could be stored in Redis or database
        CacheService.set("maintenance_mode", enable)
        return {
            "success": True,
            "message": f"Maintenance mode {'enabled' if enable else 'disabled'}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error toggling maintenance mode: {str(e)}"
        )

@router.post("/backup/database")
async def create_database_backup(_=Depends(get_current_admin_user)):
    try:
        # Implementation for database backup
        backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
        # Add your backup logic here
        return {
            "success": True,
            "message": f"Database backup created: {backup_name}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating backup: {str(e)}"
        )

@router.get("/monitor/performance")
async def get_performance_metrics(db: Session = Depends(get_db), _=Depends(get_current_admin_user)):
    try:
        metrics_query = """
            SELECT
                (SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))
                    FROM deals WHERE status = 'won') as avg_deal_completion_time,
                (SELECT COUNT(*) FROM deals 
                    WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours') as deals_last_24h,
                (SELECT COUNT(*) FROM audit_log 
                    WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours') as system_events_24h
        """
        
        metrics = db.execute(text(metrics_query)).fetchone()
        
        return {
            "success": True,
            "data": {
                "avg_deal_completion_time": float(metrics[0]) if metrics[0] else 0,
                "deals_last_24h": metrics[1],
                "system_events_24h": metrics[2],
                "cache_status": "healthy" if CacheService.is_available() else "unavailable"
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching performance metrics: {str(e)}"
        )

@router.get("/logs/errors")
async def get_error_logs(
    limit: int = 100,
    skip: int = 0,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin_user)
):
    try:
        logs_query = """
            SELECT 
                created_at,
                error_type,
                error_message,
                stack_trace,
                user_id,
                endpoint
            FROM error_logs
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :skip
        """
        
        logs = db.execute(text(logs_query), {"limit": limit, "skip": skip}).fetchall()
        
        return {
            "success": True,
            "data": [
                {
                    "timestamp": log[0].isoformat(),
                    "type": log[1],
                    "message": log[2],
                    "stack_trace": log[3],
                    "user_id": log[4],
                    "endpoint": log[5]
                } for log in logs
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching error logs: {str(e)}"
        )