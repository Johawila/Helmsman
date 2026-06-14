import { useEffect, useState } from 'react'
import ClusterView from '@/components/ClusterView'
import ContextList from '@/components/ContextList'
import { Button } from '@/components/ui/button'
import { fetchContexts, type ContextInfo } from '@/lib/api'
import { parseContext } from '@/lib/kube'

function App() {
  const [contexts, setContexts] = useState<ContextInfo[]>([])
  const [selected, setSelected] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchContexts()
      .then((c) => setContexts(c))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const current = contexts.find((c) => c.name === selected)

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between gap-6 border-b px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">⎈ Helmsman</h1>
          {current && (
            <span className="font-mono text-sm text-muted-foreground">
              {parseContext(current.name).label}
            </span>
          )}
        </div>
        {selected && (
          <Button variant="outline" size="sm" onClick={() => setSelected('')}>
            Switch context
          </Button>
        )}
      </header>

      <main className="min-h-0 flex-1">
        {error && <p className="p-6 font-mono text-destructive">{error}</p>}

        {!selected && !error && (
          <section className="max-w-3xl p-6">
            <h2 className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Contexts
            </h2>
            <ContextList contexts={contexts} loading={loading} onSelect={setSelected} />
          </section>
        )}

        {current && <ClusterView context={current.name} defaultNamespace={current.namespace} />}
      </main>
    </div>
  )
}

export default App
