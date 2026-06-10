# Helmsman — Coding Standards

These standards apply across the whole project (`/api`, `/app`). Claude must follow these when
generating or editing code. They're adapted from the conventions used in sibling projects; the
parts specific to Helmsman are the Kubernetes, read-only, and structure sections.

---

## General Principles

- **Readability and maintainability over performance.** Optimise only when there is a measured reason to.
- **Small methods.** If a method needs a comment to explain what a block does, extract that block into a named method instead.
- **No premature abstraction.** Build the obvious thing first. Abstract when the duplication is real, not hypothetical.
- **Consistency over cleverness.** The codebase should feel like one person wrote it.

### Size Targets

Soft limits, not hard rules. Blowing past them is a signal that the unit might have too many responsibilities — investigate before continuing.

| Unit | Soft limit |
|---|---|
| Method | ~30 lines |
| Class | ~200 lines |
| File | ~300 lines |

### Comments

- **Self-documenting code first.** Good names beat comments.
- **Comments explain *why*, not *what*.** If you have to explain what code does, the code itself should be clearer.
- **Never leave commented-out code.** Delete it — git has it.

### TODOs

Format: `// TODO(name, YYYY-MM-DD): description`

```csharp
// TODO(johan, 2026-06-15): page the pod list once namespaces get large
```

Same applies to `FIXME` and `HACK`. Owner + date + reason. Stops them from rotting silently.

### Magic Numbers and Strings

- Named constants for repeated literals: `const int LogTailLines = 500;`
- Enums for state types, never bare strings.
- Strongly-typed config via `IOptions<T>`, not `IConfiguration["MagicKey"]` lookups scattered through code.

---

## C# / .NET

### Versions

| What | Version |
|---|---|
| **.NET** | 10.0 (LTS) |
| **C#** | 14 (default with .NET 10) |
| **Target framework** | `net10.0` |
| **Solution file** | `.slnx` (modern XML format) |

### Style

- `var` everywhere — type inference is fine, IDEs show the type on hover.
- **Classes over records. If a record seems right, discuss first.**
- File-scoped namespaces.
- Nullable reference types **enabled** in all projects.
- No regions (`#region`). Ever.

```csharp
// ✅
namespace Helmsman.Api.Kube;

public class KubeClientFactory
{
    public IReadOnlyList<ContextInfo> ListContexts() { ... }
}

// ❌
namespace Helmsman.Api.Kube
{
    public class KubeClientFactory
    {
        ...
    }
}
```

### Method Order

Public members first, private members at the bottom. Within each group, order: constructor → properties → methods.

```csharp
public class KubeClientFactory
{
    // 1. Public methods
    public IReadOnlyList<ContextInfo> ListContexts() { ... }
    public IKubernetes CreateClient(string contextName) { ... }

    // 2. Private methods
    private bool ContextExists(string contextName) { ... }
    private static ContextInfo ToContextInfo(Context context, string? currentContext) { ... }
}
```

### Naming

| Thing | Convention | Example |
|---|---|---|
| Class | PascalCase | `KubeClientFactory` |
| Interface | `I` + PascalCase | `IKubeClientFactory` |
| Method | PascalCase | `ListContexts` |
| Async method | PascalCase + `Async` | `StreamLogsAsync` |
| Property | PascalCase | `IsCurrent` |
| Private field | `_camelCase` | `_factory` |
| Local variable | camelCase | `contextName` |
| Constant | PascalCase | `LogTailLines` |

### One Type Per File

One file = one top-level public type. File name matches the type.

**Exceptions:** small private nested types that only make sense inside the parent class; enums used only by one class can live in the same file.

### XML Documentation

- **Required** on public types and methods under `Kube/` — the cluster-access surface is the part most worth documenting.
- **Recommended** elsewhere when the name alone isn't enough. `KubeClientFactory`'s class comment explaining the no-`current-context` rule is a good example: it documents *why*.

### Default Visibility

- Start with `private` or `internal`. Escalate to `public` only when something across the layer boundary genuinely needs it.
- Smaller public surface = easier to refactor without breaking callers.

### Date and Time

- **Always `DateTimeOffset.UtcNow`.** Never `DateTime.Now` / `DateTime.UtcNow`.
- Kubernetes timestamps arrive in UTC — keep them UTC end to end; format to local time only at the UI edge.

### String Comparison

- Use `StringComparison.Ordinal` for Kubernetes identifiers — context names, namespaces, pod names, labels. The Kubernetes API is **case-sensitive**, so prefer `Ordinal` (not `OrdinalIgnoreCase`) for matching resource names.
- **Never rely on culture-default comparison** (`a == b`, `ToLower()`) for identifiers.

```csharp
// ✅
if (context.Name.Equals(currentContext, StringComparison.Ordinal)) { ... }

// ❌
if (context.Name == currentContext) { ... }   // culture-dependent for some strings
```

### Async

- All async methods end in `Async`.
- Never `async void` — use `async Task`.
- Always pass and respect `CancellationToken`. This matters more than usual here: log streams and watches are long-lived, and the token is how we stop them when the client disconnects.

```csharp
// ✅
public async Task StreamLogsAsync(string context, string ns, string pod, CancellationToken ct)

// ❌
public async void StreamLogs(string context, string ns, string pod)
```

### Argument Validation

- **Public methods** (callable across the assembly boundary, DI-injected services, extension methods) start with guard clauses:

  ```csharp
  public IKubernetes CreateClient(string contextName)
  {
      ArgumentException.ThrowIfNullOrWhiteSpace(contextName);
      ...
  }
  ```

- **Private methods** — skip the guards. The caller is us and NRT enforces nullability.
- Reason: one validation site in the public method beats many at every caller.

### Error Handling

- Exceptions for exceptional cases, not flow control.
- Define custom exception types in an `/Exceptions` folder when the caller needs to distinguish the error type (e.g. a future `ContextNotFoundException`).
- The API uses **global exception handling** (Problem Details) — no try/catch in endpoint handlers for the common path. Translate Kubernetes API failures (401/403 from the cluster, unreachable API server) into clean Problem Details responses centrally.

### Dependency Injection

- Constructor injection only. No service locator.
- Register services in `Program.cs` or a dedicated extension method. As `Kube/` grows, expose a single `AddKubernetes()` extension so `Program.cs` doesn't know about individual readers.

### Logging

- Structured logging via `ILogger<T>` — log with context, not interpolated strings.

  ```csharp
  // ✅
  _logger.LogInformation("Listing pods for {Context}/{Namespace}", context, ns);

  // ❌
  _logger.LogInformation($"Listing pods for {context}/{ns}");
  ```

- **Never log log-line *content* streamed from a cluster, or any resource payload** — it may contain secrets/PII. Log metadata only (counts, names, durations).
- Levels: `Debug` for internals, `Information` for significant events, `Warning` for recoverable issues, `Error` for failures.

---

## Kubernetes Access

The rules that make this project safe and keep it maintainable.

- **All cluster interaction lives under the `Kube/` folder.** The `KubernetesClient` NuGet package
  is used there. Endpoints and hubs call into `Kube/` types (e.g. `KubeClientFactory`) rather than
  importing `k8s` types directly.
- **Read-only.** Only call read/watch endpoints (list, get, watch, log-follow, metrics). No
  create/update/delete/scale/exec/patch/apply. See [ADR 002](./docs/adrs/002-read-only-explicit-context.md).
  A write feature requires its own ADR and a deliberate guard model — it must not arrive by accident.
- **Explicit context only.** Build clients via `KubeClientFactory.CreateClient(contextName)`.
  Never fall back to `current-context`. Listing contexts reads the kubeconfig file only and never
  contacts a cluster.
- **Namespace `...Infrastructure.Kube`, not `.Kubernetes`.** A `.Kubernetes` namespace shadows the
  `k8s` library's `Kubernetes` type and breaks compilation (`CS0118`).
- **DTOs, not k8s types, cross the wire.** Map `k8s` objects (`V1Pod`, etc.) to plain `Models/`
  classes inside `Kube/`. The endpoints and frontend never see raw `k8s` types — that keeps the wire
  contract stable and the client dependency contained.
- **Long-lived operations honour cancellation.** Watches and log streams must stop when the client
  disconnects (pass the request's `CancellationToken`), or they leak connections to the API server.

---

## React / TypeScript

### Style

- **Functional components only.** No class components.
- **Strict TypeScript** — `strict: true` in `tsconfig.json`. No `any`.
- `interface` for object shapes, `type` for unions and primitives.
- One component per file.
- Component files: `PascalCase.tsx` (e.g. `ContextList.tsx`).
- Non-component files: `camelCase.ts` (e.g. `api.ts`, `useContexts.ts`).

### Component Structure

```tsx
// 1. Imports
import { useState } from 'react'

// 2. Types/interfaces local to this file
interface ContextRowProps {
  context: ContextInfo
  onSelect: (name: string) => void
}

// 3. Component (default export)
export default function ContextRow({ context, onSelect }: ContextRowProps) {
  // a. Hooks
  // b. Derived state / handlers
  // c. Render
  return (...)
}

// 4. Sub-components (if small and only used here)
```

### Naming

| Thing | Convention | Example |
|---|---|---|
| Component | PascalCase | `ContextList` |
| Hook | `use` + PascalCase | `useContexts` |
| Handler | `handle` + event | `handleSelect` |
| Boolean | `is/has/can` prefix | `isCurrent`, `hasError` |
| API client fn | camelCase verb | `fetchContexts`, `streamLogs` |

### Folder Layers — Avoid Duplication

The biggest way a React codebase rots is accumulating near-identical components (five slightly-different
buttons). Don't.

```
src/lib/          API client, SignalR wiring, shared helpers   (api.ts lives here)
src/components/    Reusable presentational components            (ContextRow, PodTable, LogViewer)
src/pages/         Screen-level composition                      (ContextsPage, ClusterPage)
```

**Before creating a new component:** search `src/components/` for something close; if an existing
component is ~90% right, extend it with a prop rather than copying. Only create new when those fail,
and put it at the right layer. If you find duplication, consolidate it.

shadcn primitives live in `src/components/ui/` — treat them as a vendored library: they're used
everywhere, so modify with care. Reach for an existing primitive + its variants before hand-rolling.

### Styling

- **Tailwind CSS v4 + shadcn/ui.** No separate `.css` files except `index.css` (the Tailwind import
  and theme variables). Style with utility classes.
- **Dark mode is the default** — the `dark` class is set on `<html>` in `index.html`. Use the theme
  tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border`, `bg-accent`, etc.),
  **not** hard-coded hex colours, so light/dark and future theming stay consistent.
- Add primitives with `npx shadcn@latest add <name>`; don't copy component code by hand.
- No inline `style` props unless the value is genuinely dynamic (e.g. a computed pixel height).

### State Management

- `useState` / `useContext` for local and shared UI state.
- **Server state via TanStack Query** (`useQuery`, `useMutation`) once we have more than the one
  contexts call — it gives caching, refetch, and loading/error states for free. The current single
  `fetch` in `lib/api.ts` is fine for now; adopt Query when the second endpoint lands.
- No Redux/Zustand unless complexity clearly demands it (discuss first).

---

## API Conventions

Helmsman uses **minimal-API endpoints, not controllers** ([ADR 003](./docs/adrs/003-minimal-api-endpoints.md)).
Routes live in `Endpoints/*.cs` grouped behind `MapXxxEndpoints` extension methods.

### URL Structure

- Plural nouns, no verbs in URLs. Lowercase, hyphen-separated if multi-word.

```
✅ GET /api/contexts
✅ GET /api/contexts/{context}/namespaces
✅ GET /api/contexts/{context}/namespaces/{ns}/pods
❌ GET /api/getPods
```

### HTTP Methods & Status Codes

v1 is read-only, so the surface is `GET` (plus SignalR for streaming). Write verbs are out of scope.

| Code | When |
|---|---|
| `200 OK` | Successful `GET` |
| `400 Bad Request` | Missing/invalid context or namespace |
| `404 Not Found` | Context / namespace / pod doesn't exist |
| `502 Bad Gateway` | The cluster API server is unreachable or rejected us |
| `500 Internal Server Error` | Unhandled — caught by global handler |

### Validation

With minimal APIs there's no `[ApiController]` auto-validation. Validate inputs explicitly at the top
of the handler (or via an endpoint filter) **before** any cluster call — reject an unknown context with
`400`/`404` rather than letting it fail deep in the `Kube/` layer.

### Responses

- **Success — return the resource directly, no envelope.** Lists return a JSON array.
- **Errors — RFC 7807 Problem Details** (built into .NET), produced centrally by the global exception handler.

```json
// 404
{
  "type": "https://helmsman/errors/context-not-found",
  "title": "Context not found",
  "status": 404,
  "detail": "No context named 'foo' exists in the kubeconfig.",
  "errorCode": "context_not_found"
}
```

### Live Streams

Live logs (and any future watch) use a **SignalR hub** under `/hubs`, not long-polling REST. Hub methods
take the context/namespace/pod plus the connection's cancellation, and push lines to the caller. See
[`docs/architecture.md`](./docs/architecture.md).

---

## Security & Cluster Safety

Helmsman runs **locally, as the user, with the user's kubeconfig** — there is no app auth layer and no
inter-service traffic. The security surface is therefore about the cluster and about secrets, not TLS/JWT.

- **Read-only + explicit context** are the core guarantees — see [ADR 002](./docs/adrs/002-read-only-explicit-context.md)
  and the [README safety model](./README.md#safety-model). Read-only is convention, not cluster-enforced:
  cluster **RBAC** is the real backstop — prefer a read-only role, and develop against non-production.
- **Never commit secrets or cluster credentials.** Helmsman reads `~/.kube/config` at runtime; no kube,
  cert, token, or `.env` material belongs in the repo. The `.gitignore` blocks the common cases — don't
  defeat it.
- **Never log or echo resource payloads / log content** — they may carry PII or secrets. Metadata only.
- **No real cluster identifiers in source or docs.** Use placeholders
  (`arn:aws:eks:<region>:<account-id>:cluster/<name>`), never real account IDs or cluster names.

---

## Testing

### C#

- **xUnit.** Test project mirrors source: `Helmsman.Api.Tests`.
- Test files named `{ClassName}Tests.cs`.
- Cover logic worth covering — kubeconfig parsing, context validation, k8s→Domain mapping.
- No tests for boilerplate (DI wiring, endpoints that only delegate).

```csharp
public class KubeClientFactoryTests
{
    [Fact]
    public void CreateClient_ShouldThrow_WhenContextIsUnknown() { ... }
}
```

### React

- **Vitest** + **React Testing Library**. Test user-facing behaviour, not implementation. No snapshot tests.

---

## Git

### Branches

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/short-description` | `feature/pod-list` |
| Bug fix | `fix/short-description` | `fix/log-stream-leak` |
| Chore | `chore/short-description` | `chore/bump-deps` |

### Commits

Free-form, but should complete *"This commit will…"*:

```
✅ Add live log streaming over SignalR
✅ Fix context list refetch after backend restart
❌ WIP / stuff / fix
```

### Pull Requests

- Keep PRs focused — one concern per PR. Prefer smaller over larger.

---

## Project & Folder Structure

```
Helmsman/
  Helmsman.slnx
  api/
    Helmsman.Api/                 single project, folders by concern
      Endpoints/                  minimal-API route groups
      Kube/                       KubeClientFactory + readers (all k8s access); owns KubernetesClient
      Models/                     plain DTO classes — ContextInfo, PodInfo, …
      Hubs/                       SignalR hubs (live logs) — added when streaming lands
      Exceptions/                 custom exceptions (when needed)
      Program.cs
      appsettings.json
    Helmsman.Api.Tests/           (when tests land)
  app/
    src/
      lib/                        api.ts, SignalR client
      components/                 reusable components (+ ui/ shadcn primitives)
      pages/                      screen composition
      App.tsx
      main.tsx
    index.html
    tsconfig.json
    vite.config.ts
    package.json
  docs/                           architecture.md + adrs/
  README.md
  CODING_STANDARDS.md
  .gitignore
```

One `Helmsman.Api` project; folders mark the concerns rather than separate projects. `Models/` classes
stay framework-free and all `k8s` access stays under `Kube/` — by convention, not compiler enforcement.
See [ADR 001](./docs/adrs/001-layered-api.md).
