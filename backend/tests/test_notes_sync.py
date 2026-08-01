"""Offline-first note sync: push/pull, last-write-wins, tombstones, sharing."""

T1 = "2026-01-01T10:00:00+00:00"
T2 = "2026-01-01T11:00:00+00:00"
T3 = "2026-01-01T12:00:00+00:00"


def _note(client_id, title, content="", ts=T1, is_deleted=False):
    return {
        "client_id": client_id,
        "title": title,
        "content": content,
        "is_deleted": is_deleted,
        "client_updated_at": ts,
    }


async def test_push_then_pull(auth_client):
    r = await auth_client.post(
        "/api/v1/notes/sync",
        json={"since": None, "changes": [_note("n1", "Kup mleko")]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["server_time"]
    titles = [n["title"] for n in body["notes"]]
    assert "Kup mleko" in titles

    # A plain list returns live notes
    notes = (await auth_client.get("/api/v1/notes/")).json()
    assert [n["client_id"] for n in notes] == ["n1"]


async def test_last_write_wins(auth_client):
    await auth_client.post("/api/v1/notes/sync", json={"changes": [_note("n1", "wersja A", ts=T2)]})

    # Older edit must NOT override
    await auth_client.post("/api/v1/notes/sync", json={"changes": [_note("n1", "stara", ts=T1)]})
    notes = (await auth_client.get("/api/v1/notes/")).json()
    assert notes[0]["title"] == "wersja A"

    # Newer edit wins
    await auth_client.post("/api/v1/notes/sync", json={"changes": [_note("n1", "wersja C", ts=T3)]})
    notes = (await auth_client.get("/api/v1/notes/")).json()
    assert notes[0]["title"] == "wersja C"


async def test_tombstone_propagates(auth_client):
    await auth_client.post("/api/v1/notes/sync", json={"changes": [_note("n1", "temp", ts=T1)]})
    # delete
    await auth_client.post(
        "/api/v1/notes/sync",
        json={"changes": [_note("n1", "temp", ts=T2, is_deleted=True)]},
    )
    # /notes hides deleted
    assert (await auth_client.get("/api/v1/notes/")).json() == []
    # but full sync (since=None) includes the tombstone so peers can delete too
    body = (await auth_client.post("/api/v1/notes/sync", json={"since": None, "changes": []})).json()
    n1 = next(n for n in body["notes"] if n["client_id"] == "n1")
    assert n1["is_deleted"] is True


async def test_notes_shared_across_devices(client, register_user):
    a = await register_user("na@b.com")
    b = await register_user("nb@b.com")
    household = (await client.get("/api/v1/households/", headers=a)).json()[0]
    await client.post("/api/v1/households/join", headers=b, json={"code": household["join_code"]})

    # A creates a note
    await client.post("/api/v1/notes/sync", headers=a, json={"changes": [_note("shared1", "Lista gości")]})

    # B pulls and sees it
    body = (await client.post("/api/v1/notes/sync", headers=b, json={"since": None, "changes": []})).json()
    assert any(n["title"] == "Lista gości" for n in body["notes"])


async def test_notes_isolated_between_households(client, register_user):
    a = await register_user("ia@b.com")
    b = await register_user("ib@b.com")  # different personal household
    await client.post("/api/v1/notes/sync", headers=a, json={"changes": [_note("x", "sekret")]})
    body = (await client.post("/api/v1/notes/sync", headers=b, json={"since": None, "changes": []})).json()
    assert body["notes"] == []
