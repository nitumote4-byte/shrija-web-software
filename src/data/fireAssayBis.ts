/**
 * BIS / Gold Shark fire-assay defaults keyed by declared purity.
 * Values mirror Manak Fire Assaying Sheet + Gold Shark cornet sheet behaviour.
 */

export type BisPurityDefaults = {
  purity: string
  /** Strip silver (mg) — table Silver column */
  silverStrip: number
  /** Check-gold silver CG1 / CG2 (mg) */
  silverCg1: number
  silverCg2: number
  lead: number
  /** Typical sample-drawn / button weight (mg) seed */
  sampleDrawnSeed: number
}

const TABLE: Record<string, BisPurityDefaults> = {
  '999': {
    purity: '999',
    silverStrip: 407.0,
    silverCg1: 373.0,
    silverCg2: 372.8,
    lead: 4.0,
    sampleDrawnSeed: 300,
  },
  '916': {
    purity: '916',
    silverStrip: 373.3,
    silverCg1: 342.0,
    silverCg2: 341.8,
    lead: 4.0,
    sampleDrawnSeed: 330,
  },
  '750': {
    purity: '750',
    silverStrip: 373.6,
    silverCg1: 280.0,
    silverCg2: 279.8,
    lead: 4.0,
    // ~2×(150 / 0.750) + 3–6 mg unused → drawn band ≈ 403–406 with lot variation
    sampleDrawnSeed: 400,
  },
  '585': {
    purity: '585',
    silverStrip: 238.2,
    silverCg1: 218.0,
    silverCg2: 217.8,
    lead: 4.0,
    sampleDrawnSeed: 350,
  },
  '925': {
    purity: '925',
    silverStrip: 377.0,
    silverCg1: 345.5,
    silverCg2: 345.3,
    lead: 4.0,
    sampleDrawnSeed: 328,
  },
}

export function getBisDefaults(purity: string): BisPurityDefaults {
  if (TABLE[purity]) return TABLE[purity]
  const p = Number(purity)
  if (!Number.isFinite(p) || p <= 0) return TABLE['916']
  // Same inquartation ratio as the Gold Shark table (not a per-purity fineness fork).
  return {
    purity: String(p),
    silverStrip: Number((p * 0.4074).toFixed(1)),
    silverCg1: Number((p * 0.3733).toFixed(1)),
    silverCg2: Number((p * 0.3733 - 0.2).toFixed(1)),
    lead: 4.0,
    sampleDrawnSeed: Number((300 + Math.max(0, 1000 - p) * 0.16).toFixed(0)),
  }
}

/** Copper for check gold ≈ CG × (1000 − purity) / 1000 × 1.143 (Gold Shark 916 fit). */
export function copperForCg(cgWeight: number, purity: string): number {
  const p = Number(purity) || 916
  if (!cgWeight) return 0
  return Number((((cgWeight * (1000 - p)) / 1000) * 1.143).toFixed(3))
}

/** Cornet delta in mg: CG − WOTGCAA (Gold Shark). */
export function deltaMg(cg: number, wotgcaa: number): number {
  if (!cg || !wotgcaa) return 0
  return Number((cg - wotgcaa).toFixed(3))
}

/**
 * IS 1418 millesimal fineness from measured masses, with optional proof avgDelta.
 * F = (WOTGCAA + avgDelta) / SampleWeight × 1000
 * Declared purity (750 / 916 / …) is not an input and must not be substituted.
 * avgDelta is signed and applied exactly once here — never inside expectedWotgcaa.
 */
export function finenessPpt(sampleWeight: number, wotgcaa: number, avgDelta = 0): number {
  if (!sampleWeight || !wotgcaa) return 0
  return Number((((wotgcaa + avgDelta) / sampleWeight) * 1000).toFixed(3))
}

/**
 * Deterministic unused residual in the practical 3–6 mg handling band.
 * Not a hardcoded 3/4/5/6 — derived from sample-drawn + seed, then the
 * unused figure itself is always (drawn − recorded sample weights).
 */
export function handlingResidualMg(sampleDrawnMg: number, seed = 0): number {
  if (!(sampleDrawnMg > 10)) return 0
  const hashed = Math.abs(Math.round(sampleDrawnMg * 1000) + seed * 7919)
  const offset = hashed % 3001
  return Number((3 + offset / 1000).toFixed(3))
}

/**
 * Split sample-drawn into two strip M1 weights.
 * Leaves a small unused residual (3–6 mg) so the two strips are not an
 * exact mathematical partition of the received material.
 */
export function splitSampleWeights(sampleDrawnMg: number, seed = 0): [number, number] {
  const residual = handlingResidualMg(sampleDrawnMg, seed)
  const usable = Number((sampleDrawnMg - residual).toFixed(3))
  const half = usable / 2
  const a = Number((half + 0.12).toFixed(3))
  const b = Number((usable - a).toFixed(3))
  return [a, b]
}

/**
 * Deterministic u ∈ [0, 1) from Model C job-level seed parts.
 * Not Math.random — same inputs always yield the same u.
 * Assay F* is Job-level: purity + sheet + base job card (not lot / not pair).
 */
export function hash01(
  purityNumeric: number,
  sheetNumber: number,
  baseJobCardNumber: number,
): number {
  let h = 2166136261 >>> 0
  const mix = (n: number) => {
    const x = Number.isFinite(n) ? Math.trunc(n) : 0
    h ^= Math.imul(x, 16777619)
    h = Math.imul(h ^ (h >>> 13), 2246822519) >>> 0
    h = Math.imul(h ^ (h >>> 16), 3266489917) >>> 0
  }
  mix(purityNumeric)
  mix(sheetNumber)
  mix(baseJobCardNumber)
  return (h >>> 0) / 4294967296
}

export type AssaySeed = {
  sheetNumber: number
  /** Base Manak job number (e.g. 123 from 1_123 / 2_123). 0 = unassigned blank. */
  baseJobCardNumber: number
}

/**
 * Model C — controlled job-level simulated assay fineness F*.
 * Universal for every purity: scale = (1000 − P) / 250.
 * All lots of the same base job share one F* on a sheet.
 * Deterministic simulation only — not Gold Shark / not IS 1418 measurement.
 */
export function simulatedPairAssayFineness(
  purity: string,
  sheetNumber: number,
  baseJobCardNumber: number,
): number {
  const raw = Number(purity)
  const declared = Number.isFinite(raw) && raw > 0 ? raw : 916
  const scale = (1000 - declared) / 250
  const overageLow = 1.0 * scale
  const overageHigh = 11.0 * scale
  const u = hash01(declared, sheetNumber, baseJobCardNumber)
  const overage = overageLow + u * (overageHigh - overageLow)
  return Number((declared + overage).toFixed(6))
}

/**
 * Expected cornet weight from sample weight + assay fineness + jitter.
 * W = SampleWeight × F* / 1000 + jitter
 * When assayFineness is omitted, falls back to declared purity (call-site tests).
 * Proof avgDelta is NOT subtracted here — it is applied once in finenessPpt.
 * `avgDelta` is retained for call-site compatibility and ignored.
 */
export function expectedWotgcaa(
  sampleWeight: number,
  purity: string,
  avgDelta: number,
  jitter = 0,
  assayFineness?: number,
): number {
  void avgDelta
  const p =
    assayFineness != null && Number.isFinite(assayFineness)
      ? assayFineness
      : Number(purity) || 916
  const base = (sampleWeight * p) / 1000
  return Number((base + jitter).toFixed(3))
}

/** Create Sheet jitter for a job / request strip pair. */
export const JOB_PAIR_WOTGCAA_JITTER: [number, number] = [0.02, -0.01]

/** Create Sheet jitter for a blank lot pair (same ±0.02/0.01 magnitude family). */
export function blankLotWotgcaaJitter(lotNo: number): [number, number] {
  return [0.02 + (lotNo % 3) * 0.01, -0.01 - (lotNo % 2) * 0.01]
}

/**
 * Strip-pair auto-generation (Model C):
 * One job-level F* → WOTGCAA = SampleWeight × F* / 1000 + strip jitter
 * Fineness = (WOTGCAA + avgDelta) / SampleWeight × 1000 (avgDelta once)
 */
export function seedStripPairAssay(
  sw1: number,
  sw2: number,
  purity: string,
  avgDelta: number,
  jitter1 = JOB_PAIR_WOTGCAA_JITTER[0],
  jitter2 = JOB_PAIR_WOTGCAA_JITTER[1],
  seed: AssaySeed = { sheetNumber: 0, baseJobCardNumber: 0 },
): {
  wotgcaa1: number
  wotgcaa2: number
  fineness1: number
  fineness2: number
  fstar: number
} {
  const fstar = simulatedPairAssayFineness(
    purity,
    seed.sheetNumber,
    seed.baseJobCardNumber,
  )
  const wotgcaa1 = expectedWotgcaa(sw1, purity, avgDelta, jitter1, fstar)
  const wotgcaa2 = expectedWotgcaa(sw2, purity, avgDelta, jitter2, fstar)
  return {
    wotgcaa1,
    wotgcaa2,
    fineness1: finenessPpt(sw1, wotgcaa1, avgDelta),
    fineness2: finenessPpt(sw2, wotgcaa2, avgDelta),
    fstar,
  }
}

/**
 * Full Create Sheet pair seed: unused split + Model C WOTGCAA / fineness.
 * `kind: 'blank'` uses per-lot jitter; `'job'` uses 0.02 / −0.01.
 * F* uses baseJobCardNumber (job-level), not lotNo / pairIndex.
 */
export function autoGenerateJobPair(
  sampleDrawnMg: number,
  purity: string,
  avgDelta: number,
  lotNo: number,
  kind: 'job' | 'blank' = 'job',
  sheetNumber = 0,
  baseJobCardNumber = 0,
): {
  sampleDrawn: number
  sw1: number
  sw2: number
  unusedMg: number
  wotgcaa1: number
  wotgcaa2: number
  fineness1: number
  fineness2: number
  fstar: number
} {
  const [sw1, sw2] = splitSampleWeights(sampleDrawnMg, lotNo)
  const unusedMg = handlingResidualMg(sampleDrawnMg, lotNo)
  const [j1, j2] = kind === 'blank' ? blankLotWotgcaaJitter(lotNo) : JOB_PAIR_WOTGCAA_JITTER
  const seeded = seedStripPairAssay(sw1, sw2, purity, avgDelta, j1, j2, {
    sheetNumber,
    baseJobCardNumber,
  })
  return {
    sampleDrawn: sampleDrawnMg,
    sw1,
    sw2,
    unusedMg,
    ...seeded,
  }
}

/** Normalize request sample weight to mg for the sheet. */
export function sampleDrawnMgFromRequest(sampleWeight: number, purity: string): number {
  const bis = getBisDefaults(purity)
  if (!sampleWeight || sampleWeight <= 0) return bis.sampleDrawnSeed
  // QM often stores grams (0.350); Manak / Gold Shark use mg (~330)
  if (sampleWeight < 5) return Number((sampleWeight * 1000).toFixed(3))
  return Number(sampleWeight.toFixed(3))
}
