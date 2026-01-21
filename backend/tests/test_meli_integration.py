import pytest
from ..app.services.meli_mock import MeliMockService
from ..app.utils.retry import async_retry

class TestMeliIntegration:
    @pytest.fixture
    def meli_service(self):
        return MeliMockService()

    @pytest.mark.asyncio
    async def test_product_update(self, meli_service):
        update_data = {
            "title": "Updated Protein Powder",
            "price": 3499.99
        }
        
        result = await meli_service.update_product("123", update_data)
        assert result["success"] is True
        assert result["data"]["title"] == "Updated Protein Powder"
        assert result["data"]["price"] == 3499.99

    @pytest.mark.asyncio
    async def test_product_not_found(self, meli_service):
        result = await meli_service.get_product("999")
        assert result["success"] is False
        assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_retry_mechanism(self, meli_service):
        @async_retry(retries=3, delay=0.1)
        async def failing_operation():
            raise ConnectionError("Simulated connection error")

        with pytest.raises(ConnectionError):
            await failing_operation()