from fastapi import HTTPException, Depends
from functools import wraps
from . import utils
from .. import models

def require_admin():
    async def wrapper(current_user: models.User = Depends(utils.get_current_user)):
        if current_user.role != models.UserRole.ADMIN:
            raise HTTPException(
                status_code=403,
                detail="This operation requires admin privileges"
            )
        return current_user
    return wrapper

def require_sales_or_admin():
    async def wrapper(current_user: models.User = Depends(utils.get_current_user)):
        if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SALES_REP]:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions"
            )
        return current_user
    return wrapper

def check_role(allowed_roles):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user: models.User = Depends(utils.get_current_user), **kwargs):
            if current_user.role not in allowed_roles:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to perform this action"
                )
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator