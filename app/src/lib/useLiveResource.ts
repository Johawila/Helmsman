import * as signalr from '@microsoft/signalr'
import { useEffect, useRef, useState } from 'react'

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
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)

export function useLiveResource<T extends { name: string }>(
  method: string,
  context: string,
  namespace: string,
  // Sort order for the published list. Defaults to ascending by name. Kept in a ref so passing an
  // inline comparator doesn't tear down and re-subscribe the stream on every render.
  compare: (a: T, b: T) => number = byName,
) {
  const [items, setItems] = useState<T[]>([])
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const [loaded, setLoaded] = useState(false)
  const compareRef = useRef(compare)
  compareRef.current = compare

  useEffect(() => {
    if (!namespace) {
      setItems([])
      setLoaded(false)
      return
    }

    const byKey = new Map<string, T>()
    const publish = () => setItems([...byKey.values()].sort(compareRef.current))

    const apply = (event: ResourceEvent<T>) => {
      if (event.type === 'Snapshot') {
        byKey.clear()
        event.items?.forEach((it) => byKey.set(it.name, it))
      } else if (event.type === 'Deleted') {
        if (event.name) byKey.delete(event.name)
      } else if (event.item) {
        byKey.set(event.item.name, event.item)
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
