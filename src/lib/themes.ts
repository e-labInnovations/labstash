// Lab themes: the solder mask colour carries the app's structure, so a theme is a board colour.
// The values live in app.css under [data-theme]; this list is what the lab settings offer.

export const THEMES = {
  green: { name: 'Green', swatch: '#1f5c46', bar: '#1f5c46' },
  blue: { name: 'Blue', swatch: '#1d4f91', bar: '#1d4f91' },
  purple: { name: 'Purple', swatch: '#5b2d82', bar: '#5b2d82' },
  red: { name: 'Red', swatch: '#9b2a24', bar: '#9b2a24' },
  black: { name: 'Black', swatch: '#232826', bar: '#232826' },
  white: { name: 'White', swatch: '#e9ecea', bar: '#f4f6f5' },
} as const

export type ThemeKey = keyof typeof THEMES

export const themeKey = (v: unknown): ThemeKey =>
  typeof v === 'string' && v in THEMES ? (v as ThemeKey) : 'green'
