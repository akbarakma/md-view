# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Drop into any project as-is. Append project-specific rules below the line at the bottom.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. ORM Query Discipline

**Never SELECT *. Load only columns the endpoint actually returns.**

Applies to any ORM with column-projection support (SQLAlchemy `load_only`, Django `.only(...)` / `.values(...)`, Prisma `select`, ActiveRecord `select(...)`, etc.).

- Project columns explicitly on every query. Don't fetch the whole row "just in case."
- For eager-loaded relations, project columns on the relation too.
- Heavy blob/JSON/text columns (credentials, payloads, raw HTML, vectors) MUST be excluded unless the handler returns them.
- Each endpoint/handler owns its query. Don't rely on a shared dependency that loaded a "full" object — the dep can't know what you need.
- For auth-gating only (no data needed), use deps that return just the user ID and write the targeted query in the handler.

SQLAlchemy pattern:
```python
obj = db.scalar(
    select(Model)
    .options(
        load_only(Model.id, Model.field_a, Model.field_b),
        joinedload(Model.relation).load_only(Related.name),
    )
    .where(Model.id == some_id)
)
```

### 5.1 `contains_eager` when you need INNER JOIN + eager-load (SQLAlchemy)

When a query needs an explicit `.join(Model.relation)` (to filter on related columns or to gate via the related table's auto-filters) AND wants to eager-load that same relation, use `contains_eager`, NOT `joinedload`.

`joinedload(Model.rel)` emits a SECOND, separately-aliased LEFT OUTER JOIN. Combined with an explicit `.join(Model.rel)` you end up with two joins to the same table — wasteful and confusing.

`contains_eager(Model.rel)` attaches the eager-load to the explicit `.join(...)` — one join, used for both filtering and population.

Pattern:
```python
stmt = (
    select(Job)
    .join(Job.owner)  # INNER JOIN — also gates rows
    .options(
        load_only(*_JOB_OUT_COLS),
        contains_eager(Job.owner).load_only(Owner.name),
    )
    .order_by(Job.created_at.desc())
)
```

Use plain `joinedload(...)` only when you do NOT need an explicit join (e.g. LEFT OUTER eager-load where the relation may legitimately be missing).

For pure log/stream/exists-style endpoints that only need a column from the parent for a guard check (no eager-load required), the bare `.join(Model.rel)` with no `contains_eager` / `joinedload` is correct and intentional. Match the pattern across sibling endpoints of the same resource — don't mix.

## 6. Soft-Delete Query Filtering

If the project has a soft-delete pattern (a `deleted_at` / `is_deleted` column on certain models), respect its boundaries:

- **SELECTs**: if a global event listener / query manager auto-injects the filter, do NOT repeat it. Confirm by reading the project's soft-delete module before assuming.
- **UPDATEs / DELETEs / raw SQL / bulk ops**: auto-filters typically do NOT apply to these — add `Model.deleted_at IS NULL` explicitly.
- **Bypass**: only fetch deleted rows when intentionally needed, via the project's documented escape hatch.
- **Cascading**: deleting a parent does not auto-soft-delete children unless wired up. Check.

If the project has no soft-delete, ignore this section.

## 7. Frontend Conventions (Next.js + TanStack Query)

Stack assumption: Next.js (App Router) + TypeScript + Tailwind + TanStack Query v5 + zod + react-hook-form + zustand. Adapt section names to the actual stack; the principles carry.

### 7.1 Cache-update over refetch
Mutations MUST update the TanStack Query cache directly in `onSuccess`. Do NOT call `invalidateQueries` or `refetch` to "just refresh the list" after a CRUD mutation. Allowed exceptions:
- The mutation has side-effects on unrelated queries the server computes (justify in a comment).
- A server-derived total/aggregate genuinely cannot be reconstructed client-side — invalidate exactly the affected key, once.
- The user explicitly asks to refresh.

Pattern:
```ts
onSuccess: (created) => {
  qc.setQueryData(keys.detail(created.id), created);
  qc.setQueriesData<Page<T>>({ queryKey: keys.all }, (old) =>
    old ? { ...old, items: [created, ...old.items], total: old.total + 1 } : old);
}
```

### 7.2 Lazy data fetching
- Queries live inside the page component that needs them — never in a shared `layout.tsx` or above unless the data is genuinely required by every child route.
- Top-level layouts fetch only what every child needs (typically the auth/me call) with `staleTime: Infinity`.
- Sidebar / nav `<Link>` uses `prefetch={false}` — navigation is the only fetch trigger.
- For lists rendered on demand (form selects, etc.), pass `enabled` to gate the query on the open state.
- No polling. Prefer push (server events) or one-shot invalidate on a terminal client action.

### 7.3 Query-key factory per resource
Every `lib/hooks/use-<resource>.ts` exports a `<resource>Keys` object. Never inline string-array keys at call sites.

### 7.4 Pagination
List queries take `{ page, size }` in their key and use `placeholderData: keepPreviousData`. Reset `page = 1` whenever a filter input changes.

### 7.5 Forms
react-hook-form + zod resolver. Schemas live in `lib/api/types.ts` next to the API type so one definition drives both runtime validation and TypeScript inference (`z.infer<typeof X>`). Reset form on dialog open via `useEffect`, not on render.

### 7.6 Auth & API client
- Single axios (or fetch) instance in `lib/api/client.ts` attaches the auth header. On 401 it clears auth and redirects to the login route.
- Per-resource API modules in `lib/api/*.ts` parse responses through zod. Never call the HTTP client directly from a component.
- Token storage method (cookie / localStorage / memory) is a project decision — pick one and document it next to the client. Don't mix.

### 7.7 Error responses (one shape, many messages)

Backend contract (recommended): every non-2xx body is `{"detail": "<string>"}`. Multiple errors join with `"; "`. Field-validation messages prefix with the field path, e.g. `"email: invalid; password: too short"`.

Frontend rules:
- Always parse errors via a single `asApiError(err)` helper. Returns `{ status, message, messages, fieldErrors }`. Never read `error.response.data` directly at call sites.
- For toast display, pass `asApiError(err).message` — newline-joined, multi-line.
- For forms, do NOT call `toast.error` in the `catch` block. Use `applyApiErrorToForm(err, form.setError, KNOWN_FIELDS)` — maps prefixed messages → `setError` per field and toasts any leftover non-field messages.
- For inline rendering, use a shared `<ErrorState error={...} />` — bulleted list for multiple, single line for one.
- Never iterate `toast.error(...)` per message. One error event = one toast.
- Backend rule: never raise errors with list/object detail payloads. Join multiple business errors with `"; "`.

### 7.8 Performance rules
- No barrel imports — import directly from the file.
- `next/dynamic` for heavy charts and rarely-rendered widgets.
- Stable query keys via the factory; memoize the query object with `useMemo` when it depends on multiple inputs.
- Functional `setState`.
- No components defined inside other components.
- Don't subscribe to state only used in callbacks — read from the store with a selector.

### 7.9 File layout
- `app/` — routing only. Pages stay thin and compose components.
- `components/ui/` — primitive UI (buttons, inputs, dialogs).
- `components/<domain>/` — domain-specific composites.
- `components/common/` — cross-cutting: `PageHeader`, `Pagination`, `ConfirmDialog`, `EmptyState`, `ErrorState`.
- `lib/api/` — transport (one module per resource).
- `lib/hooks/` — TanStack Query hooks (one module per resource).
- `lib/stores/` — zustand stores (one module per resource).
- `lib/` — pure utilities (env, cn, auth storage).

### 7.10 What NOT to do
- Don't add a global `<Toaster />` per page; mount it once in the providers root.
- Don't put TanStack Query hooks behind another wrapper hook unless reuse is real.
- Don't mix server actions / RSC fetching with the client API layer — pick one transport and stay consistent.

### 7.11 List filter state in zustand (no URL params)
List pages that link to a detail page MUST keep their filter/search/pagination state in a per-resource zustand store under `lib/stores/<resource>-list-store.ts`, NOT in `useState`.

Why: `useState` dies when the list component unmounts on detail navigation, so the in-page Back button (and browser back) land on a fresh list with all filters reset. A zustand store outlives the unmount, and TanStack Query cache-hits on the same factory key — instant restore, no extra fetch.

Why not URL params: keep the SPA feel — no `?page=` / `?name=` in the address bar. (Override if the project explicitly wants shareable list URLs.)

Rules:
- One store per resource. File: `lib/stores/<resource>-list-store.ts`.
- Store shape: one field per filter + `setX()` per field + `reset()`. Any setter that changes a filter MUST reset `page` to 1.
- In-memory only — no `persist` middleware. Hard reload resets to defaults.
- Read via individual selectors (`s.page`, `s.name`, …) — don't subscribe to the whole store object.
- Truly local UI state (open/close dialog, "editing" row) stays in `useState`. Only navigation-relevant state belongs in the store.
- Detail-page Back link stays a plain `<Link href="/<resource>">` — no `router.back()`, no `from` query param.
- Lists without a detail route may keep `useState` until they add one.

### 7.12 Debounce text-search filters

Free-text inputs that feed a TanStack Query key MUST be debounced before entering the key. Use `useDebouncedValue` from `lib/hooks/use-debounced-value.ts` with a 300 ms default. The raw value still drives the `<Input>` (and the zustand list store, per 7.11) so typing feels instant; only the query input is debounced.

Pattern:
```ts
const name = useResourceListStore((s) => s.name);
const debouncedName = useDebouncedValue(name);
const query = useMemo(
  () => ({ page, size: 20, name: debouncedName.trim() || undefined }),
  [page, debouncedName],
);
```

Does NOT apply to:
- `<Select>`, checkbox, date picker — single deliberate commit, no per-keystroke firing.
- Inputs that filter client-side only (no API round-trip).

If a screen needs a different delay, pass it explicitly (`useDebouncedValue(value, 500)`) and add a one-line comment explaining why.

### 7.13 API-backed dropdowns

Any picker whose options come from a paginated API MUST use a shared `components/ui/async-combobox.tsx`. Required behaviors: (1) fixed max-height with a scrollable list region so long results never overflow the viewport; (2) infinite scroll via `useInfiniteQuery` + IntersectionObserver sentinel that calls `fetchNextPage` when the bottom comes into view; (3) debounced search input that drives the server-side filter.

Static-option dropdowns (fixed enums, day/month) keep using `<Select>`.

Resource adapter hook signature:
```ts
function useFooOptions(search: string): {
  options: { id: string; label: string }[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: unknown;
}
```

Use a separate `infiniteList` key namespace in the query-key factory so existing `setQueriesData` patches against `lists()` don't collide with the `InfiniteData<Page<T>>` shape. Each mutation's `onSuccess` should patch both `lists()` and `infiniteLists()`.

When a selected id may not be in the loaded pages (edit forms, persisted filters), pass `selectedLabel` from the resource's detail-cache so the trigger renders the correct name immediately:

```tsx
<AsyncCombobox
  value={value}
  onChange={onChange}
  useOptions={useFooOptions}
  selectedLabel={detailQuery.data?.name}
  placeholder="Select…"
/>
```

### 7.14 Skeleton loading states

TanStack Query `isLoading` branches MUST render a skeleton that mirrors the loaded layout, not a text loader ("Memuat…") or generic spinner. Skeleton dimensions (grid columns, card count, row height, breakpoints) match the real UI so the page reserves shape on first paint and content swap causes no layout shift.

Rules:
- Base primitive: `components/ui/skeleton.tsx` (`animate-pulse rounded-md bg-slate-200/70`). Compose page-specific skeletons in `components/skeletons/<page>-skeleton.tsx`.
- Per-section, not per-page: independent queries get independent skeletons so sections pop in as their data resolves (see insights page).
- Pagination: gate skeleton on `query.isLoading && !query.data` so `keepPreviousData` keeps prior page visible during page-change fetches. No skeleton flash on page 2+.
- Match responsive breakpoints exactly. Mobile card list ≠ desktop table — skeleton must split the same way.
- Mutations keep their existing button-state pattern ("Menyimpan…") — skeletons are for query loads only.
- Spinners acceptable (not required) for: auth-resolution shells, terminal mutation confirmations (e.g. payment polling). Skeletons preferred when a layout shape exists.
- Static pages (no client fetch) need no skeleton.

### 7.15 Use raw `<img>`, not `next/image`

This project standardizes on plain `<img>` tags throughout (landing, dashboard, nota, track). Do NOT migrate raw `<img>` to `next/image`, and do NOT introduce `next/image` for new images. The `@next/next/no-img-element` ESLint warning is expected — leave it. New images should declare `width`, `height`, and `loading="lazy"` (except above-the-fold) directly on the `<img>`.

### 7.16 Image file inputs: no `capture` attribute

Image upload `<input type="file">` MUST NOT set the `capture` attribute. iOS Safari treats `capture="environment"` (or any `capture` value) as a hard directive and opens the camera directly, with no option to pick from Photo Library. The spec says it's a hint; Safari ignores that. Android Chrome behaves similarly on most builds.

Use `accept={IMAGE_ACCEPT_ATTR}` only. The native picker on iOS will then offer "Photo Library / Take Photo or Video / Choose File" — which is what users need when the photo (e.g. transfer receipt, QRIS, logo) already lives in their gallery.

Pattern:
```tsx
<input
  ref={inputRef}
  type="file"
  accept={IMAGE_ACCEPT_ATTR}
  className="hidden"
  onChange={onChange}
/>
```

Exception: a screen that genuinely must capture a fresh photo on the spot (e.g. in-app KYC liveness, scan-only flows) may set `capture="environment"` — document why in a one-line comment above the input. Default to no capture.

## 8. Never write N+1 queries

An **N+1** is any code path where one logical operation issues `1 + N` round-trips that scale with input size: a parent fetch (1) plus a per-child fetch (N). The same shape shows up in background tasks that re-read a row each iteration of a long loop. Treat these as bugs, not optimizations — fix them at write time.

### 8.1 Eager-load every relation you will read

Any relation accessed during response serialization or downstream logic MUST be eager-loaded in the same query that fetched the parent — paired with column projection (§5) so the eager-load doesn't drag heavy blobs.

Never rely on lazy-load triggering during serialization / template rendering. By the time the ORM emits the per-row SELECT, you've already lost.

### 8.2 Don't poll the database for control signals

Background tasks (job workers, batch processors) often need to react to external state — typically a cancel signal. Do NOT do this with a per-iteration `SELECT` or `db.refresh(...)`. For a job processing N items, that's N extra round-trips and per-tick latency. It also keeps the row hot in the DB cache for no reason.

**Use an out-of-band channel** (Redis key, in-memory flag, message bus) as the cancel/control signal. The mutating route writes the flag; the worker reads it each iteration.

Pattern (Redis as example — adapt to whatever the project already uses):
```python
# In the cancel route — write the flag with a generous TTL:
redis_client().set(f"<resource>:job:{job_id}:cancel", "1", ex=86400)

# In the task loop — read the flag, never refresh the ORM:
for item in target_ids:
    if rc.get(cancel_key) == "1":
        cancelled = True
        break
    ...
```

The one-shot status check at task start (before the loop) and the recovery check inside the outer exception handler may stay as DB lookups — they fire at most twice per task lifetime, so they don't scale with input.

### 8.3 Batch when you need data for N ids

If you have a list of N IDs and need a column for each, write ONE query: `WHERE id IN (...)` or `WHERE id = ANY(:ids)`, build a `{id: row}` dict, then iterate in code. Never `for id in ids: db.scalar(select(...).where(... == id))`.

### 8.4 Pipeline fan-out IO

Multiple Redis or HTTP calls inside a loop? Use the client's pipeline / batch API for one round-trip, and `asyncio.gather` / a single multi-get for HTTP. Same principle: replace `1 + N` round-trips with `1`.

### 8.5 Rule of thumb

If a code path's query count grows with input size, and each query has the same shape, you have an N+1. Either:
1. Fold them into one batched query, OR
2. Move the per-iteration signal out of the database (Redis, in-memory state, etc.).

Code review should flag this on first read. Don't merge it.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

<!-- Append project-specific rules below this line. Keep them under their own numbered section so the global rules above remain stable across projects. -->

## 9. Transactional Limit Checks

When an endpoint enforces a per-parent quota before inserting a child row, serialize the check and insert in the same database transaction. Lock the parent row with `SELECT ... FOR UPDATE` (SQLAlchemy: `.with_for_update()`), then count the active child rows and insert before committing. Do not enforce quota limits with an unlocked count followed by an insert; concurrent requests can both pass the stale count and exceed the tier limit.
