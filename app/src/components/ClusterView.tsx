import { useEffect, useState } from 'react'
import PodTable from '@/components/PodTable'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchNamespaces, fetchPods, type PodInfo } from '@/lib/api'

interface ClusterViewProps {
  context: string
  defaultNamespace: string | null
}

export default function ClusterView({ context, defaultNamespace }: ClusterViewProps) {
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [namespace, setNamespace] = useState<string>('')
  const [pods, setPods] = useState<PodInfo[]>([])
  const [loadingPods, setLoadingPods] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    fetchNamespaces(context)
      .then((ns) => {
        setNamespaces(ns)
        setNamespace(pickDefault(ns, defaultNamespace))
      })
      .catch((e) => setError(String(e)))
  }, [context, defaultNamespace])

  useEffect(() => {
    if (!namespace) {
      return
    }
    loadPods(context, namespace)
  }, [context, namespace])

  function loadPods(ctx: string, ns: string) {
    setLoadingPods(true)
    setError(null)
    fetchPods(ctx, ns)
      .then(setPods)
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingPods(false))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={namespace} onValueChange={setNamespace}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a namespace…" />
          </SelectTrigger>
          <SelectContent>
            {namespaces.map((ns) => (
              <SelectItem key={ns} value={ns}>
                {ns}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={!namespace || loadingPods}
          onClick={() => loadPods(context, namespace)}
        >
          {loadingPods ? 'Refreshing…' : 'Refresh'}
        </Button>
        {!loadingPods && namespace && (
          <span className="text-sm text-muted-foreground">{pods.length} pods</span>
        )}
      </div>

      {error && <p className="font-mono text-destructive">{error}</p>}
      {namespace && <PodTable pods={pods} />}
    </div>
  )
}

function pickDefault(namespaces: string[], preferred: string | null): string {
  if (preferred && namespaces.includes(preferred)) {
    return preferred
  }
  if (namespaces.includes('default')) {
    return 'default'
  }
  return namespaces[0] ?? ''
}
