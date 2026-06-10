# 001 — Single API project with internal folders (no microservices, no onion split)

- **Status:** Accepted
- **Date:** 2026-06-10

## Context

Helmsman is a single graphical UI over Kubernetes. It has one backend concern (talk to a
cluster via the user's kubeconfig) and one frontend. There is no database, no second service,
no auth provider, and no real domain model — the "domain" is a handful of DTOs that map
Kubernetes objects to the shapes the frontend needs.

The first scaffold used flat `backend/`/`frontend/` folders; a second pass split the API into a
three-project onion (`Api` / `Infrastructure` / `Domain`). For a read-only tool with ~60 lines of
logic and one endpoint, three projects proved to be more structure than the work justified —
project references, an extra namespace dance, and two near-empty projects.

The sibling project Mole reserves a full onion only for *its* API, which has real entities, EF Core
persistence and OAuth; Mole's thin services (relay, agent) use a **single project with internal
folders**. Helmsman is shaped like those thin services, not like Mole's API.

## Decision

**A `.slnx` solution with a single `Helmsman.Api` project organised by internal folders, a single
`app/`, and no microservices.**

```
Helmsman.slnx
api/
  Helmsman.Api/
    Endpoints/     minimal-API route groups (ClusterEndpoints, …)
    Kube/          all Kubernetes access — KubeClientFactory + future readers; owns the KubernetesClient pkg
    Models/        plain DTO classes — ContextInfo, PodInfo, …
    Hubs/          SignalR hubs for live logs (added when streaming lands)
    Program.cs
app/
  src/lib, src/components, src/pages
```

Folders, not projects, mark the boundaries. Models classes stay framework-free; all `k8s` usage
stays under `Kube/` by convention. The namespace segment is `Kube`, not `Kubernetes`, because a
`.Kubernetes` namespace shadows the `k8s` library's `Kubernetes` type (`CS0118`).

## Consequences

**Positive:**
- Far less ceremony — one csproj, no project references, no cross-project namespace friction.
- New features still have an obvious home: a DTO in `Models/`, a reader in `Kube/`, an endpoint in
  `Endpoints/`, a hub in `Hubs/`.
- Matches how Mole structures its thin services.

**Negative / accepted:**
- The Models-depends-on-nothing and HTTP-can't-touch-k8s-directly boundaries are now enforced by
  **convention, not the compiler**. Acceptable for a solo, small, read-only tool.
- If Helmsman ever grows a real domain (persistence, complex rules), extracting `Kube/` into an
  Infrastructure project is a clean cut along the existing folder line — cheap to do later.

## Alternatives considered

- **Three-project onion (`Api`/`Infrastructure`/`Domain`).** What we briefly had. Over-structure for
  the current size; the compile-time boundaries don't earn their cost on a tool this small.
- **Two projects (`Api` + `Infrastructure`).** Keeps only the k8s-isolation boundary. Reasonable, but
  still one more project + reference than this app needs today.
- **Keep flat `backend/`/`frontend/`.** Unstructured and inconsistent with sibling repos.
- **Microservices.** No second concern exists to justify it.
