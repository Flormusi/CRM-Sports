from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from ..services.cache import CacheService
import json
import logging

logger = logging.getLogger(__name__)

class MeliErrorHandler(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            
            if request.url.path.startswith("/api/meli"):
                content = b""
                async for chunk in response.body_iterator:
                    content += chunk
                
                response_data = json.loads(content)
                
                if not response_data.get("success", True):
                    logger.error(f"MeLi API Error: {response_data.get('error')}")
                    
                    # Store error for monitoring
                    CacheService.set(
                        f"meli_error_{datetime.now().timestamp()}",
                        {
                            "endpoint": request.url.path,
                            "error": response_data.get("error"),
                            "timestamp": datetime.now().isoformat()
                        },
                        3600  # Store for 1 hour
                    )
            
            return response
            
        except Exception as e:
            logger.error(f"MeLi Middleware Error: {str(e)}")
            return {
                "success": False,
                "error": "Internal server error in MeLi integration"
            }