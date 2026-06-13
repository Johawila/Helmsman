import * as signalr from '@microsoft/signalr'
import { useEffect, useState } from 'react'

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'error'

interface ResourceEvent<T> {
  type: 'Snapshot' | 'Added' | 'Modified' | 'Deleted'
  items?: T[]
  item?: T
  name?: string
}

// Subscribes to a live resource stream over the /hubs/resources SignalR hub and maintains the
// current set as events arrive: Snapshot replaces everything; Added/Modified upsert by name;
// Deleted removes by name. Generic over any DTO with a `name`. `method` selects the hub stream
// (e.g. 'StreamPods', 'StreamDeployments'). Tears down (and the server-side watch) when method,
// context or namespace changes, or the component unmounts.
export function useLiveResource<T extends { name: string }>(
  method: string,
  context: string,
  namespace: string,
) {
  const [items, setItems] = useState<T[]>([])
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!namespace) {
      setItems([])
      setLoaded(false)
      return
    }

    const byName = new Map<string, T>()
    const publish = () => setItems([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)))

    const apply = (event: ResourceEvent<T>) => {
      if (event.type === 'Snapshot') {
        byName.clear()
        event.items?.forEach((it) => byName.set(it.name, it))
      } else if (event.type === 'Deleted') {
        if (event.name) byName.delete(event.name)
      } else if (event.item) {
        byName.set(event.item.name, event.item)
      }
      setLoaded(true)
      publish()
    }

    const connection = new signalr.HubConnectionBuilder()
      .withUrl('/hubs/resources')
      .withAutomaticReconnect()
      .build()

    let disposed = false
    let stream: signalr.ISubscription<ResourceEvent<T>> | null = null

    const subscribe = () => {
      stream?.dispose()
      stream = connection.stream<ResourceEvent<T>>(method, context, namespace).subscribe({
        next: apply,
        error: () => {
          if (!disposed) setStatus('error')
        },
        complete: () => {},
      })
    }

    connection.onreconnecting(() => setStatus('reconnecting'))
    connection.onreconnected(() => {
      setStatus('live')
      subscribe()
    })
    connection.onclose(() => {
      if (!disposed) setStatus('error')
    })

    setStatus('connecting')
    setItems([])
    setLoaded(false)
    connection
      .start()
      .then(() => {
        if (disposed) return
        setStatus('live')
        subscribe()
      })
      .catch(() => {
        if (!disposed) setStatus('error')
      })

    return () => {
      disposed = true
      stream?.dispose()
      void connection.stop()
    }
  }, [method, context, namespace])

  return { items, status, loaded }
}
