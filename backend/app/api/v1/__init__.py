from fastapi import APIRouter
from app.api.v1.routes import auth, items, upload, payments

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(auth.router)
v1_router.include_router(items.router)
v1_router.include_router(upload.router)
v1_router.include_router(payments.router)
