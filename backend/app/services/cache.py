from redis import Redis
from typing import Any, Optional
import json
import os

redis_client = Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    db=0,
    decode_responses=True
)

class CacheService:
    @staticmethod
    def get(key: str) -> Optional[Any]:
        data = redis_client.get(key)
        return json.loads(data) if data else None

    @staticmethod
    def set(key: str, value: Any, expire: int = 3600) -> None:
        redis_client.setex(key, expire, json.dumps(value))

    @staticmethod
    def delete(key: str) -> None:
        redis_client.delete(key)