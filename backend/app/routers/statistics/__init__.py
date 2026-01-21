from fastapi import APIRouter
from . import sales, inventory, customer, seasonal, product

router = APIRouter(prefix="/statistics", tags=["statistics"])

router.include_router(sales.router)
router.include_router(inventory.router)
router.include_router(customer.router)
router.include_router(seasonal.router)
router.include_router(product.router)