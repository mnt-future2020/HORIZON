// Design system colors - Premium Athletic Dark palette
// Synced with web app CSS variables (index.css)
// Converted from HSL to hex for React Native

const Colors = {
  // Backgrounds — deeper, richer dark
  background: '#050a15',       // hsl(225, 86%, 3.8%) — deeper navy
  card: '#0c1525',             // hsl(224, 52%, 9.5%) — darker for depth
  cardHover: '#111d30',

  // Text
  foreground: '#f1f5f9',       // hsl(210, 40%, 98%)
  mutedForeground: '#7c93a8',  // hsl(215, 18%, 56%) — better contrast

  // Brand — richer emerald
  primary: '#10b981',          // hsl(160, 84%, 39.4%) — vibrant emerald
  primaryForeground: '#050a15',
  primaryLight: 'rgba(16, 185, 129, 0.12)',

  accent: '#8b5cf6',           // hsl(263, 70%, 62%) — brighter violet
  accentLight: 'rgba(139, 92, 246, 0.12)',

  // States — deeper for cleaner cards
  secondary: '#131f30',        // hsl(220, 38%, 13%) — deeper secondary
  muted: '#131f30',
  border: '#162032',           // hsl(220, 30%, 14%) — subtler borders
  input: '#162032',

  // Extended brand colors
  emerald: '#10b981',
  emeraldLight: 'rgba(16, 185, 129, 0.12)',
  rose: '#f43f5e',
  roseLight: 'rgba(244, 63, 94, 0.12)',
  indigo: '#6366f1',
  indigoLight: 'rgba(99, 102, 241, 0.12)',

  // Status colors
  destructive: '#f04444',
  destructiveLight: 'rgba(240, 68, 68, 0.12)',
  amber: '#f59e0b',
  amberLight: 'rgba(245, 158, 11, 0.12)',
  sky: '#38bdf8',
  skyLight: 'rgba(56, 189, 248, 0.12)',
  violet: '#8b5cf6',
  violetLight: 'rgba(139, 92, 246, 0.12)',
  cyan: '#22d3ee',
  cyanLight: 'rgba(34, 211, 238, 0.12)',
  orange: '#fb923c',
  orangeLight: 'rgba(251, 146, 60, 0.12)',
  slate: '#94a3b8',
  slateLight: 'rgba(148, 163, 184, 0.12)',

  // Tier colors
  tierDiamond: '#22d3ee',
  tierGold: '#f59e0b',
  tierSilver: '#94a3b8',
  tierBronze: '#fb923c',

  // Common
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export default Colors;
