# 003 — Minimal-API endpoints over MVC controllers

- **Status:** Accepted
- **Date:** 2026-06-10

## Context

The API exposes a small, read-only surface: list contexts, and (soon) list pods, stream logs,
read metrics, list deployments. ASP.NET Core offers two styles: MVC controllers (attribute
routing, `Controller` base class, conventions) or minimal APIs (route strings mapped to
handlers, DI via handler parameters).

## Decision

**Minimal-API endpoints, grouped by area via extension methods.**

Routes live in `Endpoints/` (e.g. `ClusterEndpoints.cs`) as `app.MapGet(...)` handlers, and
each group exposes a `MapXxxEndpoints(this IEndpointRouteBuilder)` extension so `Program.cs`
stays a one-liner per area. DI is by handler parameter — e.g. `(KubeClientFactory factory)` is
resolved from the container, the same as constructor injection in a controller.

## Consequences

**Positive:**
- Minimal boilerplate for a small route set; everything about a route is in one place.
- Extension-method grouping keeps the readability of "one file per area" without the controller
  ceremony.
- Slightly faster startup; fewer concepts to hold.

**Negative / accepted:**
- Less familiar to a team that expects controllers; conventions (filters, model binding niceties)
  are more explicit/manual.
- If the surface grows large or needs heavy shared cross-cutting behaviour, controllers may read
  better — revisit then.

## Alternatives considered

- **MVC controllers.** More structure and attribute conventions, but over-ceremony for a handful
  of read-only routes. Easy to migrate to later if the surface grows.
