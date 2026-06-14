import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { NodeInfo } from '@/lib/api'
import { formatAge } from '@/lib/kube'

interface NodeTableProps {
  nodes: NodeInfo[]
}

export default function NodeTable({ nodes }: NodeTableProps) {
  if (nodes.length === 0) {
    return <p className="text-muted-foreground">No nodes found.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Roles</TableHead>
          <TableHead className="text-right">CPU</TableHead>
          <TableHead className="text-right">Memory</TableHead>
          <TableHead>Pressure</TableHead>
          <TableHead>Version</TableHead>
          <TableHead className="text-right">Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {nodes.map((node) => {
          const ready = node.status.startsWith('Ready')
          const pressures = [
            node.memoryPressure && 'mem',
            node.diskPressure && 'disk',
            node.pidPressure && 'pid',
          ].filter(Boolean) as string[]
          return (
            <TableRow key={node.name}>
              <TableCell className="font-mono">{node.name}</TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${ready ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                  {node.status}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{node.roles}</TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {node.cpuMillicores}m
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {node.memoryMi}Mi
              </TableCell>
              <TableCell>
                {pressures.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className="text-amber-400">{pressures.join(', ')}</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-muted-foreground">
                {node.kubeletVersion}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {formatAge(node.createdAt)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
