export interface ContextInfo {
  name: string
  cluster: string
  namespace: string | null
  isCurrent: boolean
}

export interface PodInfo {
  name: string
  // Owning namespace; present for cross-namespace listings (pods on a node).
  namespace?: string
  phase: string
  // Derived kubectl-style status (CrashLoopBackOff, OOMKilled, Completed, …); drives health.
  // Optional so an older backend without this field degrades to `phase` rather than breaking.
  status?: string
  readyContainers: number
  totalContainers: number
  restarts: number
  node: string | null
  createdAt: string | null
}

export interface WorkloadInfo {
  name: string
  desired: number
  ready: number
  upToDate: number
  available: number
  image: string | null
  createdAt: string | null
}

export interface JobInfo {
  name: string
  completions: number
  succeeded: number
  failed: number
  complete: boolean
  image: string | null
  createdAt: string | null
}

export interface CronJobInfo {
  name: string
  schedule: string
  suspended: boolean
  active: number
  lastSchedule: string | null
  createdAt: string | null
}

export interface PodMetricsInfo {
  name: string
  cpuMillicores: number
  memoryMi: number
}

export interface NodeInfo {
  name: string
  status: string
  roles: string
  kubeletVersion: string
  cpuMillicores: number
  memoryMi: number
  memoryPressure: boolean
  diskPressure: boolean
  pidPressure: boolean
  createdAt: string | null
}

export interface EventInfo {
  name: string
  type: string // Normal | Warning
  reason: string
  message: string
  objectKind: string
  objectName: string
  count: number
  lastSeen: string | null
}

export async function fetchContexts(): Promise<ContextInfo[]> {
  return getJson('/api/contexts')
}

export async function fetchNamespaces(context: string): Promise<string[]> {
  const q = new URLSearchParams({ context })
  return getJson(`/api/namespaces?${q}`)
}

export async function fetchMetrics(context: string, namespace: string): Promise<PodMetricsInfo[]> {
  const q = new URLSearchParams({ context, namespace })
  return getJson(`/api/metrics?${q}`)
}

// Pods scheduled on a node, across namespaces.
export async function fetchNodePods(context: string, node: string): Promise<PodInfo[]> {
  const q = new URLSearchParams({ context, node })
  return getJson(`/api/node-pods?${q}`)
}

// Resolves a workload to one of its pods (for log streaming). Returns null when the kind has no
// pod selector (CronJobs) or no pods are running.
export async function resolvePod(
  context: string,
  namespace: string,
  kind: string,
  name: string,
): Promise<string | null> {
  const q = new URLSearchParams({ context, namespace, kind, name })
  const { pod } = await getJson<{ pod: string | null }>(`/api/resolve-pod?${q}`)
  return pod
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}
