# Shrija → Manak AUTO Fill v2.0

## User flow (no Fill / Load buttons)

1. Shrija: **Create Sheet** (same Sheet No = overwrite)
2. Bottom-left green: **Extension OK · Sheet … ready**
3. Open Manak Fire Assaying Sheet
4. Bottom-right green: **AUTO · Sheet FS-… — Lot select karo**
5. Select **Lot No** (e.g. `Lot 1:104736831`)
6. Extension auto-fills Sample Drawn → Save → Button Weight → Save → M1/Silver/Copper/Lead → Save Initial → waits → M2 → Save Cornet

## Install / update

1. `chrome://extensions` → **Reload** (must show **2.0.0**)
2. Site access: `*.vercel.app` + `huid.manakonline.in`

## Test (local mock — no live Manak)

```bash
node tools/shrija-manak-extension/test/run-fill-test.mjs
```

Asserts Sample Drawn / Button / M1 / Silver and that Declared Purity stays `916`.
