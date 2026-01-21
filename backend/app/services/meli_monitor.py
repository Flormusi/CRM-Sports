from datetime import datetime, timedelta
from typing import Dict, List
from ..services.cache import CacheService
import logging

logger = logging.getLogger(__name__)

class MeliMonitor:
    def __init__(self):
        self.cache = CacheService

    async def log_api_call(self, endpoint: str, success: bool, response_time: float):
        key = f"meli_metrics_{datetime.now().strftime('%Y%m%d_%H')}"
        metrics = self.cache.get(key) or {
            "calls": 0,
            "failures": 0,
            "total_response_time": 0,
            "endpoints": {}
        }
        
        metrics["calls"] += 1
        if not success:
            metrics["failures"] += 1
        metrics["total_response_time"] += response_time
        
        if endpoint not in metrics["endpoints"]:
            metrics["endpoints"][endpoint] = {"calls": 0, "failures": 0}
        
        metrics["endpoints"][endpoint]["calls"] += 1
        if not success:
            metrics["endpoints"][endpoint]["failures"] += 1
        
        self.cache.set(key, metrics, 86400)  # Store for 24 hours

    async def get_daily_metrics(self) -> Dict:
        today = datetime.now().strftime('%Y%m%d')
        metrics = {
            "total_calls": 0,
            "total_failures": 0,
            "avg_response_time": 0,
            "endpoints": {}
        }
        
        for hour in range(24):
            key = f"meli_metrics_{today}_{hour:02d}"
            hour_metrics = self.cache.get(key)
            if hour_metrics:
                metrics["total_calls"] += hour_metrics["calls"]
                metrics["total_failures"] += hour_metrics["failures"]
                metrics["avg_response_time"] += hour_metrics["total_response_time"]
                
                for endpoint, data in hour_metrics["endpoints"].items():
                    if endpoint not in metrics["endpoints"]:
                        metrics["endpoints"][endpoint] = {"calls": 0, "failures": 0}
                    metrics["endpoints"][endpoint]["calls"] += data["calls"]
                    metrics["endpoints"][endpoint]["failures"] += data["failures"]
        
        if metrics["total_calls"] > 0:
            metrics["avg_response_time"] /= metrics["total_calls"]
        
        return metrics