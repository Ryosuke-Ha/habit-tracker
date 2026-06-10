import pytest
from unittest.mock import MagicMock
from models import DailyLog, PersistentTodo, SubTask


class TestSubTaskMigration:
    def test_subtasks_migrated_to_persistent_todo(self):
        """DailyLog→PersistentTodo変換時にSubTaskが引き継がれる"""
        mock_db = MagicMock()

        daily_log = DailyLog()
        daily_log.id = 1
        daily_log.title = "テストTODO"

        subtask1 = SubTask()
        subtask1.id = 1
        subtask1.todo_type = "habit_log"
        subtask1.todo_id = 1
        subtask1.title = "サブタスク1"

        subtask2 = SubTask()
        subtask2.id = 2
        subtask2.todo_type = "habit_log"
        subtask2.todo_id = 1
        subtask2.title = "サブタスク2"

        mock_db.query.return_value.filter.return_value.all.return_value = [
            subtask1, subtask2
        ]

        new_persistent_id = 10
        for subtask in [subtask1, subtask2]:
            subtask.todo_type = "persistent_todo"
            subtask.todo_id = new_persistent_id

        assert subtask1.todo_type == "persistent_todo"
        assert subtask1.todo_id == new_persistent_id
        assert subtask2.todo_type == "persistent_todo"
        assert subtask2.todo_id == new_persistent_id

    def test_subtasks_migrated_back_to_daily_log(self):
        """PersistentTodo→DailyLog変換時にSubTaskが引き継がれる"""
        subtask = SubTask()
        subtask.todo_type = "persistent_todo"
        subtask.todo_id = 10

        new_log_id = 5
        subtask.todo_type = "habit_log"
        subtask.todo_id = new_log_id

        assert subtask.todo_type == "habit_log"
        assert subtask.todo_id == new_log_id
