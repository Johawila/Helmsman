import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PodInfo, PodMetricsInfo } from '@/lib/api'
import { formatAge } from '@/lib/kube'

interface PodTableProps {
  pods: PodInfo[]
  metrics: Map<string, PodMetricsInfo>
  onSelectPod: (pod: string) => void
}

export default function PodTable({ pods, metrics, onSelectPod }: PodTableProps) {
  if (pods.length === 0) {
    return <p className="text-muted-foreground">No pods in this namespace.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ready</TableHead>
          <TableHead className="text-right">Restarts</TableHead>
          <TableHead className="text-right">CPU</TableHead>
          <TableHead className="text-right">Memory</TableHead>
          <TableHead>Node</TableHead>
          <TableHead className="text-right">Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pods.map((pod) => {
          const metric = metrics.get(pod.name)
          return (
            <TableRow key={pod.name}>
              <TableCell>
                <button
                  className="font-mono text-foreground hover:text-primary hover:underline"
                  onClick={() => onSelectPod(pod.name)}
                  title="View logs"
                >
                  {pod.name}
                </button>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${statusDot(pod.status)} ${pod.status === 'Running' ? 'animate-pulse' : ''}`}
                  />
                  {pod.status}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono">
                {pod.readyContainers}/{pod.totalContainers}
              </TableCell>
              <TableCell
                className={`text-right font-mono ${pod.restarts > 0 ? 'text-amber-500' : ''}`}
              >
                {pod.restarts}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {metric ? `${metric.cpuMillicores}m` : '—'}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {metric ? `${metric.memoryMi}Mi` : '—'}
              </TableCell>
              <TableCell className="font-mono text-muted-foreground">{pod.node ?? '—'}</TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {formatAge(pod.createdAt)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function statusDot(status: string): string {
  switch (status) {
    case 'Running':
      return 'bg-green-500'
    case 'Completed':
      return 'bg-muted-foreground'
    case 'Pending':
    case 'Terminating':
      return 'bg-amber-500'
    default:
      // CrashLoopBackOff, ImagePullBackOff, OOMKilled, Error, Failed, Unschedulable, Evicted, …
      return 'bg-red-500'
  }
}
