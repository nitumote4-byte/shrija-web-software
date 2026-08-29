# Shrija → Manak AUTO Fill v2.2.2

## User flow (Phase 1 then Phase 2)

1. Shrija: **Create Sheet** (same Sheet No = overwrite)
2. Bottom-left green: **Extension OK · Sheet … · Phase 1 / Phase 2**
3. Open Manak Fire Assaying Sheet
4. Select **Lot No** (e.g. `Lot 1:104736831`)
5. Click **Auto FS-N — Phase 1**. Sets Sample Drawn (no field click), clicks its **Save**, waits for postback, sets Button Weight, clicks its **Save**, waits, then fills M1 / Silver / Copper / Lead. Does **not** fill M2. Does **not** click Save Initial Weight. Does **not** open a serial-port chooser.
6. Manually click **Save (Initial Weight)** on the portal, then complete BIS timing.
7. Click **Auto FS-N — Phase 2**. Fills M2 Strip 1/2 and C1/C2 for the **currently selected Job + Lot** (posted value, no field click). Does **not** click Save Cornet.
8. Manually click **Save (Cornet Weight)** on the portal.

## Install / update

1. `chrome://extensions` → **Reload** (must show **2.2.2**)
2. Site access: `*.vercel.app` + `huid.manakonline.in`

## Weight fields and the serial-port popup

Live Manak (`huid.manakonline.in`) uses **Web Serial** from **page JavaScript**. Clicking or activating a weight field while a user gesture is active (the Phase 1 / Phase 2 button) makes Chrome show:

`huid.manakonline.in wants to connect to a serial port`

The extension does **not** call `navigator.serial`. Keyboard-wedge simulation (`click` + `Enter` on the field) **is** what handed that gesture to the portal.

Automation therefore:

1. Waits until transient user activation expires (so `requestPort()` cannot open a chooser)
2. Sets the value on the input **without** `focus` / `click` / `Enter`
3. Clicks the existing **Save** next to Sample Drawn / Button Weight
4. Checks the value is still there after postback

It does **not** connect to a COM port and does **not** spoof a trusted hardware scan.
