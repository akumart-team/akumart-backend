"""
Central router registry for the AkuMart API.
"""

from fastapi import APIRouter

from app.api.routers.auth import router as auth_router

# Registry
# Uncomment as Phase 3 features are built out:
#   from app.api.routers.listings  import router as listings_router
#   from app.api.routers.orders    import router as orders_router
#   from app.api.routers.payments  import router as payments_router
#   from app.api.routers.logistics import router as logistics_router
#   from app.api.routers.reviews   import router as reviews_router
#   from app.api.routers.admin     import router as admin_router

all_routers: list[APIRouter] = [
    auth_router,
    # listings_router,
    # orders_router,
    # payments_router,
    # logistics_router,
    # reviews_router,
    # admin_router,
]
