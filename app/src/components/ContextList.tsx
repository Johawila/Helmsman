import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { ContextInfo } from '@/lib/api'
import { parseContext } from '@/lib/kube'

interface ContextListProps {
  contexts: ContextInfo[]
  loading: boolean
  onSelect: (name: string) => void
}

export default function ContextList({ contexts, loading, onSelect }: ContextListProps) {
  if (loading) {
    return <p className="text-muted-foreground">Loading contexts…</p>
  }
  if (contexts.length === 0) {
    return <p className="text-muted-foreground">No contexts found in your kubeconfig.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {contexts.map((context) => (
        <ContextRow key={context.name} context={context} onSelect={onSelect} />
      ))}
    </div>
  )
}

function ContextRow({
  context,
  onSelect,
}: {
  context: ContextInfo
  onSelect: (name: string) => void
}) {
  const parsed = parseContext(context.name)
  return (
    <Card
      onClick={() => onSelect(context.name)}
      className="cursor-pointer gap-1.5 px-4 py-3 transition-colors hover:border-ring hover:bg-accent/40"
    >
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-foreground">{parsed.label}</span>
        {context.isCurrent && <Badge variant="secondary">kubectl current</Badge>}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {parsed.region && <Badge variant="outline">{parsed.region}</Badge>}
        <span className="font-mono">ns: {context.namespace ?? 'default'}</span>
      </div>
      <span className="font-mono text-xs break-all text-muted-foreground/60">{context.name}</span>
    </Card>
  )
}
