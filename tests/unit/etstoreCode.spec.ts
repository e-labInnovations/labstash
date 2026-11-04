import { describe, expect, it } from 'vitest'

import { storeCode } from '@/lib/stores/etstore'

describe('ETstore store codes', () => {
  it('reads the ET code a title ends with', () => {
    expect(storeCode('12MM KAPTON Tape  ET7489', 'G7489')).toBe('ET7489')
    expect(storeCode('CH340G SOP16 UART ETA1208', 'A1208')).toBe('ETA1208')
  })

  it('accepts a bare code when it is the item’s SKU', () => {
    expect(storeCode('PS-6824DVB-6PN 24V 0.5A Plugin Push button Switches A2031', 'A2031')).toBe(
      'ETA2031',
    )
    expect(storeCode('CH32V003A4M6 SOP-16 RISC-V Microcontroller WCH A2076', 'a2076')).toBe(
      'ETA2076',
    )
  })

  it('does not guess when the trailing word is not the SKU', () => {
    expect(storeCode('LED strip 5050', 'G1234')).toBeNull()
    expect(storeCode('Switch A2031', null)).toBeNull()
  })
})
