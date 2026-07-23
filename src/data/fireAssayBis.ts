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
    silverStrip: 305.5,
    silverCg1: 280.0,
    silverCg2: 279.8,
    lead: 4.0,
    sampleDrawnSeed: 340,
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
  return TABLE[purity] || TABLE['916']
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

export function finenessPpt(sampleWeight: number, wotgcaa: number): number {
  if (!sampleWeight || !wotgcaa) return 0
  return Number(((wotgcaa / sampleWeight) * 1000).toFixed(3))
}

/** Split sample-drawn into two strip M1 weights (slight asymmetry like Gold Shark). */
export function splitSampleWeights(sampleDrawnMg: number): [number, number] {
  const half = sampleDrawnMg / 2
  const a = Number((half + 0.12).toFixed(3))
  const b = Number((sampleDrawnMg - a).toFixed(3))
  return [a, b]
}

/** Expected cornet weight from sample weight + declared purity + avg delta. */
export function expectedWotgcaa(
  sampleWeight: number,
  purity: string,
  avgDelta: number,
  jitter = 0,
): number {
  const p = Number(purity) || 916
  const base = (sampleWeight * p) / 1000
  return Number((base - avgDelta + jitter).toFixed(3))
}

/** Normalize request sample weight to mg for the sheet. */
export function sampleDrawnMgFromRequest(sampleWeight: number, purity: string): number {
  const bis = getBisDefaults(purity)
  if (!sampleWeight || sampleWeight <= 0) return bis.sampleDrawnSeed
  // QM often stores grams (0.350); Manak / Gold Shark use mg (~330)
  if (sampleWeight < 5) return Number((sampleWeight * 1000).toFixed(3))
  return Number(sampleWeight.toFixed(3))
}
