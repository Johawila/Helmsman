import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DeploymentInfo } from '@/lib/api'
import { formatAge } from '@/lib/kube'

interface DeploymentTableProps {
  deployments: DeploymentInfo[]
}

export default function DeploymentTable({ deployments }: DeploymentTableProps) {
  if (deployments.length === 0) {
    return <p className="text-muted-foreground">No deployments in this namespace.</p>
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {deployments.map((dep) => {
          const healthy = dep.readyReplicas === dep.desiredReplicas
          return (
            <TableRow key={dep.name}>
              <TableCell className="font-mono">{dep.name}</TableCell>
              <TableCell
                className={`text-right font-mono ${healthy ? '' : 'text-amber-500'}`}
              >
                {dep.readyReplicas}/{dep.desiredReplicas}
              </TableCell>
              <TableCell className="text-right font-mono">{dep.upToDateReplicas}</TableCell>
              <TableCell className="text-right font-mono">{dep.availableReplicas}</TableCell>
              <TableCell className="max-w-md truncate font-mono text-muted-foreground" title={dep.image ?? ''}>
                {dep.image ?? '—'}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {formatAge(dep.createdAt)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
