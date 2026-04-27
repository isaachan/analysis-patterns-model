import { useState } from 'react';
import { Group, Path, Line, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElement, AttachmentPoint } from '../../store/useEditorStore';
import type { ToolMode } from '../../models/editor';
import useEditorStore from '../../store/useEditorStore';
import useHistoryStore from '../../store/useHistoryStore';
import {
  TYPE_NODE_DEFAULT_WIDTH,
  TYPE_NODE_DEFAULT_HEIGHT,
} from '../../constants/defaults';
import { computePathWithWaypoints, getEdgePoint, pointToAttachment } from '../../utils/geometry';
import type { Rect, Point } from '../../utils/geometry';
import { computeCardinalityElements } from '../../utils/cardinality';
import type { Cardinality } from '../../utils/cardinality';

interface RelationLineProps {
  element: CanvasElement;
  typeElements: CanvasElement[];
  isSelected?: boolean;
  currentTool: ToolMode;
  onShortSemanticClick?: (id: string, clientX: number, clientY: number) => void;
}

/**
 * Compute arrowhead points as a closed triangle.
 * @param x  Tip x
 * @param y  Tip y
 * @param angle  Direction the arrow points (radians)
 * @param size  Arrowhead size in px
 * @returns Flat array of [x,y,x,y,x,y] for the triangle
 */
function arrowPoints(
  x: number,
  y: number,
  angle: number,
  size = 8,
): number[] {
  const dx = size * Math.cos(angle);
  const dy = size * Math.sin(angle);
  const wing = Math.PI / 6; // 30 degrees
  return [
    x, y,
    x - dx * Math.cos(wing) + dy * Math.sin(wing),
    y - dy * Math.cos(wing) - dx * Math.sin(wing),
    x - dx * Math.cos(wing) - dy * Math.sin(wing),
    y - dy * Math.cos(wing) + dx * Math.sin(wing),
  ];
}

function SelfReferenceLoop({
  sourceEl,
  isSelected,
  handleClick,
  currentTool,
  elementId,
  sourceAttachment,
  targetAttachment,
  sourceCardinality: srcCard,
  targetCardinality: tgtCard,
  shortSemantic,
}: {
  sourceEl: CanvasElement;
  isSelected?: boolean;
  handleClick: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  currentTool: string;
  elementId: string;
  sourceAttachment?: AttachmentPoint;
  targetAttachment?: AttachmentPoint;
  sourceCardinality?: string;
  targetCardinality?: string;
  shortSemantic?: string;
}) {
  const nodeW = sourceEl.width ?? TYPE_NODE_DEFAULT_WIDTH;
  const nodeH = sourceEl.height ?? TYPE_NODE_DEFAULT_HEIGHT;
  const nodeX = sourceEl.x;
  const nodeY = sourceEl.y;

  const sourceRect: Rect = { x: nodeX, y: nodeY, width: nodeW, height: nodeH };

  // Start point: right edge, upper third (or from attachment if provided)
  const startY = sourceAttachment
    ? getEdgePoint(sourceRect, sourceAttachment).y
    : nodeY + nodeH * 0.2;
  // End point: right edge, lower third (or from attachment if provided)
  const endY = targetAttachment
    ? getEdgePoint(sourceRect, targetAttachment).y
    : nodeY + nodeH * 0.8;
  const rightX = nodeX + nodeW;

  // How far the arc extends to the right (proportional to node size)
  const loopWidth = Math.max(nodeW * 0.65, 45);

  // Cubic bezier parameters
  // M rightX,startY C rightX+loopWidth,startY rightX+loopWidth,endY rightX,endY
  const pathData = `M ${rightX} ${startY} C ${rightX + loopWidth} ${startY}, ${rightX + loopWidth} ${endY}, ${rightX} ${endY}`;

  const [isHovered, setIsHovered] = useState(false);

  const strokeColor = isSelected ? '#007aff' : isHovered && currentTool === 'select' ? '#444444' : '#666666';
  const arrowSize = isSelected ? 9 : 8;
  const hoverStrokeWidth = isSelected ? 2.5 : isHovered && currentTool === 'select' ? 2 : 1.5;

  // Cardinality symbol geometries
  const srcCardValue = (srcCard ?? '[1,1]') as Cardinality;
  const tgtCardValue = (tgtCard ?? '[1,1]') as Cardinality;
  // Source exits the node rightward (angle = 0), target re-enters from the right
  // so "away from node" for both ends is rightward (angle = 0)
  const srcCardElements = computeCardinalityElements(srcCardValue, rightX, startY, 0);
  const tgtCardElements = computeCardinalityElements(tgtCardValue, rightX, endY, 0);

  const handleMouseEnter = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (currentTool !== 'select' && currentTool !== 'shortSemantic') return;
    setIsHovered(true);
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = 'pointer';
    }
  };

  const handleMouseLeave = (e: Konva.KonvaEventObject<MouseEvent>) => {
    setIsHovered(false);
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = '';
    }
  };

  // Midpoint of the loop arc for short semantic tag
  const loopTagX = rightX + loopWidth / 2;
  const loopTagY = (startY + endY) / 2;

  // Tangent at start: from start to first CP -> angle = 0 (rightward)
  // Tangent at end: from second CP to end -> angle = Math.PI (leftward)
  return (
    <Group onClick={handleClick} onTap={handleClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Visible curved path */}
      <Path
        data={pathData}
        stroke={strokeColor}
        strokeWidth={hoverStrokeWidth}
        lineCap="round"
        listening={false}
      />
      {/* Arrowhead at start (pointing right, away from node) */}
      <Line
        points={arrowPoints(rightX, startY, 0, arrowSize)}
        closed
        fill={strokeColor}
        stroke={strokeColor}
        strokeWidth={1}
        listening={false}
      />
      {/* Arrowhead at end (pointing left, into the node) */}
      <Line
        points={arrowPoints(rightX, endY, Math.PI, arrowSize)}
        closed
        fill={strokeColor}
        stroke={strokeColor}
        strokeWidth={1}
        listening={false}
      />
      {/* Invisible wide hit area for easy clicking */}
      <Path
        data={pathData}
        stroke="transparent"
        strokeWidth={18}
        lineCap="round"
        listening={true}
      />
      {/* Source-end Cardinality symbol (arc start) */}
      {srcCardElements && (
        <Group>
          {srcCardElements.bars.map((bar, i) => (
            <Line key={`sref-src-bar-${i}`} points={[bar.x1, bar.y1, bar.x2, bar.y2]} stroke={strokeColor} strokeWidth={1.5} listening={false} />
          ))}
          {srcCardElements.circles.map((circle, i) => (
            <Circle key={`sref-src-circle-${i}`} x={circle.cx} y={circle.cy} radius={circle.r} stroke={strokeColor} strokeWidth={1.5} listening={false} />
          ))}
          {srcCardElements.crowFootLines.map((cf, i) => (
            <Line key={`sref-src-cf-${i}`} points={[cf.x1, cf.y1, cf.x2, cf.y2]} stroke={strokeColor} strokeWidth={1.5} listening={false} />
          ))}
        </Group>
      )}
      {/* Target-end Cardinality symbol (arc end) */}
      {tgtCardElements && (
        <Group>
          {tgtCardElements.bars.map((bar, i) => (
            <Line key={`sref-tgt-bar-${i}`} points={[bar.x1, bar.y1, bar.x2, bar.y2]} stroke={strokeColor} strokeWidth={1.5} listening={false} />
          ))}
          {tgtCardElements.circles.map((circle, i) => (
            <Circle key={`sref-tgt-circle-${i}`} x={circle.cx} y={circle.cy} radius={circle.r} stroke={strokeColor} strokeWidth={1.5} listening={false} />
          ))}
          {tgtCardElements.crowFootLines.map((cf, i) => (
            <Line key={`sref-tgt-cf-${i}`} points={[cf.x1, cf.y1, cf.x2, cf.y2]} stroke={strokeColor} strokeWidth={1.5} listening={false} />
          ))}
        </Group>
      )}
      {/* Short semantic tag */}
      {shortSemantic && (
        <Text
          x={loopTagX - 40}
          y={loopTagY - 25}
          width={80}
          text={`[${shortSemantic}]`}
          fontSize={11}
          fill="#888888"
          fontFamily="sans-serif"
          align="center"
          listening={false}
        />
      )}
      {/* Draggable endpoint handles when selected */}
      {isSelected && currentTool === 'select' && (
        <>
          <Circle
            x={rightX}
            y={startY}
            radius={5}
            fill="white"
            stroke="#007aff"
            strokeWidth={2}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
            }}
            onDragMove={(e) => {
              const pos = { x: e.target.x(), y: e.target.y() };
              const newAttach = pointToAttachment(sourceRect, pos.x, pos.y);
              useEditorStore.getState().updateElement(elementId, { sourceAttachment: newAttach });
            }}
          />
          <Circle
            x={rightX}
            y={endY}
            radius={5}
            fill="white"
            stroke="#007aff"
            strokeWidth={2}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
            }}
            onDragMove={(e) => {
              const pos = { x: e.target.x(), y: e.target.y() };
              const newAttach = pointToAttachment(sourceRect, pos.x, pos.y);
              useEditorStore.getState().updateElement(elementId, { targetAttachment: newAttach });
            }}
          />
        </>
      )}
    </Group>
  );
}

function NormalRelationLine({
  sourceEl,
  targetEl,
  isSelected,
  handleClick,
  currentTool,
  elementId,
  sourceCardinality: srcCard,
  targetCardinality: tgtCard,
  shortSemantic,
  sourceAttachment,
  targetAttachment,
  waypoints,
}: {
  sourceEl: CanvasElement;
  targetEl: CanvasElement;
  isSelected?: boolean;
  handleClick: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  currentTool: string;
  elementId: string;
  sourceCardinality?: string;
  targetCardinality?: string;
  shortSemantic?: string;
  sourceAttachment?: AttachmentPoint;
  targetAttachment?: AttachmentPoint;
  waypoints?: Point[];
}) {
  const sourceRect: Rect = {
    x: sourceEl.x,
    y: sourceEl.y,
    width: sourceEl.width ?? TYPE_NODE_DEFAULT_WIDTH,
    height: sourceEl.height ?? TYPE_NODE_DEFAULT_HEIGHT,
  };

  const targetRect: Rect = {
    x: targetEl.x,
    y: targetEl.y,
    width: targetEl.width ?? TYPE_NODE_DEFAULT_WIDTH,
    height: targetEl.height ?? TYPE_NODE_DEFAULT_HEIGHT,
  };

  const points = computePathWithWaypoints(sourceRect, targetRect, sourceAttachment, targetAttachment, waypoints);

  // Bend points for handle display: use stored waypoints when available,
  // otherwise use the intermediate (non-endpoint) computed path points.
  const hasWaypoints = waypoints && waypoints.length > 0;
  const bendPoints: Point[] = hasWaypoints
    ? waypoints
    : points.slice(1, -1);
  const flatPoints = points.flatMap((p) => [p.x, p.y]);

  // ---- Source cardinality symbol geometry ----
  const sourceCardinality = (
    srcCard ?? '[1,1]'
  ) as Cardinality;
  const exitPoint = points[0];
  // Direction of the line at the source exit (away from source node)
  const exitAngle = points.length >= 2
    ? Math.atan2(points[1].y - exitPoint.y, points[1].x - exitPoint.x)
    : 0;
  const cardinalityElements = sourceCardinality
    ? computeCardinalityElements(sourceCardinality, exitPoint.x, exitPoint.y, exitAngle)
    : null;

  // ---- Target cardinality symbol geometry ----
  const targetCardinality = (
    tgtCard ?? '[1,1]'
  ) as Cardinality;
  const entryPoint = points[points.length - 1];
  // Direction pointing away from the target node (back along the line toward source)
  const entryAngle = points.length >= 2
    ? Math.atan2(points[points.length - 2].y - entryPoint.y, points[points.length - 2].x - entryPoint.x)
    : Math.PI;
  const targetCardinalityElements = targetCardinality
    ? computeCardinalityElements(targetCardinality, entryPoint.x, entryPoint.y, entryAngle)
    : null;

  const [isHovered, setIsHovered] = useState(false);
  const strokeColor = isSelected ? '#007aff' : isHovered && currentTool === 'select' ? '#444444' : '#666666';
  const hoverStrokeWidth = isSelected ? 2.5 : isHovered && currentTool === 'select' ? 2 : 1.5;

  const handleMouseEnter = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (currentTool !== 'select' && currentTool !== 'shortSemantic') return;
    setIsHovered(true);
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = 'pointer';
    }
  };

  const handleMouseLeave = (e: Konva.KonvaEventObject<MouseEvent>) => {
    setIsHovered(false);
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = '';
    }
  };

  // Midpoint of the path for short semantic tag
  const midIdx = Math.floor(points.length / 2);
  const tagPoint = points.length > 0 ? points[midIdx] : { x: 0, y: 0 };

  return (
    <Group onClick={handleClick} onTap={handleClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Line
        points={flatPoints}
        stroke={strokeColor}
        strokeWidth={hoverStrokeWidth}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={18}
        listening={true}
      />
      {/* Source-end Cardinality symbol */}
      {cardinalityElements && (
        <Group>
          {cardinalityElements.bars.map((bar, i) => (
            <Line
              key={`src-bar-${i}`}
              points={[bar.x1, bar.y1, bar.x2, bar.y2]}
              stroke={strokeColor}
              strokeWidth={1.5}
              listening={false}
            />
          ))}
          {cardinalityElements.circles.map((circle, i) => (
            <Circle
              key={`src-circle-${i}`}
              x={circle.cx}
              y={circle.cy}
              radius={circle.r}
              stroke={strokeColor}
              strokeWidth={1.5}
              listening={false}
            />
          ))}
          {cardinalityElements.crowFootLines.map((cf, i) => (
            <Line
              key={`src-cf-${i}`}
              points={[cf.x1, cf.y1, cf.x2, cf.y2]}
              stroke={strokeColor}
              strokeWidth={1.5}
              listening={false}
            />
          ))}
        </Group>
      )}
      {/* Target-end Cardinality symbol */}
      {targetCardinalityElements && (
        <Group>
          {targetCardinalityElements.bars.map((bar, i) => (
            <Line
              key={`tgt-bar-${i}`}
              points={[bar.x1, bar.y1, bar.x2, bar.y2]}
              stroke={strokeColor}
              strokeWidth={1.5}
              listening={false}
            />
          ))}
          {targetCardinalityElements.circles.map((circle, i) => (
            <Circle
              key={`tgt-circle-${i}`}
              x={circle.cx}
              y={circle.cy}
              radius={circle.r}
              stroke={strokeColor}
              strokeWidth={1.5}
              listening={false}
            />
          ))}
          {targetCardinalityElements.crowFootLines.map((cf, i) => (
            <Line
              key={`tgt-cf-${i}`}
              points={[cf.x1, cf.y1, cf.x2, cf.y2]}
              stroke={strokeColor}
              strokeWidth={1.5}
              listening={false}
            />
          ))}
        </Group>
      )}
      {/* Short semantic tag */}
      {shortSemantic && (
        <Text
          x={tagPoint.x - 40}
          y={tagPoint.y - 25}
          width={80}
          text={`[${shortSemantic}]`}
          fontSize={11}
          fill="#888888"
          fontFamily="sans-serif"
          align="center"
          listening={false}
        />
      )}
      {/* Draggable endpoint handles when selected */}
      {isSelected && currentTool === 'select' && (
        <>
          <Circle
            x={points[0].x}
            y={points[0].y}
            radius={5}
            fill="white"
            stroke="#007aff"
            strokeWidth={2}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
            }}
            onDragMove={(e) => {
              const pos = { x: e.target.x(), y: e.target.y() };
              const newAttach = pointToAttachment(sourceRect, pos.x, pos.y);
              useEditorStore.getState().updateElement(elementId, { sourceAttachment: newAttach });
            }}
          />
          <Circle
            x={points[points.length - 1].x}
            y={points[points.length - 1].y}
            radius={5}
            fill="white"
            stroke="#007aff"
            strokeWidth={2}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
            }}
            onDragMove={(e) => {
              const pos = { x: e.target.x(), y: e.target.y() };
              const newAttach = pointToAttachment(targetRect, pos.x, pos.y);
              useEditorStore.getState().updateElement(elementId, { targetAttachment: newAttach });
            }}
          />
          {/* Bend point handles for path editing */}
          {bendPoints.map((bp, i) => (
            <Circle
              key={`bend-${i}`}
              x={bp.x}
              y={bp.y}
              radius={4}
              fill="white"
              stroke="#007aff"
              strokeWidth={2}
              draggable
              onDragStart={(e) => {
                e.cancelBubble = true;
                const store = useEditorStore.getState();
                useHistoryStore.getState().push(structuredClone(store.canvasElements));
              }}
              onDragMove={(e) => {
                const store = useEditorStore.getState();
                const currentEl = store.canvasElements.find((el) => el.id === elementId);
                if (!currentEl) return;

                const newPos: Point = { x: e.target.x(), y: e.target.y() };

                let newWaypoints: Point[];
                if (currentEl.waypoints && currentEl.waypoints.length > 0) {
                  // Update existing waypoint at this index
                  newWaypoints = currentEl.waypoints.map((wp, j) =>
                    j === i ? newPos : wp,
                  );
                } else {
                  // Initialize waypoints from the current bend positions
                  newWaypoints = bendPoints.map((bp, j) =>
                    j === i ? newPos : bp,
                  );
                }

                useEditorStore.setState({
                  canvasElements: useEditorStore.getState().canvasElements.map((el) =>
                    el.id === elementId ? { ...el, waypoints: newWaypoints } : el,
                  ),
                });
              }}
            />
          ))}
        </>
      )}
    </Group>
  );
}

function RelationLine({
  element,
  typeElements,
  isSelected,
  currentTool,
  onShortSemanticClick,
}: RelationLineProps) {
  const select = useEditorStore((s) => s.select);

  const sourceEl = typeElements.find((el) => el.id === element.sourceId);
  const targetEl = typeElements.find((el) => el.id === element.targetId);

  if (!sourceEl) return null;

  // Self-reference: source === target (or isSelfReference flag)
  const isSelfRef =
    element.isSelfReference ||
    (element.sourceId != null &&
      element.sourceId === element.targetId);

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (currentTool === 'shortSemantic') {
      e.cancelBubble = true;
      onShortSemanticClick?.(element.id, e.evt.clientX, e.evt.clientY);
      return;
    }
    if (currentTool !== 'select') return;
    select(element.id);
  };

  if (isSelfRef) {
    return (
      <SelfReferenceLoop
        sourceEl={sourceEl}
        isSelected={isSelected}
        handleClick={handleClick}
        currentTool={currentTool}
        elementId={element.id}
        sourceAttachment={element.sourceAttachment}
        targetAttachment={element.targetAttachment}
        sourceCardinality={element.sourceCardinality}
        targetCardinality={element.targetCardinality}
        shortSemantic={element.shortSemantic}
      />
    );
  }

  // Normal relation between two different types
  if (!targetEl) return null;

  return (
    <NormalRelationLine
      sourceEl={sourceEl}
      targetEl={targetEl}
      isSelected={isSelected}
      handleClick={handleClick}
      currentTool={currentTool}
      elementId={element.id}
      sourceCardinality={element.sourceCardinality}
      targetCardinality={element.targetCardinality}
      shortSemantic={element.shortSemantic}
      sourceAttachment={element.sourceAttachment}
      targetAttachment={element.targetAttachment}
      waypoints={element.waypoints}
    />
  );
}

export default RelationLine;
