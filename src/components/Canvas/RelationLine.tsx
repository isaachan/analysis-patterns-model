import { useMemo, useState, useCallback } from 'react';
import { Group, Line, Text, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { RelationElement, Layout, Anchor } from '../../models/diagram';
import { COLORS, FONTS } from '../../constants/designTokens';
import { getRectBorderIntersection, anchorToPoint } from '../../utils/geometry';
import { getCardinalitySymbol } from '../../utils/cardinality';
import { useDiagramStore } from '../../store/useDiagramStore';

interface RelationLineProps {
  element: RelationElement;
  sourcePosition: Layout;
  targetPosition: Layout;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/** Distance the self-loop extends beyond the right edge of the Type box. */
const SELF_LOOP_MARGIN = 40;

/** Offset from top for the self-loop exit point (as fraction of height). */
const LOOP_EXIT_FRACTION = 0.25;

/** Offset from top for the self-loop entry point (as fraction of height). */
const LOOP_ENTRY_FRACTION = 0.75;

/** Radius for endpoint and waypoint drag handles. */
const HANDLE_RADIUS = 5;

/**
 * Compute orthogonal routing points for a self-loop (source === target).
 *
 * Draws a rectangular "bump" on the right side of the Type box:
 *   - exits the right edge at 25% height
 *   - goes right by SELF_LOOP_MARGIN
 *   - goes down to 75% height
 *   - goes left back to the right edge
 */
function computeSelfLoopPoints(layout: Layout): number[] {
  const { x, y, width, height } = layout;
  const exitY = y + height * LOOP_EXIT_FRACTION;
  const entryY = y + height * LOOP_ENTRY_FRACTION;

  return [
    x + width, exitY,                     // exit right edge near top
    x + width + SELF_LOOP_MARGIN, exitY, // go right
    x + width + SELF_LOOP_MARGIN, entryY, // go down
    x + width, entryY,                     // go left, enter right edge
  ];
}

/**
 * Compute the source exit point and target entry point for orthogonal routing.
 *
 * When stored anchors are provided they are used directly (free placement).
 * Otherwise falls back to the legacy center-to-border intersection.
 */
function resolveEndpoints(
  sourceLayout: Layout,
  targetLayout: Layout,
  sourceAnchor?: Anchor,
  targetAnchor?: Anchor,
): { sourceExit: { x: number; y: number }; targetEntry: { x: number; y: number } } {
  const sourceCenter = {
    x: sourceLayout.x + sourceLayout.width / 2,
    y: sourceLayout.y + sourceLayout.height / 2,
  };
  const targetCenter = {
    x: targetLayout.x + targetLayout.width / 2,
    y: targetLayout.y + targetLayout.height / 2,
  };

  const sourceExit = sourceAnchor
    ? anchorToPoint(sourceLayout, sourceAnchor.edge, sourceAnchor.offset)
    : getRectBorderIntersection(sourceLayout, sourceCenter, targetCenter);
  const targetEntry = targetAnchor
    ? anchorToPoint(targetLayout, targetAnchor.edge, targetAnchor.offset)
    : getRectBorderIntersection(targetLayout, targetCenter, sourceCenter);

  return { sourceExit, targetEntry };
}

/**
 * Compute orthogonal routing points between two type nodes.
 *
 * Uses an L-shaped or Z-shaped path based on the relative positions.
 * When stored anchors are provided they determine where the line attaches
 * to each type box edge, enabling free endpoint placement (ME-55/56).
 *
 * When waypoints are provided the line routes through them (ME-16).
 *
 * Backward compatible: without anchors/waypoints the behaviour is identical
 * to the original center-to-border intersection approach.
 */
function computeOrthogonalPoints(
  sourceLayout: Layout,
  targetLayout: Layout,
  sourceAnchor?: Anchor,
  targetAnchor?: Anchor,
  waypoints?: Array<{ x: number; y: number }>,
): number[] {
  const { sourceExit, targetEntry } = resolveEndpoints(
    sourceLayout, targetLayout, sourceAnchor, targetAnchor,
  );

  // Route through explicit waypoints
  if (waypoints && waypoints.length > 0) {
    const result = [sourceExit.x, sourceExit.y];
    for (const wp of waypoints) {
      result.push(wp.x, wp.y);
    }
    result.push(targetEntry.x, targetEntry.y);
    return result;
  }

  // Standard L/Z orthogonal routing
  const dx = Math.abs(targetEntry.x - sourceExit.x);
  const dy = Math.abs(targetEntry.y - sourceExit.y);

  if (dx > dy) {
    // Horizontal-first: go to mid-X, then to target
    const midX = (sourceExit.x + targetEntry.x) / 2;
    return [
      sourceExit.x, sourceExit.y,
      midX, sourceExit.y,
      midX, targetEntry.y,
      targetEntry.x, targetEntry.y,
    ];
  } else {
    // Vertical-first: go to mid-Y, then to target
    const midY = (sourceExit.y + targetEntry.y) / 2;
    return [
      sourceExit.x, sourceExit.y,
      sourceExit.x, midY,
      targetEntry.x, midY,
      targetEntry.x, targetEntry.y,
    ];
  }
}

/**
 * Compute the rotation angle for a cardinality symbol at a line endpoint.
 * Same as before but can handle longer point arrays (with waypoints).
 */
function getEndpointAngle(
  points: number[],
  isSource: boolean,
): number {
  if (isSource) {
    const dx = points[2] - points[0];
    const dy = points[3] - points[1];
    return Math.atan2(dy, dx) * (180 / Math.PI);
  } else {
    const len = points.length;
    const dx = points[len - 2] - points[len - 4];
    const dy = points[len - 1] - points[len - 3];
    return Math.atan2(-dy, -dx) * (180 / Math.PI);
  }
}

/* ------------------------------------------------------------------ */
/*  CardinalityMarker (unchanged from original)                         */
/* ------------------------------------------------------------------ */

function CardinalityMarker({
  element,
  points,
  isSource,
  strokeColor,
}: {
  element: RelationElement;
  points: number[];
  isSource: boolean;
  strokeColor: string;
}) {
  const cardinality = isSource ? element.sourceCardinality : element.targetCardinality;
  const symbol = getCardinalitySymbol(cardinality, isSource);

  const posX = isSource ? points[0] : points[points.length - 2];
  const posY = isSource ? points[1] : points[points.length - 1];
  const angle = getEndpointAngle(points, isSource);

  return (
    <Group x={posX} y={posY} rotation={angle} listening={false}>
      {symbol.lines.map((line, i) => (
        <Line
          key={`card-line-${i}`}
          points={[line.x1, line.y1, line.x2, line.y2]}
          stroke={strokeColor}
          strokeWidth={1.5}
          lineCap="round"
          tension={0}
        />
      ))}
      {symbol.circle && (
        <Circle
          x={symbol.circle.x}
          y={symbol.circle.y}
          radius={symbol.circle.radius}
          stroke={strokeColor}
          strokeWidth={1.5}
          fill="transparent"
        />
      )}
    </Group>
  );
}

/* ------------------------------------------------------------------ */
/*  EndpointHandle — draggable circle on a type box edge (ME-57/17)    */
/* ------------------------------------------------------------------ */

interface EndpointHandleProps {
  x: number;
  y: number;
  layout: Layout;
  anchor: Anchor | undefined;
  isSource: boolean;
  elementId: string;
}

function EndpointHandle({ x, y, layout, anchor, isSource, elementId }: EndpointHandleProps) {
  const updateElement = useDiagramStore((s) => s.updateElement);
  const edge = anchor?.edge ?? (isSource ? 'right' : 'left');

  const dragBoundFunc = useCallback(
    (pos: { x: number; y: number }) => {
      // Constrain drag to the type box edge
      switch (edge) {
        case 'top':
          return { x: Math.max(layout.x, Math.min(layout.x + layout.width, pos.x)), y: layout.y };
        case 'bottom':
          return { x: Math.max(layout.x, Math.min(layout.x + layout.width, pos.x)), y: layout.y + layout.height };
        case 'left':
          return { x: layout.x, y: Math.max(layout.y, Math.min(layout.y + layout.height, pos.y)) };
        case 'right':
          return { x: layout.x + layout.width, y: Math.max(layout.y, Math.min(layout.y + layout.height, pos.y)) };
      }
    },
    [edge, layout],
  );

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const pos = { x: e.target.x(), y: e.target.y() };
      // Compute new anchor from dragged position
      let newEdge = edge;
      let newOffset: number;
      switch (edge) {
        case 'top':
        case 'bottom':
          newOffset = (pos.x - layout.x) / layout.width;
          break;
        case 'left':
        case 'right':
          newOffset = (pos.y - layout.y) / layout.height;
          break;
      }
      newOffset = Math.max(0, Math.min(1, newOffset));

      const field = isSource ? 'sourceAnchor' : 'targetAnchor';
      updateElement(elementId, { [field]: { edge: newEdge, offset: newOffset } } as Partial<RelationElement>);
    },
    [edge, layout, isSource, elementId, updateElement],
  );

  return (
    <Circle
      x={x}
      y={y}
      radius={HANDLE_RADIUS}
      fill="#ffffff"
      stroke={COLORS.selection}
      strokeWidth={2}
      draggable
      dragBoundFunc={dragBoundFunc}
      onDragEnd={handleDragEnd}
      name="endpoint-handle"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  BendHandle — draggable circle at a corner point of the L/Z path   */
/*  When dragged it creates/updates a waypoint (ME-16).               */
/* ------------------------------------------------------------------ */

interface BendHandleProps {
  x: number;
  y: number;
  elementId: string;
  waypoints: Array<{ x: number; y: number }>;
  /** Which waypoint index this handle maps to (-1 = new waypoint) */
  wpIndex: number;
}

function BendHandle({ x, y, elementId, waypoints, wpIndex }: BendHandleProps) {
  const updateElement = useDiagramStore((s) => s.updateElement);

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const pos = { x: e.target.x(), y: e.target.y() };
      const newWps = [...waypoints];
      if (wpIndex >= 0 && wpIndex < newWps.length) {
        // Update existing waypoint
        newWps[wpIndex] = pos;
      } else {
        // Create new waypoint
        newWps.push(pos);
      }
      updateElement(elementId, { waypoints: newWps } as Partial<RelationElement>);
    },
    [elementId, waypoints, wpIndex, updateElement],
  );

  return (
    <Circle
      x={x}
      y={y}
      radius={4}
      fill="#ffffff"
      stroke={COLORS.selection}
      strokeWidth={1.5}
      draggable
      onDragEnd={handleDragEnd}
      name="bend-handle"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  RelationLine component                                             */
/* ------------------------------------------------------------------ */

function RelationLine({
  element,
  sourcePosition,
  targetPosition,
  isSelected,
  onSelect,
}: RelationLineProps) {
  const { label } = element;
  const { sourceSemantics, targetSemantics, associationSemantics } = element;
  const { sourceAnchor, targetAnchor, waypoints } = element;
  const isSelfLoop = element.sourceId === element.targetId;
  const [isHovered, setIsHovered] = useState(false);

  const points = useMemo(
    () =>
      isSelfLoop
        ? computeSelfLoopPoints(sourcePosition)
        : computeOrthogonalPoints(sourcePosition, targetPosition, sourceAnchor, targetAnchor, waypoints),
    [sourcePosition, targetPosition, isSelfLoop, sourceAnchor, targetAnchor, waypoints],
  );

  const midPoint = useMemo(() => {
    let sumX = 0;
    let sumY = 0;
    const count = points.length / 2;
    for (let i = 0; i < points.length; i += 2) {
      sumX += points[i];
      sumY += points[i + 1];
    }
    return { x: sumX / count, y: sumY / count };
  }, [points]);

  const sourceSemanticText = useMemo(() => {
    if (!sourceSemantics || sourceSemantics.length === 0) return '';
    return sourceSemantics
      .map((s) => (s.keyType ? `[${s.type}: ${s.keyType}]` : `[${s.type}]`))
      .join(' ');
  }, [sourceSemantics]);

  const targetSemanticText = useMemo(() => {
    if (!targetSemantics || targetSemantics.length === 0) return '';
    return targetSemantics
      .map((s) => (s.keyType ? `[${s.type}: ${s.keyType}]` : `[${s.type}]`))
      .join(' ');
  }, [targetSemantics]);

  const associationSemanticText = useMemo(() => {
    if (!associationSemantics || associationSemantics.length === 0) return '';
    return associationSemantics
      .map((s) => (s.keyType ? `[${s.type}: ${s.keyType}]` : `[${s.type}]`))
      .join(' ');
  }, [associationSemantics]);

  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(element.id);
    },
    [onSelect, element.id],
  );

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  /* Visual style */
  let strokeColor: string;
  if (isSelected) {
    strokeColor = COLORS.selection;
  } else if (isHovered) {
    strokeColor = COLORS.hover;
  } else {
    strokeColor = COLORS.relationLine;
  }

  const strokeWidth = isSelected || isHovered ? 3 : 2;

  /* Build bend point handles and waypoint handles (only when selected) */
  const handlePoints = useMemo(() => {
    if (!isSelected || isSelfLoop) return { bendPoints: [] as Array<{ x: number; y: number; index: number }> };

    // Collect unique bend points (exclude endpoints)
    const bends: Array<{ x: number; y: number; index: number }> = [];
    const visited = new Set<string>();
    for (let i = 2; i < points.length - 2; i += 2) {
      const key = `${points[i]},${points[i + 1]}`;
      if (!visited.has(key)) {
        visited.add(key);
        bends.push({ x: points[i], y: points[i + 1], index: bends.length });
      }
    }
    return { bendPoints: bends };
  }, [isSelected, isSelfLoop, points]);

  return (
    <Group
      onClick={handleClick}
      onTap={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Visible orthogonal line */}
      <Line
        points={points}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
        tension={0}
      />

      {/* Wider invisible hit area for easier clicking */}
      <Line
        points={points}
        stroke="transparent"
        strokeWidth={12}
        lineCap="round"
        lineJoin="round"
        tension={0}
      />

      {/* Cardinality symbols at endpoints */}
      <CardinalityMarker
        element={element}
        points={points}
        isSource={true}
        strokeColor={strokeColor}
      />
      <CardinalityMarker
        element={element}
        points={points}
        isSource={false}
        strokeColor={strokeColor}
      />

      {/* Source-end semantic markers */}
      {sourceSemanticText && points.length >= 2 && (
        <Text
          text={sourceSemanticText}
          x={points[0]}
          y={points[1] + 8}
          fill={COLORS.semanticText}
          fontSize={11}
          fontFamily={FONTS.ui}
          fontStyle="italic"
          listening={false}
        />
      )}

      {/* Target-end semantic markers */}
      {targetSemanticText && points.length >= 2 && (
        <Text
          text={targetSemanticText}
          x={points[points.length - 2]}
          y={points[points.length - 1] + 8}
          fill={COLORS.semanticText}
          fontSize={11}
          fontFamily={FONTS.ui}
          fontStyle="italic"
          listening={false}
        />
      )}

      {/* Association-level semantic markers (midpoint) */}
      {associationSemanticText && (
        <Text
          text={associationSemanticText}
          x={midPoint.x - 40}
          y={midPoint.y - 12}
          width={80}
          height={20}
          align="center"
          verticalAlign="middle"
          fill={COLORS.semanticText}
          fontSize={11}
          fontFamily={FONTS.ui}
          listening={false}
        />
      )}

      {/* Label */}
      {label && (
        <Text
          text={label}
          x={midPoint.x - 40}
          y={midPoint.y - 10}
          width={80}
          height={20}
          align="center"
          verticalAlign="middle"
          fill={strokeColor}
          fontSize={11}
          fontFamily={FONTS.ui}
          fontStyle="bold"
          background={COLORS.canvasBg}
          padding={2}
        />
      )}

      {/* ── Drag handles (only when selected) ── */}

      {/* Endpoint handles (ME-57/17) */}
      {isSelected && !isSelfLoop && (
        <>
          <EndpointHandle
            x={points[0]}
            y={points[1]}
            layout={sourcePosition}
            anchor={sourceAnchor}
            isSource
            elementId={element.id}
          />
          <EndpointHandle
            x={points[points.length - 2]}
            y={points[points.length - 1]}
            layout={targetPosition}
            anchor={targetAnchor}
            isSource={false}
            elementId={element.id}
          />
        </>
      )}

      {/* Bend / waypoint handles (ME-16) */}
      {isSelected && !isSelfLoop && handlePoints.bendPoints.length > 0 && (
        <>
          {handlePoints.bendPoints.map((bp) => (
            <BendHandle
              key={`bend-${bp.index}`}
              x={bp.x}
              y={bp.y}
              elementId={element.id}
              waypoints={waypoints ?? []}
              wpIndex={bp.index < (waypoints?.length ?? 0) ? bp.index : -1}
            />
          ))}
        </>
      )}
    </Group>
  );
}

export { computeOrthogonalPoints, computeSelfLoopPoints };
export default RelationLine;
