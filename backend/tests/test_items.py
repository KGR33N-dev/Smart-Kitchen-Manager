from datetime import datetime, timedelta, timezone


def _iso(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


async def test_create_item_computes_status(auth_client):
    # Far-future expiry → fresh
    r = await auth_client.post("/api/v1/items/", json={"name": "Ryż", "expiry_date": _iso(30)})
    assert r.status_code == 201
    assert r.json()["status"] == "fresh"

    # Within 3 days → expiring_soon
    r = await auth_client.post("/api/v1/items/", json={"name": "Mleko", "expiry_date": _iso(2)})
    assert r.json()["status"] == "expiring_soon"

    # Past → expired
    r = await auth_client.post("/api/v1/items/", json={"name": "Chleb", "expiry_date": _iso(-1)})
    assert r.json()["status"] == "expired"


async def test_list_and_filter(auth_client):
    await auth_client.post("/api/v1/items/", json={"name": "A", "expiry_date": _iso(30), "location": "Lodówka"})
    await auth_client.post("/api/v1/items/", json={"name": "B", "expiry_date": _iso(1), "location": "Spiżarnia"})

    r = await auth_client.get("/api/v1/items/")
    assert r.status_code == 200
    assert len(r.json()) == 2

    r = await auth_client.get("/api/v1/items/", params={"location": "Spiżarnia"})
    assert [i["name"] for i in r.json()] == ["B"]

    r = await auth_client.get("/api/v1/items/", params={"status": "expiring_soon"})
    assert [i["name"] for i in r.json()] == ["B"]


async def test_get_update_delete(auth_client):
    item = (await auth_client.post("/api/v1/items/", json={"name": "Jajka", "quantity": 6})).json()
    iid = item["id"]

    r = await auth_client.get(f"/api/v1/items/{iid}")
    assert r.status_code == 200

    r = await auth_client.patch(f"/api/v1/items/{iid}", json={"quantity": 12, "expiry_date": _iso(-2)})
    assert r.status_code == 200
    assert r.json()["quantity"] == 12
    assert r.json()["status"] == "expired"  # recomputed from new expiry

    assert (await auth_client.delete(f"/api/v1/items/{iid}")).status_code == 204
    assert (await auth_client.get(f"/api/v1/items/{iid}")).status_code == 404


async def test_expiring_endpoint(auth_client):
    await auth_client.post("/api/v1/items/", json={"name": "Soon", "expiry_date": _iso(2)})
    await auth_client.post("/api/v1/items/", json={"name": "Later", "expiry_date": _iso(20)})
    r = await auth_client.get("/api/v1/items/expiring", params={"days": 3})
    names = [i["name"] for i in r.json()]
    assert "Soon" in names and "Later" not in names


async def test_items_are_user_scoped(client):
    # user 1
    await client.post("/api/v1/auth/register", json={"email": "u1@b.com", "password": "password123", "full_name": "U One"})
    t1 = (await client.post("/api/v1/auth/token", data={"username": "u1@b.com", "password": "password123"})).json()["access_token"]
    await client.post("/api/v1/items/", json={"name": "Owned"}, headers={"Authorization": f"Bearer {t1}"})

    # user 2 sees nothing
    await client.post("/api/v1/auth/register", json={"email": "u2@b.com", "password": "password123", "full_name": "U Two"})
    t2 = (await client.post("/api/v1/auth/token", data={"username": "u2@b.com", "password": "password123"})).json()["access_token"]
    r = await client.get("/api/v1/items/", headers={"Authorization": f"Bearer {t2}"})
    assert r.json() == []
