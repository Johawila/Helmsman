import { Box, Briefcase, Clock, Cpu, Database, LayoutDashboard, Layers, Pin, Server } from 'lucide-react'
import { useEffect, useState } from 'react'
import CronJobTable from '@/components/CronJobTable'
import DashboardView from '@/components/DashboardView'
import DetailSheet, { type DetailTarget } from '@/components/DetailSheet'
import JobTable from '@/components/JobTable'
import LoadingField from '@/components/LoadingField'
import LogSheet from '@/components/LogSheet'
import NodePodsSheet from '@/components/NodePodsSheet'
import NodeTable from '@/components/NodeTable'
import PodTable from '@/components/PodTable'
import ResourceSidebar, { type SidebarKind } from '@/components/ResourceSidebar'
import WorkloadTable from '@/components/WorkloadTable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  fetchNamespaces,
  resolvePod,
  type CronJobInfo,
  type JobInfo,
  type NodeInfo,
  type PodInfo,
  type PodMetricsInfo,
  type WorkloadInfo,
} from '@/lib/api'
import { useLiveResource, type LiveStatus } from '@/lib/useLiveResource'
import { usePodMetrics } from '@/lib/usePodMetrics'
import { clearDefaultNamespace, getDefaultNamespace, setDefaultNamespace } from '@/lib/defaults'

type ResourceKind =
  | 'Dashboard'
  | 'Pods'
  | 'Deployments'
  | 'StatefulSets'
  | 'DaemonSets'
  | 'Jobs'
  | 'CronJobs'
  | 'Nodes'
type ResourceItem = PodInfo | WorkloadInfo | JobInfo | CronJobInfo | NodeInfo

// Cluster-scoped kinds don't need a namespace; the stream runs against the whole cluster.
const CLUSTER_SCOPED: ResourceKind[] = ['Nodes']

const DASHBOARD_KIND: SidebarKind & { value: ResourceKind; method: string } = {
  value: 'Dashboard',
  method: '',
  icon: LayoutDashboard,
}

const WORKLOAD_KINDS: (SidebarKind & { value: ResourceKind; method: string })[] = [
  { value: 'Pods', method: 'StreamPods', icon: Box },
  { value: 'Deployments', method: 'StreamDeployments', icon: Layers },
  { value: 'StatefulSets', method: 'StreamStatefulSets', icon: Database },
  { value: 'DaemonSets', method: 'StreamDaemonSets', icon: Server },
  { value: 'Jobs', method: 'StreamJobs', icon: Briefcase },
  { value: 'CronJobs', method: 'StreamCronJobs', icon: Clock },
]

const CLUSTER_KINDS: (SidebarKind & { value: ResourceKind; method: string })[] = [
  { value: 'Nodes', method: 'StreamNodes', icon: Cpu },
]

const ALL_KINDS = [...WORKLOAD_KINDS, ...CLUSTER_KINDS]

interface ClusterViewProps {
  context: string
  defaultNamespace: string | null
}

export default function ClusterView({ context, defaultNamespace }: ClusterViewProps) {
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [namespace, setNamespace] = useState<string>('')
  const [kind, setKind] = useState<ResourceKind>('Dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [nsError, setNsError] = useState<string | null>(null)
  // A selected pod carries its namespace, since pods reached via a node span namespaces.
  const [selectedPod, setSelectedPod] = useState<{ namespace: string; name: string } | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<DetailTarget | null>(null)
  const [defaultNs, setDefaultNs] = useState<string | null>(null)

  const clusterScoped = CLUSTER_SCOPED.includes(kind)
  const method = ALL_KINDS.find((k) => k.value === kind)?.method ?? ''
  // Dashboard manages its own streams; cluster-scoped kinds stream regardless of namespace
  // (a constant placeholder keeps useLiveResource active — the server ignores it).
  const streamNamespace = kind === 'Dashboard' ? '' : clusterScoped ? 'cluster' : namespace
  const { items, status, loaded, error } = useLiveResource<ResourceItem>(
    method,
    context,
    streamNamespace,
  )
  const metrics = usePodMetrics(context, kind === 'Pods' ? namespace : '')

  // A resource table is shown for any non-dashboard kind once it has something to stream:
  // cluster-scoped kinds always, namespaced kinds once a namespace is selected.
  const streaming = kind !== 'Dashboard' && (clusterScoped || !!namespace)

  useEffect(() => {
    const pinned = getDefaultNamespace(context)
    setDefaultNs(pinned)
    setNsError(null)
    fetchNamespaces(context)
      .then((ns) => {
        setNamespaces(ns)
        // Pinned default wins, then the context's kubeconfig namespace, then sensible fallbacks.
        setNamespace(pickDefault(ns, pinned ?? defaultNamespace))
      })
      .catch((e) => setNsError(String(e)))
  }, [context, defaultNamespace])

  const toggleDefaultNamespace = () => {
    if (defaultNs === namespace) {
      clearDefaultNamespace(context)
      setDefaultNs(null)
    } else {
      setDefaultNamespace(context, namespace)
      setDefaultNs(namespace)
    }
  }

  const openDetails = (name: string) => setSelectedDetail({ kind, namespace, name })

  // Logs always come from a pod: pods open directly; workloads resolve to one of their pods.
  // These come from a namespaced view, so they use the currently-selected namespace.
  const openLogs = (name: string) => {
    if (kind === 'Pods') {
      setSelectedPod({ namespace, name })
      return
    }
    resolvePod(context, namespace, kind, name)
      .then((pod) => pod && setSelectedPod({ namespace, name: pod }))
      .catch(() => {})
  }

  return (
    <div className="flex h-full">
      <ResourceSidebar
        dashboard={DASHBOARD_KIND}
        workloads={WORKLOAD_KINDS}
        cluster={CLUSTER_KINDS}
        active={kind}
        onSelect={(v) => setKind(v as ResourceKind)}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      <div className="min-w-0 flex-1 space-y-4 overflow-auto p-6">
        <div className="flex items-center gap-3">
          {!clusterScoped && (
            <>
              <Select value={namespace} onValueChange={(v) => v && setNamespace(v)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a namespace…" />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map((ns) => (
                    <SelectItem key={ns} value={ns}>
                      {ns}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {namespace && (
                <button
                  onClick={toggleDefaultNamespace}
                  title={
                    defaultNs === namespace
                      ? 'Default namespace — click to unset'
                      : 'Set as default namespace'
                  }
                  aria-pressed={defaultNs === namespace}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pin
                    className={`size-4 ${defaultNs === namespace ? 'fill-current text-foreground' : ''}`}
                  />
                </button>
              )}
            </>
          )}

          {streaming && <LiveBadge status={status} />}
          {streaming && loaded && (
            <span className="text-sm text-muted-foreground">
              {items.length} {kind.toLowerCase()}
            </span>
          )}
        </div>

        {nsError && !clusterScoped && <p className="font-mono text-destructive">{nsError}</p>}
        {namespace && !nsError && kind === 'Dashboard' && (
          <DashboardView
            context={context}
            namespace={namespace}
            onSelectPod={(name) => setSelectedPod({ namespace, name })}
            onNavigate={(k) => setKind(k as ResourceKind)}
          />
        )}
        {streaming && (
          <ResourceArea
            kind={kind as WorkloadKind}
            status={status}
            loaded={loaded}
            error={error}
            clusterScoped={clusterScoped}
            items={items}
            metrics={metrics}
            onSelect={openLogs}
            onSelectNode={setSelectedNode}
            onDetails={openDetails}
          />
        )}
      </div>

      <NodePodsSheet
        context={context}
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onSelectPod={(ns, name) => setSelectedPod({ namespace: ns, name })}
      />

      <LogSheet
        context={context}
        namespace={selectedPod?.namespace ?? ''}
        pod={selectedPod?.name ?? null}
        onClose={() => setSelectedPod(null)}
      />

      <DetailSheet
        context={context}
        target={selectedDetail}
        onClose={() => setSelectedDetail(null)}
      />
    </div>
  )
}

type WorkloadKind = Exclude<ResourceKind, 'Dashboard'>

function ResourceArea({
  kind,
  status,
  loaded,
  error,
  clusterScoped,
  items,
  metrics,
  onSelect,
  onSelectNode,
  onDetails,
}: {
  kind: WorkloadKind
  status: LiveStatus
  loaded: boolean
  error: string | null
  clusterScoped: boolean
  items: ResourceItem[]
  metrics: Map<string, PodMetricsInfo>
  onSelect: (name: string) => void
  onSelectNode: (node: string) => void
  onDetails: (name: string) => void
}) {
  if (status === 'error') {
    return <StreamError kind={kind} error={error} clusterScoped={clusterScoped} />
  }

  return (
    <div className={`relative ${loaded ? '' : 'min-h-[60vh]'}`}>
      <LoadingField active={!loaded} />
      {loaded && renderResource(kind, items, metrics, onSelect, onSelectNode, onDetails)}
    </div>
  )
}

function renderResource(
  kind: WorkloadKind,
  items: ResourceItem[],
  metrics: Map<string, PodMetricsInfo>,
  onSelect: (name: string) => void,
  onSelectNode: (node: string) => void,
  onDetails: (name: string) => void,
) {
  switch (kind) {
    case 'Pods':
      return (
        <PodTable
          pods={items as PodInfo[]}
          metrics={metrics}
          onSelectPod={onSelect}
          onDetails={onDetails}
        />
      )
    case 'Jobs':
      return <JobTable jobs={items as JobInfo[]} onSelect={onSelect} />
    case 'CronJobs':
      return <CronJobTable cronJobs={items as CronJobInfo[]} />
    case 'Nodes':
      return <NodeTable nodes={items as NodeInfo[]} onSelect={onSelectNode} />
    default:
      return (
        <WorkloadTable
          kindLabel={kind}
          workloads={items as WorkloadInfo[]}
          onSelect={onSelect}
          onDetails={onDetails}
        />
      )
  }
}

function StreamError({
  kind,
  error,
  clusterScoped,
}: {
  kind: WorkloadKind
  error: string | null
  clusterScoped: boolean
}) {
  const forbidden = !!error && /forbidden|cannot (list|watch)|is not allowed/i.test(error)
  const label = kind.toLowerCase()

  return (
    <div className="space-y-2 text-sm">
      {forbidden ? (
        <p className="text-destructive">
          Not allowed to read {label}. Your context lacks permission to{' '}
          {clusterScoped ? 'list/watch this cluster-scoped resource' : `list/watch ${label}`} (RBAC).
        </p>
      ) : (
        <p className="text-destructive">
          Lost the {label} stream. Check your credentials (for EKS, run{' '}
          <code className="font-mono">aws sso login</code>)
          {clusterScoped ? '' : ', then reselect the namespace'}.
        </p>
      )}
      {error && <p className="font-mono text-xs break-all text-muted-foreground">{error}</p>}
    </div>
  )
}

function LiveBadge({ status }: { status: LiveStatus }) {
  const view: Record<LiveStatus, { dot: string; label: string; pulse: boolean }> = {
    connecting: { dot: 'bg-amber-500', label: 'connecting…', pulse: true },
    live: { dot: 'bg-green-500', label: 'live', pulse: true },
    reconnecting: { dot: 'bg-amber-500', label: 'reconnecting…', pulse: true },
    error: { dot: 'bg-red-500', label: 'disconnected', pulse: false },
  }
  const { dot, label, pulse } = view[status]
  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className={`size-2 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}

function pickDefault(namespaces: string[], preferred: string | null): string {
  if (preferred && namespaces.includes(preferred)) {
    return preferred
  }
  if (namespaces.includes('default')) {
    return 'default'
  }
  return namespaces[0] ?? ''
}
