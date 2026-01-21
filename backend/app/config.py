from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Existing settings...

    # Mercado Libre Configuration
    MELI_CLIENT_ID: str
    MELI_CLIENT_SECRET: str
    MELI_REDIRECT_URI: str
    MELI_REFRESH_TOKEN: str
    MELI_SITE_ID: str = "MLA"  # Argentina
    MELI_API_BASE_URL: str = "https://api.mercadolibre.com"
    MELI_AUTH_URL: str = "https://auth.mercadolibre.com.ar"
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()