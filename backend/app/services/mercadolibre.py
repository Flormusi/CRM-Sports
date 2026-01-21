import requests
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from ..config import settings
from ..services.cache import CacheService

class MercadoLibreService:
    def __init__(self, db: Session):
        self.db = db
        self.base_url = "https://api.mercadolibre.com"
        self._refresh_token_if_needed()

    def _refresh_token_if_needed(self):
        token_data = CacheService.get("meli_token")
        
        if not token_data or datetime.now() >= datetime.fromisoformat(token_data['expires_at']):
            response = requests.post(
                f"{self.base_url}/oauth/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": settings.MELI_CLIENT_ID,
                    "client_secret": settings.MELI_CLIENT_SECRET,
                    "refresh_token": settings.MELI_REFRESH_TOKEN
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                CacheService.set("meli_token", {
                    "access_token": data["access_token"],
                    "expires_at": (datetime.now() + timedelta(seconds=data["expires_in"])).isoformat()
                })
                self.access_token = data["access_token"]
            else:
                raise Exception("Failed to refresh MeLi token")
        else:
            self.access_token = token_data["access_token"]

    async def _handle_rate_limit(self, response: requests.Response) -> bool:
        if response.status_code == 429:  # Rate limit exceeded
            retry_after = int(response.headers.get('Retry-After', 60))
            CacheService.set("meli_rate_limit", True, retry_after)
            return False
        return True

    @async_retry(retries=3, delay=1.0)
    async def update_product(self, product_id: int, meli_item_id: str, data: Dict[str, Any]):
        try:
            if CacheService.get("meli_rate_limit"):
                return {"success": False, "error": "Rate limit in effect"}

            # Get product details from your database
            query = """
                SELECT 
                    p.name, 
                    p.description, 
                    p.price, 
                    p.current_stock,
                    p.category,
                    p.images,
                    p.attributes
                FROM products p
                WHERE p.id = :product_id
            """
            product = self.db.execute(text(query), {"product_id": product_id}).fetchone()

            if not product:
                return {"success": False, "error": "Product not found"}

            # Prepare data for Mercado Libre
            meli_data = {
                "title": product[0],
                "description": {"plain_text": product[1]},
                "price": product[2],
                "available_quantity": product[3],
                "category_id": self._map_category(product[4]),
                "pictures": self._format_images(product[5]),
                "attributes": self._format_attributes(product[6])
            }

            # Update in Mercado Libre
            response = requests.put(
                f"{self.base_url}/items/{meli_item_id}",
                headers={"Authorization": f"Bearer {self.access_token}"},
                json=meli_data
            )

            if not await self._handle_rate_limit(response):
                return {"success": False, "error": "Rate limit exceeded"}

            if response.status_code == 200:
                # Log successful sync
                self._log_sync(product_id, meli_item_id, True)
                return {"success": True, "meli_response": response.json()}
            else:
                # Log failed sync
                self._log_sync(product_id, meli_item_id, False, response.text)
                return {
                    "success": False,
                    "error": f"MeLi API error: {response.status_code}",
                    "details": response.json()
                }

        except Exception as e:
            self._log_sync(product_id, meli_item_id, False, str(e))
            return {"success": False, "error": str(e)}

    def _log_sync(self, product_id: int, meli_item_id: str, success: bool, error_details: str = None):
        query = """
            INSERT INTO meli_sync_log (
                product_id, meli_item_id, success, error_details, created_at
            ) VALUES (
                :product_id, :meli_item_id, :success, :error_details, :created_at
            )
        """
        self.db.execute(
            text(query),
            {
                "product_id": product_id,
                "meli_item_id": meli_item_id,
                "success": success,
                "error_details": error_details,
                "created_at": datetime.utcnow()
            }
        )
        self.db.commit()

    def _map_category(self, crm_category: str) -> str:
        # Map your CRM categories to Mercado Libre category IDs
        category_mapping = {
            "supplements": "MLA1234",
            "equipment": "MLA5678",
            "clothing": "MLA9012"
            # Add more mappings as needed
        }
        return category_mapping.get(crm_category.lower(), "MLA1234")  # Default category