from ..services.mercadolibre import MercadoLibreService

@router.put("/{product_id}")
async def update_product(
    product_id: int,
    product: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Existing product update logic...

        # Sync with Mercado Libre if meli_item_id exists
        query = "SELECT meli_item_id FROM products WHERE id = :product_id"
        result = db.execute(text(query), {"product_id": product_id}).fetchone()
        
        if result and result[0]:  # If product has MeLi listing
            meli_service = MercadoLibreService(db)
            meli_result = await meli_service.update_product(
                product_id,
                result[0],
                product.dict()
            )
            
            if not meli_result["success"]:
                # Log the error but don't stop the update
                logger.error(f"MeLi sync failed: {meli_result['error']}")

        return {"success": True, "data": updated_product}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )