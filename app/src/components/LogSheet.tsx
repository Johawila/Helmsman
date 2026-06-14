import { useEffect, useRef, useState } from 'react'
import LoadingField from '@/components/LoadingField'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { levelColor, parseLogLine } from '@/lib/logFormat'
import { useLogStream, type LogStatus } from '@/lib/useLogStream'

interface LogSheetProps {
  context: string
  namespace: string
  pod: string | null
  onClose: () => void
}

export default function LogSheet({ context, namespace, pod, onClose }: LogSheetProps) {
  const { lines, status } = useLogStream(context, namespace, pod)
  const [raw, setRaw] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [lines])

  return (
    <Sheet open={!!pod} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="!w-[70vw] !max-w-[70vw] gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="font-mono text-sm break-all">{pod}</SheetTitle>
          <SheetDescription className="flex items-center gap-3">
            <span>
              {namespace} · logs · {statusLabel(status)}
            </span>
            <button
              className="rounded border px-2 py-0.5 text-xs hover:bg-accent"
              onClick={() => setRaw((r) => !r)}
            >
              {raw ? 'Pretty' : 'Raw'}
            </button>
          </SheetDescription>
        </SheetHeader>
        <div className="relative flex-1 overflow-auto bg-black/40 p-4 font-mono text-xs leading-relaxed">
          <LoadingField
            active={lines.length === 0 && status !== 'ended' && status !== 'error'}
          />
          {lines.length === 0 && status === 'ended' && (
            <span className="text-muted-foreground">No log output.</span>
          )}
          {lines.length === 0 && status === 'error' && (
            <span className="text-destructive">Log stream error.</span>
          )}
          {lines.length > 0 &&
            (raw
              ? lines.map((line, i) => (
                  <div key={i} className="break-all whitespace-pre-wrap">
                    {line}
                  </div>
                ))
              : lines.map((line, i) => <LogRow key={i} line={line} />))}
          <div ref={bottomRef} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function LogRow({ line }: { line: string }) {
  const parsed = parseLogLine(line)

  if (!parsed.message) {
    return <div className="break-all whitespace-pre-wrap text-foreground/90">{parsed.raw}</div>
  }

  return (
    <div className="flex gap-3 whitespace-pre-wrap">
      {parsed.time && <span className="shrink-0 text-muted-foreground/70">{parsed.time}</span>}
      {parsed.level && (
        <span className={`w-12 shrink-0 font-semibold ${levelColor(parsed.level)}`}>
          {parsed.level}
        </span>
      )}
      <span className="break-all text-foreground/90">{parsed.message}</span>
    </div>
  )
}

function statusLabel(status: LogStatus): string {
  switch (status) {
    case 'connecting':
      return 'connecting…'
    case 'streaming':
      return 'live'
    case 'ended':
      return 'ended'
    case 'error':
      return 'error'
  }
}
