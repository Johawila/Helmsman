import * as signalr from '@microsoft/signalr'
import { useEffect, useState } from 'react'

export type LogStatus = 'connecting' | 'streaming' | 'ended' | 'error'

const MAX_LINES = 2000

// Streams a pod's logs over SignalR. Lines are buffered and flushed every 100ms so a chatty pod
// doesn't trigger a render per line, and the buffer is capped at MAX_LINES. Tears the connection
// (and the server-side follow) down when the pod changes or the viewer closes.
export function useLogStream(context: string, namespace: string, pod: string | null) {
  const [lines, setLines] = useState<string[]>([])
  const [status, setStatus] = useState<LogStatus>('connecting')

  useEffect(() => {
    if (!pod) {
      setLines([])
      return
    }

    setLines([])
    setStatus('connecting')

    const connection = new signalr.HubConnectionBuilder().withUrl('/hubs/logs').build()
    let disposed = false
    let buffer: string[] = []
    let flushScheduled = false

    const flush = () => {
      flushScheduled = false
      if (buffer.length === 0) return
      const pending = buffer
      buffer = []
      setLines((prev) => {
        const next = prev.concat(pending)
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
      })
    }
    const scheduleFlush = () => {
      if (!flushScheduled) {
        flushScheduled = true
        setTimeout(flush, 100)
      }
    }

    connection
      .start()
      .then(() => {
        if (disposed) return
        setStatus('streaming')
        connection.stream<string>('StreamLogs', context, namespace, pod, null).subscribe({
          next: (line) => {
            buffer.push(line)
            scheduleFlush()
          },
          error: () => {
            if (!disposed) setStatus('error')
          },
          complete: () => {
            if (!disposed) {
              flush()
              setStatus('ended')
            }
          },
        })
      })
      .catch(() => {
        if (!disposed) setStatus('error')
      })

    return () => {
      disposed = true
      void connection.stop()
    }
  }, [context, namespace, pod])

  return { lines, status }
}
