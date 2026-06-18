# ⎈ Helmsman

A graphical web UI over Kubernetes — a nicer, browser-based take on [k9s](https://k9scli.io/).
Browse your clusters, watch workloads live, stream logs, see CPU / memory, and get an
at-a-glance health dashboard — all from your existing `kubeconfig`.

> **Read-only by design.** Helmsman only ever issues reads (GET / watch) against a cluster.
> No create, update, delete, scale, exec or apply. See [Safety model](#safety-model).

## Features

- **Health dashboard** — per-namespace overview: workload health cards, a Problems panel
  (degraded pods, failed jobs, crash loops), top CPU / memory consumers with live sparklines,
  and a stream of recent **Warning events**. Cards and problems are clickable.
- **Resource navigator** — a collapsible sidebar to switch between Pods, Deployments,
  StatefulSets, DaemonSets, Jobs, CronJobs, and Nodes.
- **Live everything** — resources update in real time via Kubernetes **watch** over SignalR
  (incremental add/modify/delete), not interval polling.
- **Log streaming** — click a pod (or a workload — it resolves to a backing pod) to follow its
  logs live, with JSON/Serilog pretty-printing.
- **CPU / memory** — per-pod usage from metrics-server, plus short in-memory history sparklines.
- **Smart pod status** — kubectl-style derived status (CrashLoopBackOff, OOMKilled,
  ImagePullBackOff, Terminating, Completed, …), not just the raw phase.
- **Node drill-down** — click a node to see the pods scheduled on it, then jump to their logs.
- **Detail drawer** — the ⓘ on a row opens a read-only "describe": conditions, container images,
  labels, and the events recorded against that object.
- **Pinnable default namespace** — pin your usual namespace per context; it's auto-selected next
  time.

## Components

| Component | Path | Stack |
|---|---|---|
| **API** | `/api` | .NET 10 — single project, minimal-API endpoints + SignalR + Kubernetes access |
| **App** | `/app` | React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui |

## Quick start

Two processes — the API and the Vite dev server. The app proxies `/api` and `/hubs` to
the API, so you only ever open the app URL.

```bash
# 1. API  →  http://localhost:5206   (use `watch` so new endpoints/hubs reload automatically)
dotnet watch --project api/Helmsman.Api

# 2. App  →  http://localhost:5174   (open this one)
npm --prefix app run dev -- --port 5174
```

The landing screen lists every context in your `kubeconfig` and marks the one `kubectl` is
currently pointed at. Helmsman reads the kubeconfig directly — there is **no separate login
or credential config**; it inherits whatever your `kubectl` already uses (including
`aws eks get-token` exec auth for EKS).

### Prerequisites

- .NET 10 SDK
- Node 20+
- A reachable cluster in your `~/.kube/config` (`kubectl get ns` should work)
- **For CPU / memory:** [metrics-server](https://github.com/kubernetes-sigs/metrics-server)
  installed in the cluster. Confirm with `kubectl top pods` — if that errors, the metrics
  panels stay empty until it's installed.
- **For Nodes:** your context needs cluster-scoped `list/watch nodes` RBAC. Without it, the
  Nodes view shows a clear permission message (everything else is namespace-scoped).

## Project structure

```
Helmsman/
  Helmsman.slnx                  solution
  api/
    Helmsman.Api/                single project, folders by concern:
      Endpoints/                   minimal-API routes (ClusterEndpoints.cs)
      Kube/                        Kubernetes access (KubeClientFactory, ClusterReader); owns KubernetesClient
      Models/                      plain DTO classes (PodInfo, WorkloadInfo, NodeInfo, …)
      Hubs/                        SignalR hubs (ResourcesHub, LogsHub) for live streams
  app/
    src/lib/                     API client (api.ts), helpers, live-stream hooks
    src/components/              UI (+ ui/ shadcn primitives)
  docs/                          architecture notes + ADRs
```

It's a single API project — folders mark the concerns, not separate projects. `Models/` classes
stay framework-free and all Kubernetes access stays under `Kube/`, by convention. See
[ADR 001](./docs/adrs/001-layered-api.md).

- [`docs/architecture.md`](./docs/architecture.md) — architecture, layers, data flow
- [`docs/adrs/`](./docs/adrs/) — architecture decision records
- [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) — project conventions

## Safety model

This tool talks to real clusters, so the safety properties are deliberate, not incidental:

1. **Read-only.** The code only calls read/watch endpoints. A bug cannot mutate cluster state
   because there is no mutating call to misfire. *(Convention, not enforcement — see below.)*
2. **Explicit context, no implicit default.** `KubeClientFactory` never falls back to
   `current-context`. The app can only act on a context you explicitly selected, so it can't
   silently operate against whichever cluster `kubectl` happens to point at.
3. **Credentials stay local.** The API runs on your machine with your `kubeconfig` and talks
   to the cluster directly. Nothing is proxied through a third party.

> ⚠️ **Two honest caveats.** Read-only is enforced by *convention*, not by the cluster — your
> kubeconfig credentials may have write/admin rights, so cluster **RBAC** is the real backstop;
> prefer a read-only role. And *reads are not zero-impact*: log streaming and metrics polling
> load the API server, and real-cluster logs and events may contain sensitive data (PII).
> **Develop against a non-production cluster.**

## Contributing

Changes to `main` go through a pull request that needs an approving review. (Repo admins can
bypass for direct merges.) Keep the read-only invariant intact — no mutating Kubernetes calls.

## License

Personal project — no license is granted. The source is public to read; all rights reserved.
