# Blueline

A work tracker for small teams. An organisation owns boards, a board is a row of
bands, and work moves between bands. Anyone in the organisation can read
everything and comment; admins are the ones who create and move things. Changes
push over a websocket, so two people looking at the same board see the same
board.

Bun + Express + Postgres on the back, React + Vite + Tailwind on the front, in a
Turborepo workspace.

## Getting started

You need [Bun](https://bun.com) 1.3+ and a Postgres database. Neon works; so
does a local `postgres`.

```bash
git clone <your-remote> blueline
cd blueline
bun install
```

Create `apps/backend/.env`:

```bash
PORT=3000
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_SECRET=any-long-random-string
```

Run the migrations, then start both apps:

```bash
cd apps/backend && bun run migrate && cd ../..
bun run dev
```

That gives you the API on `:3000` and the web app on `:5173`. Open
http://localhost:5173, create an account, and make an organisation — you become
its admin.

The frontend talks to `http://localhost:3000` by default. Point it somewhere
else with `VITE_API_URL` in `apps/frontend/.env`:

```bash
VITE_API_URL=https://api.example.com
```

## How it fits together

```
apps/backend     Express API + websocket server, one folder per resource
apps/frontend    React SPA, one folder per route
```

The data model is four levels deep, plus people:

```
user ──┬── membership (admin | member) ──── org
       │                                     │
       └── invite ───────────────────────────┤
                                           board
                                             │
                                          section
                                             │
                                           issue ──┬── assignees
                                                   └── comments
```

Permissions come from one place: your `membership.role` in the organisation that
owns whatever you are touching. There is no per-board or per-issue permission.

## Using the API

Sign up, then sign in. Signup does not return a token, so it is always two
calls:

```ts
await fetch("http://localhost:3000/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "you@example.com", password: "at-least-8" }),
});

const response = await fetch("http://localhost:3000/auth/signin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "you@example.com", password: "at-least-8" }),
});

const { token } = await response.json();
```

The token goes in `Authorization` raw, with no `Bearer` prefix:

```ts
const orgs = await fetch("http://localhost:3000/organization/read", {
  headers: { Authorization: token },
}).then((r) => r.json());

// { orgs: [{ id: 3, name: "Harbour Works", description: "…", role: "admin" }] }
```

Reads take query parameters, writes take a JSON body. Reading a board means
reading its sections and then each section's issues:

```ts
const headers = { Authorization: token };

const { sections } = await fetch(
  `http://localhost:3000/section/read?boardid=${boardId}`,
  { headers },
).then((r) => r.json());

const board = await Promise.all(
  sections.map(async (section) => {
    const { issues } = await fetch(
      `http://localhost:3000/issue/read?sectionid=${section.id}`,
      { headers },
    ).then((r) => r.json());
    return { ...section, issues };
  }),
);
```

Creating an issue is one call, and every assignee has to be a member of the same
organisation or the whole thing rolls back:

```ts
await fetch("http://localhost:3000/issue/create", {
  method: "POST",
  headers: { Authorization: token, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Rebuild the export queue on durable storage",
    description: "In-memory queue loses everything on deploy.",
    sectionId: 2,
    assignees: [3, 4],
  }),
});
```

Moving an issue between bands is its own endpoint. Same board only:

```ts
await fetch("http://localhost:3000/issue/move", {
  method: "PATCH",
  headers: { Authorization: token, "Content-Type": "application/json" },
  body: JSON.stringify({ issueId: 7, newSectionId: 3 }),
});
```

Inviting somebody adds an invite for an account that **already exists** — there
is no email delivery and no signup-by-link. They see it on their own dashboard:

```ts
await fetch("http://localhost:3000/invite/create", {
  method: "POST",
  headers: { Authorization: token, "Content-Type": "application/json" },
  body: JSON.stringify({ orgid: 3, userEmail: "them@example.com", role: "member" }),
});
```

## Live updates

One socket per client. The token goes in the query string, because browsers
cannot set headers on a websocket handshake:

```ts
const socket = new WebSocket(
  `ws://localhost:3000/?token=${encodeURIComponent(token)}`,
);

socket.onopen = () => {
  socket.send(JSON.stringify({ type: "join:Org", orgId: 3 }));
  socket.send(JSON.stringify({ type: "join:Board", boardId: 1 }));
};

socket.onmessage = (event) => {
  const frame = JSON.parse(event.data);

  switch (frame.event) {
    case "issue:moved":
      refetchSection(frame.fromSectionId);
      refetchSection(frame.toSectionId);
      break;
    case "comment:updated":
      refetchComments(frame.issueId);
      break;
    case "liveMembers:changed":
      setPresent(frame.members); // [{ email }]
      break;
  }
};
```

Two things to keep in mind. Events are **signals, not data** — they carry ids and
you refetch. And a socket sits in at most one org room and one board room at a
time, so joining a new board leaves the old one. Watching two boards needs two
sockets.

A bad token closes the connection with code `1008` and reason `Unauthorized`.
There is no error frame; the close is the signal.

## Before you build against it

These are real and they will bite:

- **No create endpoint returns what it created.** No ids come back from any
  `POST`. Refetch after every write.
- **Field casing is inconsistent between modules.** `orgid`, `orgId` and
  `organizationId` all appear. `Issueid` carries a capital I on update and
  delete, but `issueId` on move. Copy from each endpoint rather than guessing.
- **Response keys are whatever Postgres lowercased them to**, including the
  misspelling: `orginisationid`, `sectionid`, `boardid`, `userid`.
- **Comments only give you `userid`.** Join against `/membership/read` yourself
  if you want author emails.
- **Sections have no position column** and come back unordered.
- **There is no search endpoint.** The web app filters what it already has.
- **Tokens never expire** and there is no logout endpoint. Clearing storage is
  the logout.
- Some error codes are surprising: a missing issue is `403`, a non-member
  editing a comment is `404`, and moving an issue onto the band it is already in
  is `400` rather than a no-op.

## Scripts

Run from the repository root:

| Command | What it does |
| --- | --- |
| `bun run dev` | Backend and frontend together, both watching |
| `bun run build` | Type-check and build both apps |
| `bun run lint` | ESLint (frontend only for now) |
| `bun run format` | Prettier over every `.ts`, `.tsx` and `.md` |

Backend-only, from `apps/backend`:

```bash
bun run migrate   # apply any unapplied .sql in migrations/
bun run dev       # API + websocket on :3000, watching
```

Migrations run in filename order and are recorded in a `migrations` table, so
each file runs once. Editing a file that has already been applied does nothing —
add a new one.

## Not done yet

- No refresh tokens or session expiry
- No password reset
- No file attachments on issues
- No per-board permissions
- Deleting a section that still holds issues fails on any database created
  before `issues.sectionId` gained its cascade. `001_base.sql` has
  `ON DELETE CASCADE` now, but the runner never replays an applied file, so
  older databases still carry `RESTRICT` and return a `500`. Fixing it takes a
  new migration that drops and re-adds the constraint.
