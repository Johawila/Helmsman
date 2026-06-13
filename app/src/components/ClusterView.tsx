import { useEffect, useState } from 'react'
import DeploymentTable from '@/components/DeploymentTable'
import LogSheet from '@/components/LogSheet'
import PodTable from '@/components/PodTable'
import Spinner from '@/components/Spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchNamespaces, type DeploymentInfo, type PodInfo, type PodMetricsInfo } from '@/lib/api'
import { useLiveResource, type LiveStatus } from '@/lib/useLiveResource'
import { usePodMetrics } from '@/lib/usePodMetrics'

type ResourceKind = 'Pods' | 'Deployments'

const KINDS: { value: ResourceKind; method: string }[] = [
  { value: 'Pods', method: 'StreamPods' },
  { value: 'Deployments', method: 'StreamDeployments' },
]

interface ClusterViewProps {
  context: string
  defaultNamespace: string | null
}

export default function ClusterView({ context, defaultNamespace }: ClusterViewProps) {
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [namespace, setNamespace] = useState<string>('')
  const [kind, setKind] = useState<ResourceKind>('Pods')
  const [nsError, setNsError] = useState<string | null>(null)
  const [selectedPod, setSelectedPod] = useState<string | null>(null)

  const method = KINDS.find((k) => k.value === kind)!.method
  const { items, status, loaded } = useLiveResource<PodInfo | DeploymentInfo>(
    method,
    context,
    namespace,
  )
  // Metrics only apply to the pods view; pass an empty namespace otherwise so it doesn't poll.
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

  return (
    <div className="space-y-4">
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

        <Select value={kind} onValueChange={(v) => setKind(v as ResourceKind)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.value}
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
          onSelectPod={setSelectedPod}
        />
      )}

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
  onSelectPod,
}: {
  kind: ResourceKind
  status: LiveStatus
  loaded: boolean
  items: (PodInfo | DeploymentInfo)[]
  metrics: Map<string, PodMetricsInfo>
  onSelectPod: (pod: string) => void
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
        <Spinner
          label={status === 'reconnecting' ? 'Reconnecting…' : `Loading ${kind.toLowerCase()}…`}
        />
      </div>
    )
  }
  if (kind === 'Deployments') {
    return <DeploymentTable deployments={items as DeploymentInfo[]} />
  }
  return <PodTable pods={items as PodInfo[]} metrics={metrics} onSelectPod={onSelectPod} />
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
