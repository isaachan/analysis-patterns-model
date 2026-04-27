export const TOOLBAR_HEIGHT = 48;
export const SIDEBAR_WIDTH = 56;
export const RIGHT_SIDEBAR_WIDTH = 280;
export const STATUSBAR_HEIGHT = 28;

export const COLORS = {
  bgPrimary: '#f5f5f7',
  bgSecondary: '#ffffff',
  bgCanvas: '#e8e8ed',
  bgToolbar: 'rgba(255, 255, 255, 0.85)',
  bgSidebar: '#ffffff',

  borderPrimary: '#d2d2d7',
  borderSecondary: '#e5e5ea',

  textPrimary: '#1d1d1f',
  textSecondary: '#86868b',
  textTertiary: '#aeaeb2',

  accent: '#007aff',
  accentHover: '#0066d6',
  accentActive: '#0055b3',

  selection: '#007aff',
  hover: 'rgba(0, 122, 255, 0.1)',
  danger: '#ff3b30',
} as const;

export const SHADOWS = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.08)',
  md: '0 4px 12px rgba(0, 0, 0, 0.1)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.12)',
} as const;

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;
