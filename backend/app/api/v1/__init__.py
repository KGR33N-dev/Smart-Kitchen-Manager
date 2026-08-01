from fastapi import APIRouter
from app.api.v1.routes import auth, items, upload, payments, categories, scans

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(auth.router)
v1_router.include_router(items.router)
v1_router.include_router(categories.router)
v1_router.include_router(upload.router)
v1_router.include_router(scans.router)
v1_router.include_router(payments.router)
