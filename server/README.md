# Shrija API

Express + **PostgreSQL** + JWT tenant isolation.

## Quick start (local)

```bash
# from repo root
docker compose up -d
cd server
cp .env.example .env
npm install
npm run seed
npm run dev
```

See [../DEPLOY.md](../DEPLOY.md) for Railway + Vercel.
