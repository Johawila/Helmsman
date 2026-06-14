import LottieImport from 'lottie-react'
import type { ComponentType } from 'react'
import spinnerAnimation from '@/assets/spinner.json'

// lottie-react ships a UMD build that Vite pre-bundles as `export default <exports object>`,
// so the default import is `{ default: Lottie, ... }` rather than the component itself.
// Unwrap one level when needed; fall through cleanly if a future build serves proper ESM.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Lottie = (
  typeof LottieImport === 'function' ? LottieImport : (LottieImport as any).default
) as ComponentType<any>

export { spinnerAnimation }

export type Rgb = [number, number, number]

// Returns a deep copy of the spinner animation with every static stroke/fill color recolored to
// `rgb` (components in 0..1). Cloning keeps each rendered instance independently coloured.
export function tintAnimation(rgb: Rgb): object {
  const clone = structuredClone(spinnerAnimation) as unknown
  paint(clone, rgb)
  return clone as object
}

function paint(node: unknown, rgb: Rgb): void {
  if (Array.isArray(node)) {
    node.forEach((child) => paint(child, rgb))
    return
  }
  if (node && typeof node === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o = node as any
    const isColored = o.ty === 'st' || o.ty === 'fl'
    if (isColored && o.c && Array.isArray(o.c.k) && typeof o.c.k[0] === 'number') {
      o.c.k = [rgb[0], rgb[1], rgb[2], o.c.k[3] ?? 1]
    }
    for (const key in o) paint(o[key], rgb)
  }
}
