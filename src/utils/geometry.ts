/**
 * Geometry calculation utilities for canvas rendering.
 * Handles intersection calculations, snapping, and distance computations.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate the intersection point of a line from the center of a rectangle
 * to the rectangle's border, in the direction of the target point.
 *
 * @param rect - The rectangle to intersect with
 * @param fromCenter - Center point of the source rectangle
 * @param toPoint - The target point (center of target rect)
 * @returns The intersection point on the rectangle border
 */
export function getRectBorderIntersection(
  rect: Rect,
  fromCenter: Point,
  toPoint: Point,
): Point {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  const dx = toPoint.x - fromCenter.x;
  const dy = toPoint.y - fromCenter.y;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const halfW = rect.width / 2;
  const halfH = rect.height / 2;

  // Compute intersection with bounding box
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let t: number;
  if (absDx * halfH > absDy * halfW) {
    // Intersects left or right edge
    t = halfW / absDx;
  } else {
    // Intersects top or bottom edge
    t = halfH / absDy;
  }

  return {
    x: cx + dx * t,
    y: cy + dy * t,
  };
}

/**
 * Snap a value to the nearest grid increment.
 *
 * @param value - The value to snap
 * @param gridSize - The grid size in pixels
 * @returns The snapped value
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize + 0;
}

/**
 * Calculate the Euclidean distance between two points.
 */
export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Check if a point is inside a rectangle.
 */
export function isPointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if two rectangles overlap (intersect).
 *
 * Returns true if the rectangles share any area, false if they are
 * completely separated in either the x or y axis.
 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Convert an Anchor (edge + offset) to an absolute point on a layout rectangle.
 */
export function anchorToPoint(
  layout: Rect,
  edge: 'top' | 'right' | 'bottom' | 'left',
  offset: number,
): Point {
  switch (edge) {
    case 'top':
      return { x: layout.x + offset * layout.width, y: layout.y };
    case 'right':
      return { x: layout.x + layout.width, y: layout.y + offset * layout.height };
    case 'bottom':
      return { x: layout.x + offset * layout.width, y: layout.y + layout.height };
    case 'left':
      return { x: layout.x, y: layout.y + offset * layout.height };
  }
}

/**
 * Given a layout rectangle and a point (e.g. cursor position), determine which
 * edge the point is nearest to and the normalized offset (0–1) along that edge.
 *
 * Uses the same angle-based logic as getRectBorderIntersection so that the
 * anchor stays consistent with the center-to-border ray.
 */
export function computeAnchorFromPoint(
  layout: Rect,
  point: Point,
): { edge: 'top' | 'right' | 'bottom' | 'left'; offset: number } {
  const cx = layout.x + layout.width / 2;
  const cy = layout.y + layout.height / 2;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let edge: 'top' | 'right' | 'bottom' | 'left';
  let offset: number;

  if (absDx * layout.height > absDy * layout.width) {
    // Intersects left or right edge
    edge = dx > 0 ? 'right' : 'left';
    offset = (point.y - layout.y) / layout.height;
  } else {
    // Intersects top or bottom edge
    edge = dy > 0 ? 'bottom' : 'top';
    offset = (point.x - layout.x) / layout.width;
  }

  return { edge, offset: Math.max(0, Math.min(1, offset)) };
}

/**
 * Compute an orthogonal connection path between two rectangles.
 * Returns an array of [x1,y1,x2,y2,x3,y3,x4,y4] for a 2-segment (L-shaped) path
 * from the source rectangle's border to the target rectangle's border.
 *
 * Path segments are axis-aligned (orthogonal), making it suitable for
 * generalization parent-to-container connection lines.
 */
export function computeOrthogonalConnection(
  fromLayout: Rect,
  toLayout: Rect,
): number[] {
  const fromCenter = {
    x: fromLayout.x + fromLayout.width / 2,
    y: fromLayout.y + fromLayout.height / 2,
  };
  const toCenter = {
    x: toLayout.x + toLayout.width / 2,
    y: toLayout.y + toLayout.height / 2,
  };

  const exit = getRectBorderIntersection(fromLayout, fromCenter, toCenter);
  const entry = getRectBorderIntersection(toLayout, toCenter, fromCenter);

  const dx = entry.x - exit.x;
  const dy = entry.y - exit.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    // More horizontal: go horizontal first, then vertical
    const midX = (exit.x + entry.x) / 2;
    return [exit.x, exit.y, midX, exit.y, midX, entry.y, entry.x, entry.y];
  } else {
    // More vertical: go vertical first, then horizontal
    const midY = (exit.y + entry.y) / 2;
    return [exit.x, exit.y, exit.x, midY, entry.x, midY, entry.x, entry.y];
  }
}

/**
 * Compute the bounding box of an array of rectangles, optionally including
 * padding on all sides.
 * Returns null for an empty array.
 */
export function computeBoundingBox(
  rects: Rect[],
  padding: number = 0,
): Rect | null {
  if (rects.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/**
 * Find a non-overlapping position for a rectangle near the desired position,
 * scanning in a spiral pattern.
 */
export function findNonOverlappingPosition(
  desiredRect: Rect,
  existingRects: Rect[],
  step: number = 40,
  maxAttempts: number = 100,
): Rect {
  // Check if the desired position is already non-overlapping
  const hasOverlap = existingRects.some((r) => rectsOverlap(desiredRect, r));
  if (!hasOverlap) return desiredRect;

  // Scan in a expanding pattern (right, down, left, up)
  const directions = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
  ];

  let attempt = 0;
  let offsetX = 0;
  let offsetY = 0;
  let directionIndex = 0;
  let segmentLength = 1;

  while (attempt < maxAttempts) {
    for (let i = 0; i < segmentLength; i++) {
      offsetX += directions[directionIndex].dx * step;
      offsetY += directions[directionIndex].dy * step;
      attempt++;

      const candidate = {
        ...desiredRect,
        x: desiredRect.x + offsetX,
        y: desiredRect.y + offsetY,
      };

      const overlaps = existingRects.some((r) => rectsOverlap(candidate, r));
      if (!overlaps) return candidate;

      if (attempt >= maxAttempts) break;
    }

    directionIndex = (directionIndex + 1) % 4;
    // Every two segments, increase the segment length (spiral pattern)
    if (directionIndex % 2 === 0) {
      segmentLength++;
    }
  }

  // Fallback: return desired rect offset by a large amount
  return {
    ...desiredRect,
    x: desiredRect.x + maxAttempts * step,
    y: desiredRect.y + maxAttempts * step,
  };
}
