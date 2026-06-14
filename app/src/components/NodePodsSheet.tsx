import { useEffect, useState } from 'react'
import LoadingField from '@/components/LoadingField'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { fetchNodePods, type PodInfo } from '@/lib/api'
import { podStatus } from '@/lib/kube'

interface NodePodsSheetProps {
  context: string
  node: string | null
  onClose: () => void
  // Open logs for a specific pod (carries its own namespace — pods on a node span namespaces).
  onSelectPod: (namespace: string, pod: string) => void
}

export default function NodePodsSheet({ context, node, onClose, onSelectPod }: NodePodsSheetProps) {
  const [pods, setPods] = useState<PodInfo[]>([])
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!node) return
    let active = true
    setStatus('loading')
    setError(null)
    fetchNodePods(context, node)
      .then((p) => {
        if (!active) return
        setPods(p)
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
  }, [context, node])

  return (
    <Sheet open={!!node} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="!w-[40vw] !max-w-[40vw] gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="font-mono text-sm break-all">{node}</SheetTitle>
          <SheetDescription>
            {status === 'done' ? `${pods.length} pods on this node · click to view logs` : 'pods on this node'}
          </SheetDescription>
        </SheetHeader>
        <div className="relative flex-1 overflow-auto p-2">
          <LoadingField active={status === 'loading'} />
          {status === 'error' && (
            <p className="p-3 text-sm text-destructive">{error}</p>
          )}
          {status === 'done' && pods.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No pods scheduled on this node.</p>
          )}
          {status === 'done' &&
            pods.map((pod) => {
              const ns = pod.namespace ?? ''
              return (
                <button
                  key={`${ns}/${pod.name}`}
                  onClick={() => onSelectPod(ns, pod.name)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent/50"
                  title="View logs"
                >
                  <span className="w-40 shrink-0 truncate font-mono text-xs text-muted-foreground">
                    {ns}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-foreground hover:text-primary hover:underline">
                    {pod.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{podStatus(pod)}</span>
                </button>
              )
            })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
