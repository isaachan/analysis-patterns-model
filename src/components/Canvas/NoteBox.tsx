import { useState, useMemo, useRef } from 'react';
import { Group, Line, Text } from 'react-konva';
import type Konva from 'konva';
import type { ToolMode } from '../../models/editor';
import type { CanvasElement } from '../../store/useEditorStore';
import useEditorStore from '../../store/useEditorStore';
import {
  TYPE_NODE_DEFAULT_WIDTH,
  TYPE_NODE_DEFAULT_HEIGHT,
} from '../../constants/defaults';

interface NoteBoxProps {
  element: CanvasElement;
  isSelected: boolean;
  currentTool: ToolMode;
  onSelect: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
}

const FONT_FAMILY = 'sans-serif';
const TITLE_FONT_SIZE = 14;
const CONTENT_FONT_SIZE = 12;
const FOLD_SIZE = 24;
const PADDING = 8;
const TITLE_BOTTOM_MARGIN = 4;
const LINE_HEIGHT = 18;
const CONTROL_POINT_SIZE = 8;

const NOTE_BG_COLOR = '#FFFBEA';
const FOLD_COLOR = '#E8DCC8';
const BORDER_COLOR = '#333333';
const CONTENT_COLOR = '#555555';
const CONNECTION_LINE_COLOR = 'rgba(100, 100, 100, 0.5)';

const TITLE_TYPE_COLORS: Record<string, string> = {
  Constraint: '#007AFF',
  Derivation: '#34C759',
  Note: '#FF9500',
};

function ControlPoints({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const half = CONTROL_POINT_SIZE / 2;
  const corners = [
    { x: x - half, y: y - half },
    { x: x + width - half, y: y - half },
    { x: x - half, y: y + height - half },
    { x: x + width - half, y: y + height - half },
  ];

  return (
    <>
      {corners.map((corner, i) => (
        <Line
          key={i}
          points={[
            corner.x, corner.y,
            corner.x + CONTROL_POINT_SIZE, corner.y,
            corner.x + CONTROL_POINT_SIZE, corner.y + CONTROL_POINT_SIZE,
            corner.x, corner.y + CONTROL_POINT_SIZE,
            corner.x, corner.y,
          ]}
          closed
          fill="#ffffff"
          stroke="#007aff"
          strokeWidth={1.5}
          listening={false}
        />
      ))}
    </>
  );
}

/**
 * Find the nearest point on the perimeter of a rectangle to a given external point.
 */
function nearestPointOnRectEdge(
  px: number,
  py: number,
  rect: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  // If the point is inside the rect, snap to the nearest edge
  if (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  ) {
    const distToLeft = px - rect.x;
    const distToRight = rect.x + rect.width - px;
    const distToTop = py - rect.y;
    const distToBottom = rect.y + rect.height - py;
    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
    if (minDist === distToLeft) return { x: rect.x, y: py };
    if (minDist === distToRight) return { x: rect.x + rect.width, y: py };
    if (minDist === distToTop) return { x: px, y: rect.y };
    return { x: px, y: rect.y + rect.height };
  }

  // Project from center to rect edge along direction (px - cx, py - cy)
  const dx = px - cx;
  const dy = py - cy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Avoid division by zero
  if (absDx < 0.001 && absDy < 0.001) {
    return { x: cx, y: rect.y };
  }

  // Check if the ray hits a vertical edge (left/right) first
  const scaleX = rect.width / 2 / Math.max(absDx, 0.001);
  const scaleY = rect.height / 2 / Math.max(absDy, 0.001);
  const scale = Math.min(scaleX, scaleY);

  let ix = cx + dx * scale;
  let iy = cy + dy * scale;

  // Clamp to rect edges
  ix = Math.max(rect.x, Math.min(rect.x + rect.width, ix));
  iy = Math.max(rect.y, Math.min(rect.y + rect.height, iy));

  return { x: ix, y: iy };
}

/**
 * Compute the midpoint of a relation for connection line targeting.
 */
function getRelationMidpoint(
  relation: CanvasElement,
  allElements: CanvasElement[],
): { x: number; y: number } | null {
  if (relation.type !== 'relation') return null;

  const sourceEl = allElements.find((el) => el.id === relation.sourceId);
  const targetEl = allElements.find((el) => el.id === relation.targetId);
  if (!sourceEl) return null;

  const sourceW = sourceEl.width ?? TYPE_NODE_DEFAULT_WIDTH;
  const sourceH = sourceEl.height ?? TYPE_NODE_DEFAULT_HEIGHT;
  const sourceCenter = {
    x: sourceEl.x + sourceW / 2,
    y: sourceEl.y + sourceH / 2,
  };

  // Self-reference: use the loop's furthest point
  if (relation.isSelfReference || relation.sourceId === relation.targetId) {
    const loopWidth = Math.max(sourceW * 0.65, 45);
    return {
      x: sourceEl.x + sourceW + loopWidth / 2,
      y: sourceCenter.y,
    };
  }

  if (!targetEl) return null;
  const targetW = targetEl.width ?? TYPE_NODE_DEFAULT_WIDTH;
  const targetH = targetEl.height ?? TYPE_NODE_DEFAULT_HEIGHT;
  const targetCenter = {
    x: targetEl.x + targetW / 2,
    y: targetEl.y + targetH / 2,
  };

  return {
    x: (sourceCenter.x + targetCenter.x) / 2,
    y: (sourceCenter.y + targetCenter.y) / 2,
  };
}

function NoteBox({ element, isSelected, currentTool, onSelect, onDragStart, onDragMove }: NoteBoxProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [snapFlash, setSnapFlash] = useState(false);
  const snapFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setIsDragging = useEditorStore((s) => s.setIsDragging);
  const updateElement = useEditorStore((s) => s.updateElement);
  const canvasElements = useEditorStore((s) => s.canvasElements);

  const width = element.width ?? 240;
  const height = element.height ?? 160;
  const content = element.content ?? '';
  const titleType = element.titleType ?? 'Note';
  const titleColor = TITLE_TYPE_COLORS[titleType] ?? '#333333';
  const isSelectable = currentTool === 'select';

  // Find the target element if attached
  const targetElement = element.attachedToId
    ? canvasElements.find((el) => el.id === element.attachedToId)
    : undefined;

  // Compute connection line points (in note-local coordinates)
  const connectionLine = useMemo(() => {
    if (!targetElement) return null;

    const noteRect = {
      x: element.x,
      y: element.y,
      width,
      height,
    };

    let targetCenter: { x: number; y: number };
    let targetRect:
      | { x: number; y: number; width: number; height: number }
      | undefined;

    if (targetElement.type === 'type') {
      const tW = targetElement.width ?? TYPE_NODE_DEFAULT_WIDTH;
      const tH = targetElement.height ?? TYPE_NODE_DEFAULT_HEIGHT;
      targetRect = {
        x: targetElement.x,
        y: targetElement.y,
        width: tW,
        height: tH,
      };
      targetCenter = {
        x: targetElement.x + tW / 2,
        y: targetElement.y + tH / 2,
      };
    } else if (targetElement.type === 'relation') {
      const mid = getRelationMidpoint(targetElement, canvasElements);
      if (!mid) return null;
      targetCenter = mid;
    } else {
      // Fallback: use element x,y as center
      targetCenter = {
        x: targetElement.x,
        y: targetElement.y,
      };
    }

    // Note edge point
    const noteEdgeAbs = nearestPointOnRectEdge(
      targetCenter.x,
      targetCenter.y,
      noteRect,
    );
    // Target edge point (only for Type targets; for relations use midpoint)
    let targetEdgeAbs: { x: number; y: number };
    if (targetRect) {
      const noteCenter = {
        x: element.x + width / 2,
        y: element.y + height / 2,
      };
      targetEdgeAbs = nearestPointOnRectEdge(
        noteCenter.x,
        noteCenter.y,
        targetRect,
      );
    } else {
      targetEdgeAbs = targetCenter;
    }

    // Convert to note-local coordinates
    return {
      x1: noteEdgeAbs.x - element.x,
      y1: noteEdgeAbs.y - element.y,
      x2: targetEdgeAbs.x - element.x,
      y2: targetEdgeAbs.y - element.y,
    };
  }, [targetElement, element.x, element.y, width, height, canvasElements]);

  // Build the main shape points: a rectangle with top-right corner cut off
  const mainPoints = [
    0, 0,
    width - FOLD_SIZE, 0,
    width, FOLD_SIZE,
    width, height,
    0, height,
    0, 0,
  ];

  // Folded corner triangle (the dog-ear)
  const foldPoints = [
    width - FOLD_SIZE, 0,
    width, 0,
    width, FOLD_SIZE,
    width - FOLD_SIZE, 0,
  ];

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isSelectable) {
      e.cancelBubble = true;
      onSelect(element.id);
    }
  };

  const handleMouseEnter = () => {
    if (isSelectable) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleDragStart = () => {
    setIsDragging(true);
    onDragStart?.(element.id);
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const rawX = node.x();
    const rawY = node.y();
    let newX = rawX;
    let newY = rawY;

    // Snap to grid when enabled
    const snapState = useEditorStore.getState();
    if (snapState.snapEnabled && snapState.gridSize > 0) {
      newX = Math.round(newX / snapState.gridSize) * snapState.gridSize;
      newY = Math.round(newY / snapState.gridSize) * snapState.gridSize;
      node.position({ x: newX, y: newY });

      // Trigger visual flash when snap actually adjusts the position
      if (rawX !== newX || rawY !== newY) {
        setSnapFlash(true);
        if (snapFlashTimerRef.current) {
          clearTimeout(snapFlashTimerRef.current);
        }
        snapFlashTimerRef.current = setTimeout(() => {
          setSnapFlash(false);
        }, 200);
      }
    }

    updateElement(element.id, {
      x: newX,
      y: newY,
    });
    onDragMove?.(element.id, newX, newY);
  };

  /**
   * Check if the note overlaps with any Type or Relation element.
   * If so, auto-set attachedToId.
   */
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setIsDragging(false);
    const node = e.target;
    let newX = node.x();
    let newY = node.y();

    // Snap to grid when enabled
    const snapState = useEditorStore.getState();
    if (snapState.snapEnabled && snapState.gridSize > 0) {
      newX = Math.round(newX / snapState.gridSize) * snapState.gridSize;
      newY = Math.round(newY / snapState.gridSize) * snapState.gridSize;
      node.position({ x: newX, y: newY });
    }

    updateElement(element.id, {
      x: newX,
      y: newY,
    });

    // Proximity detection for auto-attach
    const noteRect = {
      x: newX,
      y: newY,
      width,
      height,
    };
    const noteCenter = {
      x: newX + width / 2,
      y: newY + height / 2,
    };

    const PROXIMITY_MARGIN = 20;
    const RELATION_PROXIMITY_DIST = 30;

    let bestTargetId: string | undefined;

    // Check Type elements for overlap
    for (const el of canvasElements) {
      if (el.type === 'type' && el.id !== element.id) {
        const tW = el.width ?? TYPE_NODE_DEFAULT_WIDTH;
        const tH = el.height ?? TYPE_NODE_DEFAULT_HEIGHT;
        const typeRect = { x: el.x, y: el.y, width: tW, height: tH };

        if (
          noteRect.x - PROXIMITY_MARGIN < typeRect.x + typeRect.width &&
          noteRect.x + noteRect.width + PROXIMITY_MARGIN > typeRect.x &&
          noteRect.y - PROXIMITY_MARGIN < typeRect.y + typeRect.height &&
          noteRect.y + noteRect.height + PROXIMITY_MARGIN > typeRect.y
        ) {
          bestTargetId = el.id;
          break; // Type takes priority
        }
      }
    }

    // If not overlapping with a Type, check Relation proximity
    if (!bestTargetId) {
      for (const el of canvasElements) {
        if (el.type === 'relation' && el.id !== element.id) {
          const mid = getRelationMidpoint(el, canvasElements);
          if (mid) {
            const dist = Math.sqrt(
              (noteCenter.x - mid.x) ** 2 + (noteCenter.y - mid.y) ** 2,
            );
            if (dist < RELATION_PROXIMITY_DIST) {
              bestTargetId = el.id;
              break;
            }
          }
        }
      }
    }

    // Only update if changed
    if (bestTargetId !== element.attachedToId) {
      updateElement(element.id, {
        attachedToId: bestTargetId,
      });
    }
  };

  return (
    <Group
      x={element.x}
      y={element.y}
      draggable={isSelectable}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Dashed connection line to attached target */}
      {connectionLine && (
        <Line
          points={[connectionLine.x1, connectionLine.y1, connectionLine.x2, connectionLine.y2]}
          stroke={CONNECTION_LINE_COLOR}
          strokeWidth={2}
          dash={[6, 4]}
          lineCap="round"
          listening={false}
        />
      )}

      {/* Main note shape with dog-ear cutout */}
      <Line
        points={mainPoints}
        closed
        fill={NOTE_BG_COLOR}
        stroke={snapFlash ? '#34c759' : isSelected ? '#007aff' : isHovered ? '#005bb5' : BORDER_COLOR}
        strokeWidth={snapFlash ? 3 : isSelected ? 2.5 : 1.5}
        shadowColor="#000000"
        shadowBlur={isHovered ? 8 : 4}
        shadowOffset={{ x: 1, y: isHovered ? 3 : 2 }}
        shadowOpacity={isHovered ? 0.25 : 0.15}
        hitStrokeWidth={10}
        cursor={isSelectable ? 'pointer' : 'default'}
        lineJoin="round"
      />

      {/* Folded corner triangle */}
      <Line
        points={foldPoints}
        closed
        fill={FOLD_COLOR}
        stroke={snapFlash ? '#34c759' : isSelected ? '#007aff' : isHovered ? '#005bb5' : BORDER_COLOR}
        strokeWidth={snapFlash ? 3 : isSelected ? 2.5 : 1.5}
        listening={false}
        lineJoin="round"
      />

      {/* Title text */}
      <Text
        x={PADDING}
        y={PADDING}
        width={width - FOLD_SIZE - PADDING * 2}
        height={TITLE_FONT_SIZE + 4}
        text={titleType}
        fontSize={TITLE_FONT_SIZE}
        fontFamily={FONT_FAMILY}
        fontStyle="bold"
        fill={titleColor}
        listening={false}
      />

      {/* Divider line below title */}
      <Line
        points={[
          PADDING,
          PADDING + TITLE_FONT_SIZE + TITLE_BOTTOM_MARGIN,
          width - FOLD_SIZE - PADDING,
          PADDING + TITLE_FONT_SIZE + TITLE_BOTTOM_MARGIN,
        ]}
        stroke="#cccccc"
        strokeWidth={0.5}
        listening={false}
      />

      {/* Content text */}
      <Text
        x={PADDING}
        y={PADDING + TITLE_FONT_SIZE + TITLE_BOTTOM_MARGIN + 4}
        width={width - FOLD_SIZE - PADDING * 2}
        height={height - PADDING - (PADDING + TITLE_FONT_SIZE + TITLE_BOTTOM_MARGIN + 4)}
        text={content || 'Enter description...'}
        fontSize={CONTENT_FONT_SIZE}
        fontFamily={FONT_FAMILY}
        fill={content ? CONTENT_COLOR : '#aaaaaa'}
        listening={false}
        lineHeight={LINE_HEIGHT / CONTENT_FONT_SIZE}
        wrap="word"
        align="left"
        verticalAlign="top"
      />

      {/* Selection control points */}
      {isSelected && (
        <ControlPoints
          x={0}
          y={0}
          width={width}
          height={height}
        />
      )}
    </Group>
  );
}

export default NoteBox;
