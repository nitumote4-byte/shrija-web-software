# Shrija Assaying & Hallmarking Centre

Quality Manager web software for hallmarking centre operations — request intake, rough sheets, fire assay, billing, stock, touch assessments, and reports.

## Run locally

Requires **Docker Desktop** (local PostgreSQL).

```bash
npm install
npm --prefix server install
npm run dev
```

Then open **http://localhost:5173**.

`npm run dev` starts PostgreSQL, waits until the API and database are ready, then starts the UI on port **5173** (it will not silently move to 5174). First-time API env: copy `server/.env.example` to `server/.env` if that file is missing.

## Modules

- Manual / Auto Request
- Rough Sheet & Request Lists
- Billing & Print Job Card
- X-Ray Hallmark Sheet
- Fund / Expense Entry
- Add Party & New Category
- Create / View Fire Assay
- QM Stock & Lab Stock
- Touch Form & Touch Billing
- Reports & Others (backup / reset)

Data is stored in PostgreSQL (one JSON store document per centre). The Vite UI talks to the Express API; `npm run dev` starts Docker Postgres, the API, and the UI.

Production hosting is documented in `DEPLOY.md` (Vercel UI + Railway API/Postgres).
