import pytest

from app.core.config import settings

FAKE_JPEG = b"\xff\xd8\xff\xe0" + b"0" * 2048 + b"\xff\xd9"


async def test_categories_seeded(auth_client):
    r = await auth_client.get("/api/v1/categories/")
    assert r.status_code == 200
    names = {c["name"] for c in r.json()}
    assert {"Dairy", "Vegetables", "Fruit", "Meat", "Bakery"} <= names
    # every category has an icon
    assert all(c["icon"] for c in r.json())


async def test_receipt_upload_inline_demo_creates_items(auth_client):
    r = await auth_client.post(
        "/api/v1/upload/receipt",
        files={"file": ("receipt.jpg", FAKE_JPEG, "image/jpeg")},
    )
    assert r.status_code == 202
    scan = r.json()
    assert scan["task_status"] == "completed"
    assert scan["parsed_items_count"] > 0

    # Items were actually created and linked to categories
    items = (await auth_client.get("/api/v1/items/")).json()
    assert len(items) == scan["parsed_items_count"]
    assert any(i["category"] is not None for i in items)

    # Scan history records the scan
    scans = (await auth_client.get("/api/v1/scans/")).json()
    assert len(scans) == 1


async def test_receipt_upload_rejects_bad_type(auth_client):
    r = await auth_client.post(
        "/api/v1/upload/receipt",
        files={"file": ("note.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 415


async def test_scan_increments_usage_counter(auth_client):
    before = (await auth_client.get("/api/v1/auth/me")).json()["scans_this_month"]
    await auth_client.post(
        "/api/v1/upload/receipt",
        files={"file": ("receipt.jpg", FAKE_JPEG, "image/jpeg")},
    )
    after = (await auth_client.get("/api/v1/auth/me")).json()["scans_this_month"]
    assert after == before + 1


async def test_free_tier_quota_enforced(auth_client, monkeypatch):
    monkeypatch.setattr(settings, "FREE_TIER_SCAN_LIMIT", 0)
    r = await auth_client.post(
        "/api/v1/upload/receipt",
        files={"file": ("receipt.jpg", FAKE_JPEG, "image/jpeg")},
    )
    assert r.status_code == 402


async def test_camera_upload_inline_demo(auth_client):
    r = await auth_client.post(
        "/api/v1/upload/camera",
        params={"item_name": "Pomidor"},
        files={"file": ("frame.jpg", FAKE_JPEG, "image/jpeg")},
    )
    assert r.status_code == 202
    assert r.json()["task_status"] == "completed"
