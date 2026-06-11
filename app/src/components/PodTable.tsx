import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PodInfo } from '@/lib/api'
import { formatAge } from '@/lib/kube'

interface PodTableProps {
  pods: PodInfo[]
}

export default function PodTable({ pods }: PodTableProps) {
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
          <TableHead>Node</TableHead>
          <TableHead className="text-right">Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pods.map((pod) => (
          <TableRow key={pod.name}>
            <TableCell className="font-mono">{pod.name}</TableCell>
            <TableCell>
              <span className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${phaseDot(pod.phase)} ${pod.phase === 'Running' ? 'animate-pulse' : ''}`}
                />
                {pod.phase}
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
            <TableCell className="font-mono text-muted-foreground">{pod.node ?? '—'}</TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {formatAge(pod.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function phaseDot(phase: string): string {
  switch (phase) {
    case 'Running':
      return 'bg-green-500'
    case 'Pending':
      return 'bg-amber-500'
    case 'Failed':
      return 'bg-red-500'
    case 'Succeeded':
      return 'bg-muted-foreground'
    default:
      return 'bg-muted-foreground'
  }
}
