import { DetailsButton } from '@/components/PodTable'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { WorkloadInfo } from '@/lib/api'
import { formatAge } from '@/lib/kube'

interface WorkloadTableProps {
  kindLabel: string
  workloads: WorkloadInfo[]
  onSelect: (name: string) => void
  onDetails: (name: string) => void
}

export default function WorkloadTable({ kindLabel, workloads, onSelect, onDetails }: WorkloadTableProps) {
  if (workloads.length === 0) {
    return <p className="text-muted-foreground">No {kindLabel.toLowerCase()} in this namespace.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Ready</TableHead>
          <TableHead className="text-right">Up-to-date</TableHead>
          <TableHead className="text-right">Available</TableHead>
          <TableHead>Image</TableHead>
          <TableHead className="text-right">Age</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {workloads.map((w) => (
          <TableRow key={w.name}>
            <TableCell>
              <button
                className="font-mono text-foreground hover:text-primary hover:underline"
                onClick={() => onSelect(w.name)}
                title="View logs"
              >
                {w.name}
              </button>
            </TableCell>
            <TableCell
              className={`text-right font-mono ${w.ready === w.desired ? '' : 'text-amber-500'}`}
            >
              {w.ready}/{w.desired}
            </TableCell>
            <TableCell className="text-right font-mono">{w.upToDate}</TableCell>
            <TableCell className="text-right font-mono">{w.available}</TableCell>
            <TableCell
              className="max-w-md truncate font-mono text-muted-foreground"
              title={w.image ?? ''}
            >
              {w.image ?? '—'}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {formatAge(w.createdAt)}
            </TableCell>
            <TableCell>
              <DetailsButton onClick={() => onDetails(w.name)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
