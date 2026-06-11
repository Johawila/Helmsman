# Architecture Decision Records

ADRs capture the *why* behind a decision at the time it was made. They are **immutable** — when we change our minds, we write a new ADR that supersedes the older one rather than editing history.

Use the [template](./template.md) when adding a new one.

## Index

| # | Title | Status |
|---|---|---|
| [001](./001-layered-api.md) | Single API project with internal folders (no microservices, no onion split) | Accepted |
| [002](./002-read-only-explicit-context.md) | Read-only v1 with explicit context selection | Accepted |
| [003](./003-minimal-api-endpoints.md) | Minimal-API endpoints over MVC controllers | Accepted |
| [004](./004-streaming-first.md) | Streaming-first: live resource views via Kubernetes watch over SignalR | Accepted |
