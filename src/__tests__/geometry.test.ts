import { describe, it, expect } from 'vitest';
import { rectsOverlap, isPointInRect, snapToGrid, distance, getRectBorderIntersection, computeOrthogonalConnection, computeBoundingBox, findNonOverlappingPosition } from '../utils/geometry';
import type { Rect, Point } from '../utils/geometry';

/* ------------------------------------------------------------------ */
/*  rectsOverlap tests                                                 */
/* ------------------------------------------------------------------ */

describe('rectsOverlap', () => {
  const a: Rect = { x: 0, y: 0, width: 100, height: 100 };

  it('returns true when rectangles fully overlap (identical)', () => {
    expect(rectsOverlap(a, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
  });

  it('returns true when rectangles partially overlap', () => {
    expect(rectsOverlap(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(true);
  });

  it('returns true when one rect is inside the other', () => {
    expect(rectsOverlap(a, { x: 25, y: 25, width: 50, height: 50 })).toBe(true);
  });

  it('returns true when rectangles share an edge (touching)', () => {
    // Sharing right edge of a with left edge of b
    expect(rectsOverlap(a, { x: 100, y: 0, width: 50, height: 100 })).toBe(true);
  });

  it('returns false when rectangles are separated horizontally', () => {
    expect(rectsOverlap(a, { x: 200, y: 0, width: 50, height: 50 })).toBe(false);
  });

  it('returns false when rectangles are separated vertically', () => {
    expect(rectsOverlap(a, { x: 0, y: 200, width: 50, height: 50 })).toBe(false);
  });

  it('returns false when rectangles are separated both axes', () => {
    expect(rectsOverlap(a, { x: 200, y: 200, width: 50, height: 50 })).toBe(false);
  });

  it('handles zero-width rects (no overlap)', () => {
    expect(rectsOverlap(a, { x: 50, y: 0, width: 0, height: 100 })).toBe(true);
  });

  it('handles negative coordinates correctly', () => {
    expect(rectsOverlap(
      { x: -100, y: -100, width: 200, height: 200 },
      { x: -50, y: -50, width: 100, height: 100 },
    )).toBe(true);
    expect(rectsOverlap(
      { x: -100, y: -100, width: 50, height: 50 },
      { x: 0, y: 0, width: 50, height: 50 },
    )).toBe(false);
  });

  it('is symmetric (a overlaps b iff b overlaps a)', () => {
    const b: Rect = { x: 50, y: 50, width: 100, height: 100 };
    expect(rectsOverlap(a, b)).toBe(rectsOverlap(b, a));
  });
});

/* ------------------------------------------------------------------ */
/*  isPointInRect tests                                                */
/* ------------------------------------------------------------------ */

describe('isPointInRect', () => {
  const rect: Rect = { x: 10, y: 20, width: 100, height: 50 };

  it('returns true for a point inside the rect', () => {
    expect(isPointInRect({ x: 50, y: 40 }, rect)).toBe(true);
  });

  it('returns true for a point on the left edge', () => {
    expect(isPointInRect({ x: 10, y: 40 }, rect)).toBe(true);
  });

  it('returns true for a point on the top edge', () => {
    expect(isPointInRect({ x: 50, y: 20 }, rect)).toBe(true);
  });

  it('returns true for a point on the right edge', () => {
    expect(isPointInRect({ x: 110, y: 40 }, rect)).toBe(true);
  });

  it('returns true for a point on the bottom edge', () => {
    expect(isPointInRect({ x: 50, y: 70 }, rect)).toBe(true);
  });

  it('returns false for a point to the left', () => {
    expect(isPointInRect({ x: 5, y: 40 }, rect)).toBe(false);
  });

  it('returns false for a point above', () => {
    expect(isPointInRect({ x: 50, y: 10 }, rect)).toBe(false);
  });

  it('returns false for a point to the right', () => {
    expect(isPointInRect({ x: 150, y: 40 }, rect)).toBe(false);
  });

  it('returns false for a point below', () => {
    expect(isPointInRect({ x: 50, y: 80 }, rect)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  snapToGrid tests                                                   */
/* ------------------------------------------------------------------ */

describe('snapToGrid', () => {
  it('snaps to the nearest grid increment', () => {
    expect(snapToGrid(17, 20)).toBe(20);
    expect(snapToGrid(33, 20)).toBe(40);
    expect(snapToGrid(10, 20)).toBe(20);
    expect(snapToGrid(0, 20)).toBe(0);
    expect(snapToGrid(9, 20)).toBe(0);
  });

  it('handles negative values', () => {
    expect(snapToGrid(-5, 20)).toBe(0);
    expect(snapToGrid(-15, 20)).toBe(-20);
  });
});

/* ------------------------------------------------------------------ */
/*  distance tests                                                     */
/* ------------------------------------------------------------------ */

describe('distance', () => {
  it('calculates distance between two points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
  });

  it('returns 0 for identical points', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  getRectBorderIntersection tests                                    */
/* ------------------------------------------------------------------ */

describe('getRectBorderIntersection', () => {
  const rect: Rect = { x: 0, y: 0, width: 100, height: 100 };
  const center: Point = { x: 50, y: 50 };

  it('returns a point on the right edge when target is to the right', () => {
    const result = getRectBorderIntersection(rect, center, { x: 200, y: 50 });
    expect(result.x).toBe(100);
    expect(result.y).toBe(50);
  });

  it('returns a point on the left edge when target is to the left', () => {
    const result = getRectBorderIntersection(rect, center, { x: -100, y: 50 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(50);
  });

  it('returns a point on the top edge when target is above', () => {
    const result = getRectBorderIntersection(rect, center, { x: 50, y: -100 });
    expect(result.x).toBe(50);
    expect(result.y).toBe(0);
  });

  it('returns a point on the bottom edge when target is below', () => {
    const result = getRectBorderIntersection(rect, center, { x: 50, y: 200 });
    expect(result.x).toBe(50);
    expect(result.y).toBe(100);
  });

  it('returns center when source and target are the same', () => {
    const result = getRectBorderIntersection(rect, center, { x: 50, y: 50 });
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
  });
});

/* ------------------------------------------------------------------ */
/*  computeOrthogonalConnection tests                                  */
/* ------------------------------------------------------------------ */

describe('computeOrthogonalConnection', () => {
  const source: Rect = { x: 0, y: 0, width: 100, height: 60 };
  const target: Rect = { x: 300, y: 200, width: 200, height: 140 };

  it('returns 8 points (4 x,y pairs)', () => {
    const result = computeOrthogonalConnection(source, target);
    expect(result.length).toBe(8);
  });

  it('first point is on source rect border', () => {
    const result = computeOrthogonalConnection(source, target);
    expect(result[0]).toBeGreaterThanOrEqual(source.x);
    expect(result[0]).toBeLessThanOrEqual(source.x + source.width);
    expect(result[1]).toBeGreaterThanOrEqual(source.y);
    expect(result[1]).toBeLessThanOrEqual(source.y + source.height);
  });

  it('last point is on target rect border', () => {
    const result = computeOrthogonalConnection(source, target);
    const lastX = result[6];
    const lastY = result[7];
    expect(lastX).toBeGreaterThanOrEqual(target.x);
    expect(lastX).toBeLessThanOrEqual(target.x + target.width);
    expect(lastY).toBeGreaterThanOrEqual(target.y);
    expect(lastY).toBeLessThanOrEqual(target.y + target.height);
  });

  it('all segments are axis-aligned', () => {
    const result = computeOrthogonalConnection(source, target);
    for (let i = 0; i < result.length - 2; i += 2) {
      const isAxisAligned =
        result[i] === result[i + 2] || result[i + 1] === result[i + 3];
      expect(isAxisAligned).toBe(true);
    }
  });

  it('handles vertical connection (source above target)', () => {
    const topSource: Rect = { x: 50, y: 0, width: 100, height: 60 };
    const bottomTarget: Rect = { x: 50, y: 200, width: 100, height: 60 };
    const result = computeOrthogonalConnection(topSource, bottomTarget);
    expect(result[1]).toBeGreaterThanOrEqual(topSource.y);
    expect(result[7]).toBeLessThanOrEqual(bottomTarget.y + bottomTarget.height);
  });
});

/* ------------------------------------------------------------------ */
/*  computeBoundingBox tests                                           */
/* ------------------------------------------------------------------ */

describe('computeBoundingBox', () => {
  it('returns null for empty array', () => {
    expect(computeBoundingBox([])).toBeNull();
  });

  it('returns the rect itself for a single rect', () => {
    const rects: Rect[] = [{ x: 10, y: 20, width: 100, height: 50 }];
    const result = computeBoundingBox(rects);
    expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('computes bounding box of multiple rects', () => {
    const rects: Rect[] = [
      { x: 10, y: 20, width: 50, height: 30 },
      { x: 80, y: 60, width: 40, height: 20 },
    ];
    const result = computeBoundingBox(rects);
    expect(result).toEqual({ x: 10, y: 20, width: 110, height: 60 });
  });

  it('includes padding on all sides', () => {
    const rects: Rect[] = [{ x: 10, y: 20, width: 100, height: 50 }];
    const result = computeBoundingBox(rects, 10);
    expect(result).toEqual({ x: 0, y: 10, width: 120, height: 70 });
  });

  it('handles negative coordinates', () => {
    const rects: Rect[] = [
      { x: -50, y: -50, width: 100, height: 100 },
      { x: 0, y: 0, width: 50, height: 50 },
    ];
    const result = computeBoundingBox(rects);
    expect(result).toEqual({ x: -50, y: -50, width: 100, height: 100 });
  });
});

/* ------------------------------------------------------------------ */
/*  findNonOverlappingPosition tests                                   */
/* ------------------------------------------------------------------ */

describe('findNonOverlappingPosition', () => {
  const existing: Rect[] = [
    { x: 100, y: 100, width: 200, height: 150 },
  ];

  it('returns the same rect when no overlap', () => {
    const desired: Rect = { x: 400, y: 400, width: 220, height: 140 };
    const result = findNonOverlappingPosition(desired, existing);
    expect(result).toEqual(desired);
  });

  it('returns offset position when overlapping', () => {
    const desired: Rect = { x: 150, y: 150, width: 100, height: 80 };
    const result = findNonOverlappingPosition(desired, existing);
    expect(result.x).not.toBe(desired.x);
    expect(result.y).not.toBe(desired.y);
  });

  it('result does not overlap with any existing rect', () => {
    const desired: Rect = { x: 100, y: 100, width: 220, height: 140 };
    const result = findNonOverlappingPosition(desired, existing);
    const overlaps = existing.some((r) => rectsOverlap(result, r));
    expect(overlaps).toBe(false);
  });

  it('handles multiple existing rects', () => {
    const multipleExisting: Rect[] = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 150, y: 0, width: 100, height: 100 },
    ];
    const desired: Rect = { x: 50, y: 0, width: 150, height: 100 };
    const result = findNonOverlappingPosition(desired, multipleExisting);
    const overlaps = multipleExisting.some((r) => rectsOverlap(result, r));
    expect(overlaps).toBe(false);
  });

  it('works with empty existing rects', () => {
    const desired: Rect = { x: 50, y: 50, width: 220, height: 140 };
    const result = findNonOverlappingPosition(desired, []);
    expect(result).toEqual(desired);
  });

  it('avoids both container and parent type obstacles (ME-31/ME-32 scenario)', () => {
    const desired: Rect = { x: 100, y: 150, width: 220, height: 140 };
    const obstacles: Rect[] = [
      { x: 200, y: 300, width: 220, height: 140 }, // existing container
      { x: 100, y: 150, width: 180, height: 110 }, // parent type
    ];
    const result = findNonOverlappingPosition(desired, obstacles);
    const overlapsAny = obstacles.some((r) => rectsOverlap(result, r));
    expect(overlapsAny).toBe(false);
    // Result should preserve width and height
    expect(result.width).toBe(220);
    expect(result.height).toBe(140);
  });

  it('avoids three existing containers', () => {
    const desired: Rect = { x: 300, y: 300, width: 220, height: 140 };
    const obstacles: Rect[] = [
      { x: 0, y: 0, width: 200, height: 200 },
      { x: 250, y: 0, width: 200, height: 200 },
      { x: 500, y: 0, width: 200, height: 200 },
    ];
    const result = findNonOverlappingPosition(desired, obstacles);
    const overlapsAny = obstacles.some((r) => rectsOverlap(result, r));
    expect(overlapsAny).toBe(false);
  });
});
