// Pure: turns "10k 0603 resistor" into structured filters.

export type ParsedQuery = {
  value?: { value: number; unit: string }
  package?: string
  sku?: string
  terms: string[]
}

const SI: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
}

const PACKAGE =
  /^(0201|0402|0603|0805|1206|1210|2512|5050|sot-?\d+(-\d)?|sod-?\w+|sop-?\d+|soic-?\d+|tssop-?\d+|qfn-?\d+|to-?\d+)$/i
const SKU = /^ET[A-Z]?\d{3,}$/i

const n = (s: string) => Number(s)

/** "10k" → 10000 Ω, "4k7" → 4700 Ω, "100nF" → 1e-7 F, "1200mah" → 1200 mAh */
export const parseValue = (token: string): ParsedQuery['value'] | null => {
  // 4k7, 2R2 style
  let m = token.match(/^(\d+)([kKMR])(\d+)$/)
  if (m) {
    const mult = m[2] === 'R' ? 1 : SI[m[2]]
    return { value: round(n(`${m[1]}.${m[3]}`) * mult), unit: 'Ω' }
  }

  m = token.match(/^(\d+(?:\.\d+)?)(mah)$/i)
  if (m) return { value: n(m[1]), unit: 'mAh' }

  m = token.match(/^(\d+(?:\.\d+)?)([pnuµmkKM]?)(f|h|v|a|w|hz|Ω|ohms?|r|e)?$/i)
  if (!m) return null
  const [, num, prefix, rawUnit] = m
  const unit = normalizeUnit(rawUnit)

  if (unit === null) {
    // bare number with an ohm-ish prefix: "10k", "1M"; bare numbers are not values
    if (!prefix || !['k', 'K', 'M'].includes(prefix)) return null
    return { value: round(n(num) * SI[prefix]), unit: 'Ω' }
  }
  // "m" is milli except in "1M"; case matters only for M/m
  const mult = prefix ? (SI[prefix] ?? SI[prefix.toLowerCase()]) : 1
  return { value: round(n(num) * mult), unit }
}

const normalizeUnit = (u?: string) => {
  if (!u) return null
  const l = u.toLowerCase()
  if (l === 'f') return 'F'
  if (l === 'h') return 'H'
  if (l === 'v') return 'V'
  if (l === 'a') return 'A'
  if (l === 'w') return 'W'
  if (l === 'hz') return 'Hz'
  return 'Ω' // Ω, ohm, ohms, r, e
}

const round = (x: number) => Number(x.toPrecision(12))

export const parseQuery = (q: string): ParsedQuery => {
  const result: ParsedQuery = { terms: [] }
  for (const token of q.trim().split(/\s+/).filter(Boolean)) {
    if (!result.sku && SKU.test(token)) {
      result.sku = token.toUpperCase()
      continue
    }
    if (!result.package && PACKAGE.test(token)) {
      result.package = token.toUpperCase().replace(/^(SOT|SOD|SOP|SOIC|TSSOP|QFN|TO)-?/, '$1-')
      continue
    }
    const value = !result.value && parseValue(token)
    if (value) {
      result.value = value
      continue
    }
    result.terms.push(token)
  }
  return result
}
