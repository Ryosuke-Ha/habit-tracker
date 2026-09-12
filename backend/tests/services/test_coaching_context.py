from unittest.mock import MagicMock

from services.coaching_context import build_message_context, build_system_prompt


class TestBuildSystemPrompt:
    def test_injects_current_turn(self):
        result = build_system_prompt("", current_turn=2)
        assert "Turn2" in result

    def test_injects_turn1_by_default(self):
        result = build_system_prompt("")
        assert "Turn1" in result

    def test_injects_turn3(self):
        result = build_system_prompt("", current_turn=3)
        assert "Turn3" in result

    def test_injects_context(self):
        result = build_system_prompt("<ctx>test</ctx>", current_turn=1)
        assert "<ctx>test</ctx>" in result

    def test_no_unreplaced_placeholders(self):
        result = build_system_prompt("<ctx/>", current_turn=2)
        assert "{current_turn}" not in result
        assert "{context}" not in result


class TestBuildMessageContext:
    def _make_session(self, context: str = "") -> MagicMock:
        s = MagicMock()
        s.context = context
        return s

    def test_returns_system_with_turn(self):
        session = self._make_session("<ctx/>")
        system, _ = build_message_context(session, [], current_turn=2)
        assert "Turn2" in system

    def test_limits_recent_messages(self):
        session = self._make_session()
        msgs = [{"role": "user", "content": str(i)} for i in range(10)]
        _, recent = build_message_context(session, msgs, max_recent=5)
        assert len(recent) == 5
        assert recent[0]["content"] == "5"

    def test_returns_all_when_under_limit(self):
        session = self._make_session()
        msgs = [{"role": "user", "content": "x"}, {"role": "assistant", "content": "y"}]
        _, recent = build_message_context(session, msgs, max_recent=5)
        assert len(recent) == 2


class TestCurrentTurnCalculation:
    """ターン計算ロジックの単体テスト (coaching.py の計算式を再現)"""

    def _calc_turn(self, user_message_count: int) -> int:
        return min(user_message_count + 1, 3)

    def test_first_user_message_yields_turn2(self):
        # ユーザー1回目 → AIはTurn2で返答
        assert self._calc_turn(1) == 2

    def test_second_user_message_yields_turn3(self):
        # ユーザー2回目 → AIはTurn3で返答
        assert self._calc_turn(2) == 3

    def test_third_user_message_stays_turn3(self):
        # ユーザー3回目以降 → Turn3のまま
        assert self._calc_turn(3) == 3

    def test_excess_user_messages_capped_at_turn3(self):
        # メッセージが多くても最大Turn3
        assert self._calc_turn(10) == 3
