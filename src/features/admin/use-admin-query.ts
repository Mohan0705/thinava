'use client'

import { DependencyList, useEffect, useState } from 'react'

export function useAdminQuery<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  intervalMs = 0
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setInterval> | null = null

    const run = async (isInitial = false) => {
      if (isInitial) {
        setLoading(true)
      }

      try {
        const result = await loader()
        if (!mounted) {
          return
        }
        setData(result)
        setError(null)
      } catch (err) {
        if (!mounted) {
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load admin data')
      } finally {
        if (mounted && isInitial) {
          setLoading(false)
        }
      }
    }

    run(true)

    if (intervalMs > 0) {
      timer = setInterval(() => {
        void run(false)
      }, intervalMs)
    }

    return () => {
      mounted = false
      if (timer) {
        clearInterval(timer)
      }
    }
  }, deps)

  return { data, loading, error, setData }
}
