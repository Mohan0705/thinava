'use client'

import { DependencyList, useCallback, useEffect, useRef, useState } from 'react'

export function useAdminQuery<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  intervalMs = 0
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const mountedRef = useRef(true)

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true)
    }

    try {
      const result = await loaderRef.current()
      if (!mountedRef.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      if (mountedRef.current && isInitial) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let timer: ReturnType<typeof setInterval> | null = null

    fetchData(true)

    if (intervalMs > 0) {
      timer = setInterval(() => {
        fetchData(false)
      }, intervalMs)
    }

    return () => {
      mountedRef.current = false
      if (timer) clearInterval(timer)
    }
  }, deps)

  return { data, loading, error, setData, refetch: () => fetchData(false) }
}
