# backend

Express API and websocket server for Blueline. Setup, endpoints and the
websocket protocol are documented in the [root README](../../README.md).

```bash
bun install
bun run migrate
bun run dev
```

Needs `PORT`, `DATABASE_URL` and `JWT_SECRET` in `apps/backend/.env`.
