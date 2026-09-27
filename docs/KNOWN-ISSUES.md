# Known issues

Everything found while documenting the codebase, verified against the working tree on
2026-09-28 (branch `main`, commit `ace5d5e` plus the uncommitted fixes noted below).

Three items have since been fixed and are struck through rather than deleted, so the
numbering and the links into this file stay stable:

* **[b1](#b1)** — `authMiddleware` added to the `/comment` and `/invite` routers.
* **[b2](#b2)** — `002_invitesTable.sql` corrected, plus a `UNIQUE (org_id, user_id)`
  constraint. ⚠️ `bun run migrate` has **not** been run, so the table does not exist yet.
* **[b3](#b3)** — the six `GET` reads take query parameters instead of a request body.

Everything else below is unfixed and was found by reading the code, not by running it.

Severity key:
**Blocker** = the feature cannot work at all · **Bug** = wrong behaviour in some cases ·
**Risk** = security or data-integrity exposure · **Inconsistency** = works, but surprising
· **Gap** = written but not wired up · **✅ Fixed** = resolved, kept for the record.

## Summary

| # | Severity | Area | Issue |
| --- | --- | --- | --- |
| ~~[b1](#b1)~~ | ✅ Fixed | `/comment`, `/invite` | ~~routers mounted without `authMiddleware`~~ |
| ~~[b2](#b2)~~ | ✅ Fixed | migrations | ~~`002_invitesTable.sql` is not valid SQL~~ |
| ~~[b3](#b3)~~ | ✅ Fixed | 6 endpoints | ~~`GET` routes read parameters from the request body~~ |
| [b4](#b4) | Blocker | `/auth/signin` | registered as `GET`, frontend sends `POST` |
| [b5](#b5) | Blocker | `/organization/delete` | reads `locals.userId` instead of `userid` |
| [b6](#b6) | Bug | schema | `ON DELETE RESTRICT` blocks section/board/org deletion |
| [b7](#b7) | Blocker | `/issue/update`, `/issue/delete` | invalid table aliases in SQL |
| [b8](#b8) | Gap | issue, membership | three finished controllers never routed |
| [b9](#b9) | Blocker | `/invite/create` | invalid SQL **and** wrong user id in the duplicate check |
| [b10](#b10) | Blocker | WebSocket | `websocketServer()` is never called |
| [b11](#b11) | Risk | WebSocket | `joinBoard` performs no authorization check |
| [f1](#f1) | Blocker | frontend | the whole response object is stored as the token |
| [f2](#f2) | Blocker | backend/frontend | no CORS middleware |
| [f3](#f3) | Bug | frontend | avatar points at a file that does not exist |
| [f4](#f4) | Bug | frontend | card components take positional args, not props |
| [c1](#c1) | Inconsistency | API | "no permission" is `400` in some modules, `403` in others |
| [c2](#c2) | Inconsistency | `/board/read` | board rows returned under the JSON key `orgs` |
| [c3](#c3) | Inconsistency | WebSocket | event names and payload keys are not uniform |

---

## Blockers and bugs

### <a id="b1"></a>b1 — `/comment` and `/invite` are mounted without `authMiddleware`

> ✅ **Fixed 2026-09-28.** `authMiddleware` was added to all four `commentRouter` routes
> and all five `inviteRouter` routes. All eight routers now protect every route.
> Kept here for the record.

`apps/backend/src/routes/comment/routes.ts` and
`apps/backend/src/routes/invite/routes.ts` registered their controllers directly,
unlike the other six routers.

Every controller in those two modules then read `response.locals.userid`, which was
`undefined`. `node-postgres` serialises `undefined` as `NULL`, so the permission joins
matched nothing.

Net effect — **these were broken endpoints, not an authentication bypass**:

| Endpoint | Result before the fix |
| --- | --- |
| `POST /comment/create` | `403 no permission` |
| `GET /comment/read` | `403 no permission` |
| `PATCH` / `DELETE /comment/*` | `404 comment not found` |
| `POST /invite/create` | `403 no permission` |
| `GET /invite/received` | `200 { invites: [] }` — always empty, no data leak |
| `GET /invite/sent` | `403 no permission` |
| `POST /invite/accept` | `404 invite not found` |
| `DELETE /invite/delete` | `404 invite not found or no permission` |

`GET /invite/received` was the one to watch: the only route that returned `200` to a
completely unauthenticated caller. It leaked nothing, because it filtered on a `NULL` user
id, but it had no auth gate in front of it.

### <a id="b2"></a>b2 — `002_invitesTable.sql` is not valid SQL

> ✅ **Fixed 2026-09-28.** The file now parses, and a `UNIQUE (org_id, user_id)`
> constraint was added at the same time. **The migration has not been run yet** —
> `cd apps/backend && bun run migrate` still has to be executed before the `invites`
> table exists.

The file read:

```sql
CREATE TABLE invites(
    id SERIAL PRIMARY KEY,
    org_id INT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE   ← missing comma
    role user_role NOT NULL DEFAULT 'member',                     ← trailing comma
)
```

Two distinct syntax errors — no comma after the `user_id` column, and a trailing comma
before the closing paren. Confirmed against a real Postgres:

```
ERROR:  syntax error at or near "role"     -- the missing comma
ERROR:  syntax error at or near ")"        -- the trailing comma, once the first is fixed
```

`bun run migrate` aborted here, rolled back and rethrew, so the `invites` table never
existed and the entire invite feature returned `500`.

Because the statement could never have succeeded, it was never recorded in the
`migrations` ledger — so the file was safe to correct in place rather than needing a
`003`. It now reads:

```sql
CREATE TABLE invites(
    id SERIAL PRIMARY KEY,
    org_id INT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    UNIQUE (org_id, user_id)
);
```

Verified by applying `001` + `002` to a local Postgres inside a transaction and rolling
back: both foreign keys, the `user_role` default and the unique index are created as
intended.

`UNIQUE (org_id, user_id)` is the constraint the duplicate-invite check in [b9](#b9)
tries and fails to enforce in application code. With it in place, a duplicate invite
raises a unique violation instead of slipping through — though [b9](#b9) still has to be
fixed for `POST /invite/create` to return anything but a `500`.

### <a id="b3"></a>b3 — `GET` endpoints read their parameters from the request body

> ✅ **Fixed 2026-09-28.** All six now read `request.query`, with
> `z.coerce.number().int().positive()` in their schemas so the string values that arrive
> on a query string still validate. Routes and controller logic were otherwise untouched.
> Calls become `GET /board/read?orgid=1` and so on.

Affected: `GET /board/read` (`orgid`), `GET /section/read` (`boardid`),
`GET /issue/read` (`sectionid`), `GET /comment/read` (`issueId`),
`GET /membership/read` (`orgid`), `GET /invite/sent` (`orgid`).

`express.json()` parses a body on a `GET` if the `Content-Type` is set, so these work from
`curl`, Postman or any Node script — which is why they look fine when tested that way.

They cannot be called from the browser. `fetch` rejects the request before it is sent:

```
TypeError: fetch() request with GET/HEAD/OPTIONS method cannot have body.
```

XHR ignored the body instead of throwing, so axios-in-the-browser would silently send
nothing and get a `400`. `Auth.tsx` uses `fetch`, so this blocked every read the frontend
needs.

These need to move to query parameters, path parameters, or `POST` before the frontend can
consume them. (`DELETE` and `PATCH` endpoints taking a body are unusual but legal and do
work from `fetch`.)

### <a id="b4"></a>b4 — `/auth/signin` is registered as `GET`

`apps/backend/src/routes/auth/routes.ts:8`:

```ts
authRouter.get("/signin", signinController);
```

The frontend sends `POST` (`apps/frontend/src/pages/Auth/Auth.tsx:16`), so the request
falls through to Express's default `404` handler. Signing in is also a state-changing
operation carrying a password, which belongs on `POST` regardless — and as a `GET` it hits
[b3](#b3) as well.

### <a id="b5"></a>b5 — `/organization/delete` always returns `403`

`apps/backend/src/routes/organization/controllers.ts:138`:

```ts
const userId = response.locals.userId;   // capital I
```

`authMiddleware` sets `response.locals.userid` (all lowercase). Every other controller in
the codebase reads `userid`. Here `userId` is `undefined` → `NULL` in the membership
lookup → `rowCount` is 0 → `403 { error: "no permissions" }` for everyone, including the
org's own admin.

### <a id="b6"></a>b6 — `ON DELETE RESTRICT` blocks deleting sections, boards and orgs

`apps/backend/migrations/001_base.sql:38`:

```sql
sectionId INT NOT NULL REFERENCES sections(id) ON DELETE RESTRICT
```

`DELETE /section/delete` removes the section row directly, so as soon as the section holds
any issue the delete raises a foreign-key violation and the controller returns `500`.

The restriction propagates upward, because `orgs → boards` and `boards → sections` both
cascade into it:

* deleting a **board** cascades to its sections → restricted by any issue → `500`
* deleting an **organization** cascades to boards → sections → restricted → `500`

So an org that has ever had an issue created in it can never be deleted. Either the
issues need to cascade, or the controllers need to delete children explicitly.

A related latent case at `001_base.sql:42`: `issues_mapping.userid` is also
`ON DELETE RESTRICT`, so a user who is assigned to any issue could never be deleted. There
is no user-deletion endpoint today, so nothing hits this yet.

### <a id="b7"></a>b7 — `/issue/update` and `/issue/delete` reference non-existent table aliases

`apps/backend/src/routes/issue/controllers.ts:220`:

```sql
section.id as sectionId     -- the joined table is `sections`, and it has no alias
```

`apps/backend/src/routes/issue/controllers.ts:465`:

```sql
board.id,                   -- the joined table is `boards`
```

Postgres rejects both with `missing FROM-clause entry for table "section" / "board"`. The
error is thrown inside the permission query, before any check runs, so **both endpoints
always return `500`** — issues can be created and read but never edited or deleted.

### <a id="b8"></a>b8 — Three finished controllers are never routed

| Controller | File | Missing route |
| --- | --- | --- |
| `moveController` | `routes/issue/controllers.ts:343` | e.g. `PATCH /issue/move` |
| `changeRoleController` | `routes/membership/controller.ts:70` | e.g. `PATCH /membership/role` |
| `kickController` | `routes/membership/controller.ts:214` | e.g. `DELETE /membership/kick` |

All three are complete — permission checks, row locking, last-admin guards, WebSocket
broadcasts — and all three are unreachable. `routes/issue/routes.ts` and
`routes/membership/routes.ts` do not import them.

Without `moveController` there is no way to move an issue between sections, which is the
core interaction of the board UI in the wireframe. Without the other two, an admin can
neither promote/demote nor remove a member.

`removeUserSocket` in `websocket/rooms/roomManager.ts:224` is likewise exported and never
called.

### <a id="b9"></a>b9 — `/invite/create` duplicate check is invalid SQL and uses the wrong user

`apps/backend/src/routes/invite/controller.ts:77-87`:

```ts
const existingInvites = await pool.query(
  `SELECT 1 FROM invites WHERE org_id=$1,user_id=$2`,   // comma, should be AND
  [orgid, userId],                                       // inviter, should be invitedUserId
);
```

Two defects in five lines:

1. `WHERE org_id=$1,user_id=$2` is a syntax error — Postgres needs `AND`. The query throws
   and the controller returns `500`, so **no invite can ever be created**.
2. Even with the syntax fixed, it binds `userId` (the admin sending the invite) rather
   than `invitedUserId` (the recipient), so it would check whether the *admin* has a
   pending invite. Duplicate invites to the same person would slip through.

Note this sits behind [b1](#b1) (no auth) and [b2](#b2) (no `invites` table) — all three
have to be fixed before the endpoint works.

### <a id="b10"></a>b10 — the WebSocket server is never started

`websocketServer(server)` is exported from
`apps/backend/src/websocket/connection.ts:7` and is **not imported anywhere**.
`src/index.ts` calls `app.listen(PORT)` directly, so it never obtains the `http.Server`
instance the function needs.

Consequences:

* No client can connect. Live updates do not exist.
* Every `broadcastToOrg` / `broadcastToBoard` / `broadcastToOrgAdmins` / `sendToUser` call
  in the controllers iterates an empty map and silently does nothing. They are harmless
  no-ops, not errors.
* `authWs` is dead code, as are all of `roomManager`'s join/leave paths.

Four files in the WebSocket tree are **0 bytes**: `src/websocket/server.ts` and
`src/websocket/handlers/{board,issue,comment}.ts`. The `handlers/` directory implies an
intent to move mutations onto the socket that was never carried out — all writes currently
go over HTTP and broadcast as a side effect.

Related smaller problems in `connection.ts`:

* `authWs` reads the token from the `Authorization` **header**, which browsers cannot set
  on a WebSocket handshake. A browser client needs it in a query parameter or the
  `Sec-WebSocket-Protocol` header.
* `authWs` `throw`s inside an `async` `connection` listener, producing an unhandled
  rejection rather than a handled close.
* `addUserSocket` is `async` (it queries the user's email) but is not awaited, so a frame
  arriving in that window is routed before `socketState` has an entry — `joinOrg` would
  add the socket to the room without recording it in `socketState`, leaving it
  un-cleanable.
* `ws.send("connection closed")` runs inside the `close` handler, i.e. on a socket that is
  already closed.
* `ws.send("connected")` is a bare string while every other frame is JSON.
* `addUserSocket` dereferences `email.rows[0].email` without checking `rowCount`.

### <a id="b11"></a>b11 — `joinBoard` performs no authorization check

`apps/backend/src/websocket/rooms/roomManager.ts:104`:

```ts
export function joinBoard(boardId: number, ws: WebSocket) {
```

It takes no `userId` and runs no query. `joinOrg` (line 55) does verify membership before
admitting a socket, but `joinBoard` does not — so any authenticated user could send
`{"type":"join:Board","boardId":N}` for an arbitrary board and start receiving that
board's `issues:updated`, `comment:updated`, `section:updated` and `liveMembers:changed`
events, plus have their own email broadcast to that board's real members.

The broadcasts carry ids rather than content, so the leak is metadata (which boards are
active, which sections exist, who is viewing) rather than issue text. It is also currently
unreachable because of [b10](#b10) — but it becomes live the moment the WebSocket server
is wired up.

### <a id="f1"></a>f1 — the frontend stores the whole response object as the token

`apps/frontend/src/pages/Auth/Auth.tsx:29-31`:

```ts
const data = await response.json();     // { token: "eyJ..." }
localStorage.setItem("token", data);    // stores "[object Object]"
```

`setItem` coerces its argument to a string, so the stored value is the literal
`"[object Object]"`. It needs `data.token`. Nothing reads the value back today, so this
surfaces only once authenticated requests are built.

### <a id="f2"></a>f2 — no CORS middleware on the backend

`apps/backend/src/index.ts` registers only `express.json()` and the router. The `cors`
package is not a dependency and no `Access-Control-Allow-Origin` header is ever set.

The Vite dev server runs on `:5173` and the API on `:3000`, which are different origins,
so **every** browser call from the frontend is blocked — the signup `POST` outright, and
any future `PATCH`/`DELETE` also at the preflight stage. Either add `cors` on the backend
or configure a `server.proxy` entry in `vite.config.ts`.

### <a id="f3"></a>f3 — dashboard avatar points at a missing file

`apps/frontend/src/pages/Dash/Dash.tsx:32` renders `<img src="/profile.jpg" />`, but
`apps/frontend/public/` contains only `favicon.svg` and `icons.svg`. The image 404s and
renders as a broken-image / alt-text button. There is also no user avatar anywhere in the
data model — `users` has only `id`, `email` and `password`.

### <a id="f4"></a>f4 — `cards.tsx` components take positional arguments

`apps/frontend/src/pages/Dash/cards.tsx:1` and `:9`:

```tsx
export function OrgCard(name: string, description: string) { ... }
export function InviteCard(name: string, role: string) { ... }
```

React calls a component with a single props object, so used as `<OrgCard name=... />`
these would receive `{ name, description }` as `name` and render `[object Object]` into
the first `<div>` with the second empty. They need a props parameter.

Nothing imports either function yet, which is why `tsc -b` currently passes.

---

## Inconsistencies

### <a id="c1"></a>c1 — "no permission" uses two different status codes

`board` and `section` controllers return **`400`**; `organization`, `issue`, `comment`,
`membership` and `invite` return **`403`**. A client cannot branch on status alone.

Related wording drift in the same area:

* `/auth/signin` returns **`409`** for an unknown email, where `404` (or a deliberately
  vague `401`) would be conventional.
* The 500 body is `{ error: "server error" }` in `auth`, `organization`, `membership` and
  `{ error: "internal server error" }` in `board`, `section`, `issue`, `comment`, `invite`.
* The `400` validation message is the copy-pasted `"invalid name or description"` on all
  four `board` routes, all four `section` routes, and `issue` read/move/delete — including
  on endpoints whose body has neither a name nor a description.

### <a id="c2"></a>c2 — `/board/read` returns board rows under the key `orgs`

`apps/backend/src/routes/board/controllers.ts:94`:

```ts
return response.status(200).json({ orgs: boards.rows });
```

Copy-pasted from the organization controller. The rows are boards
(`{ id, title, orginisationid }`); only the key is wrong. Every other read endpoint names
its key correctly (`sections`, `issues`, `comments`, `members`, `invites`).

### <a id="c3"></a>c3 — WebSocket event names and payload keys are not uniform

| Pattern | Examples |
| --- | --- |
| `:changed` vs `:updated` for the same concern | `org:changed` (update) vs `org:updated` (delete); `section:changed` (create) vs `section:updated` (update/delete) |
| Wrong event for the action | `DELETE /issue/delete` broadcasts `issues:moved` |
| Key casing drift | `issues:updated` carries `sectionId` on create but `sectionid` on update; `invite:updated` carries `orgid` on create but `orgId` on accept/delete |
| Misspelling | `invite:recieved` |
| Non-JSON frames | `"connected"`, `"connection closed"`, `"invalid inputs"` are bare strings |

Since clients match these strings exactly, each variation is a silent missed update.

### Naming drift elsewhere

* Request field names vary across modules for the same concept: `orgid` / `orgId` /
  `organizationId`, `boardid` / `boardId`, `sectionid` / `sectionId`, and `Issueid`
  (capital I) in `issue` update/delete versus `issueId` in `moveIssue` and `createComment`.
* `boards.orginisationId` is misspelled in the schema, so the JSON key is `orginisationid`.
* Controller files are `controllers.ts` in six modules but `controller.ts` in `membership`
  and `invite`.
* The frontend workspace is named `my-app` while its directory is `frontend`.

---

## Security notes

None of these are exploitable in the current state, but they are load-bearing once the app
runs:

* **JWTs never expire.** `jwt.sign({ userId }, secret)` in
  `routes/auth/controllers.ts:71` sets no `expiresIn`, and there is no refresh token,
  no `jti`, and no revocation list. A leaked token is valid forever.
* **The token is expected bare in `Authorization`**, with no `Bearer ` prefix
  (`middleware/auth.ts:9`). This is unconventional and will break against any standard
  client or proxy that normalises the header.
* **Storing the token in `localStorage`** (once [f1](#f1) is fixed) exposes it to any XSS
  on the origin.
* **User enumeration** — `/auth/signin` distinguishes `"user does not exist pls signup"`
  (`409`) from `"wrong password"` (`400`), letting an unauthenticated caller test which
  emails are registered.
* **No rate limiting** anywhere, so `/auth/signin` is open to credential stuffing and
  `/auth/signup` to mass account creation.
* **No request size limit** beyond `express.json()`'s 100 KB default, and no length cap on
  `name`, `description` or `comment` in any zod schema — `z.string()` with only a
  `.min(1)`. A single comment can be arbitrarily large.
* **`response.locals.userid` is untyped** (`any`), which is exactly why [b5](#b5) compiled
  without complaint. Declaring an `Express.Locals` interface would have caught it.
* On the good side: every query is parameterised (no SQL injection surface), passwords use
  `bcrypt` at cost 12, and `.env` is correctly gitignored via `apps/backend/.gitignore`.

---

## <a id="tooling"></a>Tooling and repository hygiene

* **`turbo run check-types` and `turbo run lint` do almost nothing.** The backend defines
  neither script; the frontend defines `lint` but not `check-types`. Nothing in the task
  graph type-checks the backend, so a `tsc`-visible error there would reach `main`
  unnoticed. (Run manually, `bunx tsc --noEmit -p apps/backend/tsconfig.json` and
  `bunx tsc -b` in `apps/frontend` are both clean today.)
* **`turbo.json` still declares Next.js build outputs** (`".next/**"`, `"!.next/cache/**"`,
  `"!.next/dev/**"`). Neither remaining app produces a `.next` directory; the frontend
  builds to `dist/`, so build output is not being cached.
* **The root `README.md` is the unmodified Turborepo starter README.** It describes a
  `docs` app, a `web` app, `@repo/ui`, `@repo/eslint-config` and `@repo/typescript-config`
  — all of which have been deleted from the working tree. `apps/frontend/README.md` is
  likewise the stock Vite template README.
* **`packages/` is empty** but still listed in the root `workspaces` array.
* **A nested `apps/frontend/bun.lock` exists** alongside the root `bun.lock`. In a bun
  workspace only the root lockfile should be present; the nested one can produce a
  divergent dependency tree.
* **TypeScript version skew** — the root pins `5.9.2`, `apps/frontend` pins `~6.0.2`.
* **Root-level app dependencies** — `react-router-dom`, `tailwindcss` and
  `@tailwindcss/vite` are declared in the root `package.json` as well as in
  `apps/frontend`. Only the app needs them.
* **Five empty files are tracked**: `src/websocket/server.ts`,
  `src/websocket/handlers/{board,issue,comment}.ts`, and `notes.txt` at the repo root.
* **No tests exist** in either workspace, and no test runner is configured.
* **Commit hygiene** — the last six commit subjects are `idk`, `idk`, `idk`, `idk`,
  `backend done`, `idk i really dont`. The most recent of those is a single 93-file commit
  that mixes the monorepo restructure, a source fix and new documentation.
* **A large restructure landed in one commit** (`ace5d5e`, 93 files): `apps/docs`,
  `apps/web`, `apps/websocket` and all of `packages/` were deleted, and `apps/frontend` was
  rebuilt from a Bun template to a Vite one (`bunfig.toml`, `bun-env.d.ts`,
  `src/frontend.tsx` and `src/index.html` went away). The WebSocket code that used to live
  in `apps/websocket` now sits in `apps/backend/src/websocket` — which is why
  [b10](#b10) exists: the move never reconnected it to the HTTP server.

---

## Suggested fix order

Nothing below is required — it is just the dependency order implied by the issues above.

1. [b4](#b4) make sign-in `POST`, [f1](#f1) store `data.token`, [f2](#f2) add CORS — the
   minimum to get a user logged in from the browser.
2. ~~[b2](#b2) fix migration 002~~ ✅, ~~[b1](#b1) add `authMiddleware` to the comment and
   invite routers~~ ✅, then run `bun run migrate` and fix [b9](#b9)'s duplicate-invite
   query — the last step before invites work at all.
3. [b7](#b7) fix the two table aliases, [b5](#b5) fix the `userId` casing — makes
   issue edit/delete and org delete work.
4. ~~[b3](#b3) move `GET` parameters out of request bodies~~ ✅ — frontend reads unblocked.
5. [b8](#b8) route `moveController`, `changeRoleController`, `kickController`.
6. [b6](#b6) decide the cascade policy for issues.
7. [b10](#b10) start the WebSocket server, and fix [b11](#b11) before it goes live.
8. Add `check-types` and `lint` scripts to both workspaces so the backend is type-checked
   by `turbo run check-types`.
