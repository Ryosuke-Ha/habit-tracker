from typing import Generic, List, Optional, Type, TypeVar

from sqlalchemy.orm import Session

T = TypeVar("T")


class BaseRepository(Generic[T]):
    """
    リポジトリの基底クラス。
    共通のCRUD操作を提供する。
    """

    def __init__(self, model: Type[T], db: Session):
        self._model = model
        self._db = db

    def find_by_id(self, id: int) -> Optional[T]:
        return self._db.query(self._model).filter(
            self._model.id == id
        ).first()

    def save(self, entity: T) -> T:
        self._db.add(entity)
        self._db.commit()
        self._db.refresh(entity)
        return entity

    def delete(self, entity: T) -> None:
        self._db.delete(entity)
        self._db.commit()

    def find_all(self) -> List[T]:
        return self._db.query(self._model).all()
