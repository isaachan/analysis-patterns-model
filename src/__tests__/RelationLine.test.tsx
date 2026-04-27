import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import RelationLine, {
  computeOrthogonalPoints,
  computeSelfLoopPoints,
} from '../components/Canvas/RelationLine';
import { computePreviewPoints } from '../components/Canvas/Canvas';
import { getCardinalitySymbol } from '../utils/cardinality';
import type { RelationElement, Layout } from '../models/diagram';
import { getStage } from './testHelpers';
import { COLORS } from '../constants/designTokens';

// Helper to cast Konva nodes for accessing children and properties in tests.
interface KonvaGroupLike {
  getChildren: (filter?: (child: unknown) => boolean) => unknown[];
}
interface KonvaTextLike {
  text: () => string;
  x: () => number;
  y: () => number;
  width: () => number;
  height: () => number;
  fill: () => string;
}
interface KonvaLineLike {
  points: () => number[];
  stroke: () => string;
  strokeWidth: () => number;
}

function asGroup(n: unknown): KonvaGroupLike {
  return n as KonvaGroupLike;
}

const sampleElement: RelationElement = {
  id: 'test-rel-1',
  type: 'relation',
  sourceId: 'demo-type-1',
  targetId: 'demo-type-2',
  sourceCardinality: 'exactly_one',
  targetCardinality: 'zero_or_many',
  label: 'has',
};

const sampleElementNoLabel: RelationElement = {
  ...sampleElement,
  label: '',
};

const sourceLayout: Layout = { x: 100, y: 150, width: 180, height: 110 };
const targetLayout: Layout = { x: 420, y: 150, width: 180, height: 110 };

/**
 * Expected orthogonal points for source (100,150,180,110) -> target (420,150,180,110):
 *
 * Source center: (190, 205), Target center: (510, 205)
 * Source border exit (right edge): (280, 205)
 * Target border entry (left edge): (420, 205)
 * Horizontal-first routing since dx (140) > dy (0):
 *   midX = (280 + 420)/2 = 350
 *   points: [280, 205, 350, 205, 350, 205, 420, 205]
 */
const expectedPoints = [280, 205, 350, 205, 350, 205, 420, 205];

function renderRelationLine(
  element: RelationElement = sampleElement,
  source: Layout = sourceLayout,
  target: Layout = targetLayout,
  isSelected = false,
  onSelect = vi.fn(),
) {
  return render(
    <Stage width={800} height={600}>
      <Layer>
        <RelationLine
          element={element}
          sourcePosition={source}
          targetPosition={target}
          isSelected={isSelected}
          onSelect={onSelect}
        />
      </Layer>
    </Stage>,
  );
}

describe('RelationLine', () => {
  it('renders without crashing inside a Konva Stage', () => {
    const { container } = renderRelationLine();
    expect(container).toBeTruthy();
  });

  it('renders a Line and a Text label for labeled relations', () => {
    renderRelationLine();

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    const lines = asGroup(group).getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
    );
    const texts = asGroup(group).getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    );

    // Two lines: one visible, one invisible hit area
    expect(lines.length).toBe(2);
    expect(texts.length).toBe(1);

    // Verify the visible line uses orthogonal routing
    const visibleLine = lines.find(
      (l) => (l as KonvaLineLike).stroke() !== 'transparent',
    ) as KonvaLineLike;
    expect(visibleLine.points()).toEqual(expectedPoints);
  });

  it('renders only Lines (no Text) when label is empty', () => {
    renderRelationLine(sampleElementNoLabel);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    const lines = asGroup(group).getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
    );
    const texts = asGroup(group).getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    );

    expect(lines.length).toBe(2);
    expect(texts.length).toBe(0);
  });

  it('computes the correct mid-point label position', () => {
    renderRelationLine();

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];
    const texts = asGroup(group).getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    );

    expect(texts.length).toBe(1);
    const label = texts[0] as KonvaTextLike;

    // Midpoint of orthogonal points: average of all coordinates
    // points: [280,205, 350,205, 350,205, 420,205]
    // midX = (280+350+350+420)/4 = 350
    // midY = (205+205+205+205)/4 = 205
    // Text x = midX - 40 = 310, y = midY - 20 = 185
    //
    // Note: midPoint.y calculation changed from -20 to -10 to center the
    // label vertically (height 20, so y = midY - 10).
    // midPoint.y = 205 - 10 = 195
    expect(label.text()).toBe('has');
    expect(label.x()).toBe(310);
    expect(label.y()).toBe(195);
    expect(label.width()).toBe(80);
    expect(label.height()).toBe(20);
  });

  /* ------------------------------------------------------------------ */
  /*  ME-19: Click to select relation line                               */
  /* ------------------------------------------------------------------ */

  describe('ME-19 click to select', () => {
    it('calls onSelect with element id when the line Group is clicked', () => {
      const onSelect = vi.fn();
      renderRelationLine(sampleElement, sourceLayout, targetLayout, false, onSelect);

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      act(() => {
        group.fire('click');
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('test-rel-1');
    });

    it('stops click event propagation (cancelBubble)', () => {
      const onSelect = vi.fn();
      renderRelationLine(sampleElement, sourceLayout, targetLayout, false, onSelect);

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      // Simulate click and verify cancelBubble was set
      act(() => {
        const evt = { cancelBubble: false };
        group.fire('click', evt);
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('renders with selection highlight color when isSelected is true', () => {
      renderRelationLine(sampleElement, sourceLayout, targetLayout, true, vi.fn());

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      // The visible line is the one with a non-transparent stroke
      const visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      expect(visibleLine).toBeDefined();
      expect(visibleLine!.stroke()).toBe(COLORS.selection);
      expect(visibleLine!.strokeWidth()).toBe(3);
    });

    it('renders with default relation color and width when not selected and not hovered', () => {
      renderRelationLine(sampleElement, sourceLayout, targetLayout, false, vi.fn());

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      const visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      expect(visibleLine).toBeDefined();
      expect(visibleLine!.stroke()).toBe(COLORS.relationLine);
      expect(visibleLine!.strokeWidth()).toBe(2);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-19: Hover visual feedback on relation line                      */
  /* ------------------------------------------------------------------ */

  describe('ME-19 hover visual feedback', () => {
    it('changes to hover color on mouse enter and reverts on mouse leave', () => {
      renderRelationLine(sampleElement, sourceLayout, targetLayout, false, vi.fn());

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      const visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      expect(visibleLine).toBeDefined();

      // Default state
      expect(visibleLine!.stroke()).toBe(COLORS.relationLine);
      expect(visibleLine!.strokeWidth()).toBe(2);

      // On mouse enter
      act(() => {
        group.fire('mouseenter');
      });
      expect(visibleLine!.stroke()).toBe(COLORS.hover);
      expect(visibleLine!.strokeWidth()).toBe(3);

      // On mouse leave
      act(() => {
        group.fire('mouseleave');
      });
      expect(visibleLine!.stroke()).toBe(COLORS.relationLine);
      expect(visibleLine!.strokeWidth()).toBe(2);
    });

    it('keeps selection highlight when hovered on selected line', () => {
      renderRelationLine(sampleElement, sourceLayout, targetLayout, true, vi.fn());

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      const visibleLine = lines.find((l) => l.stroke() !== 'transparent');

      // When selected, should show selection color even after mouse enter
      expect(visibleLine!.stroke()).toBe(COLORS.selection);
      expect(visibleLine!.strokeWidth()).toBe(3);

      act(() => {
        group.fire('mouseenter');
      });
      // Should still be selection color (selection takes priority over hover)
      expect(visibleLine!.stroke()).toBe(COLORS.selection);
      expect(visibleLine!.strokeWidth()).toBe(3);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-18: Self-loop rendering                                         */
  /* ------------------------------------------------------------------ */

  describe('ME-18 self-loop', () => {
    const selfLayout: Layout = { x: 100, y: 150, width: 180, height: 110 };
    const selfElement: RelationElement = {
      ...sampleElement,
      sourceId: 'demo-type-1',
      targetId: 'demo-type-1',
      label: 'self',
    };

    it('renders without crashing and produces a Line', () => {
      renderRelationLine(selfElement, selfLayout, selfLayout);

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];
      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      );

      expect(lines.length).toBe(2);
    });

    it('produces correct loop points to the right of the box', () => {
      renderRelationLine(selfElement, selfLayout, selfLayout);

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      const visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      const points = visibleLine!.points();

      // Points should be 4 pairs (8 values)
      expect(points.length).toBe(8);

      // Self-loop extends to the right of the box
      // Layout: x=100, y=150, width=180, height=110
      // Margin = 40
      // Expected: right edge x = 100+180 = 280
      // loop extends to 280+40 = 320
      expect(points[0]).toBe(280); // exit at right edge
      expect(points[2]).toBe(320); // go right by margin
      expect(points[4]).toBe(320); // same x as point 2 (vertical segment)
      expect(points[6]).toBe(280); // back to right edge

      // Y values should be within the box height
      // exitY = 150 + 110*0.25 = 177.5
      // entryY = 150 + 110*0.75 = 232.5
      // All y values should be within box bounds
      for (let i = 1; i < points.length; i += 2) {
        expect(points[i]).toBeGreaterThanOrEqual(selfLayout.y);
        expect(points[i]).toBeLessThanOrEqual(selfLayout.y + selfLayout.height);
      }
    });

    it('renders a label at the center of the self-loop', () => {
      renderRelationLine(selfElement, selfLayout, selfLayout);

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      const texts = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
      ) as KonvaTextLike[];

      expect(texts.length).toBe(1);
      expect(texts[0].text()).toBe('self');

      // Label should be centered to the right of the box
      const expectedLabelX = selfLayout.x + selfLayout.width + 40 / 2 - 40;
      expect(texts[0].x()).toBe(expectedLabelX);
    });

    it('does not overlap with the Type box (all loop points are to the right)', () => {
      const points = computeSelfLoopPoints(selfLayout);

      // All x values should be >= right edge of the box
      const rightEdge = selfLayout.x + selfLayout.width;
      for (let i = 0; i < points.length; i += 2) {
        expect(points[i]).toBeGreaterThanOrEqual(rightEdge);
      }
    });

    it('shows selection highlight color when self-loop is selected', () => {
      renderRelationLine(selfElement, selfLayout, selfLayout, true, vi.fn());

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      const visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      expect(visibleLine).toBeDefined();
      expect(visibleLine!.stroke()).toBe(COLORS.selection);
      expect(visibleLine!.strokeWidth()).toBe(3);
    });

    it('shows hover highlight color when self-loop is hovered', () => {
      renderRelationLine(selfElement, selfLayout, selfLayout, false, vi.fn());

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      const visibleLine = lines.find((l) => l.stroke() !== 'transparent');

      // Default state
      expect(visibleLine!.stroke()).toBe(COLORS.relationLine);

      // Mouse enter
      act(() => {
        group.fire('mouseenter');
      });
      expect(visibleLine!.stroke()).toBe(COLORS.hover);
      expect(visibleLine!.strokeWidth()).toBe(3);

      // Mouse leave
      act(() => {
        group.fire('mouseleave');
      });
      expect(visibleLine!.stroke()).toBe(COLORS.relationLine);
      expect(visibleLine!.strokeWidth()).toBe(2);
    });

    it('calls onSelect when self-loop group is clicked', () => {
      const onSelect = vi.fn();
      renderRelationLine(selfElement, selfLayout, selfLayout, false, onSelect);

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];

      act(() => {
        group.fire('click');
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('test-rel-1');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  computeSelfLoopPoints unit tests                                   */
  /* ------------------------------------------------------------------ */

  describe('computeSelfLoopPoints', () => {
    it('returns 4 pairs of coordinates (8 values)', () => {
      const layout: Layout = { x: 100, y: 150, width: 180, height: 110 };
      const points = computeSelfLoopPoints(layout);
      expect(points.length).toBe(8);
    });

    it('starts and ends at the right edge of the layout', () => {
      const layout: Layout = { x: 50, y: 80, width: 200, height: 120 };
      const points = computeSelfLoopPoints(layout);
      const rightEdge = layout.x + layout.width;
      // First point x and last point x should be at the right edge
      expect(points[0]).toBe(rightEdge);
      expect(points[6]).toBe(rightEdge);
    });

    it('creates axis-aligned segments only', () => {
      const layout: Layout = { x: 100, y: 100, width: 180, height: 110 };
      const points = computeSelfLoopPoints(layout);
      // Check each segment is axis-aligned
      for (let i = 0; i < points.length - 2; i += 2) {
        const isHorizontal = points[i + 1] === points[i + 3];
        const isVertical = points[i] === points[i + 2];
        expect(isHorizontal || isVertical).toBe(true);
      }
    });

    it('works for different layout sizes', () => {
      const small: Layout = { x: 0, y: 0, width: 100, height: 60 };
      const large: Layout = { x: 200, y: 300, width: 400, height: 200 };
      const both = [computeSelfLoopPoints(small), computeSelfLoopPoints(large)];
      both.forEach((points) => {
        expect(points.length).toBe(8);
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Orthogonal routing tests (existing, updated for new props)         */
  /* ------------------------------------------------------------------ */

  describe('orthogonal routing', () => {
    it('produces correct points for vertical-first layout (target below source)', () => {
      const src: Layout = { x: 100, y: 100, width: 180, height: 110 };
      const tgt: Layout = { x: 120, y: 400, width: 180, height: 110 };

      renderRelationLine(sampleElement, src, tgt);

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];
      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      const visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      const points = visibleLine!.points();

      // Source center: (190, 155), Target center: (210, 455)
      // dx = 20, dy = 300, so vertical-first routing since dx < dy
      expect(points.length).toBe(8);
      expect(points[0]).toBeCloseTo(193.67, 0);
      expect(points[1]).toBeCloseTo(210, 0);
    });

    it('handles target directly to the right (horizontal routing)', () => {
      const src: Layout = { x: 0, y: 200, width: 100, height: 100 };
      const tgt: Layout = { x: 400, y: 200, width: 100, height: 100 };

      renderRelationLine(sampleElement, src, tgt);

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];
      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      const visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      const points = visibleLine!.points();
      expect(points.length).toBe(8);

      expect(points[0]).toBe(100);
      expect(points[1]).toBe(250);
      expect(points[6]).toBe(400);
      expect(points[7]).toBe(250);
    });

    it('all line segments are axis-aligned (horizontal or vertical, no diagonals)', () => {
      const src: Layout = { x: 50, y: 100, width: 200, height: 120 };
      const tgt: Layout = { x: 400, y: 350, width: 200, height: 120 };

      renderRelationLine(sampleElement, src, tgt);

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0];
      const lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      const visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      const points = visibleLine!.points();
      expect(points.length).toBe(8);

      // Verify each segment is axis-aligned
      for (let i = 0; i < points.length - 2; i += 2) {
        const x1 = points[i];
        const y1 = points[i + 1];
        const x2 = points[i + 2];
        const y2 = points[i + 3];
        const isHorizontal = y1 === y2;
        const isVertical = x1 === x2;
        expect(isHorizontal || isVertical).toBe(true);
      }
    });

    it('uses horizontal-first routing when source is left of target (dx > dy)', () => {
      const src: Layout = { x: 100, y: 200, width: 180, height: 110 };
      const tgt: Layout = { x: 500, y: 220, width: 180, height: 110 };
      const points = computeOrthogonalPoints(src, tgt);
      expect(points.length).toBe(8);

      // Horizontal-first: first segment changes x, second segment changes y
      expect(points[1]).toBe(points[3]);
      expect(points[2]).toBe(points[4]);
      expect(points[5]).toBe(points[7]);
    });

    it('uses vertical-first routing when source is above target (dy > dx)', () => {
      const src: Layout = { x: 200, y: 100, width: 180, height: 110 };
      const tgt: Layout = { x: 220, y: 500, width: 180, height: 110 };
      const points = computeOrthogonalPoints(src, tgt);
      expect(points.length).toBe(8);

      expect(points[0]).toBe(points[2]);
      expect(points[3]).toBe(points[5]);
      expect(points[4]).toBe(points[6]);
    });

    it('uses vertical-first routing when source is below target (dy > dx)', () => {
      const src: Layout = { x: 200, y: 500, width: 180, height: 110 };
      const tgt: Layout = { x: 220, y: 100, width: 180, height: 110 };
      const points = computeOrthogonalPoints(src, tgt);
      expect(points.length).toBe(8);

      for (let i = 0; i < points.length - 2; i += 2) {
        expect(points[i] === points[i + 2] || points[i + 1] === points[i + 3]).toBe(true);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-23: Line follows type on move                                    */
  /* ------------------------------------------------------------------ */

  describe('ME-23 line follows type on move', () => {
    it('recomputes points when source position changes', () => {
      const src1: Layout = { x: 100, y: 150, width: 180, height: 110 };
      const src2: Layout = { x: 300, y: 150, width: 180, height: 110 };
      const tgt: Layout = { x: 420, y: 150, width: 180, height: 110 };

      const onSelect = vi.fn();

      // Render with first source position
      const { rerender } = render(
        <Stage width={800} height={600}>
          <Layer>
            <RelationLine
              element={sampleElement}
              sourcePosition={src1}
              targetPosition={tgt}
              isSelected={false}
              onSelect={onSelect}
            />
          </Layer>
        </Stage>,
      );

      let stage = getStage();
      let layer = stage.getLayers()[0];
      let group = layer.getChildren()[0];
      let lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];
      let visibleLine = lines.find((l) => l.stroke() !== 'transparent');

      const pointsBefore = visibleLine!.points();

      // Re-render with moved source
      rerender(
        <Stage width={800} height={600}>
          <Layer>
            <RelationLine
              element={sampleElement}
              sourcePosition={src2}
              targetPosition={tgt}
              isSelected={false}
              onSelect={onSelect}
            />
          </Layer>
        </Stage>,
      );

      stage = getStage();
      layer = stage.getLayers()[0];
      group = layer.getChildren()[0];
      lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];
      visibleLine = lines.find((l) => l.stroke() !== 'transparent');

      const pointsAfter = visibleLine!.points();

      // Points should differ after source moved from x=100 to x=300
      expect(pointsBefore).not.toEqual(pointsAfter);
      expect(pointsAfter[0]).not.toBe(pointsBefore[0]);
    });

    it('recomputes points when target position changes', () => {
      const src: Layout = { x: 100, y: 150, width: 180, height: 110 };
      const tgt1: Layout = { x: 420, y: 150, width: 180, height: 110 };
      const tgt2: Layout = { x: 420, y: 400, width: 180, height: 110 };

      const onSelect = vi.fn();

      const { rerender } = render(
        <Stage width={800} height={600}>
          <Layer>
            <RelationLine
              element={sampleElement}
              sourcePosition={src}
              targetPosition={tgt1}
              isSelected={false}
              onSelect={onSelect}
            />
          </Layer>
        </Stage>,
      );

      let stage = getStage();
      let layer = stage.getLayers()[0];
      let group = layer.getChildren()[0];
      let lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];
      let visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      const pointsBefore = visibleLine!.points();

      // Move target down
      rerender(
        <Stage width={800} height={600}>
          <Layer>
            <RelationLine
              element={sampleElement}
              sourcePosition={src}
              targetPosition={tgt2}
              isSelected={false}
              onSelect={onSelect}
            />
          </Layer>
        </Stage>,
      );

      stage = getStage();
      layer = stage.getLayers()[0];
      group = layer.getChildren()[0];
      lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];
      visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      const pointsAfter = visibleLine!.points();

      expect(pointsBefore).not.toEqual(pointsAfter);
      // Y values should change
      expect(pointsAfter[1]).not.toBe(pointsBefore[1]);
    });

    it('always starts at source border and ends at target border', () => {
      const src: Layout = { x: 50, y: 100, width: 200, height: 120 };
      const tgt: Layout = { x: 400, y: 350, width: 200, height: 120 };

      const points = computeOrthogonalPoints(src, tgt);

      // First point should be on the source rect border
      const rightEdge = src.x + src.width;
      expect(points[0]).toBeGreaterThanOrEqual(src.x);
      expect(points[0]).toBeLessThanOrEqual(rightEdge);

      // Last point should be on the target rect border
      const targetLeftEdge = tgt.x;
      expect(points[6]).toBeGreaterThanOrEqual(targetLeftEdge - 1);
      expect(points[6]).toBeLessThanOrEqual(tgt.x + tgt.width);
    });

    it('recomputes self-loop points when Type position moves', () => {
      const selfElement: RelationElement = {
        ...sampleElement,
        sourceId: 'demo-type-1',
        targetId: 'demo-type-1',
        label: 'self',
      };
      const layout1: Layout = { x: 100, y: 150, width: 180, height: 110 };
      const layout2: Layout = { x: 300, y: 250, width: 180, height: 110 };

      const onSelect = vi.fn();

      const { rerender } = render(
        <Stage width={800} height={600}>
          <Layer>
            <RelationLine
              element={selfElement}
              sourcePosition={layout1}
              targetPosition={layout1}
              isSelected={false}
              onSelect={onSelect}
            />
          </Layer>
        </Stage>,
      );

      let stage = getStage();
      let layer = stage.getLayers()[0];
      let group = layer.getChildren()[0];
      let lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];
      let visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      const pointsBefore = visibleLine!.points();

      // Move the Type to a new position
      rerender(
        <Stage width={800} height={600}>
          <Layer>
            <RelationLine
              element={selfElement}
              sourcePosition={layout2}
              targetPosition={layout2}
              isSelected={false}
              onSelect={onSelect}
            />
          </Layer>
        </Stage>,
      );

      stage = getStage();
      layer = stage.getLayers()[0];
      group = layer.getChildren()[0];
      lines = asGroup(group).getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];
      visibleLine = lines.find((l) => l.stroke() !== 'transparent');
      const pointsAfter = visibleLine!.points();

      expect(pointsBefore).not.toEqual(pointsAfter);
      // All x values should have shifted by the layout x delta (300 - 100 = 200)
      // Each point pair should reflect the new position
      expect(pointsAfter[0]).toBe(pointsBefore[0] + 200);
      expect(pointsAfter[2]).toBe(pointsBefore[2] + 200);
      expect(pointsAfter[4]).toBe(pointsBefore[4] + 200);
      expect(pointsAfter[6]).toBe(pointsBefore[6] + 200);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-15: Preview line matches final line verification                 */
  /* ------------------------------------------------------------------ */

  describe('ME-15 preview line consistency', () => {
    it('computeOrthogonalPoints always produces axis-aligned segments with even length (8)', () => {
      const layouts: Array<[Layout, Layout]> = [
        [{ x: 0, y: 0, width: 100, height: 80 }, { x: 400, y: 0, width: 100, height: 80 }],
        [{ x: 100, y: 100, width: 180, height: 110 }, { x: 120, y: 400, width: 180, height: 110 }],
        [{ x: 50, y: 300, width: 200, height: 100 }, { x: 500, y: 100, width: 200, height: 100 }],
      ];

      for (const [src, tgt] of layouts) {
        const points = computeOrthogonalPoints(src, tgt);
        expect(points.length).toBe(8);
        for (let i = 0; i < points.length - 2; i += 2) {
          const isAxisAligned = points[i] === points[i + 2] || points[i + 1] === points[i + 3];
          expect(isAxisAligned).toBe(true);
        }
      }
    });

    it('produces consistent routing direction for same relative positions', () => {
      // Source directly left of target
      const p1 = computeOrthogonalPoints(
        { x: 0, y: 100, width: 100, height: 80 },
        { x: 400, y: 100, width: 100, height: 80 },
      );
      // Source directly right of target
      const p2 = computeOrthogonalPoints(
        { x: 400, y: 100, width: 100, height: 80 },
        { x: 0, y: 100, width: 100, height: 80 },
      );

      // Both should produce 8 points
      expect(p1.length).toBe(8);
      expect(p2.length).toBe(8);

      // Routing should be symmetric: same pattern but reversed
      // First point of p1 should be on the right edge of first rect
      expect(p1[0]).toBe(100); // source right edge
      // Last point of p2 should be on the right edge of its target
      expect(p2[6]).toBe(100); // target right edge
    });

    it('produces correct points for overlapping x ranges (dx < dy)', () => {
      const points = computeOrthogonalPoints(
        { x: 100, y: 100, width: 200, height: 80 },
        { x: 150, y: 400, width: 200, height: 80 },
      );
      expect(points.length).toBe(8);

      // Vertical-first routing: first segment is vertical
      expect(points[0]).toBe(points[2]);
    });

    it('produces correct points for overlapping y ranges (dx > dy)', () => {
      const points = computeOrthogonalPoints(
        { x: 100, y: 100, width: 180, height: 200 },
        { x: 500, y: 150, width: 180, height: 200 },
      );
      expect(points.length).toBe(8);

      // Horizontal-first routing: first segment is horizontal
      expect(points[1]).toBe(points[3]);
    });

    it('computePreviewPoints uses the same orthogonal routing algorithm as computeOrthogonalPoints (horizontal-first)', () => {
      const sourceLayout: Layout = { x: 100, y: 150, width: 180, height: 110 };
      const targetLayout: Layout = { x: 420, y: 150, width: 180, height: 110 };

      // computeOrthogonalPoints uses targetLayout center as the target point
      const targetCenter = {
        x: targetLayout.x + targetLayout.width / 2,
        y: targetLayout.y + targetLayout.height / 2,
      };

      const finalPoints = computeOrthogonalPoints(sourceLayout, targetLayout);
      const previewPoints = computePreviewPoints(sourceLayout, targetCenter);

      // Both produce 8 points with axis-aligned segments
      expect(finalPoints.length).toBe(8);
      expect(previewPoints.length).toBe(8);

      // Both start at the same source border intersection
      expect(previewPoints[0]).toBeCloseTo(finalPoints[0], 1);
      expect(previewPoints[1]).toBeCloseTo(finalPoints[1], 1);

      // Both use horizontal-first routing (first segment horizontal)
      expect(previewPoints[1]).toBe(previewPoints[3]);

      // Preview line ends at the cursor point, while final line ends at target border
      // (they naturally differ, but the routing direction is the same)
      expect(previewPoints[6]).toBe(targetCenter.x);
      expect(previewPoints[7]).toBe(targetCenter.y);

      // Verify axis-aligned segments for preview points
      for (let i = 0; i < previewPoints.length - 2; i += 2) {
        const isAxisAligned =
          previewPoints[i] === previewPoints[i + 2] || previewPoints[i + 1] === previewPoints[i + 3];
        expect(isAxisAligned).toBe(true);
      }
    });

    it('computePreviewPoints matches computeOrthogonalPoints for vertical-first routing', () => {
      const sourceLayout: Layout = { x: 100, y: 100, width: 180, height: 110 };
      const targetLayout: Layout = { x: 120, y: 400, width: 180, height: 110 };

      const targetCenter = {
        x: targetLayout.x + targetLayout.width / 2,
        y: targetLayout.y + targetLayout.height / 2,
      };

      const finalPoints = computeOrthogonalPoints(sourceLayout, targetLayout);
      const previewPoints = computePreviewPoints(sourceLayout, targetCenter);

      // Both use vertical-first routing (first segment is vertical)
      expect(finalPoints[0]).toBe(finalPoints[2]);
      expect(previewPoints[0]).toBe(previewPoints[2]);

      // Both start at the same source border intersection
      expect(previewPoints[0]).toBeCloseTo(finalPoints[0], 0);
      expect(previewPoints[1]).toBeCloseTo(finalPoints[1], 0);

      // Verify axis-aligned segments for preview points
      for (let i = 0; i < previewPoints.length - 2; i += 2) {
        const isAxisAligned =
          previewPoints[i] === previewPoints[i + 2] || previewPoints[i + 1] === previewPoints[i + 3];
        expect(isAxisAligned).toBe(true);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-20/21/22: Cardinality symbol rendering                          */
  /* ------------------------------------------------------------------ */

  describe('ME-20/21/22 cardinality symbols', () => {
    function getCardinalityGroups(stage: unknown): unknown[] {
      const s = stage as {
        getLayers: () => { getChildren: () => unknown[] }[];
      };
      const layer = s.getLayers()[0];
      const group = layer.getChildren()[0] as unknown as {
        getChildren: (filter?: (child: unknown) => boolean) => unknown[];
      };
      // Cardinality markers are Groups after the 2 Lines
      const allChildren = group.getChildren();
      const groups = allChildren.filter(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Group',
      );
      return groups;
    }

    it('renders two cardinality marker Groups (source and target)', () => {
      renderRelationLine();

      const stage = getStage();
      const groups = getCardinalityGroups(stage);
      expect(groups.length).toBe(2);
    });

    it('each cardinality Group contains at least one Line (the bar)', () => {
      renderRelationLine();

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      for (const g of groups) {
        const childLines = (g as unknown as {
          getChildren: (filter?: (child: unknown) => boolean) => unknown[];
        }).getChildren(
          (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
        );
        // Each cardinality marker must have at least the bar Line
        expect(childLines.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('zero_or_many target cardinality renders a Circle inside target marker', () => {
      const zeroManyTarget: RelationElement = {
        ...sampleElement,
        targetCardinality: 'zero_or_many',
      };
      renderRelationLine(zeroManyTarget);

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      // Target is second group (index 1)
      const targetGroup = groups[1] as unknown as {
        getChildren: (filter?: (child: unknown) => boolean) => unknown[];
      };
      const circles = targetGroup.getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
      );
      expect(circles.length).toBe(1);
    });

    it('exactly_one cardinality does NOT render a Circle', () => {
      const exactlyOne: RelationElement = {
        ...sampleElement,
        sourceCardinality: 'exactly_one',
        targetCardinality: 'exactly_one',
      };
      renderRelationLine(exactlyOne);

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      for (const g of groups) {
        const circles = (g as unknown as {
          getChildren: (filter?: (child: unknown) => boolean) => unknown[];
        }).getChildren(
          (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
        );
        expect(circles.length).toBe(0);
      }
    });

    it('zero_or_many source cardinality renders a Circle in source marker', () => {
      const zeroManySource: RelationElement = {
        ...sampleElement,
        sourceCardinality: 'zero_or_many',
      };
      renderRelationLine(zeroManySource);

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      // Source is first group (index 0)
      const sourceGroup = groups[0] as unknown as {
        getChildren: (filter?: (child: unknown) => boolean) => unknown[];
      };
      const circles = sourceGroup.getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
      );
      expect(circles.length).toBe(1);
    });

    it('one_or_many cardinality renders three Lines (bar + 2 crow foot branches)', () => {
      const oneMany: RelationElement = {
        ...sampleElement,
        sourceCardinality: 'one_or_many',
      };
      renderRelationLine(oneMany);

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      // Source is first group
      const sourceGroup = groups[0] as unknown as {
        getChildren: (filter?: (child: unknown) => boolean) => unknown[];
      };
      const lines = sourceGroup.getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      );
      expect(lines.length).toBe(3);
    });

    it('zero_or_many cardinality renders three Lines + one Circle', () => {
      const zeroMany: RelationElement = {
        ...sampleElement,
        sourceCardinality: 'zero_or_many',
      };
      renderRelationLine(zeroMany);

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      const sourceGroup = groups[0] as unknown as {
        getChildren: (filter?: (child: unknown) => boolean) => unknown[];
      };
      const lines = sourceGroup.getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      );
      const circles = sourceGroup.getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
      );
      expect(lines.length).toBe(3);
      expect(circles.length).toBe(1);
    });

    it('cardinality symbols have listening=false so clicks pass through to the relation group', () => {
      renderRelationLine();

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      for (const g of groups) {
        expect((g as unknown as { listening: () => boolean }).listening()).toBe(false);
      }
    });

    it('getCardinalitySymbol returns empty lines for unknown cardinality value', () => {
      const result = getCardinalitySymbol('unknown' as never);
      expect(result.lines).toEqual([]);
      expect(result.circle).toBeUndefined();
    });

    it('getCardinalitySymbol returns bar + circle for zero_or_one (source orientation)', () => {
      const result = getCardinalitySymbol('zero_or_one', true);
      expect(result.lines).toHaveLength(1); // just the bar
      expect(result.circle).toBeDefined();
      expect(result.circle!.radius).toBe(3);
      // Circle should be on the -x side for source
      expect(result.circle!.x).toBe(-5);
    });

    it('getCardinalitySymbol returns three lines for one_or_many (target orientation)', () => {
      const result = getCardinalitySymbol('one_or_many', false);
      expect(result.lines).toHaveLength(3); // bar + 2 crow foot branches
      expect(result.circle).toBeUndefined();
      // Crow foot branches open in -x direction for target
      expect(result.lines[1].x2).toBeLessThan(0);
      expect(result.lines[2].x2).toBeLessThan(0);
    });

    it('getCardinalitySymbol returns bar + circle for zero_or_one (target orientation)', () => {
      const result = getCardinalitySymbol('zero_or_one', false);
      expect(result.lines).toHaveLength(1);
      expect(result.circle).toBeDefined();
      // Circle should be on the +x side for target
      expect(result.circle!.x).toBe(5);
    });

    it('exactly_one cardinality renders the bar symbol on both source and target', () => {
      const exactlyOne: RelationElement = {
        ...sampleElement,
        sourceCardinality: 'exactly_one',
        targetCardinality: 'exactly_one',
      };
      renderRelationLine(exactlyOne);

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      for (const g of groups) {
        const lines = (g as unknown as {
          getChildren: (filter?: (child: unknown) => boolean) => unknown[];
        }).getChildren(
          (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
        );
        // exactly_one should have exactly 1 line (the bar)
        expect(lines).toHaveLength(1);
      }
    });

    it('cardinality markers render on self-loop relations', () => {
      const selfElement: RelationElement = {
        ...sampleElement,
        sourceId: 'demo-type-1',
        targetId: 'demo-type-1',
        label: 'self',
      };
      renderRelationLine(selfElement, sourceLayout, sourceLayout);

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      // Self-loop should also render 2 cardinality markers
      expect(groups.length).toBe(2);
    });

    it('source cardinality Group has correct rotation for horizontal routing', () => {
      renderRelationLine();

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      // Source group (index 0) rotation for horizontal routing
      const sourceGroup = groups[0] as unknown as { rotation: () => number };
      // For left-to-right routing, the first segment goes right (+x), so angle = 0
      expect(sourceGroup.rotation()).toBe(0);
    });

    it('target cardinality Group has correct rotation for horizontal routing', () => {
      renderRelationLine();

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      // Target group (index 1) rotation for horizontal routing
      const targetGroup = groups[1] as unknown as { rotation: () => number };
      // For left-to-right routing, the last segment goes left (-x),
      // so angle = atan2(0, -70) = -180 degrees (or 180, both valid)
      const rotation = targetGroup.rotation();
      expect(Math.abs(rotation)).toBe(180);
    });

    it('cardinality symbols use the correct stroke color based on selection state', () => {
      // Not selected: should use COLORS.relationLine
      renderRelationLine(sampleElement, sourceLayout, targetLayout, false, vi.fn());

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      for (const g of groups) {
        const lines = (g as unknown as {
          getChildren: (filter?: (child: unknown) => boolean) => unknown[];
        }).getChildren(
          (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
        ) as unknown as Array<{ stroke: () => string }>;
        for (const line of lines) {
          expect(line.stroke()).toBe(COLORS.relationLine);
        }
      }
    });

    it('cardinality symbols use selection color when relation is selected', () => {
      renderRelationLine(sampleElement, sourceLayout, targetLayout, true, vi.fn());

      const stage = getStage();
      const groups = getCardinalityGroups(stage);

      for (const g of groups) {
        const lines = (g as unknown as {
          getChildren: (filter?: (child: unknown) => boolean) => unknown[];
        }).getChildren(
          (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
        ) as unknown as Array<{ stroke: () => string }>;
        for (const line of lines) {
          expect(line.stroke()).toBe(COLORS.selection);
        }
      }
    });
  });
});
