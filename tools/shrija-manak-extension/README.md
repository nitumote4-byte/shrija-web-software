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
2. **Cg Auto Fire Assay** → select **Purity** → **22 rows auto-created** (BIS fill)
3. Paste Job Card Nos: `1_127087789`, `2_127087793`, …
4. **Create Sheet** → saves payload for extension (does **not** open Chrome)
5. Open Manak yourself → Fire Assaying Sheet → **select Lot No** (e.g. `Lot 1:127087789`)
6. Extension matches that job/lot and auto-fills Strip + CG weights
7. Review → Save → Submit For HUID

## Notes

- Manak DOM can change; filler is best-effort — always verify before Submit.
- Click the extension icon on a Manak tab to re-run fill.
- Payload key: `shrija-manak-fire-assay-sheet` (also copied to clipboard as JSON).
