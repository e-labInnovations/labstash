const PREFIXES: Array<[number, string]> = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
]

// Units that read naturally with SI prefixes; others print as-is (1200 mAh, not 1.2 kmAh)
const PREFIXABLE = new Set(['Ω', 'F', 'H', 'V', 'A', 'W', 'Hz'])

/** 10000 Ω → "10 kΩ", 1e-7 F → "100 nF", 0 Ω → "0 Ω" */
export const formatValue = (value: number | null | undefined, unit: string | null | undefined) => {
  if (value == null) return null
  const u = unit ?? ''
  if (value === 0 || !PREFIXABLE.has(u)) return `${trim(value)} ${u}`.trim()
  const [scale, prefix] = PREFIXES.find(([s]) => Math.abs(value) >= s * 0.9999) ?? PREFIXES.at(-1)!
  return `${trim(value / scale)} ${prefix}${u}`
}

const trim = (n: number) => String(Number(n.toPrecision(4)))
