# Frontend

React 19 single-page app built with Vite 8 and styled with Tailwind CSS v4.

- Workspace: `apps/frontend` (package name is **`my-app`**, not `frontend` — this is the
  name `turbo run <task> --filter` expects)
- Dev server: `bun run dev` → `http://localhost:5173`

---

## 1. Structure

```
apps/frontend/
├── index.html                Vite entry document (<div id="root">, /src/main.tsx)
├── vite.config.ts            plugins: @vitejs/plugin-react, @tailwindcss/vite
├── eslint.config.js          flat config: js + typescript-eslint + react-hooks + react-refresh
├── tsconfig.json             project references only
│   ├── tsconfig.app.json     src/**, DOM libs, strict-ish linting flags
│   └── tsconfig.node.json    vite.config.ts only
├── public/
│   ├── favicon.svg
│   └── icons.svg             sprite sheet (not referenced by any component yet)
└── src/
    ├── main.tsx              createRoot + <StrictMode>
    ├── index.css             @import "tailwindcss";
    ├── App.tsx               BrowserRouter + route table
    └── pages/
        ├── Auth/Auth.tsx     sign in / sign up  (built)
        ├── Dash/Dash.tsx     dashboard shell    (partially built)
        ├── Dash/cards.tsx    OrgCard, InviteCard (unused)
        ├── Org/Org.tsx       empty stub
        └── Board/Board.tsx   empty stub
```

Tailwind v4 is wired through the Vite plugin, so there is no `tailwind.config.js` and no
PostCSS config — `src/index.css` is a single `@import "tailwindcss";` and all styling is
utility classes inline in JSX. There is no design-token layer, no dark mode, and no
shared component library (`packages/ui` was deleted from the monorepo).

`tsconfig.app.json` enables `noUnusedLocals`, `noUnusedParameters` and
`erasableSyntaxOnly`. `tsc -b` currently passes with no errors.

---

## 2. Routing

`src/App.tsx`:

| Path | Element | Notes |
| --- | --- | --- |
| `/login` | `<Auth />` | sign in and sign up on one screen |
| `/dashboard` | `<Dash />` | org list / invite list tabs |
| `/org/:orgId` | `<Org />` | empty stub |
| `/org/:orgId/board/:boardId` | `<Board />` | empty stub |
| `*` | `<Navigate to="/login" replace />` | catch-all |

There is **no route guard** — `/dashboard` renders whether or not a token exists, and the
catch-all sends unknown paths to `/login` regardless of session state. There is no layout
route, no error boundary, and no 404 page.

---

## 3. Pages

### 3.1 `Auth` (`src/pages/Auth/Auth.tsx`)

The only page with behaviour. Local state: `login` (which mode), `email`, `password`,
`error`, `showPassword`.

* Renders one card that swaps its heading, subtitle, primary button and footer link based
  on `login`, plus a Show/Hide password toggle.
* `signin(email, password)` → `POST http://localhost:3000/auth/signin` with a JSON body.
  On a non-`ok` response it sets the message `"Login failed"`; on success it writes to
  `localStorage` under the key `token` and navigates to `/dashboard`.
* `signup(email, password)` → `POST http://localhost:3000/auth/signup`, then calls
  `signin` to obtain a token.
* The backend URL is hard-coded in both functions; there is no API client module and no
  `VITE_*` environment variable.

Known problems with this page (all in [KNOWN-ISSUES.md](./KNOWN-ISSUES.md)):

* The stored value is the whole response object, not `data.token`, so `localStorage`
  ends up holding the string `"[object Object]"` — [#f1](./KNOWN-ISSUES.md#f1).
* The backend registers sign-in as `GET`, so this `POST` gets a `404` — [#b4](./KNOWN-ISSUES.md#b4).
* The backend sends no CORS headers, so the browser blocks both calls anyway —
  [#f2](./KNOWN-ISSUES.md#f2).
* The email `<input>` has a visible label but the password `<input>` does not; neither is
  associated with its control via `htmlFor` / `id`.
* The controls are plain `<button>`s outside a `<form>`, so pressing Enter does not
  submit, and there is no loading / disabled state while a request is in flight.
* Client-side validation is absent — the 8-character minimum is only enforced server-side
  and surfaces as the generic `"Login failed"` / `"Signup failed"` text.

### 3.2 `Dash` (`src/pages/Dash/Dash.tsx`)

The dashboard **shell** from the wireframe, with no data behind it.

* Header: `Your orgs` / `Invites` tab buttons driven by a single `orgs` boolean, a search
  `<input>`, and a circular avatar button.
* Body: renders the literal placeholder text `orgs list` or `invites list`.
* No `fetch` calls — it never hits `GET /organization/read` or `GET /invite/received`.
* The search input is uncontrolled and filters nothing.
* The avatar loads `/profile.jpg`, which does not exist in `public/` — [#f3](./KNOWN-ISSUES.md#f3).
* The `Your orgs` button carries `border-b border-black` unconditionally, so it always
  shows an underline while `Invites` only gets one when active — the two tabs are styled
  asymmetrically.

### 3.3 `cards.tsx` (`src/pages/Dash/cards.tsx`)

Two functions, `OrgCard(name, description)` and `InviteCard(name, role)`, that return
JSX. They take **positional arguments rather than a props object**, so they cannot be used
as `<OrgCard name=... />`. Nothing imports them today, which is why `tsc` stays green.
See [#f4](./KNOWN-ISSUES.md#f4).

### 3.4 `Org` and `Board`

```tsx
export function Org()   { return <div></div>; }
export function Board() { return <div></div>; }
```

Both are empty placeholders. Neither reads its route params, fetches anything, or opens a
WebSocket. Screens 3 and 4 of the wireframe — the sidebar, the section columns, the issue
cards, and the issue-detail comment modal — are entirely unbuilt.

---

## 4. What is missing to make the frontend functional

Not defects so much as work not started yet, listed here so the gap is explicit:

| Area | Current state |
| --- | --- |
| API client | None — one hard-coded `fetch` per call site, in `Auth` only |
| Auth header | Nothing ever reads the stored token back or sends `Authorization` |
| Route protection | None; `/dashboard` is reachable logged out |
| Server state | No React Query / SWR / context; no caching, no loading or error states |
| WebSocket client | None — nothing connects to the `ws` layer or handles its events |
| Org page | Stub — needs board list, membership and invites views |
| Board page | Stub — needs sections, issue cards, assignee avatars, drag-and-drop |
| Issue detail | Stub — needs the modal and the flat comment thread |
| Search | Input exists on `Dash`, wired to nothing; no search endpoint exists server-side |
| Profile menu | Avatar button has no handler; no sign-out |
| Tests | None anywhere in the repo |

Two API-shape mismatches to design around when this work starts:

* `GET /board/read`, `/section/read`, `/issue/read`, `/comment/read`, `/membership/read`
  and `/invite/sent` all expect their parameters in a **request body on a `GET`**, which
  `fetch` cannot send. They need to become query parameters or `POST` before the frontend
  can call them — [#b3](./KNOWN-ISSUES.md#b3).
* `GET /comment/read` returns only `userid` per comment, but the wireframe labels each
  comment with the author's email. Either the query needs a join or the client needs the
  org member list to resolve ids — see [BACKEND.md § /comment](./BACKEND.md#56-comment).
