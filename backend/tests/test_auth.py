async def test_register_and_login(client):
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": "a@b.com", "password": "password123", "full_name": "Ann Bee"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "a@b.com"
    assert body["subscription_tier"] == "free"
    assert body["is_premium"] is False

    r = await client.post(
        "/api/v1/auth/token",
        data={"username": "a@b.com", "password": "password123"},
    )
    assert r.status_code == 200
    tokens = r.json()
    assert tokens["access_token"] and tokens["refresh_token"]
    assert tokens["token_type"] == "bearer"


async def test_register_duplicate_email(client):
    payload = {"email": "dup@b.com", "password": "password123", "full_name": "Dup User"}
    assert (await client.post("/api/v1/auth/register", json=payload)).status_code == 201
    r = await client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 409


async def test_login_wrong_password(client):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "c@b.com", "password": "password123", "full_name": "Cee Bee"},
    )
    r = await client.post(
        "/api/v1/auth/token",
        data={"username": "c@b.com", "password": "WRONGpass1"},
    )
    assert r.status_code == 401


async def test_me_requires_auth(client):
    assert (await client.get("/api/v1/auth/me")).status_code == 401


async def test_me_returns_current_user(auth_client):
    r = await auth_client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "tester@example.com"


async def test_refresh_flow(client):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "r@b.com", "password": "password123", "full_name": "Ref Resh"},
    )
    tokens = (
        await client.post(
            "/api/v1/auth/token",
            data={"username": "r@b.com", "password": "password123"},
        )
    ).json()
    r = await client.post(
        "/api/v1/auth/refresh", params={"refresh_token": tokens["refresh_token"]}
    )
    assert r.status_code == 200
    assert r.json()["access_token"]
