import { useState, useEffect, useRef } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElement } from '../../store/useEditorStore';
import type { ToolMode } from '../../models/editor';
import useEditorStore from '../../store/useEditorStore';
import { TYPE_NODE_DEFAULT_WIDTH, TYPE_NODE_DEFAULT_HEIGHT } from '../../constants/defaults';
import { rectsOverlap, findNearestNonOverlappingPosition, computeOrthogonalPath } from '../../utils/geometry';
import type { Rect as GeoRect } from '../../utils/geometry';
import TypeNode from './TypeNode';

interface GeneralizationBoxProps {
  element: CanvasElement;
  isSelected: boolean;
  currentTool: ToolMode;
  onSelect: (id: string) => void;
  childTypes: CanvasElement[];
  onShortSemanticClick?: (id: string, clientX: number, clientY: number) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
}

const FONT_FAMILY = 'sans-serif';
const LABEL_HEIGHT = 24;
const BOTTOM_DOUBLE_LINE_OFFSET = 10;

function GeneralizationBox({
  element,
  isSelected,
  currentTool,
  onSelect,
  childTypes,
  onShortSemanticClick,
  onDragStart,
  onDragMove,
}: GeneralizationBoxProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOverlappingParent, setIsOverlappingParent] = useState(false);
  const [snapFlash, setSnapFlash] = useState(false);
  const snapFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasElements = useEditorStore((s) => s.canvasElements);
  const updateElement = useEditorStore((s) => s.updateElement);
  const setIsDragging = useEditorStore((s) => s.setIsDragging);
  const selectedIds = useEditorStore((s) => s.selectedIds);

  const width = element.width ?? 200;
  const height = element.height ?? 120;
  const isComplete = element.isComplete ?? true;

  const parentType = element.parentTypeId
    ? canvasElements.find((el) => el.id === element.parentTypeId)
    : null;

  // --- Child type expansion collision detection ---
  // When child types grow (e.g. name change) and the container needs to expand
  // to encompass them, check against other generalization containers and clamp
  // the expansion to avoid overlap.
  useEffect(() => {
    if (childTypes.length === 0) return;

    // Compute bounding box of all children relative to the container
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const child of childTypes) {
      const childW = child.width ?? TYPE_NODE_DEFAULT_WIDTH;
      const childH = child.height ?? TYPE_NODE_DEFAULT_HEIGHT;
      minX = Math.min(minX, child.x);
      minY = Math.min(minY, child.y);
      maxX = Math.max(maxX, child.x + childW);
      maxY = Math.max(maxY, child.y + childH);
    }

    const padding = 16;
    const neededWidth = maxX - minX + padding * 2;
    const neededHeight = maxY - minY + padding * 2;

    // Trigger resize only when children exceed current container bounds
    if (neededWidth > width || neededHeight > height) {
      const currentWidth = element.width ?? 200;
      const currentHeight = element.height ?? 120;
      let newWidth = Math.max(currentWidth, neededWidth);
      let newHeight = Math.max(currentHeight, neededHeight);

      // Check for overlap with other generalization containers at the larger size
      const allGeneralizations = canvasElements.filter(
        (el) => el.type === 'generalization' && el.id !== element.id,
      );
      const otherRects: GeoRect[] = allGeneralizations.map((g) => ({
        x: g.x,
        y: g.y,
        width: g.width ?? 200,
        height: g.height ?? 120,
      }));

      if (otherRects.length > 0) {
        const expandedRect: GeoRect = {
          x: element.x,
          y: element.y,
          width: newWidth,
          height: newHeight,
        };

        const hasOverlap = otherRects.some((r) => rectsOverlap(expandedRect, r));

        if (hasOverlap) {
          // Clamp expansion: try to find the largest non-overlapping size.
          // Shrink the container back until it no longer overlaps or is back to default.
          const clamped = findNearestNonOverlappingPosition(expandedRect, otherRects);
          newWidth = clamped.x + newWidth - element.x;
          newHeight = clamped.y + newHeight - element.y;

          // Don't shrink below current width/height
          newWidth = Math.max(currentWidth, newWidth);
          newHeight = Math.max(currentHeight, newHeight);

          // Final overlap check after clamping
          const clampedRect: GeoRect = {
            x: element.x,
            y: element.y,
            width: newWidth,
            height: newHeight,
          };
          if (otherRects.some((r) => rectsOverlap(clampedRect, r))) {
            // Still overlaps, keep original size
            newWidth = currentWidth;
            newHeight = currentHeight;
          }
        }
      }

      updateElement(element.id, { width: newWidth, height: newHeight });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childTypes.length, JSON.stringify(childTypes.map((c) => c.x + c.y + (c.width ?? TYPE_NODE_DEFAULT_WIDTH) + (c.height ?? TYPE_NODE_DEFAULT_HEIGHT) + (c.name ?? ''))), element.x, element.y, element.id, width, height]);

  const isSelectable = currentTool === 'select';

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

    // Desired position from Konva node drag
    const rawX = node.x();
    const rawY = node.y();
    let targetX = rawX;
    let targetY = rawY;

    // --- Grid snap (before collision detection so collisions work on grid positions) ---
    const snapState = useEditorStore.getState();
    if (snapState.snapEnabled && snapState.gridSize > 0) {
      targetX = Math.round(targetX / snapState.gridSize) * snapState.gridSize;
      targetY = Math.round(targetY / snapState.gridSize) * snapState.gridSize;
      node.position({ x: targetX, y: targetY });

      // Trigger visual flash when snap actually adjusts the position
      if (rawX !== targetX || rawY !== targetY) {
        setSnapFlash(true);
        if (snapFlashTimerRef.current) {
          clearTimeout(snapFlashTimerRef.current);
        }
        snapFlashTimerRef.current = setTimeout(() => {
          setSnapFlash(false);
        }, 200);
      }
    }

    // --- Parent type overlap detection ---
    if (parentType) {
      const currentRect: GeoRect = {
        x: targetX,
        y: targetY,
        width: element.width ?? 200,
        height: element.height ?? 120,
      };
      const parentRect: GeoRect = {
        x: parentType.x,
        y: parentType.y,
        width: parentType.width ?? TYPE_NODE_DEFAULT_WIDTH,
        height: parentType.height ?? TYPE_NODE_DEFAULT_HEIGHT,
      };

      const overlapping = rectsOverlap(currentRect, parentRect);
      setIsOverlappingParent(overlapping);

      if (overlapping) {
        const snapped = findNearestNonOverlappingPosition(currentRect, [parentRect]);
        targetX = snapped.x;
        targetY = snapped.y;
        // Visually snap the Konva node back
        node.position({ x: targetX, y: targetY });
      }
    } else {
      setIsOverlappingParent(false);
    }

    // --- Collision detection against other generalization containers ---
    const otherGeneralizations = canvasElements.filter(
      (el) => el.type === 'generalization' && el.id !== element.id,
    );

    if (otherGeneralizations.length > 0) {
      const currentRect: GeoRect = {
        x: targetX,
        y: targetY,
        width: element.width ?? 200,
        height: element.height ?? 120,
      };
      const otherRects: GeoRect[] = otherGeneralizations.map((g) => ({
        x: g.x,
        y: g.y,
        width: g.width ?? 200,
        height: g.height ?? 120,
      }));

      if (otherRects.some((r) => rectsOverlap(currentRect, r))) {
        const snapped = findNearestNonOverlappingPosition(currentRect, otherRects);
        targetX = snapped.x;
        targetY = snapped.y;
        // Visually snap the Konva node back
        node.position({ x: targetX, y: targetY });
      }
    }

    const dx = targetX - element.x;
    const dy = targetY - element.y;

    // Update container position
    updateElement(element.id, { x: targetX, y: targetY });

    // Update all child type positions to move together
    childTypes.forEach((child) => {
      updateElement(child.id, {
        x: child.x + dx,
        y: child.y + dy,
      });
    });

    onDragMove?.(element.id, targetX, targetY);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setIsDragging(false);

    let targetX = e.target.x();
    let targetY = e.target.y();

    // --- Grid snap (before collision detection) ---
    const snapState = useEditorStore.getState();
    if (snapState.snapEnabled && snapState.gridSize > 0) {
      targetX = Math.round(targetX / snapState.gridSize) * snapState.gridSize;
      targetY = Math.round(targetY / snapState.gridSize) * snapState.gridSize;
      e.target.position({ x: targetX, y: targetY });
    }

    // --- Parent type overlap check ---
    if (parentType) {
      const currentRect: GeoRect = {
        x: targetX,
        y: targetY,
        width: element.width ?? 200,
        height: element.height ?? 120,
      };
      const parentRect: GeoRect = {
        x: parentType.x,
        y: parentType.y,
        width: parentType.width ?? TYPE_NODE_DEFAULT_WIDTH,
        height: parentType.height ?? TYPE_NODE_DEFAULT_HEIGHT,
      };

      if (rectsOverlap(currentRect, parentRect)) {
        const snapped = findNearestNonOverlappingPosition(currentRect, [parentRect]);
        targetX = snapped.x;
        targetY = snapped.y;
        e.target.position({ x: targetX, y: targetY });
      }
    }

    setIsOverlappingParent(false);

    // --- Final collision check against other generalization containers (safety net) ---
    const otherGeneralizations = canvasElements.filter(
      (el) => el.type === 'generalization' && el.id !== element.id,
    );

    if (otherGeneralizations.length > 0) {
      const currentRect: GeoRect = {
        x: targetX,
        y: targetY,
        width: element.width ?? 200,
        height: element.height ?? 120,
      };
      const otherRects: GeoRect[] = otherGeneralizations.map((g) => ({
        x: g.x,
        y: g.y,
        width: g.width ?? 200,
        height: g.height ?? 120,
      }));

      if (otherRects.some((r) => rectsOverlap(currentRect, r))) {
        const snapped = findNearestNonOverlappingPosition(currentRect, otherRects);
        targetX = snapped.x;
        targetY = snapped.y;
        e.target.position({ x: targetX, y: targetY });
      }
    }

    const dx = targetX - element.x;
    const dy = targetY - element.y;

    // Final position updates
    updateElement(element.id, { x: targetX, y: targetY });
    childTypes.forEach((child) => {
      updateElement(child.id, {
        x: child.x + dx,
        y: child.y + dy,
      });
    });

    onDragMove?.(element.id, targetX, targetY);
  };

  return (
    <Group>
      {/* Connection line from parent Type to this box */}
      {parentType && (() => {
        const parentX = parentType.x;
        const parentY = parentType.y;
        const parentW = parentType.width ?? TYPE_NODE_DEFAULT_WIDTH;
        const parentH = parentType.height ?? TYPE_NODE_DEFAULT_HEIGHT;

        const parentRect: GeoRect = {
          x: parentX,
          y: parentY,
          width: parentW,
          height: parentH,
        };
        const containerRect: GeoRect = {
          x: element.x,
          y: element.y,
          width,
          height,
        };

        const overlapping = rectsOverlap(parentRect, containerRect);

        if (overlapping) {
          // Use orthogonal path routing to find non-overlapping edges
          const pathPoints = computeOrthogonalPath(parentRect, containerRect);
          const flatPoints = pathPoints.flatMap((p) => [p.x, p.y]);
          return (
            <Line
              points={flatPoints}
              stroke="#666666"
              strokeWidth={1.5}
              lineCap="round"
              listening={false}
            />
          );
        }

        // Line from parent bottom center to box top center
        const startX = parentX + parentW / 2;
        const startY = parentY + parentH;
        const endX = element.x + width / 2;
        const endY = element.y;

        return (
          <Line
            points={[startX, startY, endX, endY]}
            stroke="#666666"
            strokeWidth={1.5}
            lineCap="round"
            listening={false}
          />
        );
      })()}

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
        {/* Main container rectangle */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#ffffff"
          stroke={snapFlash ? '#34c759' : isOverlappingParent ? '#ff0000' : isSelected ? '#007aff' : isHovered ? '#005bb5' : '#333333'}
          strokeWidth={snapFlash ? 3 : isOverlappingParent ? 3 : isSelected ? 2.5 : 1.5}
          cornerRadius={4}
          shadowColor="#000000"
          shadowBlur={isHovered ? 8 : 4}
          shadowOffset={{ x: 1, y: isHovered ? 3 : 2 }}
          shadowOpacity={isHovered ? 0.25 : 0.15}
          hitStrokeWidth={10}
          cursor={isSelectable ? 'pointer' : 'default'}
        />

        {/* Label at top-right */}
        <Text
          x={8}
          y={4}
          width={width - 16}
          height={LABEL_HEIGHT}
          text={element.name || 'Generalization'}
          fontSize={12}
          fill="#888888"
          fontFamily={FONT_FAMILY}
          align="right"
          verticalAlign="middle"
          listening={false}
        />

        {/* Divider line under label */}
        <Line
          points={[4, LABEL_HEIGHT + 4, width - 4, LABEL_HEIGHT + 4]}
          stroke="#cccccc"
          strokeWidth={0.5}
          listening={false}
        />

        {/* Double line at bottom when isComplete is false */}
        {!isComplete && (
          <Line
            points={[
              8,
              height - BOTTOM_DOUBLE_LINE_OFFSET,
              width - 8,
              height - BOTTOM_DOUBLE_LINE_OFFSET,
            ]}
            stroke="#333333"
            strokeWidth={1.5}
            listening={false}
          />
        )}

        {/* Child Type nodes rendered inside the container */}
        {childTypes.map((child) => (
          <TypeNode
            key={child.id}
            element={child}
            isSelected={selectedIds.includes(child.id)}
            currentTool={currentTool}
            onSelect={onSelect}
            onShortSemanticClick={onShortSemanticClick}
            containerOffset={{ x: element.x, y: element.y }}
          />
        ))}
      </Group>
    </Group>
  );
}

export default GeneralizationBox;
