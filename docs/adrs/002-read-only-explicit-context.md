# 002 — Read-only v1 with explicit context selection

- **Status:** Accepted
- **Date:** 2026-06-10

## Context

Helmsman is developed and tested against **real** clusters, because there is no synthetic
cluster that exercises the same paths (multi-context kubeconfig, EKS auth, metrics-server,
real workloads). The same kubeconfig that lists harmless dev clusters also lists production.

Two risks follow:
1. A bug could mutate cluster state (delete/scale/exec) against the wrong cluster.
2. A tool that defaults to `kubectl`'s `current-context` would act on production the moment the
   user happens to have it selected — which is the common default.

## Decision

**v1 is read-only, and the app refuses to act without an explicitly chosen context.**

- **Read-only:** the codebase only calls read/watch Kubernetes endpoints — list, get, watch,
  log-follow, metrics. No create, update, delete, scale, exec, patch or apply. A mutating
  misfire is impossible because no mutating call exists.
- **Explicit context:** `KubeClientFactory.CreateClient(contextName)` requires a non-empty,
  known context name and throws otherwise. There is **no fallback to `current-context`**.
  Listing contexts (`GET /api/contexts`) reads the kubeconfig file only and never contacts a
  cluster; it flags which context is `kubectl`-current purely for display.

## Consequences

**Positive:**
- The blast radius of any bug is bounded to reads.
- The app cannot silently operate on production by inheriting the shell's current context.
- Listing/selecting contexts is completely safe regardless of what `kubectl` points at.

**Negative / accepted:**
- Read-only is enforced by **convention, not by the cluster**. The user's kubeconfig may carry
  write/admin rights, so cluster **RBAC** is the real backstop — a read-only role is recommended.
- Reads are **not zero-impact**: log streaming and metrics polling load the API server, and
  real-cluster logs may contain sensitive data (PII). Mitigation is process, not code: develop
  against a non-production cluster.
- A future write feature (e.g. scaling a deployment) will need its own ADR and a deliberate
  guard model — it must not arrive by accident.

## Alternatives considered

- **Default to `current-context` for convenience.** Rejected — it's the single most likely way
  to act on production unintentionally.
- **Enforce read-only in code (block mutating verbs centrally).** Deferred — valuable when a
  write path eventually exists, but premature while there is literally no mutating call.
- **Mock/local cluster only for development.** Doesn't reproduce the real EKS auth, metrics, and
  multi-context behaviour we need to build against.
