# Shrija CG & Cornet — Manak Fill Extension

Gold Shark–style bridge: **Create Sheet** in Shrija Hallmark Suite publishes a fire-assay payload; this Chrome extension fills **BIS Manak Online → Fire Assaying Sheet**.

## Install (Chrome)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder: `tools/shrija-manak-extension`
4. Allow access to:
   - `https://shrija-web-software.vercel.app/*`
   - `https://huid.manakonline.in/*`

## Flow

1. QM Stock → CG WEIGHT — add unused CG1/CG2
2. Create Fire Assay → select **Purity** (BIS fields auto-fill)
3. Search jobs → **Fill Jobs**
4. Paste Job Card as `1_8080132061` (Lot 1), `2_…` (Lot 2), …
5. **Create Sheet** (payload saved + Manak tab opens)
6. Open the job’s **Fire Assaying Sheet** on Manak → extension fills Strip/CG weights
7. Review → Save (Initial / Cornet) → Submit For HUID

## Notes

- Manak DOM can change; filler is best-effort — always verify before Submit.
- Click the extension icon on a Manak tab to re-run fill.
- Payload key: `shrija-manak-fire-assay-sheet` (also copied to clipboard as JSON).
