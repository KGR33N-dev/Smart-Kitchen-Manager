"""Recipes + the AI cooking chat (żeberka scenario) in demo mode."""

RIBS_CORE = {"Żeberka wieprzowe", "Miód", "Sos sojowy", "Czosnek", "Ketchup", "Papryka słodka"}


async def test_recipes_seeded_and_searchable(auth_client):
    all_recipes = (await auth_client.get("/api/v1/recipes/")).json()
    names = {r["name"] for r in all_recipes}
    assert "Żeberka BBQ" in names

    found = (await auth_client.get("/api/v1/recipes/", params={"q": "żeberka"})).json()
    assert any(r["name"] == "Żeberka BBQ" for r in found)

    rid = next(r["id"] for r in found if r["name"] == "Żeberka BBQ")
    detail = (await auth_client.get(f"/api/v1/recipes/{rid}")).json()
    ing_names = {i["name"] for i in detail["ingredients"]}
    assert RIBS_CORE <= ing_names


async def test_chat_ribs_empty_pantry_adds_all(auth_client):
    r = await auth_client.post("/api/v1/ai/chat", json={"message": "chcę zrobić żeberka"})
    assert r.status_code == 200
    body = r.json()
    assert body["intent"] == "recipe"
    assert body["recipe"]["name"] == "Żeberka BBQ"

    missing = {m["name"] for m in body["missing"]}
    assert RIBS_CORE <= missing            # non-optional core is missing
    assert "Sól" not in missing            # optional staples are not chased
    assert set(body["added_to_shopping"]) == missing

    # The shopping list now actually contains them
    lists = (await auth_client.get("/api/v1/shopping/lists")).json()
    on_list = {i["name"] for lst in lists for i in lst["items"]}
    assert RIBS_CORE <= on_list


async def test_chat_ribs_with_some_ingredients(auth_client):
    # We already have ribs and honey in the fridge
    await auth_client.post("/api/v1/items/", json={"name": "Żeberka wieprzowe", "quantity": 1.2, "unit": "kg"})
    await auth_client.post("/api/v1/items/", json={"name": "Miód pszczeli"})

    body = (await auth_client.post("/api/v1/ai/chat", json={"message": "zróbmy żeberka bbq"})).json()
    have = set(body["have"])
    missing = {m["name"] for m in body["missing"]}

    assert "Żeberka wieprzowe" in have
    assert "Miód" in have                  # matched "Miód pszczeli"
    assert "Żeberka wieprzowe" not in missing
    assert "Miód" not in missing
    assert "Ketchup" in missing


async def test_chat_auto_add_disabled(auth_client):
    body = (await auth_client.post(
        "/api/v1/ai/chat", json={"message": "chcę zrobić naleśniki", "auto_add": False}
    )).json()
    assert body["intent"] == "recipe"
    assert body["missing"]                 # there are missing ingredients
    assert body["added_to_shopping"] == []  # but nothing was added
    assert (await auth_client.get("/api/v1/shopping/lists")).json() == []


async def test_chat_inventory_question(auth_client):
    await auth_client.post("/api/v1/items/", json={"name": "Masło"})
    body = (await auth_client.post("/api/v1/ai/chat", json={"message": "co mam w lodówce?"})).json()
    assert body["intent"] == "inventory"
    assert "Masło" in body["reply"]


async def test_chat_unknown(auth_client):
    body = (await auth_client.post("/api/v1/ai/chat", json={"message": "opowiedz mi dowcip"})).json()
    assert body["intent"] == "unknown"
    assert body["recipe"] is None


async def test_chat_added_items_shared_in_household(client, register_user):
    a = await register_user("ca@b.com")
    b = await register_user("cb@b.com")
    household = (await client.get("/api/v1/households/", headers=a)).json()[0]
    await client.post("/api/v1/households/join", headers=b, json={"code": household["join_code"]})

    # A asks the assistant; missing items land on the shared list
    await client.post("/api/v1/ai/chat", headers=a, json={"message": "chcę zrobić rosół"})

    # B sees them on the shared shopping list
    b_lists = (await client.get("/api/v1/shopping/lists", headers=b)).json()
    on_list = {i["name"] for lst in b_lists for i in lst["items"]}
    assert "Marchew" in on_list
