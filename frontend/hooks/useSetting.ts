/**
 * useSetting — DBベースの設定管理フック
 *
 * - ログイン済み: GET /settings でまとめて取得し、PUT /settings/{key} で保存
 * - 未ログイン: localStorage にフォールバック
 * - 初回アクセス時に localStorage → DB へのマイグレーションを実行
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

// DBから全設定を取得してキャッシュする
type Cache = Record<string, string>;

// モジュールレベルのキャッシュ（同一セッション内で共有）
let _cache: Cache | null = null;
let _cachePromise: Promise<Cache> | null = null;

async function fetchAllSettings(email: string): Promise<Cache> {
  if (_cache) return _cache;
  if (_cachePromise) return _cachePromise;

  _cachePromise = apiFetch(`/settings`, {
    headers: { "X-User-Email": email },
  })
    .then((r) => r.json())
    .then((data: Cache) => {
      _cache = data;
      _cachePromise = null;
      return data;
    })
    .catch(() => {
      _cachePromise = null;
      return {};
    });

  return _cachePromise;
}

async function putSetting(email: string, key: string, value: string): Promise<void> {
  await apiFetch(`/settings/${key}`, {
    method: "PUT",
    headers: { "X-User-Email": email },
    body: JSON.stringify({ value }),
  });
  // キャッシュを更新
  if (_cache) _cache[key] = value;
}

/** localStorage → DB マイグレーション（初回のみ） */
const MIGRATION_KEYS = [
  "habit_app_launched",
  "habit_day_template_map",
  "habit_last_visit_date",
  "habit_last_template_id",
];

async function migrateLocalStorageToDB(email: string, dbCache: Cache): Promise<void> {
  for (const key of MIGRATION_KEYS) {
    const lsValue = localStorage.getItem(key);
    if (lsValue !== null && !(key in dbCache)) {
      await putSetting(email, key, lsValue);
      localStorage.removeItem(key);
    }
  }
}

// ---- hook ----

export function useSetting() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? null;
  const [ready, setReady] = useState(false);
  const migrated = useRef(false);

  useEffect(() => {
    if (!email) { setReady(true); return; }
    if (migrated.current) { setReady(true); return; }
    migrated.current = true;

    fetchAllSettings(email).then((cache) => {
      migrateLocalStorageToDB(email, cache).then(() => setReady(true));
    });
  }, [email]);

  const getSetting = useCallback(
    async (key: string): Promise<string | null> => {
      if (!email) return localStorage.getItem(key);
      const cache = await fetchAllSettings(email);
      return cache[key] ?? null;
    },
    [email],
  );

  const setSetting = useCallback(
    async (key: string, value: string): Promise<void> => {
      if (!email) { localStorage.setItem(key, value); return; }
      await putSetting(email, key, value);
    },
    [email],
  );

  return { getSetting, setSetting, ready };
}

/** キャッシュをリセット（テスト・ログアウト時用） */
export function resetSettingCache() {
  _cache = null;
  _cachePromise = null;
}
