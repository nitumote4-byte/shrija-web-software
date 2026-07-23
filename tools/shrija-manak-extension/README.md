# Shrija CG & Cornet — Manak Fill Extension v1.1

Fills **BIS Manak Online → Fire Assaying Sheet** from Shrija **Create Sheet**.

## Manak official steps (this extension follows)

1. **Sampling Details**
   - Sample Drawn Weight → **Save**
   - Button Weight → **Save**
2. **Fire Assaying Details**
   - Fill **M1**, Silver, Copper, Lead (Strip1 / Strip2 / C1 / C2)
   - Click **Save (Initial Weight)**
3. Wait until Manak **timing** completes (M2 unlocks)
4. Extension auto-fills **M2** (cornet) → **Save (Cornet Weight)**

## Install / update

1. `chrome://extensions` → Developer mode
2. **Load unpacked** → `tools/shrija-manak-extension`  
   (or **Reload** if already loaded — version **1.1.0**)
3. Allow `huid.manakonline.in` + Shrija Vercel

## App flow

1. Shrija: CG WEIGHT → Create Fire Assay → Purity → fill Job Cards → **Create Sheet**
2. Open Manak Fire Assaying Sheet yourself
3. Select **Lot No** (e.g. `Lot 1:104736831`)
4. Extension runs steps 1–2, then watches for M2 unlock
