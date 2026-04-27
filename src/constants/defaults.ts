/** Default values for the model editor */

import type { DiagramState } from '../models/diagram';

/** Initial zoom level (100%) */
export const DEFAULT_ZOOM = 1.0;

/** Minimum zoom level */
export const MIN_ZOOM = 0.1;

/** Maximum zoom level */
export const MAX_ZOOM = 5.0;

/** Zoom step increment */
export const ZOOM_STEP = 0.1;

/** Canvas grid size in pixels */
export const GRID_SIZE = 20;

/** Maximum history stack size */
export const MAX_HISTORY = 100;

/** Auto-save debounce delay in milliseconds */
export const SAVE_DEBOUNCE_MS = 2000;

/** Maximum size of a single diagram file in bytes (500 KB) */
export const MAX_FILE_SIZE_BYTES = 500 * 1024;

/** LocalStorage key for persistence */
export const STORAGE_KEY = 'model-editor-current';

/** Default width for Type nodes */
export const TYPE_NODE_WIDTH = 180;

/** Minimum height for Type nodes */
export const TYPE_NODE_MIN_HEIGHT = 60;

/** Maximum width for Type nodes (prevents excessively wide nodes) */
export const TYPE_NODE_MAX_WIDTH = 400;

/**
 * Calculate a reasonable width for a Type node based on its name text length.
 *
 * Uses an approximation of ~9px per character at 13px bold font, plus padding
 * on both sides, clamped between the configured minimum and maximum widths.
 */
export function calcTypeNodeWidth(name: string): number {
  const CHAR_WIDTH = 9; // approximate px per char for bold 13px font
  const PADDING = 8;
  const estimatedWidth = name.length * CHAR_WIDTH + PADDING * 2;
  return Math.max(TYPE_NODE_WIDTH, Math.min(estimatedWidth, TYPE_NODE_MAX_WIDTH));
}

/** Default width for Generalization containers */
export const DEFAULT_GEN_WIDTH = 220;

/** Default height for Generalization containers */
export const DEFAULT_GEN_HEIGHT = 140;

/** Padding inside generalization containers (between border and children) */
export const GEN_PADDING = 20;

/** Header height for generalization containers */
export const GEN_HEADER_HEIGHT = 26;

/** Default width for Long Semantic notes */
export const DEFAULT_NOTE_WIDTH = 220;

/** Default height for Long Semantic notes */
export const DEFAULT_NOTE_HEIGHT = 100;

/** Minimum height for Long Semantic notes */
export const NOTE_MIN_HEIGHT = 80;

/** Maximum height for Long Semantic notes before internal scrolling */
export const NOTE_MAX_HEIGHT = 400;

/** Default empty diagram state */
export const EMPTY_DIAGRAM: DiagramState = {
  version: '1.0.0',
  metadata: {
    title: 'Untitled Diagram',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  elements: [],
};
