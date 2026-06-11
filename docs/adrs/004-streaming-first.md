# 004 — Streaming-first: live resource views via Kubernetes watch over SignalR

- **Status:** Accepted
- **Date:** 2026-06-10

## Context

Helmsman is a k9s-like tool. The point of it is to *see the cluster as it changes* — a pod going
Pending→Running, restarts ticking up, a job completing. The first pod list was a one-shot `GET`
with a manual Refresh button, which is a poll: stale between clicks, and not what the tool is for.

Kubernetes exposes change streams natively via **watch** (list + watch from a `resourceVersion`,
yielding ADDED/MODIFIED/DELETED). The earlier implicit stance (REST snapshots, see
[ADR 003](./003-minimal-api-endpoints.md) and `architecture.md`) doesn't fit live data.

## Decision

**Resource lists are live by default: a server-side Kubernetes watch, pushed to the browser over
a SignalR stream, applied as incremental deltas client-side.** Built first for pods; the same
plumbing is reused for logs, events, and other lists.

- **Server:** `ClusterReader.WatchPodsAsync` does list→snapshot→watch and yields a `PodEvent`
  stream (`Snapshot` then `Added`/`Modified`/`Deleted`). On watch expiry (410 Gone) or drop it
  **resyncs** by re-listing and emitting a fresh `Snapshot`. `PodsHub.StreamPods` exposes it as a
  SignalR `IAsyncEnumerable` stream; SignalR's `CancellationToken` ties the watch lifecycle to the
  subscription — unsubscribe/disconnect cancels the watch, so no leaked connections to the API server.
- **Client:** `useLivePods` holds a keyed `Map<name, PodInfo>`, applies events (Snapshot replaces,
  Added/Modified upsert, Deleted removes), and exposes a connection status (`connecting`/`live`/
  `reconnecting`/`error`). `withAutomaticReconnect` plus re-subscribe on reconnect handles full
  connection loss.
- **Exception — metrics.** `metrics.k8s.io` has no watch API, so CPU/memory will be **polled** on a
  timer and pushed over the same channel. Truly static reads (context list, namespace list) stay
  plain REST.

## Consequences

**Positive:**
- The view reflects the cluster in real time, no Refresh, no flicker (React reconciles by key).
- One streaming foundation that logs/events/other lists reuse rather than re-solving per feature.
- Watch lifecycle bound to the SignalR subscription keeps API-server connections bounded.

**Negative / accepted:**
- The client list is now **stateful** (delta application) instead of a replaced array — more logic.
- Watch **resync** and **reconnect** are real edge cases that must be handled (done) rather than
  ignored as with a poll.
- More moving parts than a Refresh button. Justified: live updates are the product, not a nicety.

## Alternatives considered

- **Keep REST + Refresh / interval polling.** Simplest, but stale, flickers on swap, and doesn't
  teach the watch model that logs and events need anyway.
- **Watch as a mere "something changed" trigger that re-lists.** Half-measure; still ships full
  snapshots on every change. The delta path is barely more code and is the correct model.
