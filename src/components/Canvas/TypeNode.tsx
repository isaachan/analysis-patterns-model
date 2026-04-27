import { useState, useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { ToolMode } from '../../models/editor';
import type { CanvasElement } from '../../store/useEditorStore';
import useEditorStore from '../../store/useEditorStore';
import {
  TYPE_NODE_DEFAULT_WIDTH,
  TYPE_NODE_DEFAULT_HEIGHT,
} from '../../constants/defaults';

interface TypeNodeProps {
  element: CanvasElement;
  isSelected: boolean;
  currentTool: ToolMode;
  onSelect: (id: string) => void;
  isRelationSource?: boolean;
  isRelationDragTarget?: boolean;
  onRelationDragStart?: (sourceId: string) => void;
  onRelationDragMove?: (pos: { x: number; y: number }) => void;
  onRelationDragEnd?: (pos: { x: number; y: number }) => void;
  onShortSemanticClick?: (id: string, clientX: number, clientY: number) => void;
  /** Called during select-mode drag to notify parent of position change (for attached notes following). */
  onSelectDragMove?: (id: string, x: number, y: number) => void;
  /** Called when select-mode drag starts (for multi-drag). */
  onSelectDragStart?: (id: string) => void;
  /** When the TypeNode is rendered inside a container (e.g. GeneralizationBox),
   *  this offset is subtracted from element.x/y for display, and added back
   *  when updating the store during drag. */
  containerOffset?: { x: number; y: number };
}

const FONT_SIZE = 14;
const TAG_FONT_SIZE = 11;
const TAG_PADDING_BOTTOM = 3;
const FONT_FAMILY = 'sans-serif';
const PADDING_X = 20;
const CONTROL_POINT_SIZE = 8;

function measureTextWidth(text: string): number {
  if (typeof document === 'undefined') return 0;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  return Math.ceil(ctx.measureText(text).width);
}

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
        <Rect
          key={i}
          x={corner.x}
          y={corner.y}
          width={CONTROL_POINT_SIZE}
          height={CONTROL_POINT_SIZE}
          fill="#ffffff"
          stroke="#007aff"
          strokeWidth={1.5}
          cornerRadius={1}
          listening={false}
        />
      ))}
    </>
  );
}

function TypeNode({ element, isSelected, currentTool, onSelect, isRelationSource, isRelationDragTarget, onRelationDragStart, onRelationDragMove, onRelationDragEnd, onShortSemanticClick, onSelectDragMove, onSelectDragStart, containerOffset }: TypeNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [snapFlash, setSnapFlash] = useState(false);
  const snapFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateElement = useEditorStore((s) => s.updateElement);
  const setIsDragging = useEditorStore((s) => s.setIsDragging);
  const text = element.name ?? 'Type';
  const textWidth = measureTextWidth(text);
  const width = Math.max(
    element.width ?? TYPE_NODE_DEFAULT_WIDTH,
    textWidth + PADDING_X * 2,
  );
  const height = element.height ?? TYPE_NODE_DEFAULT_HEIGHT;

  // When rendered inside a container, display position is relative to container
  const offsetX = containerOffset?.x ?? 0;
  const offsetY = containerOffset?.y ?? 0;
  const displayX = element.x - offsetX;
  const displayY = element.y - offsetY;

  const isSelectable = currentTool === 'select';
  const isRelationMode = currentTool === 'relation';
  const isShortSemanticMode = currentTool === 'shortSemantic';

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isShortSemanticMode) {
      e.cancelBubble = true;
      onShortSemanticClick?.(element.id, e.evt.clientX, e.evt.clientY);
      return;
    }
    if (isSelectable) {
      e.cancelBubble = true;
      onSelect(element.id);
    }
    // In relation mode, clicks are handled by drag events.
  };

  const handleMouseEnter = () => {
    if (isSelectable || isRelationMode || isShortSemanticMode) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (isRelationMode) {
      onSelect(element.id);
      onRelationDragStart?.(element.id);
      setIsDragging(true);
      e.target.position({ x: displayX, y: displayY });
      return;
    }
    // Preserve multi-selection: don't overwrite if already selected
    if (!isSelected) {
      onSelect(element.id);
    }
    setIsDragging(true);
    onSelectDragMove?.(element.id, element.x, element.y);
    onSelectDragStart?.(element.id);
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (isRelationMode) {
      e.target.position({ x: displayX, y: displayY });
      const stage = e.target.getStage();
      if (stage) {
        const pos = stage.getPointerPosition();
        if (pos) onRelationDragMove?.(pos);
      }
      return;
    }
    const node = e.target;
    const rawX = node.x() + offsetX;
    const rawY = node.y() + offsetY;
    let newX = rawX;
    let newY = rawY;

    // Snap to grid when enabled
    const snapState = useEditorStore.getState();
    if (snapState.snapEnabled && snapState.gridSize > 0) {
      newX = Math.round(newX / snapState.gridSize) * snapState.gridSize;
      newY = Math.round(newY / snapState.gridSize) * snapState.gridSize;
      // Update the visual Konva node position to match snapped coordinates
      node.position({ x: newX - offsetX, y: newY - offsetY });

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
    onSelectDragMove?.(element.id, newX, newY);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setIsDragging(false);
    if (isRelationMode) {
      const stage = e.target.getStage();
      if (stage) {
        const pos = stage.getPointerPosition();
        if (pos) onRelationDragEnd?.(pos);
      }
      return;
    }
    const node = e.target;
    let newX = node.x() + offsetX;
    let newY = node.y() + offsetY;

    // Snap to grid when enabled
    const snapState = useEditorStore.getState();
    if (snapState.snapEnabled && snapState.gridSize > 0) {
      newX = Math.round(newX / snapState.gridSize) * snapState.gridSize;
      newY = Math.round(newY / snapState.gridSize) * snapState.gridSize;
      // Update the visual Konva node position to match snapped coordinates
      node.position({ x: newX - offsetX, y: newY - offsetY });
    }

    updateElement(element.id, {
      x: newX,
      y: newY,
    });
    onSelectDragMove?.(element.id, newX, newY);
  };

  return (
    <Group
      x={displayX}
      y={displayY}
      draggable={isSelectable || isRelationMode}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {/* Short semantic tag above the box */}
      {element.shortSemantic && (
        <Text
          x={0}
          y={-TAG_FONT_SIZE - TAG_PADDING_BOTTOM}
          width={width}
          text={`[${element.shortSemantic}]`}
          fontSize={TAG_FONT_SIZE}
          fill="#888888"
          fontFamily={FONT_FAMILY}
          align="center"
          listening={false}
        />
      )}
      <Rect
        id={element.id}
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#ffffff"
        stroke={snapFlash ? '#34c759' : isRelationDragTarget ? '#34c759' : isRelationSource ? '#ff9500' : isSelected ? '#007aff' : isHovered ? '#005bb5' : '#333333'}
        strokeWidth={snapFlash ? 3 : isRelationDragTarget ? 3 : isRelationSource ? 2.5 : isSelected ? 2.5 : 1.5}
        cornerRadius={4}
        shadowColor="#000000"
        shadowBlur={isHovered ? 8 : 4}
        shadowOffset={{ x: 1, y: isHovered ? 3 : 2 }}
        shadowOpacity={isHovered ? 0.25 : 0.15}
        onClick={handleClick}
        onTap={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        hitStrokeWidth={10}
        cursor={isSelectable || isRelationMode || isShortSemanticMode ? 'pointer' : 'default'}
        dash={isRelationDragTarget ? [6, 3] : isRelationSource ? [6, 3] : undefined}
      />
      <Text
        x={0}
        y={0}
        width={width}
        height={height}
        text={text}
        fontSize={FONT_SIZE}
        fill="#333333"
        fontFamily={FONT_FAMILY}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
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

export default TypeNode;
