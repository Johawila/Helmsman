// Per-context default namespace, persisted locally so Helmsman re-selects your usual namespace on
// next launch. Keyed by context name. Best-effort: storage failures (private mode, etc.) are ignored.

const key = (context: string) => `helmsman.defaultNamespace.${context}`

export function getDefaultNamespace(context: string): string | null {
  try {
    return localStorage.getItem(key(context))
  } catch {
    return null
  }
}

export function setDefaultNamespace(context: string, namespace: string): void {
  try {
    localStorage.setItem(key(context), namespace)
  } catch {
    // ignore
  }
}

export function clearDefaultNamespace(context: string): void {
  try {
    localStorage.removeItem(key(context))
  } catch {
    // ignore
  }
}
