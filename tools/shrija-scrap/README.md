# Shrija Scrap Tool

Local Windows agent (Gold Shark–style) that opens **Manak Online** in Chromium on **your PC**, lets you solve captcha, then returns pending AHC requests to Shrija Auto Request.

## Why local?

Manak has no public API. Cloud scrape from Railway is fragile. Gold Shark uses a desktop scrap `.exe` + MAC binding — this tool is Shrija’s equivalent.

## Setup (reception PC)

1. Install [Node.js 20+](https://nodejs.org/)
2. Open folder: `tools/shrija-scrap`
3. Double-click **`start.bat`** (first run installs packages + Chromium)
4. Leave the black window open — you should see `Listening: http://127.0.0.1:19876`
5. In Shrija → **Auto Request → Manak Settings**:
   - Save Manak username / password
   - Paste this PC’s **MAC** (shown in scrap tool window / health) into Allowed MACs
6. Click **Fetch Request** — Chromium opens Manak; enter captcha → Login; tool reads pending table

## API (localhost only)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Tool online + MAC |
| GET | `/mac` | MAC list |
| POST | `/fetch` | `{ username, password, baseUrl?, night?, allowedMacs? }` |

Port: **19876** (`SHRIJA_SCRAP_PORT` to change).

## Optional protocol

Edit path in `install-protocol.reg`, then import — enables `shrija-scrap://` links later.

## Notes

- Prefer **`/MANAK/AHCReceivingUIDJewellerRequest.do`** (Manak AHC receive / jeweller request). Detail URLs include base64 query params (`eRequestId`, `eCmlNo`, …); the tool discovers those links after login and opens them.
- One fetch at a time (browser lock).
- If login times out, solve captcha faster or raise `loginTimeoutSec`.
- If “no request table”, open Receiving UID Jeweller Request in Manak once, copy any list URL, and share it.
