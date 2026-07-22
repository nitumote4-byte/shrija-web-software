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
| `CORS_ORIGIN` | Your Vercel URL, e.g. `https://shrija.vercel.app` (comma-separate if multiple) |
| `NODE_ENV` | `production` |

5. Deploy → open the public URL → `/api/health` should return `{ ok: true, db: "postgres" }`.
6. Optional seed (Railway shell / one-off):

```bash
npm run seed
```

Creates **Centre A** → `qm_admin` / `admin123`.

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
| `LICENSE_MASTER_SECRET` | Strong secret used only to **issue** keys (Licence page → Issue keys) |
| `JWT_SECRET` | Already required; also fallback for master if `LICENSE_MASTER_SECRET` unset |

- New centres get a **14-day trial**.
- Centre admin activates keys at `/license` or **Others → Licence**.
- Expired centres can still log in only to activate a new key; data APIs are blocked until then.

---

## 3. Local development

```bash
# Postgres
docker compose up -d

# API
cd server
cp .env.example .env   # DATABASE_URL + JWT_SECRET + PGSSL=false
npm install
npm run seed
npm run dev

# UI (repo root)
cp .env.example .env.local   # leave VITE_API_URL empty to use Vite proxy
npm install
npm run dev
```

Vite proxies `/api` → `http://localhost:8787` when `VITE_API_URL` is unset.

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