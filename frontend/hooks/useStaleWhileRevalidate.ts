import { useState, useEffect, useCallback, useRef } from "react"

interface SWROptions<T> {
  key: string
  fetcher: () => Promise<T>
  ttlMs?: number
}

interface SWRResult<T> {
  data: T | null
  isLoading: boolean
  isValidating: boolean
  error: string | null
  revalidate: () => Promise<void>
}

interface CacheEntry<T> {
  data: T
  cachedAt: number
  expiresAt: number
}

function getCacheKey(key: string): string {
  return `swr_${key}`
}

export function getFromCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(getCacheKey(key))
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(getCacheKey(key))
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

export function setToCache<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === "undefined") return
  try {
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    }
    localStorage.setItem(getCacheKey(key), JSON.stringify(entry))
  } catch {
    // localStorage が使えない場合は無視
  }
}

export function invalidateSWRCache(key: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(getCacheKey(key))
  } catch {
    // 無視
  }
}

export function invalidateSWRCachePrefix(prefix: string): void {
  if (typeof window === "undefined") return
  try {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(`swr_${prefix}`)
    )
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    // 無視
  }
}

export function useStaleWhileRevalidate<T>({
  key,
  fetcher,
  ttlMs = 30 * 60 * 1000,
}: SWROptions<T>): SWRResult<T> {
  const initialCached = getFromCache<T>(key)
  const [data, setData] = useState<T | null>(initialCached)
  const [isLoading, setIsLoading] = useState<boolean>(initialCached === null)
  const [isValidating, setIsValidating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // fetcher を ref で保持して revalidate の依存から除外
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const revalidate = useCallback(async () => {
    setIsValidating(true)
    try {
      const fresh = await fetcherRef.current()
      setData(fresh)
      setToCache(key, fresh, ttlMs)
      setError(null)
    } catch {
      setError("データの取得に失敗しました")
    } finally {
      setIsValidating(false)
      setIsLoading(false)
    }
  }, [key, ttlMs])

  // key が変わったときにキャッシュ状態をリセット
  useEffect(() => {
    const cached = getFromCache<T>(key)
    setData(cached)
    setIsLoading(cached === null)
    setError(null)
  }, [key])

  // マウント時・key 変更時に自動 revalidate
  useEffect(() => {
    revalidate()
  }, [revalidate])

  return { data, isLoading, isValidating, error, revalidate }
}
