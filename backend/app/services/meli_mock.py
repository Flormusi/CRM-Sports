from typing import Dict, Any
from datetime import datetime, timedelta

class MeliMockService:
    def __init__(self):
        self.mock_products = {
            "123": {
                "id": "123",
                "title": "Protein Powder",
                "price": 2999.99,
                "available_quantity": 50,
                "status": "active",
                "permalink": "http://mock.meli.com/protein-powder"
            }
        }

    async def update_product(self, product_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if product_id not in self.mock_products:
            return {
                "success": False,
                "error": "Product not found in MeLi"
            }
        
        self.mock_products[product_id].update(data)
        return {
            "success": True,
            "data": self.mock_products[product_id]
        }

    async def get_product(self, product_id: str) -> Dict[str, Any]:
        if product_id not in self.mock_products:
            return {
                "success": False,
                "error": "Product not found"
            }
        return {
            "success": True,
            "data": self.mock_products[product_id]
        }