import { useMemo } from 'react';
import { Circle, Rect } from 'react-konva';
import { GRID_SIZE } from '../../constants/defaults';
import { COLORS } from '../../constants/designTokens';
import { useEditorStore } from '../../store/useEditorStore';

interface GridLayerProps {
  width: number;
  height: number;
}

/**
 * Renders a dot-grid background on the canvas.
 *
 * Instead of drawing full grid lines (which can be visually heavy), this
 * component paints evenly spaced dots at every grid-size interval. The
 * grid scrolls and zooms with the canvas content.
 *
 * A transparent full-size Rect is included at the bottom to catch
 * pointer events (deselect, start-relation, etc.) that miss all shapes.
 */
function GridLayer({ width, height }: GridLayerProps) {
  const gridEnabled = useEditorStore((s) => s.gridEnabled);

  const dots = useMemo(() => {
    if (!gridEnabled) return [];

    const positions: { x: number; y: number }[] = [];
    const cols = Math.ceil(width / GRID_SIZE);
    const rows = Math.ceil(height / GRID_SIZE);

    for (let col = 0; col <= cols; col++) {
      for (let row = 0; row <= rows; row++) {
        positions.push({ x: col * GRID_SIZE, y: row * GRID_SIZE });
      }
    }
    return positions;
  }, [width, height, gridEnabled]);

  return (
    <>
      {dots.map((dot, i) => (
        <Circle
          key={`grid-${i}`}
          x={dot.x}
          y={dot.y}
          radius={1}
          fill={COLORS.gridLine}
          listening={false}
        />
      ))}
      {/* Invisible background rect to catch empty-area clicks */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        listening={true}
      />
    </>
  );
}

export default GridLayer;
