import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  label?: string
}

// A track ring with a spinning accent arc.
export default function Spinner({ className, label }: SpinnerProps) {
  return (
    <span role="status" aria-label={label ?? 'Loading'} className="flex items-center gap-3">
      <span className={cn('relative inline-block size-6', className)}>
        <span className="absolute inset-0 rounded-full border-2 border-muted" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-foreground border-r-foreground/40" />
      </span>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </span>
  )
}
