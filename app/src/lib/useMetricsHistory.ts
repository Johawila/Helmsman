import { useEffect, useRef, useState } from 'react'
import { fetchMetrics, type PodMetricsInfo } from './api'

const POLL_MS = 10_000
const MAX_SAMPLES = 30 // ~5 minutes at the poll interval

export interface MetricSeries {
  cpu: number[]
  mem: number[]
}

export interface MetricsHistory {
  current: Map<string, PodMetricsInfo>
  series: Map<string, MetricSeries>
  totalCpu: number[]
  totalMem: number[]
}

// Polls metrics-server like usePodMetrics, but retains a rolling in-memory history (per pod and a
// cluster-wide total) so the dashboard can draw sparklines. No backend storage — history resets on
// context/namespace change and is capped to the last MAX_SAMPLES. Failures are swallowed.
export function useMetricsHistory(context: string, namespace: string): MetricsHistory {
  const [history, setHistory] = useState<MetricsHistory>(empty)
  const ref = useRef<MetricsHistory>(empty())

  useEffect(() => {
    ref.current = empty()
    setHistory(ref.current)
    if (!namespace) return

    let active = true
    const load = async () => {
      try {
        const list = await fetchMetrics(context, namespace)
        if (!active) return
        ref.current = append(ref.current, list)
        setHistory(ref.current)
      } catch {
        // best-effort — metrics-server may be absent
      }
    }

    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [context, namespace])

  return history
}

function append(prev: MetricsHistory, list: PodMetricsInfo[]): MetricsHistory {
  const current = new Map(list.map((m) => [m.name, m]))
  const series = new Map<string, MetricSeries>()
  for (const m of list) {
    const existing = prev.series.get(m.name) ?? { cpu: [], mem: [] }
    series.set(m.name, {
      cpu: push(existing.cpu, m.cpuMillicores),
      mem: push(existing.mem, m.memoryMi),
    })
  }
  const totalCpu = push(prev.totalCpu, sum(list, (m) => m.cpuMillicores))
  const totalMem = push(prev.totalMem, sum(list, (m) => m.memoryMi))
  return { current, series, totalCpu, totalMem }
}

function push(arr: number[], value: number): number[] {
  const next = [...arr, value]
  return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next
}

function sum(list: PodMetricsInfo[], select: (m: PodMetricsInfo) => number): number {
  return list.reduce((acc, m) => acc + select(m), 0)
}

function empty(): MetricsHistory {
  return { current: new Map(), series: new Map(), totalCpu: [], totalMem: [] }
}
