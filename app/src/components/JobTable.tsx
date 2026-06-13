import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { JobInfo } from '@/lib/api'
import { formatAge } from '@/lib/kube'

interface JobTableProps {
  jobs: JobInfo[]
  onSelect: (name: string) => void
}

export default function JobTable({ jobs, onSelect }: JobTableProps) {
  if (jobs.length === 0) {
    return <p className="text-muted-foreground">No jobs in this namespace.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Completions</TableHead>
          <TableHead className="text-right">Failed</TableHead>
          <TableHead>Image</TableHead>
          <TableHead className="text-right">Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.name}>
            <TableCell>
              <button
                className="font-mono text-foreground hover:text-primary hover:underline"
                onClick={() => onSelect(job.name)}
                title="View logs"
              >
                {job.name}
              </button>
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${job.complete ? 'bg-green-500' : 'bg-amber-500'}`}
                />
                {job.complete ? 'Complete' : 'Running'}
              </span>
            </TableCell>
            <TableCell className="text-right font-mono">
              {job.succeeded}/{job.completions}
            </TableCell>
            <TableCell className={`text-right font-mono ${job.failed > 0 ? 'text-red-400' : ''}`}>
              {job.failed}
            </TableCell>
            <TableCell
              className="max-w-md truncate font-mono text-muted-foreground"
              title={job.image ?? ''}
            >
              {job.image ?? '—'}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {formatAge(job.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
