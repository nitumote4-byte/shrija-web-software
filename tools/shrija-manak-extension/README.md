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

## Fire Assaying Details = scan weights

Manak often **blocks manual typing** on M1 / Silver / Copper / Lead / M2 — balance sends **keyboard-wedge** digits.
Extension v2.0.4+ fills those fields with **scan simulation** (focus → digit key events → Enter), not only `.value =`.

Sampling (Sample Drawn / Button Weight) also uses the same scan-style set.