// ── Theme tokens — Light app + Dark sidebar ───────────────────────
export const T = {
  // App background (light)
  appBg:     '#f5f6fa',
  cardBg:    '#ffffff',
  cardBg2:   '#f8f9fc',
  border:    '#e8eaf0',
  border2:   '#dde0ea',
  hover:     '#f0f2f8',

  // Sidebar (dark navy)
  sidebarBg:     '#1a1c2e',
  sidebarBg2:    '#13152a',
  sidebarBorder: '#2a2d45',
  sidebarText:   '#ffffff',
  sidebarSub:    '#8890b5',
  sidebarDim:    '#4a5070',
  sidebarHover:  '#252840',

  // Text (on light background)
  text:    '#1a1d35',
  textSub: '#6b7280',
  textDim: '#9ca3af',

  // Accent — mauve/burgundy (from reference image)
  accent:    '#8b3a5e',
  accentLight: '#f9eef3',
  accentMid:   '#d4789a',

  // Status
  green:     '#10b981',
  greenLight:'#ecfdf5',
  red:       '#ef4444',
  redLight:  '#fef2f2',
  yellow:    '#f59e0b',
  yellowLight:'#fffbeb',
  blue:      '#3b82f6',
  blueLight: '#eff6ff',

  // Misc
  r:  '10px',
  r2: '14px',
  shadow:  '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
  shadow2: '0 8px 32px rgba(0,0,0,0.12)',
} as const;
