from datetime import datetime, timedelta, timezone


def _iso(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


async def test_verify_confirmed_keeps_status(auth_client):
    item = (await auth_client.post("/api/v1/items/", json={"name": "Ser", "expiry_date": _iso(10)})).json()
    r = await auth_client.post(
        f"/api/v1/items/{item['id']}/verify",
        json={"confirmed": True, "ai_prediction": "fresh", "ai_confidence": 0.9},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ai_verified"] is True
    assert body["status"] == "fresh"


async def test_verify_rejected_marks_expired(auth_client):
    item = (await auth_client.post("/api/v1/items/", json={"name": "Jogurt", "expiry_date": _iso(5)})).json()
    r = await auth_client.post(
        f"/api/v1/items/{item['id']}/verify",
        json={"confirmed": False, "ai_prediction": "fresh", "ai_confidence": 0.6},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "expired"
    assert r.json()["ai_verified"] is True


async def test_pending_verification_list(auth_client):
    # Items with expiry and not yet verified show up
    await auth_client.post("/api/v1/items/", json={"name": "Unchecked", "expiry_date": _iso(4)})
    verified = (await auth_client.post("/api/v1/items/", json={"name": "Checked", "expiry_date": _iso(4)})).json()
    await auth_client.post(
        f"/api/v1/items/{verified['id']}/verify",
        json={"confirmed": True, "ai_prediction": "fresh"},
    )
    r = await auth_client.get("/api/v1/items/pending-verification")
    names = [i["name"] for i in r.json()]
    assert "Unchecked" in names
    assert "Checked" not in names
