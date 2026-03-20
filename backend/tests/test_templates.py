def test_get_templates_empty(client):
    res = client.get("/templates")
    assert res.status_code == 200
    assert res.json() == []


def test_get_templates_returns_list(client):
    client.post("/templates", json={"name": "平日"})
    client.post("/templates", json={"name": "休日"})

    res = client.get("/templates")
    assert res.status_code == 200
    names = [t["name"] for t in res.json()]
    assert "平日" in names
    assert "休日" in names


def test_create_template(client):
    res = client.post("/templates", json={"name": "平日"})
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "平日"
    assert "id" in data


def test_update_template(client):
    created = client.post("/templates", json={"name": "平日"}).json()

    res = client.put(f"/templates/{created['id']}", json={"name": "平日（修正）"})
    assert res.status_code == 200
    assert res.json()["name"] == "平日（修正）"


def test_delete_template(client):
    created = client.post("/templates", json={"name": "削除用"}).json()

    res = client.delete(f"/templates/{created['id']}")
    assert res.status_code == 200
    assert res.json()["ok"] is True

    remaining = client.get("/templates").json()
    assert all(t["id"] != created["id"] for t in remaining)


def test_delete_template_not_found(client):
    res = client.delete("/templates/99999")
    assert res.status_code == 404
