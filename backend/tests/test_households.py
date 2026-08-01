async def test_personal_household_created_on_register(auth_client):
    me = (await auth_client.get("/api/v1/auth/me")).json()
    assert me["active_household_id"] is not None

    lists = (await auth_client.get("/api/v1/households/")).json()
    assert len(lists) == 1
    assert lists[0]["is_personal"] is True
    assert lists[0]["role"] == "owner"
    assert lists[0]["is_active"] is True
    assert lists[0]["member_count"] == 1
    assert lists[0]["join_code"]


async def test_create_and_switch_household(auth_client):
    created = (await auth_client.post("/api/v1/households/", json={"name": "Wakacje"})).json()
    assert created["name"] == "Wakacje"
    assert created["is_active"] is True  # newly created becomes active

    households = (await auth_client.get("/api/v1/households/")).json()
    assert len(households) == 2

    personal = next(h for h in households if h["is_personal"])
    r = await auth_client.post(f"/api/v1/households/{personal['id']}/switch")
    assert r.status_code == 200
    assert r.json()["is_active"] is True


async def test_join_by_code_shares_household(client, register_user):
    a = await register_user("owner@b.com", name="Owner A")
    b = await register_user("guest@b.com", name="Guest B")

    household = (await client.get("/api/v1/households/", headers=a)).json()[0]
    code = household["join_code"]

    # B joins A's household
    r = await client.post("/api/v1/households/join", headers=b, json={"code": code})
    assert r.status_code == 200
    joined = r.json()
    assert joined["id"] == household["id"]
    assert joined["is_active"] is True
    assert joined["member_count"] == 2

    # Members list shows both
    members = (await client.get(f"/api/v1/households/{household['id']}/members", headers=a)).json()
    emails = {m["email"] for m in members}
    assert emails == {"owner@b.com", "guest@b.com"}


async def test_join_invalid_code(auth_client):
    r = await auth_client.post("/api/v1/households/join", json={"code": "ZZZZZZ"})
    assert r.status_code == 404


async def test_regenerate_code_owner_only(client, register_user):
    a = await register_user("o2@b.com")
    b = await register_user("g2@b.com")
    household = (await client.get("/api/v1/households/", headers=a)).json()[0]
    await client.post("/api/v1/households/join", headers=b, json={"code": household["join_code"]})

    # non-owner cannot regenerate
    r = await client.post(f"/api/v1/households/{household['id']}/regenerate-code", headers=b)
    assert r.status_code == 403

    # owner can, and code changes
    r = await client.post(f"/api/v1/households/{household['id']}/regenerate-code", headers=a)
    assert r.status_code == 200
    assert r.json()["join_code"] != household["join_code"]
