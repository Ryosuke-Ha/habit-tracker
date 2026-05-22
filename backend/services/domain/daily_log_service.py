from sqlalchemy.orm import Session

import models


class DailyLogGenerationService:
    """
    DailyLogのデタッチ処理に関するドメインサービス。
    HabitとDailyLogをまたぐ処理を担当する。
    """

    def __init__(self, db: Session):
        self._db = db

    def detach_logs_from_habit(self, habit: models.Habit) -> None:
        """
        ハビット削除時に既存DailyLogをスタンドアロン化する。
        ハビットのデータをログにコピーしてhabit_idをNullにする。
        呼び出し元でdb.delete(habit)とdb.commit()を行うこと。
        """
        logs = self._db.query(models.DailyLog).filter(
            models.DailyLog.habit_id == habit.id
        ).all()

        for log in logs:
            log.title = habit.title
            log.scheduled_time = habit.scheduled_time
            log.location = habit.location
            log.template_id = habit.template_id
            log.habit_id = None

        self._db.flush()
