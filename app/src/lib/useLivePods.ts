import * as signalr from '@microsoft/signalr'
import { useEffect, useState } from 'react'
import type { PodInfo } from './api'

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'error'

interface PodEvent {
  type: 'Snapshot' | 'Added' | 'Modified' | 'Deleted'
  pods?: PodInfo[]
  pod?: PodInfo
  name?: string
}

// Subscribes to the live pod stream for a context/namespace over SignalR and maintains the
// current set as events arrive: Snapshot replaces everything; Added/Modified upsert by name;
// Deleted removes by name. Tears the connection down (and the server-side watch with it) when
// the context/namespace changes or the component unmounts.
export function useLivePods(context: string, namespace: string) {
  const [pods, setPods] = useState<PodInfo[]>([])
  const [status, setStatus] = useState<LiveStatus>('connecting')
  // True once the first event (the snapshot) has been applied. The SignalR connection goes
  // 'live' the instant the socket opens — well before any pod data arrives — so this is what
  // the UI should gate the spinner on, not the connection status.
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!namespace) {
      setPods([])
      setLoaded(false)
      return
    }

    const byName = new Map<string, PodInfo>()
    const publish = () =>
      setPods([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)))

    const apply = (event: PodEvent) => {
      if (event.type === 'Snapshot') {
        byName.clear()
        event.pods?.forEach((p) => byName.set(p.name, p))
      } else if (event.type === 'Deleted') {
        if (event.name) byName.delete(event.name)
      } else if (event.pod) {
        byName.set(event.pod.name, event.pod)
      }
      setLoaded(true)
      publish()
    }

    const connection = new signalr.HubConnectionBuilder()
      .withUrl('/hubs/pods')
      .withAutomaticReconnect()
      .build()

    let disposed = false
    let stream: signalr.ISubscription<PodEvent> | null = null

    const subscribe = () => {
      stream?.dispose()
      stream = connection.stream<PodEvent>('StreamPods', context, namespace).subscribe({
        next: apply,
        error: () => {
          if (!disposed) setStatus('error')
        },
        complete: () => { },
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
    setPods([])
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
  }, [context, namespace])

  return { pods, status, loaded }
}
