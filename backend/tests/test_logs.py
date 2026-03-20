import pytest


@pytest.fixture
def habit(client):
    template = client.post("/templates", json={"name": "平日"}).json()
    return client.post("/habits", json={
        "template_id": template["id"],
        "title": "筋トレ",
        "scheduled_time": "07:00",
        "location": "ジム",
    }).json()


def test_get_today_logs(client, habit):
    template_id = habit["template_id"]

    res = client.get(f"/logs/today?template_id={template_id}")
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) == 1
    assert logs[0]["habit_id"] == habit["id"]
    assert logs[0]["is_checked"] is False


def test_toggle_log_false_to_true(client, habit):
    # Ensure log exists
    client.get(f"/logs/today?template_id={habit['template_id']}")

    res = client.post(f"/logs/{habit['id']}/toggle")
    assert res.status_code == 200
    assert res.json()["is_checked"] is True


def test_toggle_log_true_to_false(client, habit):
    # Ensure log exists and toggle once to true
    client.get(f"/logs/today?template_id={habit['template_id']}")
    client.post(f"/logs/{habit['id']}/toggle")

    # Toggle again → back to false
    res = client.post(f"/logs/{habit['id']}/toggle")
    assert res.status_code == 200
    assert res.json()["is_checked"] is False
