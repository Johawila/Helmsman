import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import LoadingField from '@/components/LoadingField'
import Sparkline from '@/components/Sparkline'
import { useLiveResource } from '@/lib/useLiveResource'
import { useMetricsHistory } from '@/lib/useMetricsHistory'
import type { CronJobInfo, JobInfo, PodInfo, PodMetricsInfo, WorkloadInfo } from '@/lib/api'

// Maps the short kind name used in problems to the ResourceKind value used by the sidebar.
const KIND_MAP: Record<string, string> = {
  Pod: 'Pods',
  Deployment: 'Deployments',
  StatefulSet: 'StatefulSets',
  DaemonSet: 'DaemonSets',
  Job: 'Jobs',
}

interface DashboardViewProps {
  context: string
  namespace: string
  onSelectPod: (pod: string) => void
  onNavigate: (kind: string) => void
}

export default function DashboardView({ context, namespace, onSelectPod, onNavigate }: DashboardViewProps) {
  const pods = useLiveResource<PodInfo>('StreamPods', context, namespace)
  const deployments = useLiveResource<WorkloadInfo>('StreamDeployments', context, namespace)
  const statefulSets = useLiveResource<WorkloadInfo>('StreamStatefulSets', context, namespace)
  const daemonSets = useLiveResource<WorkloadInfo>('StreamDaemonSets', context, namespace)
  const jobs = useLiveResource<JobInfo>('StreamJobs', context, namespace)
  const cronJobs = useLiveResource<CronJobInfo>('StreamCronJobs', context, namespace)
  const { current: metrics, series, totalCpu, totalMem } = useMetricsHistory(context, namespace)

  const problems = collectProblems(
    pods.items,
    deployments.items,
    statefulSets.items,
    daemonSets.items,
    jobs.items,
  )

  const topCpu = topN(metrics, (m) => m.cpuMillicores, 5)
  const topMem = topN(metrics, (m) => m.memoryMi, 5)

  const allLoaded =
    pods.loaded &&
    deployments.loaded &&
    statefulSets.loaded &&
    daemonSets.loaded &&
    jobs.loaded &&
    cronJobs.loaded

  return (
    <div className={`relative ${allLoaded ? '' : 'min-h-[60vh]'}`}>
      <LoadingField active={!allLoaded} />
      {allLoaded && (
    <div className="space-y-6 p-6">
      {/* Summary cards */}
      <section>
        <h2 className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard
            label="Pods"
            ok={pods.items.filter(isHealthyPod).length}
            total={pods.items.length}
            healthy={pods.items.every(isHealthyPod)}
            onNavigate={() => onNavigate('Pods')}
          />
          <SummaryCard
            label="Deployments"
            ok={deployments.items.filter(isHealthyWorkload).length}
            total={deployments.items.length}
            healthy={deployments.items.every(isHealthyWorkload)}
            onNavigate={() => onNavigate('Deployments')}
          />
          <SummaryCard
            label="StatefulSets"
            ok={statefulSets.items.filter(isHealthyWorkload).length}
            total={statefulSets.items.length}
            healthy={statefulSets.items.every(isHealthyWorkload)}
            onNavigate={() => onNavigate('StatefulSets')}
          />
          <SummaryCard
            label="DaemonSets"
            ok={daemonSets.items.filter(isHealthyWorkload).length}
            total={daemonSets.items.length}
            healthy={daemonSets.items.every(isHealthyWorkload)}
            onNavigate={() => onNavigate('DaemonSets')}
          />
          <SummaryCard
            label="Jobs"
            ok={jobs.items.filter((j) => j.complete).length}
            total={jobs.items.length}
            healthy={jobs.items.every((j) => j.failed === 0)}
            failCount={jobs.items.reduce((acc, j) => acc + j.failed, 0)}
            onNavigate={() => onNavigate('Jobs')}
          />
          <SummaryCard
            label="CronJobs"
            ok={cronJobs.items.filter((c) => !c.suspended).length}
            total={cronJobs.items.length}
            healthy={cronJobs.items.every((c) => !c.suspended)}
            onNavigate={() => onNavigate('CronJobs')}
          />
        </div>
      </section>

      {/* Cluster load */}
      {totalCpu.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Cluster load
          </h2>
          <div className="grid max-w-xl grid-cols-2 gap-3">
            <TotalCard
              label="Total CPU"
              value={`${last(totalCpu)}m`}
              data={totalCpu}
              color="text-blue-400"
            />
            <TotalCard
              label="Total memory"
              value={`${last(totalMem)} Mi`}
              data={totalMem}
              color="text-purple-400"
            />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Problems */}
        <section className="xl:col-span-2">
          <h2 className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Problems
          </h2>
          {problems.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border bg-card/30 p-4 text-sm text-green-400">
              <CheckCircle2 className="size-4 shrink-0" />
              All resources healthy
            </div>
          ) : (
            <div className="space-y-1.5">
              {problems.map((p, i) => (
                <ProblemRow key={i} problem={p} onNavigate={() => onNavigate(KIND_MAP[p.kind] ?? p.kind)} />
              ))}
            </div>
          )}
        </section>

        {/* Top consumers */}
        {metrics.size > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Top consumers
            </h2>
            <div className="space-y-4">
              <ConsumerList
                label="CPU"
                color="text-blue-400"
                items={topCpu.map((m) => ({
                  name: m.name,
                  value: `${m.cpuMillicores}m`,
                  series: series.get(m.name)?.cpu ?? [],
                }))}
                onSelect={onSelectPod}
              />
              <ConsumerList
                label="Memory"
                color="text-purple-400"
                items={topMem.map((m) => ({
                  name: m.name,
                  value: `${m.memoryMi} Mi`,
                  series: series.get(m.name)?.mem ?? [],
                }))}
                onSelect={onSelectPod}
              />
            </div>
          </section>
        )}
      </div>
    </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  ok,
  total,
  healthy,
  failCount,
  onNavigate,
}: {
  label: string
  ok: number
  total: number
  healthy: boolean
  failCount?: number
  onNavigate: () => void
}) {
  const hasFailures = (failCount ?? 0) > 0
  const color =
    total === 0 ? 'text-muted-foreground' : healthy && !hasFailures ? 'text-green-400' : 'text-amber-400'

  return (
    <button
      onClick={onNavigate}
      className="rounded-lg border bg-card/30 p-3 text-left hover:bg-accent/30"
    >
      <div className="mb-1 text-xs text-muted-foreground hover:underline">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${color}`}>
        {ok}
        <span className="text-sm font-normal text-muted-foreground">/{total}</span>
      </div>
      {hasFailures && (
        <div className="mt-0.5 text-xs text-destructive">{failCount} failed</div>
      )}
    </button>
  )
}

interface Problem {
  kind: string
  name: string
  reason: string
  severity: 'error' | 'warning'
}

function ProblemRow({ problem, onNavigate }: { problem: Problem; onNavigate: () => void }) {
  const Icon = problem.severity === 'error' ? XCircle : AlertTriangle
  const iconColor = problem.severity === 'error' ? 'text-destructive' : 'text-amber-400'
  return (
    <button
      onClick={onNavigate}
      className="flex w-full items-start gap-3 rounded-lg border bg-card/30 p-3 text-sm text-left hover:bg-accent/30"
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconColor}`} />
      <div className="min-w-0 flex-1">
        <span className="font-mono text-xs text-muted-foreground">{problem.kind}/</span>
        <span className="font-medium hover:underline">{problem.name}</span>
      </div>
      <span className="shrink-0 text-muted-foreground">{problem.reason}</span>
    </button>
  )
}

function ConsumerList({
  label,
  color,
  items,
  onSelect,
}: {
  label: string
  color: string
  items: { name: string; value: string; series: number[] }[]
  onSelect: (name: string) => void
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.name}
            onClick={() => onSelect(item.name)}
            className="flex w-full items-center gap-3 rounded px-1 py-0.5 text-xs hover:bg-accent/50"
          >
            <span className="min-w-0 flex-1 truncate text-left font-mono text-foreground/80 hover:text-primary hover:underline">
              {item.name}
            </span>
            <Sparkline data={item.series} width={48} height={14} className={`shrink-0 ${color}`} />
            <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
              {item.value}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TotalCard({
  label,
  value,
  data,
  color,
}: {
  label: string
  value: string
  data: number[]
  color: string
}) {
  return (
    <div className="rounded-lg border bg-card/30 p-3">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        <Sparkline data={data} width={120} height={32} className={color} />
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function last(arr: number[]): number {
  return arr[arr.length - 1] ?? 0
}

function isHealthyPod(p: PodInfo): boolean {
  return p.phase === 'Running' || p.phase === 'Succeeded'
}

function isHealthyWorkload(w: WorkloadInfo): boolean {
  return w.desired === 0 || w.ready >= w.desired
}

function collectProblems(
  pods: PodInfo[],
  deployments: WorkloadInfo[],
  statefulSets: WorkloadInfo[],
  daemonSets: WorkloadInfo[],
  jobs: JobInfo[],
): Problem[] {
  const problems: Problem[] = []

  for (const p of pods) {
    if (p.phase !== 'Running' && p.phase !== 'Succeeded') {
      problems.push({ kind: 'Pod', name: p.name, reason: p.phase, severity: 'error' })
    } else if (p.restarts >= 5) {
      problems.push({
        kind: 'Pod',
        name: p.name,
        reason: `${p.restarts} restarts`,
        severity: 'warning',
      })
    }
  }

  for (const d of deployments) {
    if (d.desired > 0 && d.ready < d.desired) {
      problems.push({
        kind: 'Deployment',
        name: d.name,
        reason: `${d.ready}/${d.desired} ready`,
        severity: 'error',
      })
    }
  }

  for (const s of statefulSets) {
    if (s.desired > 0 && s.ready < s.desired) {
      problems.push({
        kind: 'StatefulSet',
        name: s.name,
        reason: `${s.ready}/${s.desired} ready`,
        severity: 'error',
      })
    }
  }

  for (const d of daemonSets) {
    if (d.desired > 0 && d.ready < d.desired) {
      problems.push({
        kind: 'DaemonSet',
        name: d.name,
        reason: `${d.ready}/${d.desired} ready`,
        severity: 'error',
      })
    }
  }

  for (const j of jobs) {
    if (j.failed > 0) {
      problems.push({
        kind: 'Job',
        name: j.name,
        reason: `${j.failed} failed`,
        severity: 'error',
      })
    }
  }

  // errors first, then warnings, alphabetically within each group
  return problems.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function topN(
  metrics: Map<string, PodMetricsInfo>,
  selector: (m: PodMetricsInfo) => number,
  n: number,
): PodMetricsInfo[] {
  return [...metrics.values()].sort((a, b) => selector(b) - selector(a)).slice(0, n)
}
