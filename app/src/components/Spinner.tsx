import LottieImport from 'lottie-react'

// lottie-react ships a UMD build that Vite pre-bundles as `export default <exports object>`,
// so the default import is `{ default: Lottie, ... }` rather than the component itself.
// Unwrap one level when needed; fall through cleanly if a future build serves proper ESM.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Lottie = (
  typeof LottieImport === 'function' ? LottieImport : (LottieImport as any).default
) as React.ComponentType<any>
import spinnerAnimation from '@/assets/spinner.json'

interface SpinnerProps {
  label?: string
  size?: number
}

export default function Spinner({ label, size = 80 }: SpinnerProps) {
  return (
    <span role="status" aria-label={label ?? 'Loading'} className="flex flex-col items-center gap-2">
      <Lottie animationData={spinnerAnimation} loop style={{ width: size, height: size }} />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </span>
  )
}
