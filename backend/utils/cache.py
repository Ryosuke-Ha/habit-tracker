from datetime import datetime, timedelta
from typing import Any, Optional

_cache: dict = {}


def get_cached(key: str) -> Optional[Any]:
    """キャッシュからデータを取得する。期限切れの場合はNoneを返す。"""
    if key in _cache:
        value, expires_at = _cache[key]
        if datetime.now() < expires_at:
            return value
        del _cache[key]
    return None


def set_cached(key: str, value: Any, ttl_seconds: int = 300) -> None:
    """キャッシュにデータを保存する。"""
    _cache[key] = (value, datetime.now() + timedelta(seconds=ttl_seconds))


def invalidate_cache(key: str) -> None:
    """指定したキーのキャッシュを無効化する。"""
    _cache.pop(key, None)


def invalidate_cache_prefix(prefix: str) -> None:
    """指定したプレフィックスで始まる全キャッシュを無効化する。"""
    keys_to_delete = [k for k in _cache if k.startswith(prefix)]
    for key in keys_to_delete:
        del _cache[key]


def clear_all_cache() -> None:
    """全キャッシュを削除する（テスト用）。"""
    _cache.clear()
