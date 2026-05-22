from datetime import date
from unittest.mock import MagicMock

from models import Habit, PersistentTodo, ScheduledTodo, Template
from repositories.habit_repository import HabitRepository
from repositories.persistent_todo_repository import PersistentTodoRepository
from repositories.scheduled_todo_repository import ScheduledTodoRepository
from repositories.template_repository import TemplateRepository


class TestTemplateRepository:
    def setup_method(self):
        self.mock_db = MagicMock()

    def _make_query_mock(self, return_value):
        q = MagicMock()
        q.filter.return_value = q
        q.order_by.return_value = q
        q.all.return_value = return_value
        q.first.return_value = return_value
        q.count.return_value = return_value if isinstance(return_value, int) else 0
        self.mock_db.query.return_value = q
        return q

    def test_find_all_ordered_returns_templates(self):
        t1 = Template()
        t1.id = 1
        t1.name = "平日"
        self._make_query_mock([t1])

        repo = TemplateRepository(self.mock_db)
        result = repo.find_all_ordered()
        assert len(result) == 1
        assert result[0].name == "平日"

    def test_find_by_name_returns_template(self):
        t = Template()
        t.name = "平日"
        self._make_query_mock(t)

        repo = TemplateRepository(self.mock_db)
        result = repo.find_by_name("平日")
        assert result is not None
        assert result.name == "平日"

    def test_find_by_name_returns_none_when_not_found(self):
        self._make_query_mock(None)

        repo = TemplateRepository(self.mock_db)
        result = repo.find_by_name("存在しない")
        assert result is None

    def test_find_by_name_keyword(self):
        t = Template()
        t.name = "平日テンプレート"
        self._make_query_mock(t)

        repo = TemplateRepository(self.mock_db)
        result = repo.find_by_name_keyword("平日")
        assert result is not None

    def test_exists_by_name_returns_true(self):
        t = Template()
        t.name = "平日"
        self._make_query_mock(t)

        repo = TemplateRepository(self.mock_db)
        assert repo.exists_by_name("平日") is True

    def test_exists_by_name_returns_false(self):
        self._make_query_mock(None)

        repo = TemplateRepository(self.mock_db)
        assert repo.exists_by_name("存在しない") is False


class TestHabitRepository:
    def setup_method(self):
        self.mock_db = MagicMock()

    def _make_query_mock(self, return_value):
        q = MagicMock()
        q.filter.return_value = q
        q.order_by.return_value = q
        q.all.return_value = return_value if isinstance(return_value, list) else []
        q.first.return_value = return_value if not isinstance(return_value, list) else None
        q.count.return_value = len(return_value) if isinstance(return_value, list) else 0
        self.mock_db.query.return_value = q
        return q

    def test_find_by_template_returns_habits(self):
        h1 = Habit()
        h1.id = 1
        h1.template_id = 1
        h1.order = 0
        self._make_query_mock([h1])

        repo = HabitRepository(self.mock_db)
        result = repo.find_by_template(template_id=1)
        assert len(result) == 1

    def test_get_max_order_returns_zero_when_empty(self):
        self._make_query_mock(None)

        repo = HabitRepository(self.mock_db)
        max_order = repo.get_max_order(template_id=1)
        assert max_order == 0

    def test_get_max_order_returns_habit_order(self):
        habit = Habit()
        habit.order = 5
        self._make_query_mock(habit)

        repo = HabitRepository(self.mock_db)
        max_order = repo.get_max_order(template_id=1)
        assert max_order == 5

    def test_find_by_id_and_template_returns_none_for_wrong_template(self):
        self._make_query_mock(None)

        repo = HabitRepository(self.mock_db)
        result = repo.find_by_id_and_template(habit_id=1, template_id=999)
        assert result is None

    def test_count_by_template(self):
        q = MagicMock()
        q.filter.return_value = q
        q.count.return_value = 3
        self.mock_db.query.return_value = q

        repo = HabitRepository(self.mock_db)
        count = repo.count_by_template(template_id=1)
        assert count == 3


class TestScheduledTodoRepository:
    def setup_method(self):
        self.mock_db = MagicMock()

    def _make_query_mock(self, return_value):
        q = MagicMock()
        q.filter.return_value = q
        q.order_by.return_value = q
        q.all.return_value = return_value if isinstance(return_value, list) else []
        q.first.return_value = return_value if not isinstance(return_value, list) else None
        self.mock_db.query.return_value = q
        return q

    def test_find_by_user_returns_todos(self):
        todo = ScheduledTodo()
        todo.id = 1
        todo.user_id = "user@example.com"
        self._make_query_mock([todo])

        repo = ScheduledTodoRepository(self.mock_db)
        result = repo.find_by_user(user_id="user@example.com")
        assert len(result) == 1

    def test_find_today_by_user(self):
        todo = ScheduledTodo()
        todo.id = 1
        todo.scheduled_date = date.today()
        self._make_query_mock([todo])

        repo = ScheduledTodoRepository(self.mock_db)
        result = repo.find_today_by_user(user_id="user@example.com", today=date.today())
        assert len(result) == 1

    def test_find_future_by_user(self):
        self._make_query_mock([])

        repo = ScheduledTodoRepository(self.mock_db)
        result = repo.find_future_by_user(user_id="user@example.com", from_date=date.today())
        assert result == []

    def test_find_by_id_and_user_returns_none_for_wrong_user(self):
        self._make_query_mock(None)

        repo = ScheduledTodoRepository(self.mock_db)
        result = repo.find_by_id_and_user(todo_id=1, user_id="wrong@example.com")
        assert result is None

    def test_find_pending_notifications(self):
        self._make_query_mock([])

        repo = ScheduledTodoRepository(self.mock_db)
        result = repo.find_pending_notifications(user_id="user@example.com")
        assert result == []


class TestPersistentTodoRepository:
    def setup_method(self):
        self.mock_db = MagicMock()

    def _make_query_mock(self, return_value):
        q = MagicMock()
        q.filter.return_value = q
        q.order_by.return_value = q
        q.all.return_value = return_value if isinstance(return_value, list) else []
        q.first.return_value = return_value if not isinstance(return_value, list) else None
        self.mock_db.query.return_value = q
        return q

    def test_find_active_by_user_returns_incomplete_todos(self):
        todo = PersistentTodo()
        todo.id = 1
        todo.is_completed = False
        self._make_query_mock([todo])

        repo = PersistentTodoRepository(self.mock_db)
        result = repo.find_active_by_user(user_id="user@example.com")
        assert len(result) == 1
        assert result[0].is_completed is False

    def test_find_long_pending_with_default_threshold(self):
        self._make_query_mock([])

        repo = PersistentTodoRepository(self.mock_db)
        result = repo.find_long_pending_by_user(user_id="user@example.com")
        assert result == []

    def test_find_long_pending_with_custom_threshold(self):
        self._make_query_mock([])

        repo = PersistentTodoRepository(self.mock_db)
        result = repo.find_long_pending_by_user(user_id="user@example.com", days_threshold=14)
        assert result == []

    def test_find_by_id_and_user_returns_none_for_wrong_user(self):
        self._make_query_mock(None)

        repo = PersistentTodoRepository(self.mock_db)
        result = repo.find_by_id_and_user(todo_id=1, user_id="wrong@example.com")
        assert result is None

    def test_find_by_user_returns_all_todos(self):
        t1, t2 = PersistentTodo(), PersistentTodo()
        t1.id, t2.id = 1, 2
        self._make_query_mock([t1, t2])

        repo = PersistentTodoRepository(self.mock_db)
        result = repo.find_by_user(user_id="user@example.com")
        assert len(result) == 2
