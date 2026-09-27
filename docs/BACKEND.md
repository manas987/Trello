# Backend

Express 5 API running on Bun, backed by PostgreSQL through `pg.Pool`, with a `ws`
WebSocket layer for live updates.

- Entry point: `apps/backend/src/index.ts`
- Base URL in development: `http://localhost:3000` (`PORT` from `.env`, default `3000`)

---

## 1. Bootstrap

`src/index.ts` is the whole startup sequence:

```ts
app.use(express.json());
app.use(router);
app.listen(PORT);
```

There is no CORS middleware, no request logger, no error handler, no rate limiting, and
no `helmet`-style hardening. `src/router.ts` mounts eight feature routers:

| Mount | Router |
| --- | --- |
| `/auth` | `routes/auth/routes.ts` |
| `/organization` | `routes/organization/routes.ts` |
| `/board` | `routes/board/routes.ts` |
| `/section` | `routes/section/routes.ts` |
| `/issue` | `routes/issue/routes.ts` |
| `/comment` | `routes/comment/routes.ts` |
| `/membership` | `routes/membership/routes.ts` |
| `/invite` | `routes/invite/routes.ts` |

### Module convention

Every resource folder follows the same three-file shape:

| File | Responsibility |
| --- | --- |
| `schema.ts` | zod schemas, one per operation, validating `request.body` |
| `controllers.ts` (`controller.ts` for `membership` and `invite`) | Express `RequestHandler`s |
| `routes.ts` | `Router()` wiring path → `authMiddleware` → controller |

Controllers follow a consistent internal order: parse body with `safeParse` → read
`response.locals.userid` → run a permission query against `membership` → perform the
write → `broadcast*` → return JSON.

### Environment variables

`apps/backend/.env` (gitignored via `apps/backend/.gitignore`):

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP listen port (`3000`) |
| `DATABASE_URL` | Postgres connection string (Neon, `sslmode=require`) |
| `JWT_SECRET` | HMAC secret for signing/verifying session tokens |

---

## 2. Authentication

`src/middleware/auth.ts` holds one private `auth()` helper and two exported wrappers.

```ts
async function auth(request: IncomingMessage): Promise<number | null>
```

1. Reads the raw `Authorization` header — **the token is expected bare, with no
   `Bearer ` prefix**.
2. `jwt.verify(token, JWT_SECRET)` → `{ userId }`.
3. Confirms the user row still exists (`SELECT id FROM users WHERE id = $1`).
4. Returns the user id, or `null` on any failure (the `try/catch` swallows the reason).

| Export | Used by | Failure behaviour |
| --- | --- | --- |
| `authMiddleware` | HTTP routes | `401 { error: "Invalid token" }` |
| `authWs(ws, request)` | WebSocket upgrade | `ws.close(1008, "Unauthorized")` then `throw` |

On success `authMiddleware` sets **`response.locals.userid`** (all lowercase) and calls
`next()`. Every controller reads that exact key — one place gets the casing wrong, see
[KNOWN-ISSUES](./KNOWN-ISSUES.md#b5).

Tokens are signed in `routes/auth/controllers.ts` with `jwt.sign({ userId }, secret)` —
**no `expiresIn`**, so sessions never expire and there is no refresh or revocation path
beyond deleting the user.

### Coverage

All eight routers apply `authMiddleware` to every route. `commentRouter` and
`inviteRouter` previously did not — see [KNOWN-ISSUES b1](./KNOWN-ISSUES.md#b1), fixed
2026-09-28.

---

## 3. Permission model

Authorisation is always a SQL join, never cached state. Three shapes recur:

**Direct membership** — is the caller in this org at all?

```sql
SELECT role FROM membership WHERE user_id = $1 AND org_id = $2
```

**Walk up from a board** — `boards.orginisationId = membership.org_id`.

**Walk up from a section / issue / comment** — chain
`comments → issues → sections → boards → membership`.

The controller then checks `rowCount` (membership exists) and, for writes,
`rows[0].role === 'admin'`.

| Operation | Required role |
| --- | --- |
| Read orgs / boards / sections / issues / comments / members / invites-received | any member |
| Create / update / delete board, section, issue | `admin` |
| Update / delete organization | `admin` |
| Change role, kick, list sent invites, create invite | `admin` |
| Update / delete comment | comment author **or** org `admin` |
| Leave organization | self (blocked if you are the last admin) |
| Accept / decline own invite | the invitee |

The "last admin" guard appears in `changeRoleController`, `kickController` and
`leaveController`. Each takes `SELECT user_id FROM membership WHERE org_id = $1 FOR UPDATE`
first, locking every membership row in the org so two concurrent demotions cannot both
pass the `adminCount <= 1` check.

> ⚠️ The HTTP status used for "no permission" is inconsistent: `board` and `section`
> controllers return **400**, while `organization`, `issue`, `comment`, `membership` and
> `invite` return **403**. See [KNOWN-ISSUES](./KNOWN-ISSUES.md#c1).

---

## 4. Database schema

Two migrations in `apps/backend/migrations/`, applied by `migrations/migrate.ts`.

### `001_base.sql`

```sql
users          (id SERIAL PK, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL)
orgs           (id SERIAL PK, name TEXT NOT NULL, description TEXT)

CREATE TYPE user_role AS ENUM ('admin', 'member');

membership     (user_id → users ON DELETE CASCADE,
                org_id  → orgs  ON DELETE CASCADE,
                role user_role NOT NULL DEFAULT 'member',
                PRIMARY KEY (user_id, org_id))

boards         (id SERIAL PK, title TEXT NOT NULL,
                orginisationId → orgs ON DELETE CASCADE)

sections       (id SERIAL PK, title TEXT,
                boardId → boards ON DELETE CASCADE)

issues         (id SERIAL PK, title TEXT, description TEXT,
                sectionId → sections ON DELETE RESTRICT)

issues_mapping (userid  → users  ON DELETE RESTRICT,
                issueid → issues ON DELETE CASCADE,
                PRIMARY KEY (userid, issueid))

comments       (id SERIAL PK,
                issueId → issues ON DELETE CASCADE,
                comment TEXT NOT NULL,
                userId  → users ON DELETE SET NULL)
```

Notes on the schema as written:

* `boards.orginisationId` is misspelled (`orginisation`), and Postgres folds the unquoted
  identifier to lowercase `orginisationid` — that is the key that appears in JSON
  responses and the name every query must use.
* `issues.sectionId` is `ON DELETE RESTRICT`, so a section holding issues cannot be
  deleted, and because `orgs → boards → sections` cascade into that restriction, an org or
  board with any issue in it cannot be deleted either. See
  [KNOWN-ISSUES](./KNOWN-ISSUES.md#b6).
* `issues_mapping.userid` is `ON DELETE RESTRICT`, so an assigned user can never be
  deleted. There is currently no user-deletion endpoint, so this is latent.
* `comments.userId` is `ON DELETE SET NULL`, so comments survive their author as orphans.
* There are no `created_at` / `updated_at` columns anywhere, and no explicit ordering
  column on `sections` or `issues` — board column order and card order are whatever
  Postgres returns.
* There are no indexes beyond the primary keys and the `users.email` unique constraint.
  Every permission join hits `membership`, `boards.orginisationid`, `sections.boardid` and
  `issues.sectionid` unindexed.

### `002_invitesTable.sql`

Intends to create:

```sql
invites (id SERIAL PK,
         org_id  → orgs  ON DELETE CASCADE,
         user_id → users ON DELETE CASCADE,
         role user_role NOT NULL DEFAULT 'member')
```

`UNIQUE (org_id, user_id)` is what stops the same person being invited to one
organization twice — the check the controller attempts in application code
([b9](./KNOWN-ISSUES.md#b9)) is broken, so this constraint is the only thing enforcing it.

This file did not parse until 2026-09-28 (a missing comma and a trailing comma), so the
`invites` table never existed. See [KNOWN-ISSUES b2](./KNOWN-ISSUES.md#b2). It has to be
applied with `bun run migrate` before any invite endpoint will work.

### Migration runner

`migrations/migrate.ts` creates a `migrations (id, filename UNIQUE, applied_at)` ledger,
reads `./migrations/*.sql` sorted by filename, skips files already recorded, and applies
each remaining file inside `BEGIN` / `COMMIT` with a `ROLLBACK` on error. It is run
relative to the backend workspace root (`bun run migrate` from `apps/backend`), because
`migrationDir` is the relative path `"./migrations"`.

`migrations/db.ts` exports the shared `pool`, constructed from `DATABASE_URL`. Note that
the pool lives under `migrations/` and is imported by every controller via
`../../../migrations/db` — an odd location for runtime code, but functional.

---

## 5. HTTP API reference

Conventions used below:

* **Auth** — `yes` means `authMiddleware` runs before the controller.
* The six `GET` reads take **query parameters**; `POST`, `PATCH` and `DELETE` take a JSON
  **body**. The reads used to take a body too, which made them unreachable from a browser
  — see [KNOWN-ISSUES b3](./KNOWN-ISSUES.md#b3), fixed 2026-09-28. Their zod schemas use
  `z.coerce.number().int().positive()`, since query values arrive as strings.
* Every controller catches its own errors and returns `500 { error: "server error" }` or
  `{ error: "internal server error" }` (the wording varies by module).
* `z.int().positive()` is written throughout for id fields.

### 5.1 `/auth`

| Method | Path | Auth | Body | Success |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/signup` | no | `{ email, password }` | `201 { message: "user registered" }` |
| `GET` | `/auth/signin` | no | `{ email, password }` | `200 { token }` |

`signUpSchema` / `signInSchema` are identical: `email` must be a valid email,
`password` at least 8 characters.

**signup** — rejects with `400` on schema failure, `409` if the email already exists,
otherwise hashes with `bcrypt.hash(password, 12)` and inserts. Note that the duplicate
check and the insert are two separate statements with no transaction and no reliance on
the `users.email` unique constraint, so two concurrent signups for the same address race:
one succeeds and the other surfaces the constraint violation as a `500` rather than a
`409`.

**signin** — `400` on schema failure, `409` if the email is unknown (note: `409`, not
`404`), `400 { error: "wrong password" }` on mismatch, otherwise returns a JWT.
⚠️ Registered as `GET`, which the frontend does not call and a browser cannot send a body
to. See [KNOWN-ISSUES](./KNOWN-ISSUES.md#b4).

The error messages distinguish "user does not exist" from "wrong password", which lets an
unauthenticated caller enumerate registered email addresses.

### 5.2 `/organization`

| Method | Path | Auth | Body | Role | Success |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/create` | yes | `{ name, description }` | any user | `201 { message: "organization created" }` |
| `GET` | `/read` | yes | — | member | `200 { orgs: [{ id, name, description, role }] }` |
| `PATCH` | `/update` | yes | `{ orgid, name?, description? }` | admin | `200 { message: "org updated" }` |
| `DELETE` | `/delete` | yes | `{ orgid }` | admin | `200 { message: "organization deleted" }` |

* `create` runs in a transaction: insert into `orgs`, then insert the creator into
  `membership` with role `admin`. `description` is **required** by the schema
  (`z.string()`, not optional) even though the column is nullable.
* `update` requires at least one of `name` / `description` (zod `.refine`), and uses
  `COALESCE($1, name)` so omitted fields keep their value. Broadcasts `org:changed`.
* `delete` broadcasts `org:updated` (different event name for a delete).
  ⚠️ `delete` reads `response.locals.userId` instead of `userid` and therefore always
  returns `403`. See [KNOWN-ISSUES](./KNOWN-ISSUES.md#b5).

### 5.3 `/board`

| Method | Path | Auth | Body | Role | Success |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/create` | yes | `{ name, organizationId }` | admin | `201 { message: "board created" }` |
| `GET` | `/read` | yes | `?orgid=` | member | `200 { orgs: [...] }` |
| `PATCH` | `/update` | yes | `{ boardid, name }` | admin | `200 { message: "board updated" }` |
| `DELETE` | `/delete` | yes | `{ boardid }` | admin | `200 { message: "board deleted" }` |

* `read` returns board rows (`{ id, title, orginisationid }`) under the JSON key
  **`orgs`**, not `boards` — a copy-paste artefact the frontend will have to match.
  See [KNOWN-ISSUES](./KNOWN-ISSUES.md#c2).
* `update` / `delete` resolve the owning org by joining `boards → orgs → membership`, and
  reuse `rows[0].id` (the org id) as the `broadcastToOrg` target.
* All four broadcast `board:updated` to the org room.
* "no permission" is returned as `400`, and the validation message on all four is the
  copy-pasted `"invalid name or description"`.

### 5.4 `/section`

| Method | Path | Auth | Body | Role | Success |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/create` | yes | `{ name, boardId }` | admin | `201 { message: "section created" }` |
| `GET` | `/read` | yes | `?boardid=` | member | `200 { sections: [{ id, title, boardid }] }` |
| `PATCH` | `/update` | yes | `{ sectionid, name }` | admin | `200 { message: "section updated" }` |
| `DELETE` | `/delete` | yes | `{ sectionid }` | admin | `200 { message: "section deleted" }` |

* `create` broadcasts `section:changed`; `update` and `delete` broadcast
  `section:updated` — two names for one concern.
* `delete` will fail with a `500` (foreign-key violation) whenever the section still holds
  issues, because of `issues.sectionId ON DELETE RESTRICT`.
  See [KNOWN-ISSUES](./KNOWN-ISSUES.md#b6).
* `sections.title` is nullable in SQL but `createSection` requires a non-empty `name`.

### 5.5 `/issue`

| Method | Path | Auth | Body | Role | Success |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/create` | yes | `{ name, description?, sectionId, assignees?: number[] }` | admin | `201 { message: "issue created" }` |
| `GET` | `/read` | yes | `?sectionid=` | member | `200 { issues: [...] }` |
| `PATCH` | `/update` | yes | `{ Issueid, name?, description?, assignees? }` | admin | `200 { message: "issue updated" }` |
| `DELETE` | `/delete` | yes | `{ Issueid }` | admin | `200 { message: "issue deleted" }` |

Note the capitalised `Issueid` field name in `update` and `delete`, against `issueId` in
the (unrouted) move schema and `sectionId` / `sectionid` elsewhere.

**create** is fully transactional:
1. Permission join `sections → boards → membership` with `membership.role = 'admin'`
   folded into the `WHERE` clause; `403` if no row.
2. If `assignees` is non-empty, verify every id is a member of the same org —
   `SELECT user_id FROM membership WHERE org_id = $1 AND user_id = ANY($2::int[])` and
   compare `rowCount` to `assignees.length`; `400` otherwise.
3. Insert the issue, `RETURNING id`.
4. `INSERT INTO issues_mapping (userid, issueid) SELECT unnest($1::int[]), $2`.
5. `COMMIT`, then broadcast `issues:updated` with `{ sectionId }` to the board room.

Because the validation compares `rowCount` against `assignees.length`, a request that
repeats the same user id twice is rejected as invalid.

**read** aggregates assignees inline:

```sql
COALESCE(JSON_AGG(JSON_BUILD_OBJECT('id', users.id, 'email', users.email))
         FILTER (WHERE users.id IS NOT NULL), '[]') AS assignees
```

so each row is `{ id, title, description, sectionid, assignees: [{ id, email }] }`.
Only member-level access is required.

**update** validates assignees before opening its transaction, then inside the
transaction `COALESCE`-updates title/description and, when `assignees` is present,
deletes all `issues_mapping` rows for the issue and re-inserts the (re-validated) set.
Passing `assignees: []` therefore clears all assignees.
⚠️ The permission query references a table alias `section` that does not exist, so this
endpoint always returns `500`. See [KNOWN-ISSUES](./KNOWN-ISSUES.md#b7).

**delete** broadcasts `issues:moved` — the wrong event name for a deletion.
⚠️ Its permission query references `board.id` where the table is `boards`, so this
endpoint also always returns `500`. See [KNOWN-ISSUES](./KNOWN-ISSUES.md#b7).

**move** — `moveController` and the `moveIssue` schema (`{ newSectionId, issueId }`) are
fully implemented: admin check, then a query that resolves the current and target
section's `boardId`, rejecting a cross-board move (`403`), a no-op move (`400`), and a
missing issue/section (`404`); on success it updates `issues.sectionId` and broadcasts
`issues:moved` with both section ids. **It is never registered on the router**, so there
is no drag-and-drop endpoint. See [KNOWN-ISSUES](./KNOWN-ISSUES.md#b8).

### 5.6 `/comment`

| Method | Path | Auth | Body | Role | Success |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/create` | yes | `{ issueId, comment }` | member | `201 { message: "comment created" }` |
| `GET` | `/read` | yes | `?issueId=` | member | `200 { comments: [{ id, comment, userid }] }` |
| `PATCH` | `/update` | yes | `{ commentId, comment }` | author or admin | `200 { message: "comment updated" }` |
| `DELETE` | `/delete` | yes | `{ commentId }` | author or admin | `200 { message: "comment deleted" }` |

Comments are **flat** — the `comments` table has no parent pointer, matching the
"comments non recursive" note in the design wireframe.

`read` returns comments ordered by `id ASC` and exposes only the raw `userid`; it does
**not** join `users`, so the frontend has no email to display without a second lookup —
even though the wireframe shows each comment labelled with the author's email.

`update` and `delete` share a permission query that left-joins membership onto the
comment's org and returns `comment_user_id`, `role`, `board_id` and `issue_id`; `404` if
the comment does not exist or the caller is not in its org, `403` if the caller is neither
the author nor an admin. Both broadcast `comment:updated` with `{ issueId }` to the board
room.

These four routes were unprotected until 2026-09-28, which made all of them
non-functional; they now run behind `authMiddleware` like the rest.
See [KNOWN-ISSUES b1](./KNOWN-ISSUES.md#b1).

### 5.7 `/membership`

| Method | Path | Auth | Body | Role | Success |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/read` | yes | `?orgid=` | member | `200 { members: [{ id, email, role }] }` |
| `DELETE` | `/delete` | yes | `{ orgId }` | self | `200 { message: "left the org" }` |

`DELETE /membership/delete` is the **leave-organization** endpoint — it removes the
*caller*, not a named target. It refuses (`400`) if the caller is the org's last admin,
and `404` if the caller is not a member. On success it broadcasts `membership:updated` to
the org's admin room and sends `membership:removed` to the leaving user's own sockets.

Note the field-name inconsistency: `read` takes `orgid`, `delete` takes `orgId`.

**Implemented but unrouted** (see [KNOWN-ISSUES](./KNOWN-ISSUES.md#b8)):

* `changeRoleController` — `{ orgId, userId, role: 'admin' | 'member' }`. Admin-only,
  row-locked, short-circuits with `200 "user role unchanged"` when the role already
  matches, refuses to demote the final admin, broadcasts `membership:updated` to admins
  and `membership:role_changed` to the target user.
* `kickController` — `{ orgId, userId }`. Admin-only, row-locked, refuses to remove the
  final admin, `404` if the target is not a member, broadcasts `membership:updated` and
  `membership:removed`.

`membership/schema.ts` also imports an unused `positive` symbol alongside `z`. This is a
real zod v4 export, so it is dead code rather than a broken import.

### 5.8 `/invite`

| Method | Path | Auth | Body | Role | Success |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/create` | yes | `{ orgid, userEmail, role }` | admin | `201 { message: "invite created" }` |
| `GET` | `/received` | yes | — | self | `200 { invites: [{ id, org_id, name, description }] }` |
| `GET` | `/sent` | yes | `?orgid=` | admin | `200 { invites: [{ id, user_id, email }] }` |
| `POST` | `/accept` | yes | `{ inviteId }` | invitee | `200 { message: "invite accepted" }` |
| `DELETE` | `/delete` | yes | `{ inviteId }` | admin or invitee | `200 { message: "invite deleted" }` |

Invites target an **existing user by email** — there is no email-sending or
signup-by-invite-link flow. `create` checks, in order: caller is an admin (`403`), the
email resolves to a user (`404`), that user is not already a member (`400`), no invite
already exists (`400`), then inserts and notifies.

`accept` runs in a transaction: look up the invite scoped to `id` **and** `user_id`
(`404` if it isn't yours), insert `membership` with the role stored on the invite, delete
the invite, commit, then broadcast `invite:updated` to the org's admins. There is no
"decline" endpoint — declining is `DELETE /invite/delete`, whose permission query accepts
either an admin of the inviting org or the invitee themselves.

⚠️ `POST /invite/create` still returns `500` on every call: its duplicate-invite check
is invalid SQL *and* binds the wrong user id — [#b9](./KNOWN-ISSUES.md#b9). The other two
problems that used to stack up here are resolved: the router now has auth
([#b1](./KNOWN-ISSUES.md#b1)) and migration 002 is valid
([#b2](./KNOWN-ISSUES.md#b2)), though it still has to be run.

---

## 6. WebSocket layer

Source: `src/websocket/`. **This layer never runs** — see
[KNOWN-ISSUES](./KNOWN-ISSUES.md#b10). Everything below describes the code as written.

```
connection.ts   websocketServer(server) — attaches a WebSocketServer to an http.Server
router.ts       parses client frames and dispatches join/leave
rooms/          roomManager.ts — all in-memory room state and broadcast helpers
handlers/       board.ts, issue.ts, comment.ts — empty files (0 bytes)
server.ts       empty file (0 bytes)
```

### Connection lifecycle (`connection.ts`)

```ts
wss.on("connection", async (ws, request) => {
  const userid = await authWs(ws, request);   // JWT from the Authorization header
  addUserSocket(userid, ws);                   // not awaited
  ws.send("connected");
  ws.on("message", (data) => router(ws, userid, data));
  ws.on("close",   () => { removeSocket(ws); ws.send("connection closed"); });
  ws.on("error",   (error) => console.log(error));
});
```

Three things to know about this handler:

* Authentication reads the `Authorization` **header**, which browsers cannot set on a
  `WebSocket` handshake. A browser client would need the token moved to a query
  parameter or a `Sec-WebSocket-Protocol` value.
* `addUserSocket` is `async` (it queries the user's email) but is not awaited, so a frame
  arriving in that window is routed before `socketState` has an entry for the socket.
* `ws.send("connection closed")` runs inside the `close` handler, i.e. on an already
  closed socket.
* `ws.send("connected")` is a bare string, not JSON, unlike every other server frame.

### Room state (`rooms/roomManager.ts`)

Four in-memory maps plus a per-socket state record:

| Map | Shape | Purpose |
| --- | --- | --- |
| `orgs` | `Map<orgId, Set<WebSocket>>` | everyone viewing an org |
| `orgAdmins` | `Map<orgId, Set<WebSocket>>` | admins only, for membership/invite events |
| `boards` | `Map<boardId, Set<WebSocket>>` | everyone viewing a board |
| `users` | `Map<userId, Set<WebSocket>>` | all sockets of one user, for direct messages |
| `socketState` | `Map<WebSocket, { userId, email, orgs, adminOrgs, boards }>` | reverse index for cleanup |

`socketState` stores `orgs`, `adminOrgs` and `boards` as `number | null` — a single value
each — so **one socket can be in at most one org room and one board room at a time**.
`joinOrg` and `joinBoard` both call their `leave*` counterpart first to enforce this.

| Function | Behaviour |
| --- | --- |
| `addUserSocket(userId, ws)` | registers the socket under the user, looks up the email, seeds `socketState` |
| `joinOrg(orgId, ws, userId)` | **verifies membership via SQL**, leaves the previous org, joins `orgs`, and additionally joins `orgAdmins` when the role is `admin` |
| `leaveOrg(ws)` | removes from `orgs` and, if applicable, `orgAdmins`; deletes the room when it empties |
| `joinBoard(boardId, ws)` | leaves the previous board, joins `boards`, then broadcasts `liveMembers:changed` with the emails of everyone in that board |
| `leaveBoard(ws)` | removes from `boards` and re-broadcasts `liveMembers:changed` to whoever remains |
| `broadcastToOrg / broadcastToOrgAdmins / broadcastToBoard` | `ws.send(message)` to every socket in the room; no-op if the room does not exist |
| `sendToUser(userId, message)` | sends to every socket of one user |
| `removeSocket(ws)` | full teardown across all four maps, re-broadcasting `liveMembers:changed` if the board still has members |
| `removeUserSocket(userId)` | `removeSocket` for every socket of a user — **currently unused** |

⚠️ `joinBoard` performs **no authorization check** — it does not take a `userId` and never
verifies that the caller belongs to the board's organization. See
[KNOWN-ISSUES](./KNOWN-ISSUES.md#b11).

The maps are process-local, so this design assumes a single backend instance; running
more than one process would split the rooms.

### Client → server messages (`router.ts`)

Frames are JSON; invalid JSON gets `{"error":"invalid JSON"}` back.

| `type` | Extra fields | Effect |
| --- | --- | --- |
| `join:Org` | `orgId` | `joinOrg(orgId, ws, userId)` |
| `leave:Org` | `orgId` | `leaveOrg(ws)` — the `orgId` is required by the guard but ignored |
| `join:Board` | `boardId` | `joinBoard(boardId, ws)` |
| `leave:Board` | `boardId` | `leaveBoard(ws)` — `boardId` likewise ignored |
| anything else | — | `{"error":"unknown msg type"}` |

Missing `orgId` / `boardId` replies with the bare string `"invalid inputs"` rather than
JSON. The guards use truthiness, so an id of `0` is rejected — harmless here, since
`SERIAL` ids start at 1.

### Server → client events

Emitted from the HTTP controllers via the `broadcast*` helpers:

| Event | Room | Payload | Emitted by |
| --- | --- | --- | --- |
| `org:changed` | org | — | `PATCH /organization/update` |
| `org:updated` | org | `{ orgId }` | `DELETE /organization/delete` |
| `board:updated` | org | `{ organizationId }` | board create / update / delete |
| `section:changed` | board | `{ boardId }` | `POST /section/create` |
| `section:updated` | board | `{ boardId }` | section update / delete |
| `issues:updated` | board | `{ sectionId }` on create, `{ sectionid }` on update | issue create / update |
| `issues:moved` | board | `{ sectionidOne, sectionidTwo }` on move, `{ sectionid }` on delete | issue move / delete |
| `comment:updated` | board | `{ issueId }` | comment create / update / delete |
| `membership:updated` | org admins | — | role change / kick / leave |
| `membership:role_changed` | user | `{ orgId, role }` | role change |
| `membership:removed` | user | `{ orgId }` | kick / leave |
| `invite:updated` | org admins | `{ orgid }` on create, `{ orgId }` on accept/delete | invite create / accept / delete |
| `invite:recieved` | user | — | `POST /invite/create` (note the spelling) |
| `liveMembers:changed` | board | `{ members: [{ email }] }` | join / leave / disconnect |

The naming is not consistent — `:changed` vs `:updated` for the same concern, singular vs
plural resource names, `sectionId` vs `sectionid`, `orgId` vs `orgid`, and `invite:recieved`
is misspelled. A client has to match each string exactly. See
[KNOWN-ISSUES](./KNOWN-ISSUES.md#c3).
