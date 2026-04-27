/** Design system tokens for the model editor */

export const COLORS = {
  /** Canvas background */
  canvasBg: '#f5f5f7',
  /** Grid line color */
  gridLine: '#e8e8ed',
  /** Type node background */
  typeBg: '#ffffff',
  /** Type node border */
  typeBorder: '#0071e3',
  /** Type node header */
  typeHeader: '#0071e3',
  /** Type node text */
  typeText: '#1d1d1f',
  /** Relation line */
  relationLine: '#6e6e73',
  /** Selection highlight */
  selection: '#0071e3',
  /** Hover highlight */
  hover: '#0077ed',
  /** Note background */
  noteBg: '#fff9d6',
  /** Note border */
  noteBorder: '#ffd60a',
  /** Generalization border */
  generalizationBorder: '#30d158',
  /** Short semantic marker text */
  semanticText: '#515154',
  /** Long semantic note background */
  longNoteBg: '#fffbe6',
  /** Long semantic note border */
  longNoteBorder: '#d4b94e',
  /** Long semantic note fold */
  longNoteFold: '#e9d380',
  /** Constraint heading color */
  constraintColor: '#b36200',
  /** Derivation heading color */
  derivationColor: '#2f6bff',
  /** Note heading color (default/gray) */
  noteHeadingColor: '#515154',
  /** Dashed connector line color */
  connectorLine: '#515154',
} as const;

export const FONTS = {
  /** Default UI font */
  ui: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
  /** Monospace font for code/attributes */
  mono: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace',
} as const;
