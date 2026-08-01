"""Security tests for Issue #72: AI agent attack mitigation."""
from utils.security import ClaudeRateLimiter, sanitize_user_input, truncate


# ---------------------------------------------------------------------------
# Unit tests: sanitize_user_input
# ---------------------------------------------------------------------------

class TestSanitizeUserInput:
    def test_normal_japanese_text_unchanged_in_meaning(self):
        text = "毎朝ランニングをする"
        result = sanitize_user_input(text)
        assert result == text

    def test_xml_special_chars_are_escaped(self):
        result = sanitize_user_input("<script>alert('xss')</script>")
        assert "<script>" not in result
        assert "&lt;script&gt;" in result

    def test_ampersand_escaped(self):
        result = sanitize_user_input("foo & bar")
        assert "&amp;" in result
        assert "& " not in result

    def test_template_placeholder_injection_neutralized(self):
        # If a user inputs {previous_commit}, it should not be treated as a placeholder
        result = sanitize_user_input("{previous_commit}")
        assert "{previous_commit}" not in result
        assert "&#123;" in result

    def test_nested_template_injection(self):
        result = sanitize_user_input("{context}{previous_summary}")
        assert "{context}" not in result
        assert "{previous_summary}" not in result

    def test_empty_string_returns_empty(self):
        assert sanitize_user_input("") == ""

    def test_none_like_empty_handled(self):
        # Should not raise
        result = sanitize_user_input("")
        assert result == ""

    def test_quotes_escaped(self):
        result = sanitize_user_input('say "hello"')
        assert '"hello"' not in result
        assert "&quot;" in result


# ---------------------------------------------------------------------------
# Unit tests: truncate
# ---------------------------------------------------------------------------

class TestTruncate:
    def test_short_text_unchanged(self):
        assert truncate("hello", 100) == "hello"

    def test_long_text_truncated(self):
        text = "a" * 500
        result = truncate(text, 300)
        assert len(result) == 300

    def test_empty_returns_empty(self):
        assert truncate("", 100) == ""


# ---------------------------------------------------------------------------
# Unit tests: ClaudeRateLimiter
# ---------------------------------------------------------------------------

class TestClaudeRateLimiter:
    def setup_method(self):
        self.limiter = ClaudeRateLimiter(max_calls_per_day=3)
        self.limiter.reset_all()

    def test_allows_calls_within_limit(self):
        assert self.limiter.is_allowed("user1") is True
        assert self.limiter.is_allowed("user1") is True
        assert self.limiter.is_allowed("user1") is True

    def test_blocks_calls_over_limit(self):
        for _ in range(3):
            self.limiter.is_allowed("user1")
        assert self.limiter.is_allowed("user1") is False

    def test_different_users_are_independent(self):
        for _ in range(3):
            self.limiter.is_allowed("user1")
        # user1 is exhausted, user2 should still be allowed
        assert self.limiter.is_allowed("user2") is True

    def test_reset_restores_allowance(self):
        for _ in range(3):
            self.limiter.is_allowed("user1")
        assert self.limiter.is_allowed("user1") is False
        self.limiter.reset("user1")
        assert self.limiter.is_allowed("user1") is True


# ---------------------------------------------------------------------------
# Integration tests: input validation via API
# ---------------------------------------------------------------------------

class TestInputValidation:
    def test_send_message_content_too_long_rejected(self, client):
        # Create a session first (without calling Claude)
        import models
        from database import SessionLocal
        from domain.enums import SessionStatus

        db = SessionLocal()
        try:
            session = models.CoachingSession(
                user_id="test@example.com",
                session_date="2026-08-02",
                status=SessionStatus.IN_PROGRESS,
                context="",
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            session_id = session.id
        finally:
            db.close()

        too_long = "あ" * 1001
        res = client.post(
            f"/coaching/sessions/{session_id}/messages",
            json={"content": too_long},
            headers={"X-User-Email": "test@example.com"},
        )
        assert res.status_code == 422

    def test_send_message_empty_content_rejected(self, client):
        import models
        from database import SessionLocal
        from domain.enums import SessionStatus

        db = SessionLocal()
        try:
            session = models.CoachingSession(
                user_id="test@example.com",
                session_date="2026-08-03",
                status=SessionStatus.IN_PROGRESS,
                context="",
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            session_id = session.id
        finally:
            db.close()

        res = client.post(
            f"/coaching/sessions/{session_id}/messages",
            json={"content": ""},
            headers={"X-User-Email": "test@example.com"},
        )
        assert res.status_code == 422

    def test_create_goal_title_too_long_rejected(self, client):
        too_long = "あ" * 201
        res = client.post(
            "/coaching/goals",
            json={"title": too_long},
            headers={"X-User-Email": "test@example.com"},
        )
        assert res.status_code == 422

    def test_create_goal_empty_title_rejected(self, client):
        res = client.post(
            "/coaching/goals",
            json={"title": ""},
            headers={"X-User-Email": "test@example.com"},
        )
        assert res.status_code == 422

    def test_create_goal_valid_title_accepted(self, client):
        res = client.post(
            "/coaching/goals",
            json={"title": "毎朝ランニングする"},
            headers={"X-User-Email": "test@example.com"},
        )
        assert res.status_code == 200


# ---------------------------------------------------------------------------
# Integration tests: per-session message count limit
# ---------------------------------------------------------------------------

class TestMessageCountLimit:
    def test_message_count_limit_enforced(self, client):
        """Sending more than MAX_MESSAGES_PER_SESSION messages returns 400."""
        import models
        from database import SessionLocal
        from domain.enums import SessionStatus
        from routers.coaching import MAX_MESSAGES_PER_SESSION

        db = SessionLocal()
        try:
            session = models.CoachingSession(
                user_id="test@example.com",
                session_date="2026-08-10",
                status=SessionStatus.IN_PROGRESS,
                context="",
            )
            db.add(session)
            db.flush()

            # Pre-fill messages up to the limit
            for i in range(MAX_MESSAGES_PER_SESSION):
                role = "user" if i % 2 == 0 else "assistant"
                db.add(models.CoachingMessage(
                    session_id=session.id,
                    role=role,
                    content=f"message {i}",
                ))
            db.commit()
            db.refresh(session)
            session_id = session.id
        finally:
            db.close()

        res = client.post(
            f"/coaching/sessions/{session_id}/messages",
            json={"content": "もう一通送ります"},
            headers={"X-User-Email": "test@example.com"},
        )
        assert res.status_code == 400
        assert "上限" in res.json()["detail"]


# ---------------------------------------------------------------------------
# Integration tests: rate limiting
# ---------------------------------------------------------------------------

class TestRateLimiting:
    def test_rate_limit_returns_429(self, client):
        """After exhausting the rate limit, Claude endpoints return 429."""
        import models
        from database import SessionLocal
        from domain.enums import SessionStatus
        from utils.security import claude_rate_limiter

        user = "ratelimit@example.com"
        claude_rate_limiter.reset(user)

        db = SessionLocal()
        try:
            session = models.CoachingSession(
                user_id=user,
                session_date="2026-08-11",
                status=SessionStatus.IN_PROGRESS,
                context="",
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            session_id = session.id
        finally:
            db.close()

        # Exhaust the limiter directly
        limiter = claude_rate_limiter
        original_max = limiter.max_calls_per_day
        limiter.max_calls_per_day = 0  # force block

        try:
            res = client.post(
                f"/coaching/sessions/{session_id}/messages",
                json={"content": "テスト"},
                headers={"X-User-Email": user},
            )
            assert res.status_code == 429
            assert "上限" in res.json()["detail"]
        finally:
            limiter.max_calls_per_day = original_max
            claude_rate_limiter.reset(user)
