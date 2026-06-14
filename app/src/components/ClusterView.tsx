import { Box, Briefcase, Clock, Database, Layers, Server } from 'lucide-react'
import { useEffect, useState } from 'react'
import CronJobTable from '@/components/CronJobTable'
import JobTable from '@/components/JobTable'
import LogSheet from '@/components/LogSheet'
import PodTable from '@/components/PodTable'
import ResourceSidebar, { type SidebarKind } from '@/components/ResourceSidebar'
import Spinner from '@/components/Spinner'
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
  type PodInfo,
  type PodMetricsInfo,
  type WorkloadInfo,
} from '@/lib/api'
import { useLiveResource, type LiveStatus } from '@/lib/useLiveResource'
import { usePodMetrics } from '@/lib/usePodMetrics'

type ResourceKind = 'Pods' | 'Deployments' | 'StatefulSets' | 'DaemonSets' | 'Jobs' | 'CronJobs'
type ResourceItem = PodInfo | WorkloadInfo | JobInfo | CronJobInfo

const KINDS: (SidebarKind & { value: ResourceKind; method: string })[] = [
  { value: 'Pods', method: 'StreamPods', icon: Box },
  { value: 'Deployments', method: 'StreamDeployments', icon: Layers },
  { value: 'StatefulSets', method: 'StreamStatefulSets', icon: Database },
  { value: 'DaemonSets', method: 'StreamDaemonSets', icon: Server },
  { value: 'Jobs', method: 'StreamJobs', icon: Briefcase },
  { value: 'CronJobs', method: 'StreamCronJobs', icon: Clock },
]

interface ClusterViewProps {
  context: string
  defaultNamespace: string | null
}

export default function ClusterView({ context, defaultNamespace }: ClusterViewProps) {
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [namespace, setNamespace] = useState<string>('')
  const [kind, setKind] = useState<ResourceKind>('Pods')
  const [collapsed, setCollapsed] = useState(false)
  const [nsError, setNsError] = useState<string | null>(null)
  const [selectedPod, setSelectedPod] = useState<string | null>(null)

  const method = KINDS.find((k) => k.value === kind)!.method
  const { items, status, loaded } = useLiveResource<ResourceItem>(method, context, namespace)
  const metrics = usePodMetrics(context, kind === 'Pods' ? namespace : '')

  useEffect(() => {
    setNsError(null)
    fetchNamespaces(context)
      .then((ns) => {
        setNamespaces(ns)
        setNamespace(pickDefault(ns, defaultNamespace))
      })
      .catch((e) => setNsError(String(e)))
  }, [context, defaultNamespace])

  // Logs always come from a pod: pods open directly; workloads resolve to one of their pods.
  const openLogs = (name: string) => {
    if (kind === 'Pods') {
      setSelectedPod(name)
      return
    }
    resolvePod(context, namespace, kind, name)
      .then((pod) => pod && setSelectedPod(pod))
      .catch(() => {})
  }

  return (
    <div className="flex h-full">
      <ResourceSidebar
        kinds={KINDS}
        active={kind}
        onSelect={(v) => setKind(v as ResourceKind)}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      <div className="min-w-0 flex-1 space-y-4 overflow-auto p-6">
        <div className="flex items-center gap-3">
          <Select value={namespace} onValueChange={setNamespace}>
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

          {namespace && <LiveBadge status={status} />}
          {namespace && loaded && (
            <span className="text-sm text-muted-foreground">
              {items.length} {kind.toLowerCase()}
            </span>
          )}
        </div>

        {nsError && <p className="font-mono text-destructive">{nsError}</p>}
        {namespace && !nsError && (
          <ResourceArea
            kind={kind}
            status={status}
            loaded={loaded}
            items={items}
            metrics={metrics}
            onSelect={openLogs}
          />
        )}
      </div>

      <LogSheet
        context={context}
        namespace={namespace}
        pod={selectedPod}
        onClose={() => setSelectedPod(null)}
      />
    </div>
  )
}

function ResourceArea({
  kind,
  status,
  loaded,
  items,
  metrics,
  onSelect,
}: {
  kind: ResourceKind
  status: LiveStatus
  loaded: boolean
  items: ResourceItem[]
  metrics: Map<string, PodMetricsInfo>
  onSelect: (name: string) => void
}) {
  if (status === 'error') {
    return (
      <p className="text-sm text-destructive">
        Lost the cluster stream. Check your credentials (for EKS, run{' '}
        <code className="font-mono">aws sso login</code>), then reselect the namespace.
      </p>
    )
  }
  if (!loaded) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label={status === 'reconnecting' ? 'Reconnecting…' : `Loading ${kind.toLowerCase()}…`} />
      </div>
    )
  }

  switch (kind) {
    case 'Pods':
      return <PodTable pods={items as PodInfo[]} metrics={metrics} onSelectPod={onSelect} />
    case 'Jobs':
      return <JobTable jobs={items as JobInfo[]} onSelect={onSelect} />
    case 'CronJobs':
      return <CronJobTable cronJobs={items as CronJobInfo[]} />
    default:
      return (
        <WorkloadTable kindLabel={kind} workloads={items as WorkloadInfo[]} onSelect={onSelect} />
      )
  }
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
