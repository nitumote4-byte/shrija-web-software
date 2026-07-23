# Shrija CG & Cornet — Manak Fill Extension v1.3

Fills **BIS Manak Online → Fire Assaying Sheet** from Shrija **Create Sheet**.

## Why "No Shrija sheet" happened

Shrija (Vercel) and Manak are **different websites**. Browser `localStorage` does **not** share between them. The extension must copy the sheet into `chrome.storage.local` on the Shrija tab, then Manak reads it.

If Create Sheet succeeded but Manak still says **No Shrija sheet**, the bridge script was not running on Shrija (old extension / wrong site access).

## Install / update (required after every code change)

1. Open `chrome://extensions`
2. Find **Shrija CG & Cornet** → **Reload** (version must show **1.3.0**)
3. Click **Details** → **Site access** → allow:
   - `https://*.vercel.app`
   - `https://huid.manakonline.in`
4. Open Shrija Create Fire Assay tab → refresh page
5. Click **Create Sheet** again
6. Bottom-left green badge must say: **Extension OK · Sheet … ready for Manak**
7. Open Manak Fire Assaying → hint should turn green: **Sheet FS-… · rows**

### Emergency fallback

On Manak, use **Load Sheet (paste JSON)** — Create Sheet already copies JSON to clipboard.

## Manak steps

1. Sampling: Sample Drawn → Save, Button Wt → Save  
2. M1 + Silver + Copper + Lead → Save (Initial Weight)  
3. Wait Manak timing (M2 unlock)  
4. M2 → Save (Cornet Weight)

## App flow

1. Shrija: CG WEIGHT → Create Fire Assay → Purity → Job Cards → **Create Sheet**
2. Confirm green **Extension OK** badge
3. Manak: select **Lot No** → **Shrija: Fill Fire Assay**
