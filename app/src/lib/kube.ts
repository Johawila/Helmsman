export interface ParsedContext {
  label: string
  region: string | null
}

// EKS context names look like
// arn:aws:eks:<region>:<account-id>:cluster/<cluster-name>
// Pull out something readable while keeping the raw name available.
export function parseContext(name: string): ParsedContext {
  const eks = name.match(/^arn:aws:eks:([^:]+):\d+:cluster\/(.+)$/)
  if (eks) {
    return { label: eks[2], region: eks[1] }
  }
  return { label: name, region: null }
}

// Pod display status, falling back to raw phase if the API hasn't sent a derived status
// (e.g. an older backend build). Keeps the UI sane instead of marking every pod broken.
export function podStatus(pod: { status?: string; phase: string }): string {
  return pod.status || pod.phase
}

// Compact age like kubectl: 45s, 12m, 5h, 3d.
export function formatAge(isoTimestamp: string | null): string {
  if (!isoTimestamp) {
    return '—'
  }
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
