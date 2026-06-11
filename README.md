# ⎈ Helmsman

A graphical web UI over Kubernetes — a nicer, browser-based take on [k9s](https://k9scli.io/).
Browse your clusters, watch pods, stream live logs, and read CPU / memory and scaling
info, all from your existing `kubeconfig`.

> **Read-only by design.** v1 only ever issues reads (GET / watch) against a cluster.
> No create, update, delete, scale, exec or apply. See [Safety model](#safety-model).

## Components

| Component | Path | Stack |
|---|---|---|
| **API** | `/api` | .NET 10 — single project, minimal-API endpoints + Kubernetes access |
| **App** | `/app` | React + TypeScript + Vite |

## Quick start

Two processes — the API and the Vite dev server. The app proxies `/api` and `/hubs` to
the API, so you only ever open the app URL.

```bash
# 1. API  →  http://localhost:5206
dotnet run --project api/Helmsman.Api

# 2. App  →  http://localhost:5174   (open this one)
npm --prefix app run dev -- --port 5174
```

The landing screen lists every context in your `kubeconfig` and marks the one `kubectl` is
currently pointed at. Helmsman reads the kubeconfig directly — there is **no separate login
or credential config**; it inherits whatever your `kubectl` already uses.

### Prerequisites

- .NET 10 SDK
- Node 20+
- A reachable cluster in your `~/.kube/config` (`kubectl get ns` should work)
- **For CPU / memory:** [metrics-server](https://github.com/kubernetes-sigs/metrics-server)
  installed in the cluster. Confirm with `kubectl top pods` — if that errors, the metrics
  panels will be empty until it's installed.

## Project structure

```
Helmsman/
  Helmsman.slnx                  solution
  api/
    Helmsman.Api/                single project, folders by concern:
      Endpoints/                   minimal-API routes (ClusterEndpoints.cs)
      Kube/                        Kubernetes access (KubeClientFactory.cs); owns KubernetesClient
      Models/                      plain DTO classes (ContextInfo.cs)
      Hubs/                        SignalR hubs for live logs (later)
  app/
    src/lib/                     API client (api.ts), helpers
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
> load the API server, and real-cluster logs may contain sensitive data (PII). **Develop against
> a non-production cluster.**

## Status & roadmap

| Feature | Status |
|---|---|
| Context list (k9s-style) from kubeconfig | ✅ Done |
| Namespace picker | ✅ Done |
| **Live** pod list (watch → SignalR, incremental deltas) | ✅ Done |
| Live log streaming (SignalR) | ⏳ Next |
| CPU / memory (metrics.k8s.io, polled) | ⏳ Planned |
| Deployments / HPA with replica counts | ⏳ Planned |

## License

Personal project — no license granted.
