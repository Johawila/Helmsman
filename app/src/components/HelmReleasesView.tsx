import { ArrowUpCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import LoadingField from '@/components/LoadingField'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchHelmReleases, type HelmReleaseInfo } from '@/lib/api'
import { formatAge } from '@/lib/kube'

interface HelmReleasesViewProps {
  context: string
  namespace: string
}

export default function HelmReleasesView({ context, namespace }: HelmReleasesViewProps) {
  const [releases, setReleases] = useState<HelmReleaseInfo[]>([])
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!namespace) return
    let active = true
    setStatus('loading')
    setError(null)
    fetchHelmReleases(context, namespace)
      .then((r) => {
        if (!active) return
        setReleases(r)
        setStatus('done')
      })
      .catch((e) => {
        if (!active) return
        setError(String(e))
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [context, namespace])

  if (status === 'error') {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className={`relative ${status === 'done' ? '' : 'min-h-[60vh]'}`}>
      <LoadingField active={status === 'loading'} />
      {status === 'done' &&
        (releases.length === 0 ? (
          <p className="text-muted-foreground">No Helm releases in this namespace.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Chart</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Latest</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rev</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-mono">{r.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{r.chart}</TableCell>
                  <TableCell className="font-mono">{r.chartVersion}</TableCell>
                  <TableCell className="font-mono">
                    {r.updateAvailable ? (
                      <span
                        className="flex items-center gap-1 text-amber-400"
                        title={`Newer chart version available: ${r.latestVersion}`}
                      >
                        <ArrowUpCircle className="size-3.5" />
                        {r.latestVersion}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {r.latestVersion && r.latestVersion === r.chartVersion ? 'up to date' : '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {r.appVersion || '—'}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${statusDot(r.status)}`} />
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {r.revision}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatAge(r.updated)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
    </div>
  )
}

function statusDot(status: string): string {
  switch (status) {
    case 'deployed':
      return 'bg-green-500'
    case 'pending-install':
    case 'pending-upgrade':
    case 'pending-rollback':
      return 'bg-amber-500'
    case 'superseded':
      return 'bg-muted-foreground'
    default:
      // failed, uninstalling, unknown, …
      return 'bg-red-500'
  }
}
