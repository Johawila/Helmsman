import { useEffect, useRef, useState } from 'react'
import { Lottie, tintAnimation, type Rgb } from '@/lib/lottie'

// 0..1 RGB palette tuned to read well on the dark background.
const PALETTE: Rgb[] = [
  [0.92, 0.92, 0.96], // near-white
  [0.3, 0.85, 0.45], // green
  [0.96, 0.7, 0.2], // amber
  [0.36, 0.55, 0.96], // blue
  [0.62, 0.4, 0.96], // purple
  [0.25, 0.8, 0.8], // teal
]

const MAX_SPRITES = 11
const SPAWN_MS = 320
const FADE_OUT_MS = 800

interface Sprite {
  id: number
  top: number // percent
  left: number // percent
  size: number // px
  speed: number
  direction: 1 | -1
  opacity: number
  data: object
}

let nextId = 0

function makeSprite(): Sprite {
  return {
    id: nextId++,
    top: 12 + Math.random() * 76,
    left: 10 + Math.random() * 80,
    size: 46 + Math.random() * 88,
    speed: 0.4 + Math.random() * 1.3,
    direction: Math.random() < 0.5 ? 1 : -1,
    opacity: 0.5 + Math.random() * 0.5,
    data: tintAnimation(PALETTE[Math.floor(Math.random() * PALETTE.length)]),
  }
}

interface LoadingFieldProps {
  // True while the request is in flight. Flipping to false stops spawning and fades the field out.
  active: boolean
}

// A playful loading overlay: while active, spinners accumulate at random positions with varied
// size, speed, colour and rotation. When the request completes, no new spinners are added and the
// existing ones fade out together. Renders nothing (no overlay, no pointer capture) once idle.
export default function LoadingField({ active }: LoadingFieldProps) {
  const [sprites, setSprites] = useState<Sprite[]>([])
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (active) {
      setLeaving(false)
      setSprites([makeSprite(), makeSprite()])
      const interval = setInterval(() => {
        setSprites((prev) => (prev.length >= MAX_SPRITES ? prev : [...prev, makeSprite()]))
      }, SPAWN_MS)
      return () => clearInterval(interval)
    }

    // Completed: stop spawning, fade out, then unmount.
    setLeaving(true)
    const timer = setTimeout(() => setSprites([]), FADE_OUT_MS + 100)
    return () => clearTimeout(timer)
  }, [active])

  if (sprites.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {sprites.map((sprite) => (
        <SpinnerSprite key={sprite.id} sprite={sprite} leaving={leaving} />
      ))}
    </div>
  )
}

function SpinnerSprite({ sprite, leaving }: { sprite: Sprite; leaving: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null)
  const [entered, setEntered] = useState(false)

  // Fade in on the frame after mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Per-instance speed and rotation direction (lottieRef is populated by the child's effect first).
  useEffect(() => {
    const inst = ref.current
    if (inst) {
      inst.setSpeed(sprite.speed)
      inst.setDirection(sprite.direction)
    }
  }, [sprite.speed, sprite.direction])

  const visible = entered && !leaving

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity ease-out"
      style={{
        top: `${sprite.top}%`,
        left: `${sprite.left}%`,
        width: sprite.size,
        height: sprite.size,
        opacity: visible ? sprite.opacity : 0,
        transitionDuration: leaving ? `${FADE_OUT_MS}ms` : '500ms',
      }}
    >
      <Lottie
        animationData={sprite.data}
        loop
        autoplay
        lottieRef={ref}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
