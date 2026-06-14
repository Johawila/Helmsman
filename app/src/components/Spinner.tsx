import { LottiePlayer as Lottie } from 'lottie-react'
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
