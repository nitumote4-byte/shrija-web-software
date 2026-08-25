# Shrija API

Express + **PostgreSQL** + JWT tenant isolation.

## Quick start (local)

From the **repo root** (not this folder):

```bash
npm install
npm --prefix server install
npm run dev
```

That starts Docker Postgres, this API on port 8787, and the UI on http://localhost:5173.

Optional empty-database seed: `npm run seed` (from repo root).

See [../DEPLOY.md](../DEPLOY.md) for Railway + Vercel.
