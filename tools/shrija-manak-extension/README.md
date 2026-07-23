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
2. **Cg Auto Fire Assay** → select **Purity** (BIS fields auto-fill)
3. Set **No. of Rows** (default **22**) → **Create Sheet** / Fill Rows
4. Paste Job Card as `1_8080132061` (optional in app)
5. **Create Sheet does not open Chrome**
6. Open Manak yourself → open Fire Assaying Sheet → **select Lot No**
7. Extension fills Strip/CG weights for that lot → review → Save → Submit For HUID

## Notes

- Manak DOM can change; filler is best-effort — always verify before Submit.
- Click the extension icon on a Manak tab to re-run fill.
- Payload key: `shrija-manak-fire-assay-sheet` (also copied to clipboard as JSON).
