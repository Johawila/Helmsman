import { useEffect, useState } from 'react'
import LoadingField from '@/components/LoadingField'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { fetchDescribe, type ResourceDetail } from '@/lib/api'
import { formatAge, levelColorForCondition } from '@/lib/kube'

export interface DetailTarget {
  kind: string
  namespace: string
  name: string
}

interface DetailSheetProps {
  context: string
  target: DetailTarget | null
  onClose: () => void
}

export default function DetailSheet({ context, target, onClose }: DetailSheetProps) {
  const [detail, setDetail] = useState<ResourceDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!target) return
    let active = true
    setStatus('loading')
    setError(null)
    setDetail(null)
    fetchDescribe(context, target.namespace, target.kind, target.name)
      .then((d) => {
        if (!active) return
        setDetail(d)
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
  }, [context, target])

  return (
    <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="!w-[50vw] !max-w-[50vw] gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="font-mono text-sm break-all">
            {target?.kind.replace(/s$/, '')}/{target?.name}
          </SheetTitle>
          <SheetDescription>
            {target?.namespace}
            {detail?.createdAt ? ` · age ${formatAge(detail.createdAt)}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="relative flex-1 space-y-5 p-4 text-sm">
          <LoadingField active={status === 'loading'} />
          {status === 'error' && <p className="text-destructive">{error}</p>}

          {status === 'done' && detail && (
            <>
              <Section title="Conditions">
                {detail.conditions.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="space-y-1.5">
                    {detail.conditions.map((c) => (
                      <div key={c.type} className="flex items-start gap-3">
                        <span className={`w-40 shrink-0 font-medium ${levelColorForCondition(c)}`}>
                          {c.type}
                        </span>
                        <span className="w-12 shrink-0 text-muted-foreground">{c.status}</span>
                        <span className="min-w-0 flex-1 text-foreground/80">
                          {c.reason}
                          {c.message ? ` — ${c.message}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Images">
                {detail.images.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="space-y-1">
                    {detail.images.map((img) => (
                      <div key={img} className="font-mono text-xs break-all text-foreground/80">
                        {img}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Labels">
                {Object.keys(detail.labels).length === 0 ? (
                  <Empty />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(detail.labels).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded bg-accent/50 px-1.5 py-0.5 font-mono text-xs text-foreground/80"
                      >
                        {k}={v}
                      </span>
                    ))}
                  </div>
                )}
              </Section>

              <Section title={`Events (${detail.events.length})`}>
                {detail.events.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="space-y-1.5">
                    {detail.events.map((e) => (
                      <div key={e.name} className="flex items-start gap-3 text-xs">
                        <span
                          className={`w-20 shrink-0 font-medium ${e.type === 'Warning' ? 'text-amber-400' : 'text-muted-foreground'}`}
                        >
                          {e.reason}
                        </span>
                        <span className="min-w-0 flex-1 text-foreground/80">{e.message}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {e.count > 1 && <span className="mr-1.5">×{e.count}</span>}
                          {e.lastSeen ? formatAge(e.lastSeen) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Empty() {
  return <p className="text-muted-foreground">—</p>
}
