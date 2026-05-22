import { useState, useEffect, useCallback } from "react"

type HealthStatus = "checking" | "healthy" | "unhealthy"

export function useBackendHealth() {
  const [status, setStatus] = useState<HealthStatus>("checking")
  const [retryCount, setRetryCount] = useState(0)
  const [nextRetryIn, setNextRetryIn] = useState(30)

  const checkHealth = useCallback(async () => {
    setStatus("checking")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/health`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (res.ok) {
        setStatus("healthy")
        setRetryCount(0)
      } else {
        setStatus("unhealthy")
      }
    } catch {
      setStatus("unhealthy")
    }
  }, [])

  // 初回チェック
  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  // 障害時は30秒ごとに再チェック
  useEffect(() => {
    if (status !== "unhealthy") return

    setNextRetryIn(30)
    const countdown = setInterval(() => {
      setNextRetryIn((prev) => {
        if (prev <= 1) {
          clearInterval(countdown)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    const retry = setTimeout(() => {
      setRetryCount((prev) => prev + 1)
      checkHealth()
    }, 30000)

    return () => {
      clearInterval(countdown)
      clearTimeout(retry)
    }
  }, [status, retryCount, checkHealth])

  return { status, nextRetryIn, checkHealth }
}
