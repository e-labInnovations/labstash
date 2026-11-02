import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  cleanTitle,
  guessCategory,
  guessPackage,
  guessValue,
  parseEtstoreOrder,
} from '@/importers/etstore'

const seed = JSON.parse(
  readFileSync(path.resolve(__dirname, '../fixtures/etstore-order-31860.json'), 'utf8'),
)

describe('parseEtstoreOrder (order #31860)', () => {
  const parsed = parseEtstoreOrder(seed)

  it('keeps every line and the order totals', () => {
    expect(parsed.lines).toHaveLength(72)
    expect(parsed.lines.reduce((s, l) => s + l.quantity, 0)).toBe(1188)
    expect(parsed.lines.reduce((s, l) => s + l.lineTotal, 0)).toBeCloseTo(1651.26, 2)
    expect(parsed.order).toMatchObject({
      orderNumber: '#31860',
      externalId: 'gid://shopify/Order/18992625516795',
      orderedAt: '2026-11-02T10:25:23Z',
      subtotal: 1399.38,
      tax: 251.88,
      shipping: 55,
      total: 1706.26,
    })
  })

  it('gives every line a unique sku', () => {
    const skus = parsed.lines.map((l) => l.sku)
    expect(new Set(skus).size).toBe(72)
  })

  it('falls back to the variant id when the store code is missing, with a warning', () => {
    const line = parsed.lines.find((l) => l.title.startsWith('PS-6824DVB'))!
    expect(line.sku).toBe('variant-46803458228475')
    expect(line.url).toBeNull()
    expect(parsed.warnings).toHaveLength(1)
    expect(parsed.warnings[0]).toContain('PS-6824DVB')
  })

  it('builds product urls from handles', () => {
    const line = parsed.lines.find((l) => l.sku === 'ET9233')!
    expect(line.url).toBe('https://etstore.in/products/e9233')
    expect(line.variantId).toBe('gid://shopify/ProductVariant/' + line.variantId.split('/').pop())
  })
})

describe('cleanTitle', () => {
  it('strips the trailing store code and extra spaces', () => {
    expect(cleanTitle('Micro USB 5pin SMD Female Connector Micro B  ET8201', 'ET8201')).toBe(
      'Micro USB 5pin SMD Female Connector Micro B',
    )
    expect(cleanTitle('PS-6824DVB-6PN 24V 0.5A Plugin Push button Switches A2031', null)).toBe(
      'PS-6824DVB-6PN 24V 0.5A Plugin Push button Switches A2031',
    )
  })
})

describe('guessValue', () => {
  it.each([
    ['4.7K OHM 0603 SMD RESISTOR 1/16W 4K7 472 5%', 4700, 'Ω'],
    ['1M OHM 0603 SMD RESISTOR 1/16W 5%', 1_000_000, 'Ω'],
    ['0 OHM 1206 SMD RESISTOR 0E 0R', 0, 'Ω'],
    ['330 OHM 0603 SMD RESISTOR 330R', 330, 'Ω'],
    ['4.7uF 0603 6.3V CL10A475KQ8NNNCSamsung X5R', 4.7e-6, 'F'],
    ['100NF 50V 0603 SMD Ceramic Capacitor 104', 100e-9, 'F'],
    ['470UF 35V SMD JWCO CAPACITOR ELECTROLYTIC', 470e-6, 'F'],
    ['10uF 6.3V SAMSUNG CL10A106MQ8NNNC X5R', 10e-6, 'F'],
    ['3.7V 1200mAh 18650 Li-ion Battery HONGLI', 1200, 'mAh'],
  ])('%s → %d %s', (title, value, unit) => {
    // exact equality: stored values must be clean for range queries
    expect(guessValue(title)).toEqual({ value, unit })
  })

  it('returns null when nothing matches', () => {
    expect(guessValue('LM358DT SOIC8 ST SMD op-amp')).toBeNull()
  })
})

describe('guessPackage', () => {
  it.each([
    ['10K OHM 0603 SMD RESISTOR', '0603'],
    ['BAT54C Diode Schottky FSC SOT23 0.2A', 'SOT-23'],
    ['ME6211C33M5G-N S2 SOT-23-5  3.3V MICRONE LDO', 'SOT-23-5'],
    ['A7 Diode hottech SMD 1A 1000V SOD-123FL', 'SOD-123FL'],
    ['LM358DT SOIC8 ST SMD op-amp', 'SOIC-8'],
    ['CH32V003J4M6 SOP8 RISC-V SMD WCH', 'SOP-8'],
    ['DOD4185 TO-252 DOINGTER 40V', 'TO-252'],
    ['Water Pump with dual Nozzle', null],
  ])('%s → %s', (title, pkg) => {
    expect(guessPackage(title)).toBe(pkg)
  })
})

describe('guessCategory', () => {
  it.each([
    ['10K OHM 0603 SMD RESISTOR', ['Passives', 'Resistors']],
    ['100NF 50V 0603 SMD Ceramic Capacitor', ['Passives', 'Capacitors']],
    ['CL10A105KO8NNNC 1uF 16V SAMSUNG X5R 10% 0603 MLCC SMD SMT', ['Passives', 'Capacitors']],
    [
      'PCB For CH32V003J4M6 WCH RISC Micro controller 8pin breakout board',
      ['Boards & modules', 'Breakout PCBs'],
    ],
    ['CH32V003J4M6 SOP8 RISC-V SMD WCH Micro controller', ['ICs', 'Microcontrollers']],
    ['Photo transistor 5MM PT333-3B IR receiver', ['Sensors']],
    ['L78M05CDT-TR DPAK TO252 smd ST 7805 5V 78M05 0.5A', ['ICs', 'Voltage regulators']],
    ['AO3401 A19T SOT23 SMD MOSFET P Channel', ['Discretes', 'Transistors']],
    ['0603 RED SMD LED COLOR', ['Optoelectronics', 'LEDs']],
    ['Water Pump with dual Nozzle Submersible Dc 3-6V', ['Electromechanical', 'Motors & pumps']],
    ['Mystery gadget', ['Uncategorized']],
  ])('%s', (title, cat) => {
    expect(guessCategory(title)).toEqual(cat)
  })
})
