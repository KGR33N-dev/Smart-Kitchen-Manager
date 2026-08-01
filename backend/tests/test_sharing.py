"""Fridge/pantry items are shared within a household and isolated across them."""


async def test_items_isolated_until_shared(client, register_user):
    a = await register_user("aa@b.com", name="Aa")
    b = await register_user("bb@b.com", name="Bb")

    # A adds an item in their personal household
    await client.post("/api/v1/items/", headers=a, json={"name": "Masło"})

    # B (separate personal household) sees nothing
    assert (await client.get("/api/v1/items/", headers=b)).json() == []

    # B joins A's household (join switches B's active household)
    household = (await client.get("/api/v1/households/", headers=a)).json()[0]
    await client.post("/api/v1/households/join", headers=b, json={"code": household["join_code"]})

    # Now B sees the shared item...
    shared = (await client.get("/api/v1/items/", headers=b)).json()
    assert [i["name"] for i in shared] == ["Masło"]

    # ...and can add to the shared fridge, visible to A
    await client.post("/api/v1/items/", headers=b, json={"name": "Chleb"})
    a_items = {i["name"] for i in (await client.get("/api/v1/items/", headers=a)).json()}
    assert a_items == {"Masło", "Chleb"}


async def test_switching_household_changes_visible_items(auth_client):
    # In personal household add one item
    await auth_client.post("/api/v1/items/", json={"name": "Ser"})

    # Create + switch to a fresh household → empty fridge
    created = (await auth_client.post("/api/v1/households/", json={"name": "Działka"})).json()
    assert created["is_active"] is True
    assert (await auth_client.get("/api/v1/items/")).json() == []

    # Add here, isolated from personal
    await auth_client.post("/api/v1/items/", json={"name": "Grill"})
    names = [i["name"] for i in (await auth_client.get("/api/v1/items/")).json()]
    assert names == ["Grill"]
