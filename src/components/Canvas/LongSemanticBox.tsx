import { useCallback, useMemo } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Group, Rect, Text, Line } from 'react-konva';
import type { LongSemanticElement, Layout } from '../../models/diagram';
import { COLORS, FONTS } from '../../constants/designTokens';

interface LongSemanticBoxProps {
  element: LongSemanticElement;
  /** Layout of the attached element (Type or Relation), or null if free-floating */
  attachedLayout: Layout | null;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

const PADDING = 12;
const HEADING_HEIGHT = 20;
const FOLD_SIZE = 18;

/** Get heading text and color based on heading type */
function getHeadingStyle(heading: string): { label: string; color: string } {
  switch (heading) {
    case 'constraint':
      return { label: 'Constraint:', color: COLORS.constraintColor };
    case 'derivation':
      return { label: 'Derivation:', color: COLORS.derivationColor };
    case 'note':
    default:
      return { label: 'Note:', color: COLORS.noteHeadingColor };
  }
}

/**
 * Renders a Long Semantic Statement sticky-note.
 *
 * Visual structure:
 *   ┌───────────────────────┐
 *   │ ┌──────────────────┐  │
 *   │ │   fold triangle   │  │ ← folded corner (top-right)
 *   │ └──────────────────┘  │
 *   │  Constraint:          │ ← heading (italic bold, colored)
 *   │  some restriction     │ ← body text
 *   │  on Type-B            │
 *   └───────────────────────┘
 *
 * When attached to a Type or Relation, a dashed connector line is drawn
 * from this note's nearest edge to the attached element's nearest edge.
 */
function LongSemanticBox({
  element,
  attachedLayout,
  isSelected,
  onSelect,
  onDragEnd,
}: LongSemanticBoxProps) {
  const { id, heading, body, layout } = element;
  const headingStyle = useMemo(() => getHeadingStyle(heading), [heading]);

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

  const borderColor = isSelected ? COLORS.selection : COLORS.longNoteBorder;
  const borderWidth = isSelected ? 2 : 1;

  /**
   * Compute dashed connector line from this note to the attached element.
   * Line goes from note's nearest edge center to attached element's nearest edge center.
   */
  const connectorPoints: number[] = useMemo(() => {
    if (!attachedLayout) return [];

    const noteCx = layout.x + layout.width / 2;
    const noteCy = layout.y + layout.height / 2;
    const attachCx = attachedLayout.x + attachedLayout.width / 2;
    const attachCy = attachedLayout.y + attachedLayout.height / 2;

    // Find the nearest edge center on the note
    const noteEdges = [
      { x: layout.x + layout.width / 2, y: layout.y }, // top
      { x: layout.x + layout.width / 2, y: layout.y + layout.height }, // bottom
      { x: layout.x, y: layout.y + layout.height / 2 }, // left
      { x: layout.x + layout.width, y: layout.y + layout.height / 2 }, // right
    ];
    const nearestNoteEdge = noteEdges.reduce<{ dist: number; x: number; y: number }>((best, edge) => {
      const d = Math.hypot(edge.x - attachCx, edge.y - attachCy);
      return d < best.dist ? { dist: d, ...edge } : best;
    }, { dist: Infinity, x: 0, y: 0 });

    // Find the nearest edge center on the attached element
    const attachEdges = [
      { x: attachedLayout.x + attachedLayout.width / 2, y: attachedLayout.y },
      { x: attachedLayout.x + attachedLayout.width / 2, y: attachedLayout.y + attachedLayout.height },
      { x: attachedLayout.x, y: attachedLayout.y + attachedLayout.height / 2 },
      { x: attachedLayout.x + attachedLayout.width, y: attachedLayout.y + attachedLayout.height / 2 },
    ];
    const nearestAttachEdge = attachEdges.reduce<{ dist: number; x: number; y: number }>((best, edge) => {
      const d = Math.hypot(edge.x - noteCx, edge.y - noteCy);
      return d < best.dist ? { dist: d, ...edge } : best;
    }, { dist: Infinity, x: 0, y: 0 });

    return [
      nearestNoteEdge.x,
      nearestNoteEdge.y,
      nearestAttachEdge.x,
      nearestAttachEdge.y,
    ];
  }, [layout, attachedLayout]);

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
      {/* Dashed connector line to attached element */}
      {connectorPoints.length > 0 && (
        <Line
          points={connectorPoints}
          stroke={COLORS.connectorLine}
          strokeWidth={1}
          dash={[4, 3]}
          lineCap="round"
          listening={false}
        />
      )}

      {/* Main body */}
      <Rect
        width={layout.width}
        height={layout.height}
        fill={COLORS.longNoteBg}
        stroke={borderColor}
        strokeWidth={borderWidth}
        cornerRadius={4}
        shadowColor="rgba(0,0,0,0.08)"
        shadowBlur={4}
        shadowOffset={{ x: 0, y: 1 }}
      />

      {/* Folded corner triangle (top-right) */}
      <Rect
        x={layout.width - FOLD_SIZE}
        y={0}
        width={FOLD_SIZE}
        height={FOLD_SIZE}
        fill={COLORS.longNoteFold}
        cornerRadius={[0, 4, 0, 0]}
      />
      <Line
        points={[
          layout.width - FOLD_SIZE, 0,
          layout.width, 0,
          layout.width, FOLD_SIZE,
        ]}
        fill={COLORS.longNoteFold}
        stroke={COLORS.longNoteBorder}
        strokeWidth={0.5}
        listening={false}
        closed
      />

      {/* Heading */}
      <Text
        text={headingStyle.label}
        x={PADDING}
        y={PADDING}
        width={layout.width - PADDING * 2 - FOLD_SIZE}
        height={HEADING_HEIGHT}
        fill={headingStyle.color}
        fontSize={13}
        fontFamily={FONTS.ui}
        fontStyle="italic bold"
      />

      {/* Body text */}
      <Text
        text={body}
        x={PADDING}
        y={PADDING + HEADING_HEIGHT + 4}
        width={layout.width - PADDING * 2}
        height={layout.height - PADDING * 2 - HEADING_HEIGHT - 4}
        fill={COLORS.typeText}
        fontSize={13}
        fontFamily={FONTS.ui}
        lineHeight={1.45}
      />
    </Group>
  );
}

export default LongSemanticBox;
