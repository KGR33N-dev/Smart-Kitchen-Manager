"""
Stripe Payment Service — Freemium subscription management
Handles: checkout sessions, webhook verification, subscription lifecycle
"""
import stripe
from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.logging import log

stripe.api_key = settings.STRIPE_SECRET_KEY


# ─── Checkout ─────────────────────────────────────────────────────────────────

async def create_checkout_session(
    user_id: int,
    user_email: str,
    stripe_customer_id: str | None,
    success_url: str,
    cancel_url: str,
) -> str:
    """Creates a Stripe Checkout session and returns the hosted URL."""
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=stripe_customer_id or None,
            customer_email=None if stripe_customer_id else user_email,
            line_items=[{"price": settings.STRIPE_PRICE_ID_PREMIUM, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": str(user_id)},
            subscription_data={
                "metadata": {"user_id": str(user_id)},
            },
        )
        log.info("stripe.checkout_created", user_id=user_id, session_id=session.id)
        return session.url  # type: ignore
    except stripe.StripeError as e:
        log.error("stripe.checkout_failed", error=str(e))
        raise HTTPException(status_code=400, detail=f"Stripe error: {e.user_message}")


async def create_customer_portal_session(
    stripe_customer_id: str,
    return_url: str,
) -> str:
    """Creates a Stripe Customer Portal session for subscription management."""
    session = stripe.billing_portal.Session.create(
        customer=stripe_customer_id,
        return_url=return_url,
    )
    return session.url  # type: ignore


# ─── Webhook handler ─────────────────────────────────────────────────────────

async def handle_webhook(request: Request, db) -> dict:
    """
    Verifies Stripe webhook signature and dispatches subscription lifecycle events.
    Returns handled event type.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook signature")

    log.info("stripe.webhook", event_type=event["type"])

    from app.repositories.user_repo import UserRepository
    import datetime

    repo = UserRepository(db)

    # ── Subscription activated ────────────────────────────────────────────────
    if event["type"] == "customer.subscription.created":
        sub = event["data"]["object"]
        customer_id = sub["customer"]
        user = await repo.get_by_stripe_customer(customer_id)
        if not user:
            # First-time — look up via metadata
            user_id = sub.get("metadata", {}).get("user_id")
            if user_id:
                user = await repo.get(int(user_id))
                if user:
                    await repo.update(user.id, stripe_customer_id=customer_id)

        if user:
            valid_until = datetime.datetime.fromtimestamp(
                sub["current_period_end"], tz=datetime.timezone.utc
            )
            from app.models.food import SubscriptionTier
            await repo.update(
                user.id,
                subscription_tier=SubscriptionTier.PREMIUM,
                stripe_subscription_id=sub["id"],
                subscription_valid_until=valid_until,
            )
            log.info("stripe.subscription_activated", user_id=user.id)

    # ── Subscription renewed ──────────────────────────────────────────────────
    elif event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        customer_id = invoice["customer"]
        subscription_id = invoice.get("subscription")
        user = await repo.get_by_stripe_customer(customer_id)
        if user and subscription_id:
            sub = stripe.Subscription.retrieve(subscription_id)
            valid_until = datetime.datetime.fromtimestamp(
                sub["current_period_end"], tz=datetime.timezone.utc
            )
            from app.models.food import SubscriptionTier
            await repo.update(
                user.id,
                subscription_tier=SubscriptionTier.PREMIUM,
                subscription_valid_until=valid_until,
            )
            log.info("stripe.subscription_renewed", user_id=user.id)

    # ── Subscription cancelled or payment failed ───────────────────────────────
    elif event["type"] in (
        "customer.subscription.deleted",
        "invoice.payment_failed",
    ):
        customer_id = event["data"]["object"]["customer"]
        user = await repo.get_by_stripe_customer(customer_id)
        if user:
            from app.models.food import SubscriptionTier
            await repo.update(user.id, subscription_tier=SubscriptionTier.FREE)
            log.info("stripe.subscription_cancelled", user_id=user.id)

    return {"handled": event["type"]}


# ─── Freemium gate ───────────────────────────────────────────────────────────

def check_scan_quota(user) -> None:
    """Raise 402 if free user has exhausted their monthly scan limit."""
    if user.is_premium:
        return
    if user.scans_this_month >= settings.FREE_TIER_SCAN_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Free tier limit of {settings.FREE_TIER_SCAN_LIMIT} scans/month reached. "
                "Upgrade to Premium for unlimited scanning."
            ),
        )
