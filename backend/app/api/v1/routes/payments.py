from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import User
from app.schemas.food import CheckoutSessionOut, PortalSessionOut
from app.services import payment_service

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/checkout", response_model=CheckoutSessionOut)
async def create_checkout(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start Stripe Checkout for Premium subscription."""
    url = await payment_service.create_checkout_session(
        user_id=current_user.id,
        user_email=current_user.email,
        stripe_customer_id=current_user.stripe_customer_id,
        success_url="smartfridge://payment-success",
        cancel_url="smartfridge://payment-cancel",
    )
    return {"checkout_url": url}


@router.post("/portal", response_model=PortalSessionOut)
async def customer_portal(
    current_user: User = Depends(get_current_user),
):
    """Open Stripe Customer Portal to manage / cancel subscription."""
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active Stripe subscription found.")
    url = await payment_service.create_customer_portal_session(
        current_user.stripe_customer_id,
        return_url="smartfridge://settings",
    )
    return {"portal_url": url}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Stripe webhook receiver — processes subscription lifecycle events."""
    return await payment_service.handle_webhook(request, db)
