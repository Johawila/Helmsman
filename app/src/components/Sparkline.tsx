interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  // Stroke colour comes from `currentColor`, so set it with a Tailwind text-* class.
  className?: string
}

// A minimal inline SVG trend line. Scales to the data's own min/max so small movements stay visible.
export default function Sparkline({ data, width = 64, height = 18, className }: SparklineProps) {
  if (data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden />
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const points = data
    .map((value, i) => {
      const x = i * stepX
      const y = height - ((value - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
