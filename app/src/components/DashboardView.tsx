import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useLiveResource } from '@/lib/useLiveResource'
import { usePodMetrics } from '@/lib/usePodMetrics'
import type { CronJobInfo, JobInfo, PodInfo, PodMetricsInfo, WorkloadInfo } from '@/lib/api'

interface DashboardViewProps {
  context: string
  namespace: string
}

export default function DashboardView({ context, namespace }: DashboardViewProps) {
  const pods = useLiveResource<PodInfo>('StreamPods', context, namespace)
  const deployments = useLiveResource<WorkloadInfo>('StreamDeployments', context, namespace)
  const statefulSets = useLiveResource<WorkloadInfo>('StreamStatefulSets', context, namespace)
  const daemonSets = useLiveResource<WorkloadInfo>('StreamDaemonSets', context, namespace)
  const jobs = useLiveResource<JobInfo>('StreamJobs', context, namespace)
  const cronJobs = useLiveResource<CronJobInfo>('StreamCronJobs', context, namespace)
  const metrics = usePodMetrics(context, namespace)

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

  if (!allLoaded) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading dashboard…</div>
    )
  }

  return (
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
          />
          <SummaryCard
            label="Deployments"
            ok={deployments.items.filter(isHealthyWorkload).length}
            total={deployments.items.length}
            healthy={deployments.items.every(isHealthyWorkload)}
          />
          <SummaryCard
            label="StatefulSets"
            ok={statefulSets.items.filter(isHealthyWorkload).length}
            total={statefulSets.items.length}
            healthy={statefulSets.items.every(isHealthyWorkload)}
          />
          <SummaryCard
            label="DaemonSets"
            ok={daemonSets.items.filter(isHealthyWorkload).length}
            total={daemonSets.items.length}
            healthy={daemonSets.items.every(isHealthyWorkload)}
          />
          <SummaryCard
            label="Jobs"
            ok={jobs.items.filter((j) => j.complete).length}
            total={jobs.items.length}
            healthy={jobs.items.every((j) => j.failed === 0)}
            failCount={jobs.items.reduce((acc, j) => acc + j.failed, 0)}
          />
          <SummaryCard
            label="CronJobs"
            ok={cronJobs.items.filter((c) => !c.suspended).length}
            total={cronJobs.items.length}
            healthy={cronJobs.items.every((c) => !c.suspended)}
          />
        </div>
      </section>

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
                <ProblemRow key={i} problem={p} />
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
                items={topCpu.map((m) => ({ name: m.name, value: `${m.cpuMillicores}m` }))}
              />
              <ConsumerList
                label="Memory"
                items={topMem.map((m) => ({ name: m.name, value: `${m.memoryMi} Mi` }))}
              />
            </div>
          </section>
        )}
      </div>
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
}: {
  label: string
  ok: number
  total: number
  healthy: boolean
  failCount?: number
}) {
  const hasFailures = (failCount ?? 0) > 0
  const color =
    total === 0 ? 'text-muted-foreground' : healthy && !hasFailures ? 'text-green-400' : 'text-amber-400'

  return (
    <div className="rounded-lg border bg-card/30 p-3">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${color}`}>
        {ok}
        <span className="text-sm font-normal text-muted-foreground">/{total}</span>
      </div>
      {hasFailures && (
        <div className="mt-0.5 text-xs text-destructive">{failCount} failed</div>
      )}
    </div>
  )
}

interface Problem {
  kind: string
  name: string
  reason: string
  severity: 'error' | 'warning'
}

function ProblemRow({ problem }: { problem: Problem }) {
  const Icon = problem.severity === 'error' ? XCircle : AlertTriangle
  const iconColor = problem.severity === 'error' ? 'text-destructive' : 'text-amber-400'
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card/30 p-3 text-sm">
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconColor}`} />
      <div className="min-w-0 flex-1">
        <span className="font-mono text-xs text-muted-foreground">{problem.kind}/</span>
        <span className="font-medium">{problem.name}</span>
      </div>
      <span className="shrink-0 text-muted-foreground">{problem.reason}</span>
    </div>
  )
}

function ConsumerList({ label, items }: { label: string; items: { name: string; value: string }[] }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-mono text-foreground/80">{item.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
