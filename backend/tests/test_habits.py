import pytest


@pytest.fixture
def template(client):
    return client.post("/templates", json={"name": "平日"}).json()


def test_get_habits_by_template(client, template):
    client.post("/habits", json={
        "template_id": template["id"],
        "title": "筋トレ",
        "scheduled_time": "07:00",
        "location": "ジム",
    })

    res = client.get(f"/templates/{template['id']}/habits")
    assert res.status_code == 200
    habits = res.json()
    assert len(habits) == 1
    assert habits[0]["title"] == "筋トレ"


def test_create_habit(client, template):
    res = client.post("/habits", json={
        "template_id": template["id"],
        "title": "英語学習",
        "scheduled_time": "12:00",
        "location": "カフェ",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "英語学習"
    assert data["scheduled_time"] == "12:00"
    assert data["location"] == "カフェ"
    assert data["template_id"] == template["id"]


def test_update_habit(client, template):
    habit = client.post("/habits", json={
        "template_id": template["id"],
        "title": "読書",
        "scheduled_time": "22:00",
        "location": "寝室",
    }).json()

    res = client.put(f"/habits/{habit['id']}", json={
        "title": "読書60分",
        "scheduled_time": "21:00",
        "location": "リビング",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "読書60分"
    assert data["scheduled_time"] == "21:00"
    assert data["location"] == "リビング"


def test_delete_habit(client, template):
    habit = client.post("/habits", json={
        "template_id": template["id"],
        "title": "削除テスト",
        "scheduled_time": "08:00",
        "location": "",
    }).json()

    res = client.delete(f"/habits/{habit['id']}")
    assert res.status_code == 200
    assert res.json()["ok"] is True

    habits = client.get(f"/templates/{template['id']}/habits").json()
    assert all(h["id"] != habit["id"] for h in habits)
