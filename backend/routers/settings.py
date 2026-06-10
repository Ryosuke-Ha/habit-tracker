from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from auth import verify_api_key
from database import SessionLocal

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(verify_api_key)])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_user(x_user_email: Optional[str] = Header(None)) -> str:
    if not x_user_email:
        raise HTTPException(status_code=401, detail="X-User-Email header is required")
    return x_user_email


class SettingValue(BaseModel):
    value: str


@router.get("")
def get_settings(
    user_id: str = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    rows = db.query(models.UserSettings).filter(models.UserSettings.user_id == user_id).all()
    return {row.key: row.value for row in rows if row.value is not None}


@router.put("/{key}")
def put_setting(
    key: str,
    body: SettingValue,
    user_id: str = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    row = (
        db.query(models.UserSettings)
        .filter(models.UserSettings.user_id == user_id, models.UserSettings.key == key)
        .first()
    )
    if row:
        row.value = body.value
    else:
        row = models.UserSettings(user_id=user_id, key=key, value=body.value)
        db.add(row)
    db.commit()
    return {"key": key, "value": body.value}
