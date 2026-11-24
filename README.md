# Skrifari

A headless, API-first, multi-site CMS. JavaScript only (ES modules + JSDoc), Fastify, MongoDB, Redis. Apache-2.0.
The admin UI will be built on [Athena UI](https://github.com/csabatibortoth/athena-ui) (MIT, a versioned npm dependency).

**Status: pre-release, milestone M1 (foundation) in progress.** See `LICENSE`, `NOTICE`, `TRADEMARKS.md`, `CONTRIBUTING.md`, `THIRD_PARTY_NOTICES.md`.

## Layout

```
apps/api        the API server (Fastify): config, database + migrations, Redis, health, OpenAPI
packages/       shared packages (later)
scripts/        check-dco.mjs (the DCO sign-off check used by CI)
```

## Develop

Needs Node.js 22 or later, MongoDB and Redis (for example from Docker).

```
npm install
cp .env.example .env        # development defaults work without edits; .env is never committed
npm run migrate             # applies the database migrations (idempotent)
npm run dev                 # http://127.0.0.1:3000/health  /ready  /openapi.json
npm run check               # lint + format check + tests (the migration test needs MongoDB at 127.0.0.1:27017)
```

Environment variables are loaded by your shell or process manager (the API does not read `.env` itself; use `node --env-file=.env` if you want that).

## Configuration fails closed

`NODE_ENV` unset means production. In production the API refuses to start unless `SKRIFARI_HOST`, `SKRIFARI_MONGODB_URI`, `SKRIFARI_REDIS_URL`
and `SKRIFARI_SESSION_SECRET` are set, and the secret is at least 32 characters and not a known placeholder. Development binds to `127.0.0.1` only.

## Endpoints

- `GET /health` liveness. `GET /ready` readiness (503 and which dependency is down, never why). `GET /openapi.json` the OpenAPI 3 document.

## Contributing

Commits need a DCO sign-off (`git commit -s`), see `CONTRIBUTING.md`.
