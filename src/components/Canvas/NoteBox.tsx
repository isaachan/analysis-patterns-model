import { useCallback } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Group, Rect, Text } from 'react-konva';
import type { NoteElement } from '../../models/diagram';
import { COLORS, FONTS } from '../../constants/designTokens';

interface NoteBoxProps {
  element: NoteElement;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

const PADDING = 12;

/**
 * Renders a semantic-note / annotation box.
 *
 * Styled as a yellow sticky-note with folded-corner effect (simulated
 * by a small triangle in the top-right). Supports click-to-select and
 * drag-to-move.
 */
function NoteBox({ element, isSelected, onSelect, onDragEnd }: NoteBoxProps) {
  const { id, content, layout } = element;

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

  const borderColor = isSelected ? COLORS.selection : COLORS.noteBorder;
  const borderWidth = isSelected ? 2 : 1;

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
      {/* Main body */}
      <Rect
        width={layout.width}
        height={layout.height}
        fill={COLORS.noteBg}
        stroke={borderColor}
        strokeWidth={borderWidth}
        cornerRadius={4}
        shadowColor="rgba(0,0,0,0.08)"
        shadowBlur={4}
        shadowOffset={{ x: 0, y: 1 }}
      />

      {/* Folded-corner triangle (simulated) */}
      <Rect
        x={layout.width - 16}
        y={0}
        width={16}
        height={16}
        fill={COLORS.canvasBg}
        cornerRadius={[0, 4, 0, 0]}
      />

      {/* Content text */}
      <Text
        text={content}
        x={PADDING}
        y={PADDING}
        width={layout.width - PADDING * 2}
        height={layout.height - PADDING * 2}
        fill={COLORS.typeText}
        fontSize={12}
        fontFamily={FONTS.ui}
        lineHeight={1.4}
      />
    </Group>
  );
}

export default NoteBox;
