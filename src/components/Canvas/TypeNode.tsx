import { useCallback, useState, useMemo } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Group, Rect, Text } from 'react-konva';
import type { TypeElement } from '../../models/diagram';
import { COLORS, FONTS } from '../../constants/designTokens';

interface TypeNodeProps {
  element: TypeElement;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  /** Called when clicking in relation mode instead of onSelect */
  onRelationClick?: (id: string) => void;
  /** Whether this node is highlighted as a relation source */
  isRelationSource?: boolean;
  /** Whether this node is highlighted as a potential relation target */
  isRelationTarget?: boolean;
}

const HEADER_HEIGHT = 28;
const LINE_HEIGHT = 18;
const PADDING = 8;
const ATTR_START_Y = HEADER_HEIGHT + PADDING;

/**
 * Renders a Type node – the primary building block of an ER / analysis-pattern diagram.
 *
 * Layout:
 *   ┌──────────────────────┐
 *   │      Customer        │  ← header bar (blue fill, white text)
 *   ├──────────────────────┤
 *   │  customerId: int     │  ← attributes list
 *   │  name: string        │
 *   │  email: string       │
 *   ├──────────────────────┤
 *   │  placeOrder()        │  ← methods list
 *   └──────────────────────┘
 *
 * Supports click-to-select and drag-to-move.
 */
function TypeNode({
  element,
  isSelected,
  onSelect,
  onDragEnd,
  onRelationClick,
  isRelationSource,
  isRelationTarget,
}: TypeNodeProps) {
  const { id, name, attributes, methods, semantics, layout } = element;
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (onRelationClick) {
        onRelationClick(id);
      } else {
        onSelect(id);
      }
    },
    [id, onSelect, onRelationClick],
  );

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      onDragEnd(id, e.target.x(), e.target.y());
    },
    [id, onDragEnd],
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const isInRelationMode = !!onRelationClick;

  let borderColor: string;
  if (isRelationTarget) {
    borderColor = COLORS.selection;
  } else if (isRelationSource) {
    borderColor = COLORS.selection;
  } else if (isSelected) {
    borderColor = COLORS.selection;
  } else {
    borderColor = COLORS.typeBorder;
  }

  const borderWidth = isRelationSource || isRelationTarget ? 3 : isSelected ? 2 : 1;
  const headerFill = isHovered ? COLORS.hover : COLORS.typeHeader;
  const bodyFill = isRelationTarget ? '#e8f4ff' : isHovered ? '#f0f5ff' : COLORS.typeBg;

  /** Build the semantic markers display text (e.g. "[abstract] [immutable]") */
  const semanticText = useMemo(() => {
    if (!semantics || semantics.length === 0) return '';
    return semantics
      .map((s) => (s.keyType ? `[${s.type}: ${s.keyType}]` : `[${s.type}]`))
      .join(' ');
  }, [semantics]);

  return (
    <Group
      x={layout.x}
      y={layout.y}
      width={layout.width}
      height={layout.height}
      name="type-node"
      id={id}
      draggable={!isInRelationMode}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Short semantic markers (above the body box) */}
      {semanticText && (
        <Text
          text={semanticText}
          x={0}
          y={-18}
          width={layout.width}
          height={16}
          align="center"
          verticalAlign="middle"
          fill={COLORS.semanticText}
          fontSize={11}
          fontFamily={FONTS.ui}
        />
      )}

      {/* Body background */}
      <Rect
        width={layout.width}
        height={layout.height}
        fill={bodyFill}
        stroke={borderColor}
        strokeWidth={borderWidth}
        cornerRadius={6}
        shadowColor={isHovered ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)'}
        shadowBlur={isHovered ? 10 : 6}
        shadowOffset={{ x: 0, y: 2 }}
        shadowEnabled
      />

      {/* Header bar */}
      <Rect
        width={layout.width}
        height={HEADER_HEIGHT}
        fill={headerFill}
        cornerRadius={[6, 6, 0, 0]}
      />

      {/* Entity name in header (centered) */}
      <Text
        text={name}
        x={0}
        y={0}
        width={layout.width}
        height={HEADER_HEIGHT}
        align="center"
        verticalAlign="middle"
        fill="#ffffff"
        fontSize={13}
        fontFamily={FONTS.ui}
        fontStyle="bold"
      />

      {/* Attributes */}
      {attributes.map((attr, i) => (
        <Text
          key={`attr-${i}`}
          text={attr}
          x={PADDING}
          y={ATTR_START_Y + i * LINE_HEIGHT}
          width={layout.width - PADDING * 2}
          height={LINE_HEIGHT}
          fill={COLORS.typeText}
          fontSize={12}
          fontFamily={FONTS.mono}
        />
      ))}

      {/* Methods (rendered below a thin separator after attributes) */}
      {methods.length > 0 && (
        <>
          <Rect
            x={PADDING}
            y={ATTR_START_Y + attributes.length * LINE_HEIGHT}
            width={layout.width - PADDING * 2}
            height={1}
            fill={COLORS.gridLine}
          />
          {methods.map((method, i) => (
            <Text
              key={`method-${i}`}
              text={method}
              x={PADDING}
              y={ATTR_START_Y + (attributes.length + 1 + i) * LINE_HEIGHT}
              width={layout.width - PADDING * 2}
              height={LINE_HEIGHT}
              fill={COLORS.typeText}
              fontSize={12}
              fontFamily={FONTS.mono}
              fontStyle="italic"
            />
          ))}
        </>
      )}
    </Group>
  );
}

export default TypeNode;
