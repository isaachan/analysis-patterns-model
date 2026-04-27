/**
 * Cardinality notation rendering utilities.
 * Provides functions to compute path data for cardinality symbols
 * (crow's foot notation) at relation endpoints.
 *
 * Coordinate convention:
 *   - Origin (0,0) is the attachment point where the symbol meets the entity border.
 *   - +x direction is "forward" (away from the entity, toward the line).
 *   - The bar is drawn perpendicular to the forward direction (along the y axis).
 *   - The crow's foot (if any) opens in the +x direction.
 *   - The circle (if any) is on the -x side (toward the entity).
 */

import type { Cardinality } from '../models/diagram';

/** Dimensions of cardinality symbols in pixels */
const SYMBOL_SIZE = 15;

/** Line segment for cardinality symbol rendering */
export interface SymbolLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Optional circle element for zero variants */
export interface SymbolCircle {
  x: number;
  y: number;
  radius: number;
}

/** Return value from getCardinalitySymbol */
export interface CardinalitySymbol {
  lines: SymbolLine[];
  circle?: SymbolCircle;
}

/**
 * Get the line segments and optional circle for a cardinality symbol.
 *
 * @param cardinality - The cardinality type
 * @param _isSource - Whether this is the source end (affects orientation)
 * @returns Lines and optional circle describing the symbol
 */
export function getCardinalitySymbol(
  cardinality: Cardinality,
  _isSource?: boolean,
): CardinalitySymbol {
  const s = SYMBOL_SIZE;
  const sign = _isSource ? 1 : -1;

  switch (cardinality) {
    case 'exactly_one': {
      // Single short bar (perpendicular to the line)
      return {
        lines: [{ x1: 0, y1: -s / 2, x2: 0, y2: s / 2 }],
      };
    }
    case 'zero_or_one': {
      // Circle (on entity side) followed by a short bar
      return {
        lines: [{ x1: 0, y1: -s / 2, x2: 0, y2: s / 2 }],
        circle: { x: -sign * 5, y: 0, radius: 3 },
      };
    }
    case 'zero_or_many': {
      // Circle (on entity side) followed by bar and crow's foot
      return {
        lines: [
          { x1: 0, y1: -s / 2, x2: 0, y2: s / 2 },
          { x1: 0, y1: -s / 4, x2: sign * s / 2, y2: -s / 2 },
          { x1: 0, y1: -s / 4, x2: sign * s / 2, y2: s / 2 },
        ],
        circle: { x: -sign * 5, y: 0, radius: 3 },
      };
    }
    case 'one_or_many': {
      // Bar followed by crow's foot (three-pronged)
      return {
        lines: [
          { x1: 0, y1: -s / 2, x2: 0, y2: s / 2 },
          { x1: 0, y1: -s / 4, x2: sign * s / 2, y2: -s / 2 },
          { x1: 0, y1: -s / 4, x2: sign * s / 2, y2: s / 2 },
        ],
      };
    }
    default:
      return { lines: [] };
  }
}

export { SYMBOL_SIZE };
