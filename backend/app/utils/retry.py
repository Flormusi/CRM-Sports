import asyncio
from functools import wraps
from typing import Callable, Any
import logging

logger = logging.getLogger(__name__)

def async_retry(
    retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,)
):
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            retry_count = 0
            current_delay = delay

            while retry_count < retries:
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    retry_count += 1
                    if retry_count == retries:
                        logger.error(f"Final retry failed: {str(e)}")
                        raise

                    logger.warning(f"Retry {retry_count}/{retries}: {str(e)}")
                    await asyncio.sleep(current_delay)
                    current_delay *= backoff

        return wrapper
    return decorator