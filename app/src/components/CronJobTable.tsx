import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { CronJobInfo } from '@/lib/api'
import { formatAge } from '@/lib/kube'

interface CronJobTableProps {
  cronJobs: CronJobInfo[]
}

export default function CronJobTable({ cronJobs }: CronJobTableProps) {
  if (cronJobs.length === 0) {
    return <p className="text-muted-foreground">No cronjobs in this namespace.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Schedule</TableHead>
          <TableHead>Suspended</TableHead>
          <TableHead className="text-right">Active</TableHead>
          <TableHead className="text-right">Last run</TableHead>
          <TableHead className="text-right">Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cronJobs.map((cj) => (
          <TableRow key={cj.name}>
            <TableCell className="font-mono">{cj.name}</TableCell>
            <TableCell className="font-mono text-muted-foreground">{cj.schedule}</TableCell>
            <TableCell className={cj.suspended ? 'text-amber-500' : 'text-muted-foreground'}>
              {cj.suspended ? 'yes' : 'no'}
            </TableCell>
            <TableCell className="text-right font-mono">{cj.active}</TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {cj.lastSchedule ? `${formatAge(cj.lastSchedule)} ago` : '—'}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {formatAge(cj.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
