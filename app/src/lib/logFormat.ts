export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

export interface ParsedLog {
  raw: string
  time?: string
  level?: LogLevel
  message?: string
}

// Many apps (Serilog, .NET, etc.) emit one JSON object per log line. When a line parses as JSON
// with recognizable fields, pull out time/level/message for a clean rendering; otherwise show the
// line verbatim. Field names vary by logger, so we probe the common ones.
export function parseLogLine(line: string): ParsedLog {
  const trimmed = line.trim()
  if (!trimmed.startsWith('{')) {
    return { raw: line }
  }

  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(trimmed)
  } catch {
    return { raw: line }
  }

  const time = firstString(obj, ['Timestamp', '@t', 'timestamp', 'ts', 'time'])
  const level = firstString(obj, ['Level', '@l', 'level', 'severity'])
  const message = firstString(obj, ['Message', '@m', 'message', 'msg', 'MessageTemplate'])

  if (!message) {
    return { raw: line }
  }

  return {
    raw: line,
    time: time ? formatTime(time) : undefined,
    level: normalizeLevel(level),
    message,
  }
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }
  return undefined
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleTimeString(undefined, { hour12: false })
}

function normalizeLevel(level: string | undefined): LogLevel | undefined {
  if (!level) {
    return undefined
  }
  switch (level.toLowerCase()) {
    case 'trace':
    case 'verbose':
      return 'TRACE'
    case 'debug':
      return 'DEBUG'
    case 'info':
    case 'information':
      return 'INFO'
    case 'warn':
    case 'warning':
      return 'WARN'
    case 'error':
      return 'ERROR'
    case 'fatal':
    case 'critical':
      return 'FATAL'
    default:
      return undefined
  }
}

export function levelColor(level: LogLevel | undefined): string {
  switch (level) {
    case 'ERROR':
    case 'FATAL':
      return 'text-red-400'
    case 'WARN':
      return 'text-amber-400'
    case 'INFO':
      return 'text-green-400'
    case 'DEBUG':
    case 'TRACE':
      return 'text-muted-foreground'
    default:
      return 'text-muted-foreground'
  }
}
