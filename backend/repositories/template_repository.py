from typing import List, Optional

from sqlalchemy.orm import Session

from models import Template
from repositories.base import BaseRepository


class TemplateRepository(BaseRepository[Template]):
    """
    Templateのリポジトリ。
    習慣テンプレートに関するデータアクセスを担当する。
    """

    def __init__(self, db: Session):
        super().__init__(Template, db)

    def find_all_ordered(self) -> List[Template]:
        """全テンプレートをID順で取得"""
        return self._db.query(Template).order_by(Template.id).all()

    def find_by_name(self, name: str) -> Optional[Template]:
        """名前でテンプレートを取得"""
        return self._db.query(Template).filter(
            Template.name == name
        ).first()

    def find_by_name_keyword(self, keyword: str) -> Optional[Template]:
        """名前にキーワードを含むテンプレートを取得（平日・休日の判定等）"""
        return self._db.query(Template).filter(
            Template.name.contains(keyword)
        ).first()

    def exists_by_name(self, name: str) -> bool:
        """指定名のテンプレートが存在するか確認"""
        return self._db.query(Template).filter(
            Template.name == name
        ).first() is not None
