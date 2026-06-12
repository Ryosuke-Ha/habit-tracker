import time

from utils.cache import (
    clear_all_cache,
    get_cached,
    invalidate_cache,
    invalidate_cache_prefix,
    set_cached,
)


class TestInMemoryCache:
    def setup_method(self) -> None:
        """各テスト前にキャッシュをクリア"""
        clear_all_cache()

    def test_set_and_get(self) -> None:
        """キャッシュに保存して取得できる"""
        set_cached("test_key", {"data": "value"}, ttl_seconds=60)
        result = get_cached("test_key")
        assert result == {"data": "value"}

    def test_get_returns_none_for_missing_key(self) -> None:
        """存在しないキーはNoneを返す"""
        result = get_cached("nonexistent_key")
        assert result is None

    def test_cache_expires(self) -> None:
        """TTL経過後はNoneを返す"""
        set_cached("expire_key", "value", ttl_seconds=1)
        time.sleep(1.1)
        result = get_cached("expire_key")
        assert result is None

    def test_invalidate_cache(self) -> None:
        """指定したキーのキャッシュを削除できる"""
        set_cached("delete_key", "value", ttl_seconds=60)
        invalidate_cache("delete_key")
        result = get_cached("delete_key")
        assert result is None

    def test_invalidate_cache_prefix(self) -> None:
        """プレフィックスに一致するキャッシュを全て削除できる"""
        set_cached("user_1_weekly", "data1", ttl_seconds=60)
        set_cached("user_1_monthly", "data2", ttl_seconds=60)
        set_cached("user_2_weekly", "data3", ttl_seconds=60)

        invalidate_cache_prefix("user_1_")

        assert get_cached("user_1_weekly") is None
        assert get_cached("user_1_monthly") is None
        assert get_cached("user_2_weekly") == "data3"

    def test_overwrite_cache(self) -> None:
        """同じキーで上書きできる"""
        set_cached("key", "old_value", ttl_seconds=60)
        set_cached("key", "new_value", ttl_seconds=60)
        result = get_cached("key")
        assert result == "new_value"

    def test_clear_all_cache(self) -> None:
        """全キャッシュを削除できる"""
        set_cached("key1", "value1", ttl_seconds=60)
        set_cached("key2", "value2", ttl_seconds=60)
        clear_all_cache()
        assert get_cached("key1") is None
        assert get_cached("key2") is None
