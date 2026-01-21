from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any

class RecommenderService:
    def __init__(self, db: Session):
        self.db = db

    def get_product_recommendations(self, client_id: int) -> List[Dict[Any, Any]]:
        query = """
            WITH client_preferences AS (
                SELECT 
                    d.product_category,
                    COUNT(*) as purchase_count,
                    AVG(d.amount) as avg_spend
                FROM deals d
                WHERE d.client_id = :client_id AND d.status = 'won'
                GROUP BY d.product_category
            ),
            similar_clients AS (
                SELECT 
                    d2.client_id,
                    COUNT(*) as common_categories
                FROM deals d1
                JOIN deals d2 ON d1.product_category = d2.product_category
                WHERE d1.client_id = :client_id 
                    AND d2.client_id != :client_id
                    AND d1.status = 'won' 
                    AND d2.status = 'won'
                GROUP BY d2.client_id
                ORDER BY common_categories DESC
                LIMIT 100
            )
            SELECT 
                p.id,
                p.name,
                p.category,
                COUNT(d.id) as popularity,
                AVG(d.amount) as avg_price
            FROM products p
            JOIN deals d ON d.product_id = p.id
            JOIN similar_clients sc ON d.client_id = sc.client_id
            WHERE d.status = 'won'
                AND p.id NOT IN (
                    SELECT product_id 
                    FROM deals 
                    WHERE client_id = :client_id
                )
            GROUP BY p.id, p.name, p.category
            ORDER BY popularity DESC, avg_price ASC
            LIMIT 10
        """
        results = self.db.execute(text(query), {"client_id": client_id}).fetchall()
        return [
            {
                "product_id": row[0],
                "name": row[1],
                "category": row[2],
                "popularity": row[3],
                "avg_price": float(row[4])
            } for row in results
        ]