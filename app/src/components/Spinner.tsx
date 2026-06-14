import * as LottieLib from 'lottie-react'
// lottie-react is CJS; Vite's ESM interop lands the component on .default
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Lottie = (LottieLib.default ?? LottieLib) as React.ComponentType<any>
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
