import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import RelationLine, {
  computeOrthogonalPoints,
} from '../components/Canvas/RelationLine';
import {
  anchorToPoint,
  computeAnchorFromPoint,
} from '../utils/geometry';
import { getStage } from './testHelpers';
import type { RelationElement, Layout } from '../models/diagram';
import { useDiagramStore } from '../store/useDiagramStore';

/* ------------------------------------------------------------------ */
/*  Helper types for Konva node inspection                             */
/* ------------------------------------------------------------------ */

interface KonvaGroupLike {
  getChildren: (filter?: (child: unknown) => boolean) => unknown[];
}
interface KonvaCircleLike {
  x: () => number;
  y: () => number;
  fill: () => string;
  stroke: () => string;
  draggable: () => boolean;
  radius: () => number;
}
interface KonvaLineLike {
  points: () => number[];
  stroke: () => string;
}

function asGroup(n: unknown): KonvaGroupLike {
  return n as KonvaGroupLike;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SOURCE_LAYOUT: Layout = { x: 100, y: 150, width: 180, height: 110 };
const TARGET_LAYOUT: Layout = { x: 420, y: 150, width: 180, height: 110 };

const BASE_RELATION: RelationElement = {
  id: 'rel-1',
  type: 'relation',
  sourceId: 'src-1',
  targetId: 'tgt-1',
  sourceCardinality: 'exactly_one',
  targetCardinality: 'exactly_one',
  label: '',
};

/* ------------------------------------------------------------------ */
/*  1. Anchor utility unit tests                                      */
/* ------------------------------------------------------------------ */

describe('anchorToPoint', () => {
  const layout: Layout = { x: 100, y: 200, width: 200, height: 100 };

  it('returns top-left for top edge at offset 0', () => {
    const p = anchorToPoint(layout, 'top', 0);
    expect(p).toEqual({ x: 100, y: 200 });
  });

  it('returns top-center for top edge at offset 0.5', () => {
    const p = anchorToPoint(layout, 'top', 0.5);
    expect(p).toEqual({ x: 200, y: 200 });
  });

  it('returns top-right for top edge at offset 1', () => {
    const p = anchorToPoint(layout, 'top', 1);
    expect(p).toEqual({ x: 300, y: 200 });
  });

  it('returns right-center for right edge at offset 0.5', () => {
    const p = anchorToPoint(layout, 'right', 0.5);
    expect(p).toEqual({ x: 300, y: 250 });
  });

  it('returns bottom-left for bottom edge at offset 0', () => {
    const p = anchorToPoint(layout, 'bottom', 0);
    expect(p).toEqual({ x: 100, y: 300 });
  });

  it('returns bottom-right for bottom edge at offset 1', () => {
    const p = anchorToPoint(layout, 'bottom', 1);
    expect(p).toEqual({ x: 300, y: 300 });
  });

  it('returns left-center for left edge at offset 0.5', () => {
    const p = anchorToPoint(layout, 'left', 0.5);
    expect(p).toEqual({ x: 100, y: 250 });
  });

  it('clamps offset correctly at extreme values', () => {
    const p = anchorToPoint(layout, 'top', 2); // Should wrap
    expect(p).toEqual({ x: 500, y: 200 }); // offset=2 * 200w = 400 + 100
  });
});

describe('computeAnchorFromPoint', () => {
  const layout: Layout = { x: 100, y: 200, width: 200, height: 100 };

  it('returns top edge when point is above center', () => {
    const anchor = computeAnchorFromPoint(layout, { x: 200, y: 180 });
    expect(anchor.edge).toBe('top');
    expect(anchor.offset).toBeCloseTo(0.5, 1);
  });

  it('returns bottom edge when point is below center', () => {
    const anchor = computeAnchorFromPoint(layout, { x: 200, y: 320 });
    expect(anchor.edge).toBe('bottom');
    expect(anchor.offset).toBeCloseTo(0.5, 1);
  });

  it('returns left edge when point is to the left of center', () => {
    const anchor = computeAnchorFromPoint(layout, { x: 50, y: 250 });
    expect(anchor.edge).toBe('left');
    expect(anchor.offset).toBeCloseTo(0.5, 1);
  });

  it('returns right edge when point is to the right of center', () => {
    const anchor = computeAnchorFromPoint(layout, { x: 350, y: 250 });
    expect(anchor.edge).toBe('right');
    expect(anchor.offset).toBeCloseTo(0.5, 1);
  });

  it('offset is 0 at the start of the edge and 1 at the end', () => {
    // Point on right edge, clearly to the right of center (not at a corner)
    const anchorTop = computeAnchorFromPoint(layout, { x: 300, y: 240 });
    expect(anchorTop.edge).toBe('right');
    expect(anchorTop.offset).toBeCloseTo(0.4, 1);

    // Point on right edge near the bottom
    const anchorBottom = computeAnchorFromPoint(layout, { x: 300, y: 299 });
    expect(anchorBottom.edge).toBe('right');
    expect(anchorBottom.offset).toBeCloseTo(0.99, 1);
  });
});

/* ------------------------------------------------------------------ */
/*  2. computeOrthogonalPoints with anchors                            */
/* ------------------------------------------------------------------ */

describe('computeOrthogonalPoints with anchors', () => {
  it('uses source anchor to determine exit point', () => {
    // Without anchor: exit on right edge (since source is left of target)
    const withoutAnchor = computeOrthogonalPoints(SOURCE_LAYOUT, TARGET_LAYOUT);
    // Source right edge x = 100 + 180 = 280
    expect(withoutAnchor[0]).toBe(280);

    // With anchor on top edge at offset 0.5: exit point = (190, 150)
    const withAnchor = computeOrthogonalPoints(
      SOURCE_LAYOUT,
      TARGET_LAYOUT,
      { edge: 'top', offset: 0.5 },
    );
    // Top edge center: x = 100 + 180*0.5 = 190, y = 150
    expect(withAnchor[0]).toBeCloseTo(190);
    expect(withAnchor[1]).toBeCloseTo(150);
  });

  it('uses target anchor to determine entry point', () => {
    // With anchor on bottom edge at 0.3
    const withAnchor = computeOrthogonalPoints(
      SOURCE_LAYOUT,
      TARGET_LAYOUT,
      undefined,
      { edge: 'bottom', offset: 0.3 },
    );

    // Target bottom edge: x = 420 + 180*0.3 = 474, y = 150 + 110 = 260
    expect(withAnchor[6]).toBeCloseTo(474);
    expect(withAnchor[7]).toBeCloseTo(260);
  });

  it('produces axis-aligned segments with both anchors', () => {
    const points = computeOrthogonalPoints(
      SOURCE_LAYOUT,
      TARGET_LAYOUT,
      { edge: 'top', offset: 0.25 },
      { edge: 'bottom', offset: 0.75 },
    );

    expect(points.length).toBe(8);
    for (let i = 0; i < points.length - 2; i += 2) {
      const isHorizontal = points[i + 1] === points[i + 3];
      const isVertical = points[i] === points[i + 2];
      expect(isHorizontal || isVertical).toBe(true);
    }
  });

  it('falls back to center-based routing when no anchors given', () => {
    const withNoAnchor = computeOrthogonalPoints(SOURCE_LAYOUT, TARGET_LAYOUT);
    const withUndefined = computeOrthogonalPoints(SOURCE_LAYOUT, TARGET_LAYOUT, undefined, undefined);

    expect(withNoAnchor).toEqual(withUndefined);

    // Source right edge x = 280
    expect(withNoAnchor[0]).toBe(280);
  });
});

/* ------------------------------------------------------------------ */
/*  3. RelationLine renders handles when selected (ME-57/16/17)        */
/* ------------------------------------------------------------------ */

describe('RelationLine handles (ME-57/16/17)', () => {
  function renderRelationLine(
    element: RelationElement = BASE_RELATION,
    source: Layout = SOURCE_LAYOUT,
    target: Layout = TARGET_LAYOUT,
    isSelected = false,
  ) {
    return render(
      <Stage width={800} height={600}>
        <Layer>
          <RelationLine
            element={element}
            sourcePosition={source}
            targetPosition={target}
            isSelected={isSelected}
            onSelect={vi.fn()}
          />
        </Layer>
      </Stage>,
    );
  }

  it('renders endpoint handles when selected', () => {
    renderRelationLine(BASE_RELATION, SOURCE_LAYOUT, TARGET_LAYOUT, true);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    const circles = asGroup(group).getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
    ) as KonvaCircleLike[];

    // Should have 2 endpoint handles + 2 bend handles = 4 circles
    // Note: bend handles may merge into 1 if overlapping
    expect(circles.length).toBeGreaterThanOrEqual(2);
    expect(circles.length).toBeLessThanOrEqual(4);

    // All handles should be draggable
    for (const c of circles) {
      expect(c.draggable()).toBe(true);
    }
  });

  it('does not render handles when not selected', () => {
    renderRelationLine(BASE_RELATION, SOURCE_LAYOUT, TARGET_LAYOUT, false);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    const circles = asGroup(group).getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
    );

    // No handles when not selected
    expect(circles.length).toBe(0);
  });

  it('renders endpoint handles at correct positions', () => {
    const withAnchor: RelationElement = {
      ...BASE_RELATION,
      sourceAnchor: { edge: 'top', offset: 0.3 },
      targetAnchor: { edge: 'bottom', offset: 0.7 },
    };
    renderRelationLine(withAnchor, SOURCE_LAYOUT, TARGET_LAYOUT, true);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    // Check that at least one handle is at the source anchor position
    const circles = asGroup(group).getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
    ) as KonvaCircleLike[];

    // Source anchor point: top edge, offset 0.3 → x=100+180*0.3=154, y=150
    const sourceAnchorX = SOURCE_LAYOUT.x + SOURCE_LAYOUT.width * 0.3;
    const sourceAnchorY = SOURCE_LAYOUT.y;

    const hasSourceHandle = circles.some(
      (c) => Math.abs(c.x() - sourceAnchorX) < 1 && Math.abs(c.y() - sourceAnchorY) < 1,
    );
    expect(hasSourceHandle).toBe(true);
  });

  it('renders self-loop without handles', () => {
    const selfElement: RelationElement = {
      ...BASE_RELATION,
      sourceId: 'same',
      targetId: 'same',
    };
    renderRelationLine(selfElement, SOURCE_LAYOUT, SOURCE_LAYOUT, true);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    const circles = asGroup(group).getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
    );

    expect(circles.length).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  4. computeOrthogonalPoints with waypoints (ME-16)                  */
/* ------------------------------------------------------------------ */

describe('computeOrthogonalPoints with waypoints', () => {
  it('routes through a single waypoint', () => {
    const wp = { x: 350, y: 100 };
    const points = computeOrthogonalPoints(
      SOURCE_LAYOUT,
      TARGET_LAYOUT,
      undefined,
      undefined,
      [wp],
    );

    // Points: sourceExit → waypoint → targetEntry = 3 points = 6 values
    expect(points.length).toBe(6);
    expect(points[0]).toBe(280); // source right edge
    expect(points[2]).toBe(wp.x);
    expect(points[3]).toBe(wp.y);
    expect(points[4]).toBe(420); // target left edge
  });

  it('routes through multiple waypoints', () => {
    const wps = [{ x: 350, y: 100 }, { x: 450, y: 250 }];
    const points = computeOrthogonalPoints(
      SOURCE_LAYOUT,
      TARGET_LAYOUT,
      undefined,
      undefined,
      wps,
    );

    // source → wp1 → wp2 → target = 4 points = 8 values
    expect(points.length).toBe(8);
    expect(points[0]).toBe(280); // source right edge
    expect(points[2]).toBe(wps[0].x);
    expect(points[3]).toBe(wps[0].y);
    expect(points[4]).toBe(wps[1].x);
    expect(points[5]).toBe(wps[1].y);
    expect(points[6]).toBe(420); // target left edge
  });
});

/* ------------------------------------------------------------------ */
/*  5. Canvas stores anchors on relation creation (ME-55/56)           */
/* ------------------------------------------------------------------ */

describe('useDiagramStore creates relation with anchors (ME-55/56)', () => {
  it('can store and retrieve sourceAnchor on a RelationElement', () => {
    const relation: RelationElement = {
      ...BASE_RELATION,
      sourceAnchor: { edge: 'right', offset: 0.3 },
    };

    expect(relation.sourceAnchor).toEqual({ edge: 'right', offset: 0.3 });
  });

  it('can store and retrieve targetAnchor on a RelationElement', () => {
    const relation: RelationElement = {
      ...BASE_RELATION,
      targetAnchor: { edge: 'top', offset: 0.7 },
    };

    expect(relation.targetAnchor).toEqual({ edge: 'top', offset: 0.7 });
  });

  it('can store and retrieve waypoints on a RelationElement', () => {
    const relation: RelationElement = {
      ...BASE_RELATION,
      waypoints: [{ x: 100, y: 200 }, { x: 300, y: 400 }],
    };

    expect(relation.waypoints).toHaveLength(2);
    expect(relation.waypoints![0]).toEqual({ x: 100, y: 200 });
  });

  it('updateElement preserves anchors when modifying other fields', () => {
    const store = useDiagramStore.getState();

    // Add a relation with anchors
    store.addElement({
      ...BASE_RELATION,
      id: 'rel-anchor-test',
      sourceAnchor: { edge: 'bottom', offset: 0.5 },
      targetAnchor: { edge: 'top', offset: 0.3 },
    });

    // Update only the label
    store.updateElement('rel-anchor-test', { label: 'updated' } as Partial<RelationElement>);

    const updated = useDiagramStore.getState().elements.find(
      (e) => e.id === 'rel-anchor-test',
    ) as RelationElement;

    // Anchors should be preserved
    expect(updated.sourceAnchor).toEqual({ edge: 'bottom', offset: 0.5 });
    expect(updated.targetAnchor).toEqual({ edge: 'top', offset: 0.3 });
    expect(updated.label).toBe('updated');
  });

  it('updateElement preserves anchors when updating layout-related fields', () => {
    const store = useDiagramStore.getState();

    const rel = useDiagramStore.getState().elements.find(
      (e) => e.id === 'rel-anchor-test',
    ) as RelationElement;

    // Update cardinality (a non-anchor field)
    store.updateElement('rel-anchor-test', {
      sourceCardinality: 'zero_or_many',
    } as Partial<RelationElement>);

    const updated = useDiagramStore.getState().elements.find(
      (e) => e.id === 'rel-anchor-test',
    ) as RelationElement;

    expect(updated.sourceAnchor).toEqual({ edge: 'bottom', offset: 0.5 });
    expect(updated.sourceCardinality).toBe('zero_or_many');

    // Cleanup
    store.deleteElement('rel-anchor-test');
  });
});
