import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def auth_client(setup_test_db):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with patch.dict(os.environ, {"API_SECRET_KEY": "test-secret-key"}):
        with TestClient(app) as c:
            yield c
    app.dependency_overrides.clear()


class TestAPIKeyAuth:
    def test_health_check_no_auth_required(self, auth_client):
        """ヘルスチェックは認証不要"""
        response = auth_client.get("/health")
        assert response.status_code == 200

    def test_missing_api_key_returns_401(self, auth_client):
        """APIキーなしは401を返す"""
        response = auth_client.get("/templates")
        assert response.status_code == 401

    def test_invalid_api_key_returns_401(self, auth_client):
        """無効なAPIキーは401を返す"""
        response = auth_client.get(
            "/templates",
            headers={"X-API-Key": "wrong-key"}
        )
        assert response.status_code == 401

    def test_valid_api_key_returns_200(self, auth_client):
        """正しいAPIキーは通過する"""
        response = auth_client.get(
            "/templates",
            headers={"X-API-Key": "test-secret-key"}
        )
        assert response.status_code == 200
