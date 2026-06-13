import { useEffect, useState } from 'react'
import { fetchMetrics, type PodMetricsInfo } from './api'

// Polls metrics-server (metrics.k8s.io) for per-pod CPU/memory every few seconds and returns a
// map keyed by pod name. Metrics have no watch API, so this is a poll — kept separate from the
// live pod watch and merged into the table by name. Failures are swallowed: metrics are an
// overlay, not the primary data, and metrics-server may be absent.
export function usePodMetrics(context: string, namespace: string) {
  const [metrics, setMetrics] = useState<Map<string, PodMetricsInfo>>(new Map())

  useEffect(() => {
    if (!namespace) {
      setMetrics(new Map())
      return
    }

    let active = true
    const load = async () => {
      try {
        const list = await fetchMetrics(context, namespace)
        if (active) setMetrics(new Map(list.map((m) => [m.name, m])))
      } catch {
        // ignore — metrics are best-effort
      }
    }

    load()
    const id = setInterval(load, 10_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [context, namespace])

  return metrics
}
