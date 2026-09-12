# Deployment — Railway (API + Postgres) + Vercel (UI)

## Architecture

| Piece | Host | Notes |
|-------|------|--------|
| Frontend | **Vercel** | Vite React build; set `VITE_API_URL` |
| Backend | **Railway** | Express API in `/server` |
| Database | **Railway PostgreSQL** | `DATABASE_URL` auto-linked |

SQLite is no longer used. Schema is created automatically on API boot (`initDb`).

---

## 1. Railway — PostgreSQL + API

1. Create a Railway project.
2. **Add PostgreSQL** plugin → copy `DATABASE_URL`.
3. **New service** from this GitHub repo:
   - **Root Directory:** `server`
   - **Start Command:** `npm start`
4. Service **Variables**:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | From Postgres (Reference Variable) |
| `JWT_SECRET` | Long random string (e.g. `openssl rand -hex 32`) |
| `LICENSE_MASTER_SECRET` | Separate long random string for `/operator` and licence issue — **required**, not a JWT fallback |
| `CORS_ORIGIN` | `https://shrija-web-software.vercel.app` (comma-separate if multiple). **Required** in production; the API will not start without it. |
| `FRONTEND_URL` | `https://shrija-web-software.vercel.app` (password-reset links) |
| `MAIL_HOST` | `smtp.resend.com` |
| `MAIL_PORT` | `587` |
| `MAIL_USER` | `resend` |
| `MAIL_PASSWORD` | Resend API key (`re_...`) — Railway Variables only, never commit |
| `MAIL_FROM` | A **verified** Resend sender, e.g. `Shrija Hallmark Suite <noreply@yourdomain.com>` |
| `NODE_ENV` | `production` |

Forgot Password uses **Resend SMTP**. `MAIL_FROM` must be a domain/address verified in the Resend dashboard. Emails go to the centre **Company Profile** email. If that address is empty, the API still returns the generic success message and does not send mail. Schema for reset tokens is created automatically on API boot.

5. Deploy → open the public URL → `/api/health` should return `{ ok: true, ready: true, service: "shrija-api" }` in production.
6. Optional seed (Railway shell / one-off):

```bash
npm run seed
```

Creates **Centre A** → `qm_admin` plus a **one-time random password** printed in the seed output. Change it on first sign-in. Lab users are not created automatically.

---

## PostgreSQL backups (required before a paying customer)

Railway Postgres backups are **not configured in this repo**. In the Railway dashboard:

1. Open the PostgreSQL service → Backups (or Point-in-time recovery, depending on the plan).
2. Enable automatic backups with at least 7 days retention.
3. Run a restore drill once: create a throwaway project or restore to a staging instance, then confirm `store_docs` for a test centre is intact.

Manual dump from a linked database:

```bash
pg_dump "$DATABASE_URL" --format=custom --file shrija-$(date +%F).dump
```

Restore:

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" shrija-YYYY-MM-DD.dump
```

The in-app **Others → Backup** JSON export is not a substitute for `pg_dump`. Restore in the UI is admin-only and requires typing `RESTORE`.

---

## 2. Vercel — Frontend

1. Import the same repo on Vercel.
2. **Root Directory:** project root (not `server`).
3. Build: `npm run build` · Output: `dist` (see `vercel.json`).
4. Environment variable:

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | Railway API origin, e.g. `https://your-api.up.railway.app` (no trailing slash) |

5. Redeploy after setting env (Vite inlines `VITE_*` at build time).
6. Update Railway `CORS_ORIGIN` to the final Vercel URL if it changed.

### Licence system (Railway)

| Variable | Value |
|----------|--------|
| `LICENSE_MASTER_SECRET` | Strong secret used only to **issue** keys and open `/operator` |
| `JWT_SECRET` | Session tokens only. Do **not** reuse it as the licence master in production. |

- New centres get a **14-day trial**.
- Centre admin activates keys at `/license` or **Others → Licence**.
- Expired centres can still log in only to activate a new key; data APIs are blocked until then.

---

## 3. Local development

```bash
npm install
npm --prefix server install
# First time only, if server/.env does not exist:
#   copy server/.env.example → server/.env
npm run dev
```

Open **http://localhost:5173**. One command starts Docker Postgres, the API on port **8787**, and Vite on **5173** (strict — it will not fall back to 5174). Vite proxies `/api` → `http://127.0.0.1:8787` when `VITE_API_URL` is unset.

Optional seed (empty database only): `npm run seed` prints a one-time `qm_admin` password. Change it on first sign-in.

---

## Security checklist

- Passwords: **bcrypt** (`password_hash` column only)
- Auth: JWT with embedded `tenantId`
- Data routes: `WHERE tenant_id = JWT tenant`
- Login / register: **express-rate-limit** (30 / 15 min)
- Production: `JWT_SECRET` required
- Manak credentials: AES-GCM encrypted with key derived from `JWT_SECRET` (kv `manak_credentials`)

---

## Auto Request → Manak Online

1. Open **Auto Request → Manak Settings**.
2. Save AHC Manak username/password + optional **Allowed MAC(s)**.
3. On the reception PC run **`tools/shrija-scrap/start.bat`** (Shrija Scrap Tool — Gold Shark–style local agent).
4. When the pill shows **Scrap tool: Online**, click **Fetch Request** — Chromium opens Manak; enter captcha if needed.
5. Example PHP bridge (optional): `server/manak-bridge.example.php`.
6. **Demo Fetch** = sample rows only. **Cloud Fetch** = server-side fallback without local tool.

Scrap tool listens on `http://127.0.0.1:19876` only (see `tools/shrija-scrap/README.md`).