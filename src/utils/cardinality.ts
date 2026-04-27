export type Cardinality = '[1,1]' | '[0,1]' | '[1,*]' | '[0,*]';

export function parseCardinality(value: string): Cardinality {
  if (['[1,1]', '[0,1]', '[1,*]', '[0,*]'].includes(value)) {
    return value as Cardinality;
  }
  return '[1,1]';
}

export function isOptional(cardinality: Cardinality): boolean {
  return cardinality === '[0,1]' || cardinality === '[0,*]';
}

export function isMultiple(cardinality: Cardinality): boolean {
  return cardinality === '[1,*]' || cardinality === '[0,*]';
}

// ---------------------------------------------------------------------------
// Cardinality symbol geometry (for Konva rendering on relation lines)
// ---------------------------------------------------------------------------

/** A line segment definition, suitable for <Line> or <Path>. */
export interface BarDef {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A circle definition. */
export interface CircleDef {
  cx: number;
  cy: number;
  r: number;
}

/** All geometric primitives needed to draw a cardinality symbol. */
export interface CardinalityElements {
  bars: BarDef[];
  circles: CircleDef[];
  crowFootLines: BarDef[];
}

/**
 * Compute the geometric elements for a cardinality symbol at a given
 * attachment point on a relation line.
 *
 * @param cardinality - The cardinality type to render.
 * @param x           - Attachment point x (where the line meets the node edge).
 * @param y           - Attachment point y.
 * @param angle       - Direction of the line *pointing away from the node* (radians).
 * @param barHalfLen  - Half-length of the perpendicular bar (default 6).
 * @param circleRadius - Radius of the optional circle (default 4).
 * @param spacing     - Gap between stacked elements along the line (default 8).
 */
export function computeCardinalityElements(
  cardinality: Cardinality,
  x: number,
  y: number,
  angle: number,
  barHalfLen = 6,
  circleRadius = 4,
  spacing = 8,
): CardinalityElements {
  // Unit direction of the line (pointing away from the node)
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  // Perpendicular direction (rotate dir by +90°)
  const perpX = -dirY;
  const perpY = dirX;

  const bars: BarDef[] = [];
  const circles: CircleDef[] = [];
  const crowFootLines: BarDef[] = [];

  switch (cardinality) {
    case '[1,1]':
      // Bar at the attachment point
      bars.push({
        x1: x + perpX * barHalfLen,
        y1: y + perpY * barHalfLen,
        x2: x - perpX * barHalfLen,
        y2: y - perpY * barHalfLen,
      });
      break;

    case '[0,1]':
      // Circle on the line side, bar at the attachment point
      circles.push({
        cx: x - dirX * spacing,
        cy: y - dirY * spacing,
        r: circleRadius,
      });
      bars.push({
        x1: x + perpX * barHalfLen,
        y1: y + perpY * barHalfLen,
        x2: x - perpX * barHalfLen,
        y2: y - perpY * barHalfLen,
      });
      break;

    case '[1,*]':
      // Bar on the line side, crow's foot at the attachment point
      bars.push({
        x1: x + perpX * barHalfLen - dirX * spacing,
        y1: y + perpY * barHalfLen - dirY * spacing,
        x2: x - perpX * barHalfLen - dirX * spacing,
        y2: y - perpY * barHalfLen - dirY * spacing,
      });
      addCrowFoot(crowFootLines, x, y, angle, barHalfLen);
      break;

    case '[0,*]':
      // Circle on the line side, crow's foot at the attachment point
      circles.push({
        cx: x - dirX * spacing,
        cy: y - dirY * spacing,
        r: circleRadius,
      });
      addCrowFoot(crowFootLines, x, y, angle, barHalfLen);
      break;
  }

  return { bars, circles, crowFootLines };
}

/**
 * Append three fan-shaped crow's foot lines to `lines`.
 *
 * The fan sits on one side of the connecting line (determined by
 * `angle - π/2`) so that it is always clearly visible and does not
 * overlap the connecting line.
 */
function addCrowFoot(
  lines: BarDef[],
  x: number,
  y: number,
  angle: number,
  halfLen: number,
): void {
  // The "base" perpendicular direction (one side of the line)
  const perpBase = angle - Math.PI / 2;
  // Fan spread angle (22.5° each side)
  const spread = Math.PI / 8;
  // Slightly longer than the plain bar so the toes are visible
  const len = halfLen * 1.3;

  for (let i = -1; i <= 1; i++) {
    const theta = perpBase + i * spread;
    lines.push({
      x1: x,
      y1: y,
      x2: x + len * Math.cos(theta),
      y2: y + len * Math.sin(theta),
    });
  }
}
