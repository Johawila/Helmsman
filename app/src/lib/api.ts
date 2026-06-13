export interface ContextInfo {
  name: string
  cluster: string
  namespace: string | null
  isCurrent: boolean
}

export interface PodInfo {
  name: string
  phase: string
  readyContainers: number
  totalContainers: number
  restarts: number
  node: string | null
  createdAt: string | null
}

export async function fetchContexts(): Promise<ContextInfo[]> {
  return getJson('/api/contexts')
}

export async function fetchNamespaces(context: string): Promise<string[]> {
  const q = new URLSearchParams({ context })
  return getJson(`/api/namespaces?${q}`)
}

export async function fetchPods(context: string, namespace: string): Promise<PodInfo[]> {
  const q = new URLSearchParams({ context, namespace })
  return getJson(`/api/pods?${q}`)
}

export interface PodMetricsInfo {
  name: string
  cpuMillicores: number
  memoryMi: number
}

export async function fetchMetrics(context: string, namespace: string): Promise<PodMetricsInfo[]> {
  const q = new URLSearchParams({ context, namespace })
  return getJson(`/api/metrics?${q}`)
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}
