# TODO — Project Documentation

A multi-tenant issue tracker (Trello/Linear-shaped). Users belong to **organizations**,
each organization owns **boards**, each board holds **sections** (columns), each section
holds **issues**, and each issue has **assignees** and **comments**.

This documentation describes the code **as it exists today**, not as it is intended to
work. Where behaviour is broken or unfinished, it is marked and cross-referenced to
[KNOWN-ISSUES.md](./KNOWN-ISSUES.md).

## Index

| Document | Contents |
| --- | --- |
| [BACKEND.md](./BACKEND.md) | Express API reference, auth, permission model, database schema, WebSocket layer |
| [FRONTEND.md](./FRONTEND.md) | React app structure, routing, pages, styling, intended UI spec |
| [KNOWN-ISSUES.md](./KNOWN-ISSUES.md) | Every defect, gap, and inconsistency found while writing these docs |

## Repository layout

```
TODO/                         Turborepo monorepo (bun workspaces)
├── apps/
│   ├── backend/              Express 5 + Postgres API (Bun runtime)
│   │   ├── migrations/       Raw SQL migrations + runner + pg Pool
│   │   └── src/
│   │       ├── index.ts      HTTP entry point
│   │       ├── router.ts     Mounts all feature routers
│   │       ├── middleware/   JWT auth (HTTP + WebSocket)
│   │       ├── routes/       One folder per resource: routes / controllers / schema
│   │       └── websocket/    ws server, room manager, message router
│   └── frontend/             React 19 + Vite + Tailwind v4 SPA
│       └── src/pages/        Auth, Dash, Org, Board
├── packages/                 Empty (starter packages were deleted)
├── turbo.json                Turbo task graph
└── package.json              Workspace root
```

## Tech stack

| Layer | Choice |
| --- | --- |
| Monorepo | Turborepo 2.x, bun workspaces (`apps/*`, `packages/*`) |
| Runtime | Bun 1.3.9 (backend), Node/Vite (frontend dev server) |
| Backend | Express 5.2, `pg` 8.22, `zod` 4.4, `jsonwebtoken` 9, `bcrypt` 6, `ws` 8.21 |
| Database | PostgreSQL (hosted on Neon, per `apps/backend/.env`) |
| Frontend | React 19.2, react-router-dom 7.18, Tailwind CSS 4.3, Vite 8 |
| Types | TypeScript 5.9 (root) / ~6.0 (frontend app) |

## Running the project

```bash
bun install                   # from the repo root

# Backend — needs apps/backend/.env with PORT, DATABASE_URL, JWT_SECRET
cd apps/backend
bun run migrate               # apply migrations/*.sql in filename order
bun run dev                   # bun --watch src/index.ts  → http://localhost:3000

# Frontend
cd apps/frontend
bun run dev                   # vite → http://localhost:5173
```

Turbo aggregates these from the root: `bun run dev`, `bun run build`, `bun run lint`,
`bun run check-types`. Note that `lint` and `check-types` are no-ops for the backend and
`check-types` is a no-op for the frontend — neither workspace defines those scripts
(see [KNOWN-ISSUES.md](./KNOWN-ISSUES.md) § Tooling).

> ⚠️ The two halves of the product do not yet connect: the server sends no CORS headers
> and registers sign-in as `GET` while the frontend sends `POST`. Migration `002` was
> invalid until 2026-09-28 — it now parses, but `bun run migrate` still has to be run
> before the invite feature has a table to write to.
> See [KNOWN-ISSUES.md](./KNOWN-ISSUES.md).

## Domain model

```
users ──┬── membership ──── orgs
        │   (role: admin/member)  │
        │                         │
        ├── invites ──────────────┤
        │   (role to grant)       │
        │                      boards
        │                         │
        │                     sections
        │                         │
        ├── issues_mapping ──── issues
        │   (assignees)           │
        └── comments ─────────────┘
```

* A user's capabilities are derived entirely from the `membership.role` they hold in the
  organization that owns the resource. There is no per-board or per-issue permission.
* `admin` may create/update/delete boards, sections and issues, manage members, and send
  invites. `member` may read everything in the organization and write comments.
* Comment edit/delete is allowed for the comment's author **or** any org admin.

## Request flow

```
Browser ──HTTP──> express.json() ──> router.ts ──> <resource>Router
                                                        │
                                          authMiddleware (JWT → res.locals.userid)
                                                        │
                                              zod schema.safeParse(body)
                                                        │
                                             permission query against membership
                                                        │
                                                   pg query / transaction
                                                        │
                                          broadcast* (roomManager) ──WS──> subscribers
```

The WebSocket half of that diagram is written but never started — `websocketServer()` in
`src/websocket/connection.ts` is exported and never called, so all `broadcast*` calls are
no-ops against empty maps. See [BACKEND.md § WebSocket layer](./BACKEND.md#6-websocket-layer).

## Intended UI (from the design wireframe)

1. **Login / signup** — a single screen that toggles between the two modes.
2. **Dashboard** — tabs `Your orgs` / `Invites`, a search field and a profile avatar.
   Org cards show name + truncated description; a `+` card creates a new org.
3. **Org / board view** — left sidebar with the org name, a list of boards, and
   `Membership` / `Invites` links. Main area is a horizontally scrollable row of
   sections; each section is a vertically scrollable column of issue cards showing
   title, description, and assignee avatars. A `+` in the header adds a section/issue.
4. **Issue detail** — opens over the board as a modal: issue name, description,
   assignees, and a **non-recursive** (flat, single-level) comment list.

Screens 1 and 2 are partially built; screens 3 and 4 are empty component stubs. See
[FRONTEND.md](./FRONTEND.md).
