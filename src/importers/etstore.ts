// ETstore (Shopify) order → normalized purchase lines. Pure: no Payload, no network.

export type EtstoreOrderFile = {
  store: string
  order: string
  orderGid: string
  placed: string
  totals: { subtotal: number; tax: number; shipping: number; paid: number }
  items: Array<{
    title: string
    etCode: string | null
    handle: string | null
    variantGid: string
    quantity: number
    lineTotalInr: number
  }>
}

export type ParsedLine = {
  sku: string
  title: string
  name: string
  handle: string | null
  variantId: string
  url: string | null
  quantity: number
  lineTotal: number
  package: string | null
  value: number | null
  unit: string | null
  category: string[]
}

export type ParsedOrder = {
  order: {
    orderNumber: string
    externalId: string
    orderedAt: string
    subtotal: number
    tax: number
    shipping: number
    total: number
  }
  lines: ParsedLine[]
  warnings: string[]
}

export const STORE_URL = 'https://etstore.in'

export const parseEtstoreOrder = (file: EtstoreOrderFile): ParsedOrder => {
  const warnings: string[] = []

  const lines = file.items.map((item): ParsedLine => {
    const variantNum = item.variantGid.split('/').pop()
    const sku = item.etCode ?? `variant-${variantNum}`
    if (!item.etCode) warnings.push(`No store code for "${item.title}" — using ${sku}`)

    const value = guessValue(item.title)
    return {
      sku,
      title: item.title,
      name: cleanTitle(item.title, item.etCode),
      handle: item.handle,
      variantId: item.variantGid,
      url: item.handle ? `${STORE_URL}/products/${item.handle}` : null,
      quantity: item.quantity,
      lineTotal: item.lineTotalInr,
      package: guessPackage(item.title),
      value: value?.value ?? null,
      unit: value?.unit ?? null,
      category: guessCategory(item.title),
    }
  })

  return {
    order: {
      orderNumber: file.order,
      externalId: file.orderGid,
      orderedAt: file.placed,
      subtotal: file.totals.subtotal,
      tax: file.totals.tax,
      shipping: file.totals.shipping,
      total: file.totals.paid,
    },
    lines,
    warnings,
  }
}

export const cleanTitle = (title: string, code: string | null) => {
  let name = title.trim()
  if (code && name.endsWith(code)) name = name.slice(0, -code.length)
  return name.replace(/\s+/g, ' ').trim()
}

const SI: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, k: 1e3, m: 1e6 }

// 10 * 1e-6 is 9.999999999999999e-6 in floats; trim the noise
const scale = (n: string, prefix?: string) =>
  Number((Number(n) * (prefix ? SI[prefix.toLowerCase()] : 1)).toPrecision(12))

export const guessValue = (title: string): { value: number; unit: string } | null => {
  const ohm = title.match(/(\d+(?:\.\d+)?)\s*([KM]?)\s*OHM\b/i)
  if (ohm) return { value: scale(ohm[1], ohm[2]), unit: 'Ω' }
  const farad = title.match(/(\d+(?:\.\d+)?)\s*([pnuµ])F\b/i)
  if (farad) return { value: scale(farad[1], farad[2]), unit: 'F' }
  const mah = title.match(/(\d+)\s*mAh\b/i)
  if (mah) return { value: Number(mah[1]), unit: 'mAh' }
  return null
}

const PACKAGES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/\bSOT-?23-(\d)\b/i, (m) => `SOT-23-${m[1]}`],
  [/\bSOT-?89(?:-3)?\b/i, () => 'SOT-89-3'],
  [/\bSOT-?23\b/i, () => 'SOT-23'],
  [/\bSOD-?123FL\b/i, () => 'SOD-123FL'],
  [/\bSOIC-?(\d+)\b/i, (m) => `SOIC-${m[1]}`],
  [/\bSOP-?(\d+)\b/i, (m) => `SOP-${m[1]}`],
  [/\bTO-?252\b|\bDPAK\b/i, () => 'TO-252'],
  [/\b(0402|0603|0805|1206)\b/, (m) => m[1]],
  [/\b5050\b/, () => '5050'],
]

export const guessPackage = (title: string): string | null => {
  for (const [re, fmt] of PACKAGES) {
    const m = title.match(re)
    if (m) return fmt(m)
  }
  return null
}

// First match wins, so specific rules go before broad ones
const CATEGORIES: Array<[RegExp, string[]]> = [
  [/\bPCB FOR\b|breakout board/i, ['Boards & modules', 'Breakout PCBs']],
  [/PROGRAMMER/i, ['Tools', 'Programmers']],
  [/SOLDER/i, ['Tools', 'Consumables']],
  [/THERMISTOR|PHOTO TRANSISTOR|IR RECEIVER/i, ['Sensors']],
  [/RESISTOR/i, ['Passives', 'Resistors']],
  [/CAPACITOR|MLCC/i, ['Passives', 'Capacitors']],
  [/\bLED\b|WS2812/i, ['Optoelectronics', 'LEDs']],
  [/DIODE/i, ['Discretes', 'Diodes']],
  [/MOSFET|TRANSISTOR/i, ['Discretes', 'Transistors']],
  [/REGULATOR|\bLDO\b|\bL?78[LM]?\d{2}/i, ['ICs', 'Voltage regulators']],
  [/MICRO ?CONTROLLER|RISC-V/i, ['ICs', 'Microcontrollers']],
  [/OP-?AMP/i, ['ICs', 'Op-amps']],
  [/CONNECTOR|SOCKET|\bUSB\b/i, ['Electromechanical', 'Connectors']],
  [/SWITCH|BUTTON/i, ['Electromechanical', 'Switches']],
  [/FUSE/i, ['Electromechanical', 'Fuse holders']],
  [/PUMP|MOTOR/i, ['Electromechanical', 'Motors & pumps']],
  [/BATTERY/i, ['Power', 'Batteries']],
  [/MODULE/i, ['Boards & modules', 'Modules']],
]

export const guessCategory = (title: string): string[] =>
  CATEGORIES.find(([re]) => re.test(title))?.[1] ?? ['Uncategorized']
