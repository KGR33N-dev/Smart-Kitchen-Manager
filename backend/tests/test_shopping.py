async def test_shopping_list_crud(auth_client):
    lst = (await auth_client.post("/api/v1/shopping/lists", json={"name": "Biedronka"})).json()
    assert lst["name"] == "Biedronka"
    assert lst["items"] == []

    item = (await auth_client.post(
        f"/api/v1/shopping/lists/{lst['id']}/items",
        json={"name": "Mleko", "quantity": 2, "unit": "L"},
    )).json()
    assert item["is_checked"] is False

    # toggle checked
    upd = (await auth_client.patch(f"/api/v1/shopping/items/{item['id']}", json={"is_checked": True})).json()
    assert upd["is_checked"] is True

    lists = (await auth_client.get("/api/v1/shopping/lists")).json()
    assert lists[0]["items"][0]["name"] == "Mleko"

    assert (await auth_client.delete(f"/api/v1/shopping/items/{item['id']}")).status_code == 204
    assert (await auth_client.delete(f"/api/v1/shopping/lists/{lst['id']}")).status_code == 204
    assert (await auth_client.get("/api/v1/shopping/lists")).json() == []


async def test_shopping_list_shared_in_household(client, register_user):
    a = await register_user("sa@b.com")
    b = await register_user("sb@b.com")
    household = (await client.get("/api/v1/households/", headers=a)).json()[0]
    await client.post("/api/v1/households/join", headers=b, json={"code": household["join_code"]})

    # A creates a list + item
    lst = (await client.post("/api/v1/shopping/lists", headers=a, json={"name": "Wspólna"})).json()
    await client.post(f"/api/v1/shopping/lists/{lst['id']}/items", headers=a, json={"name": "Jajka"})

    # B sees the same shared list and can check the item off
    b_lists = (await client.get("/api/v1/shopping/lists", headers=b)).json()
    assert b_lists[0]["name"] == "Wspólna"
    item_id = b_lists[0]["items"][0]["id"]
    r = await client.patch(f"/api/v1/shopping/items/{item_id}", headers=b, json={"is_checked": True})
    assert r.status_code == 200 and r.json()["is_checked"] is True
