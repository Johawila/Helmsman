# Architecture

Helmsman is a two-tier app: a .NET API that talks to Kubernetes, and a React app that talks
to the API. There are no microservices and no database — the source of truth is the cluster
(and the user's `kubeconfig`).

```
┌──────────────┐      /api, /hubs      ┌──────────────────────────────┐      kube API       ┌─────────┐
│  app (React) │ ───────────────────▶ │  Helmsman.Api (ASP.NET 10)   │ ──────────────────▶ │ cluster │
│  Vite :5174  │   (Vite dev proxy)    │  :5206                       │   (read / watch)    │  (EKS)  │
└──────────────┘                       └──────────────────────────────┘                     └─────────┘
                                                │ reads
                                                ▼
                                         ~/.kube/config
```

## API — single project, folders by concern

```
api/Helmsman.Api/
  Endpoints/     minimal-API route groups (ClusterEndpoints.cs, …)
  Kube/          all Kubernetes access — KubeClientFactory.cs (+ future readers); owns KubernetesClient
  Models/        plain DTO classes — ContextInfo.cs (+ PodInfo, LogLine, …)
  Hubs/          SignalR hubs for live logs (added when streaming lands)
  Program.cs
```

One project; folders mark the concerns. There is no separate Domain/Infrastructure project — for a
read-only tool this small, the onion's compile-time boundaries didn't earn their cost (see
[ADR 001](./adrs/001-layered-api.md)). Two conventions stand in for the missing boundaries:

- **`Models/` classes stay framework-free** — no `k8s` types, no `KubernetesClient` references. They're
  the shapes handed to the frontend (`ContextInfo`, later `PodInfo`, `LogLine`).
- **All Kubernetes access stays under `Kube/`** — loading the kubeconfig, building clients, and (next)
  listing pods, streaming logs, reading metrics. The `KubernetesClient` package is used here. `k8s`
  objects are mapped to `Models/` types before leaving this folder.

> **Naming note:** the folder/namespace segment is `Kube`, *not* `Kubernetes`. A `.Kubernetes`
> namespace shadows the `k8s` library's `Kubernetes` type and breaks compilation (`CS0118`).

## How the API reaches a cluster

1. The frontend `GET /api/contexts` — this reads **only the local kubeconfig file**, no cluster
   call. Each context is returned with its cluster, default namespace, and an `isCurrent` flag.
2. The user selects a context.
3. Cluster-touching endpoints (pods, logs, metrics — *not yet built*) take the chosen context
   name and ask `KubeClientFactory.CreateClient(contextName)` for a client bound to exactly
   that context. There is **no `current-context` fallback** — an unknown or empty name throws.

This explicit-context rule is the core safety property; see [ADR 002](./adrs/002-read-only-explicit-context.md).

## Frontend

Vite + React + TypeScript. `src/lib/api.ts` is the typed API client; `src/App.tsx` renders the
context list. The Vite dev server proxies `/api` (REST) and `/hubs` (SignalR, for live logs)
to the API on `:5206`, so the browser only ever sees one origin and there's no CORS in dev.

## Live logs (planned)

Log streaming is the architecturally interesting piece and is built first among the
cluster-touching features: `ReadNamespacedPodLogAsync(follow: true)` yields a `Stream` in
Infrastructure, pumped to the browser over a **SignalR** hub (`@microsoft/signalr` client).
Once streaming works end to end, the remaining features (pods, metrics, deployments) are
plain request/response REST.

## What's intentionally absent

- **No database / persistence.** The cluster and kubeconfig are the only state.
- **No auth layer.** It runs locally as the user, using the user's kubeconfig credentials.
- **No write path.** See the safety model in the [README](../README.md#safety-model).
