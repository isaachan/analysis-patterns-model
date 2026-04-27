import { useCallback, useMemo } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Group, Rect, Text, Line } from 'react-konva';
import type { GeneralizationElement, Layout } from '../../models/diagram';
import { COLORS, FONTS } from '../../constants/designTokens';
import { computeOrthogonalConnection } from '../../utils/geometry';

interface GeneralizationBoxProps {
  element: GeneralizationElement;
  /** Layout of the parent Type, or null if no parent is assigned */
  parentLayout: Layout | null;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export const GEN_HEADER_HEIGHT = 26;
export const GEN_PADDING = 8;

/**
 * Renders a Generalization (super-type / sub-type) container.
 *
 * Visual structure:
 *   ┌─────────────────────────────┐
 *   │     Generalization Name     │ ← header (26px)
 *   ├─────────────────────────────┤
 *   │                             │
 *   │    (child Type elements)    │ ← content area
 *   │                             │
 *   ├─────────────────────────────┤
 *   │  (incomplete: extra line)   │ ← only for incomplete completeness
 *   └─────────────────────────────┘ ← single bottom line = complete
 *
 * Connection line:
 *   When a parent Type is assigned, a 2-segment orthogonal line is drawn
 *   from the parent Type's nearest edge to the container's nearest edge.
 *
 * Completeness visual:
 *   - Complete: just the rect's own bottom edge (single line)
 *   - Incomplete: extra horizontal line drawn inside, 5px above bottom edge
 */
function GeneralizationBox({
  element,
  parentLayout,
  isSelected,
  onSelect,
  onDragEnd,
}: GeneralizationBoxProps) {
  const { id, name, layout, completeness } = element;

  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(id);
    },
    [id, onSelect],
  );

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      onDragEnd(id, e.target.x(), e.target.y());
    },
    [id, onDragEnd],
  );

  const borderColor = isSelected ? COLORS.selection : COLORS.generalizationBorder;
  const borderWidth = isSelected ? 2 : 1.5;
  const headerFill = isSelected ? '#e8f4e8' : '#f0faf0';

  /**
   * Compute connection line points (orthogonal) from parent Type to this container.
   * Points are converted to be relative to the container Group's coordinate space.
   */
  const connectionLinePoints: number[] = useMemo(() => {
    if (!parentLayout) return [];
    const absPoints = computeOrthogonalConnection(parentLayout, layout);
    // Convert absolute canvas coords to relative-to-container coords
    const relPoints: number[] = [];
    for (let i = 0; i < absPoints.length; i += 2) {
      relPoints.push(absPoints[i] - layout.x);
      relPoints.push(absPoints[i + 1] - layout.y);
    }
    return relPoints;
  }, [parentLayout, layout]);

  return (
    <Group
      x={layout.x}
      y={layout.y}
      width={layout.width}
      height={layout.height}
      draggable
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={handleDragEnd}
    >
      {/* Connection line from parent Type (rendered behind the container) */}
      {connectionLinePoints.length > 0 && (
        <Line
          points={connectionLinePoints}
          stroke={COLORS.generalizationBorder}
          strokeWidth={2}
          lineCap="round"
          lineJoin="round"
        />
      )}

      {/* Container solid border background */}
      <Rect
        width={layout.width}
        height={layout.height}
        fill={COLORS.typeBg}
        stroke={borderColor}
        strokeWidth={borderWidth}
        cornerRadius={6}
      />

      {/* Header background */}
      <Rect
        x={0}
        y={0}
        width={layout.width}
        height={GEN_HEADER_HEIGHT}
        fill={headerFill}
        cornerRadius={[6, 6, 0, 0]}
      />

      {/* Header label */}
      <Text
        text={name}
        x={GEN_PADDING}
        y={0}
        width={layout.width - GEN_PADDING * 2}
        height={GEN_HEADER_HEIGHT}
        align="left"
        verticalAlign="middle"
        fill={COLORS.generalizationBorder}
        fontSize={12}
        fontFamily={FONTS.ui}
        fontStyle="bold"
      />

      {/* Incomplete completeness: extra horizontal line 5px above bottom edge */}
      {completeness === 'incomplete' && (
        <Line
          x={0}
          y={0}
          points={[
            8,
            layout.height - 5,
            layout.width - 8,
            layout.height - 5,
          ]}
          stroke={borderColor}
          strokeWidth={1.5}
          lineCap="round"
        />
      )}
    </Group>
  );
}

export default GeneralizationBox;
