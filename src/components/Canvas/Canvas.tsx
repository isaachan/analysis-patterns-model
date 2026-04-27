import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Rect as KonvaRect } from 'react-konva';
import type Konva from 'konva';
import useEditorStore from '../../store/useEditorStore';
import type { CanvasElement, AttachmentPoint } from '../../store/useEditorStore';
import { useDeleteKey } from '../../hooks/useKeyboard';
import { useArrowKeyNudge } from '../../hooks/useArrowKeyNudge';
import { useZoomPan } from '../../hooks/useZoomPan';
import {
  TYPE_NODE_DEFAULT_WIDTH,
  TYPE_NODE_DEFAULT_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
} from '../../constants/defaults';
import { rectsOverlap, findNearestNonOverlappingPosition, computeOrthogonalPath } from '../../utils/geometry';
import type { Rect } from '../../utils/geometry';
import TypeNode from './TypeNode';
import RelationLine from './RelationLine';
import GeneralizationBox from './GeneralizationBox';
import NoteBox from './NoteBox';
import { setStageRef } from '../../utils/stageRef';

function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [relationSourceId, setRelationSourceId] = useState<string | null>(null);
  const [previewLine, setPreviewLine] = useState<{ sourceId: string; mousePos: { x: number; y: number } } | null>(null);
  const [relationDragHoveredId, setRelationDragHoveredId] = useState<string | null>(null);
  const [shortSemanticTarget, setShortSemanticTarget] = useState<{
    id: string;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const previewLineRef = useRef(previewLine);
  previewLineRef.current = previewLine;
  const currentTool = useEditorStore((s) => s.currentTool);
  const gridEnabled = useEditorStore((s) => s.gridEnabled);
  const gridSize = useEditorStore((s) => s.gridSize);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const canvasElements = useEditorStore((s) => s.canvasElements);
  const { zoom, panX, panY, setPan, resetView, handleWheel } = useZoomPan();
  const addElement = useEditorStore((s) => s.addElement);
  const select = useEditorStore((s) => s.select);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const isDragging = useEditorStore((s) => s.isDragging);
  const setTool = useEditorStore((s) => s.setTool);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const updateElement = useEditorStore((s) => s.updateElement);

  // ---- Box selection state ----
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  const isSelecting = useRef(false);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);

  // ---- Multi-drag state ----
  const multiDragOrigins = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  /**
   * Get the bounding box for an element that has a rectangular shape.
   * Relations are excluded (they are lines, not rectangles).
   */
  const getElementBounds = useCallback(
    (el: CanvasElement): Rect | null => {
      switch (el.type) {
        case 'type':
          return {
            x: el.x,
            y: el.y,
            width: el.width ?? TYPE_NODE_DEFAULT_WIDTH,
            height: el.height ?? TYPE_NODE_DEFAULT_HEIGHT,
          };
        case 'note':
          return {
            x: el.x,
            y: el.y,
            width: el.width ?? 240,
            height: el.height ?? 160,
          };
        case 'generalization':
          return {
            x: el.x,
            y: el.y,
            width: el.width ?? 200,
            height: el.height ?? 120,
          };
        default:
          return null;
      }
    },
    [],
  );

  // Track TypeNode positions during drag for attached note following
  const typeDragPositions = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  const handleTypeSelectDragMove = (id: string, newX: number, newY: number) => {
    const prev = typeDragPositions.current.get(id);
    if (prev) {
      const dx = newX - prev.x;
      const dy = newY - prev.y;
      if (dx !== 0 || dy !== 0) {
        // Move all notes attached to this type by the same delta
        const elements = useEditorStore.getState().canvasElements;
        elements.forEach((el) => {
          if (el.type === 'note' && el.attachedToId === id) {
            updateElement(el.id, {
              x: el.x + dx,
              y: el.y + dy,
            });
          }
        });
      }
    }
    typeDragPositions.current.set(id, { x: newX, y: newY });

    // Multi-drag: move all other selected elements by the same delta
    handleMultiDragMove(id, newX, newY);
  };

  // ---- Multi-drag handlers ----

  /** Save initial positions of all selected elements when drag starts. */
  const handleMultiDragStart = useCallback(
    (id: string) => {
      if (selectedIds.length <= 1 || !selectedIds.includes(id)) {
        multiDragOrigins.current.clear();
        return;
      }
      const origins = new Map<string, { x: number; y: number }>();
      const elements = useEditorStore.getState().canvasElements;
      selectedIds.forEach((sid) => {
        const el = elements.find((e) => e.id === sid);
        if (el) origins.set(sid, { x: el.x, y: el.y });
      });
      multiDragOrigins.current = origins;
    },
    [selectedIds],
  );

  /** Move all selected elements (except the one being dragged) by the same delta. */
  const handleMultiDragMove = useCallback(
    (id: string, currentX: number, currentY: number) => {
      if (selectedIds.length <= 1 || multiDragOrigins.current.size === 0)
        return;

      const draggedOrigin = multiDragOrigins.current.get(id);
      if (!draggedOrigin) return;

      const dx = currentX - draggedOrigin.x;
      const dy = currentY - draggedOrigin.y;

      if (dx === 0 && dy === 0) return;

      const elements = useEditorStore.getState().canvasElements;
      selectedIds.forEach((sid) => {
        if (sid === id) return;
        // Skip children of the dragged element (GeneralizationBox handles its own children)
        const el = elements.find((e) => e.id === sid);
        if (el && el.containerId === id) return;

        const origin = multiDragOrigins.current.get(sid);
        if (!origin) return;
        const newX = origin.x + dx;
        const newY = origin.y + dy;

        if (el && (el.x !== newX || el.y !== newY)) {
          updateElement(sid, { x: newX, y: newY });
        }
      });
    },
    [selectedIds, updateElement],
  );

  // Delete/Backspace key to remove selected element(s)
  useDeleteKey(() => {
    if (selectedIds.length > 0) {
      // Delete each selected element (cascade for types handled in store)
      selectedIds.forEach((id) => deleteElement(id));
    }
  });

  // Arrow key nudge for fine-tuning selected element positions
  useArrowKeyNudge();

  // ---- Relation drag-to-create helpers ----

  const typeNodes = canvasElements.filter((el) => el.type === 'type');
  const generalizations = canvasElements.filter(
    (el) => el.type === 'generalization',
  );
  const standaloneTypeNodes = typeNodes.filter((el) => !el.containerId);

  const findContainerAtPosition = (
    pos: { x: number; y: number },
  ): CanvasElement | null => {
    for (let i = generalizations.length - 1; i >= 0; i--) {
      const g = generalizations[i];
      const gx = g.x;
      const gy = g.y;
      const gw = g.width ?? 200;
      const gh = g.height ?? 120;
      if (
        pos.x >= gx &&
        pos.x <= gx + gw &&
        pos.y >= gy &&
        pos.y <= gy + gh
      ) {
        return g;
      }
    }
    return null;
  };

  const findTypeAtPosition = (pos: { x: number; y: number }): string | null => {
    for (let i = typeNodes.length - 1; i >= 0; i--) {
      const el = typeNodes[i];
      const elX = el.x;
      const elY = el.y;
      const elW = el.width ?? TYPE_NODE_DEFAULT_WIDTH;
      const elH = el.height ?? TYPE_NODE_DEFAULT_HEIGHT;
      if (pos.x >= elX && pos.x <= elX + elW && pos.y >= elY && pos.y <= elY + elH) {
        return el.id;
      }
    }
    return null;
  };

  // Helper to compute initial attachment from center-to-center direction
  const computeInitialAttachment = useCallback(
    (
      typeEl: { x: number; y: number; width?: number; height?: number },
      otherEl: { x: number; y: number; width?: number; height?: number },
    ): AttachmentPoint => {
      const typeCenter = {
        x: typeEl.x + (typeEl.width ?? TYPE_NODE_DEFAULT_WIDTH) / 2,
        y: typeEl.y + (typeEl.height ?? TYPE_NODE_DEFAULT_HEIGHT) / 2,
      };
      const otherCenter = {
        x: otherEl.x + (otherEl.width ?? TYPE_NODE_DEFAULT_WIDTH) / 2,
        y: otherEl.y + (otherEl.height ?? TYPE_NODE_DEFAULT_HEIGHT) / 2,
      };
      const dx = otherCenter.x - typeCenter.x;
      const dy = otherCenter.y - typeCenter.y;

      let side: 'left' | 'right' | 'top' | 'bottom';
      if (Math.abs(dx) >= Math.abs(dy)) {
        side = dx >= 0 ? 'right' : 'left';
      } else {
        side = dy >= 0 ? 'bottom' : 'top';
      }

      return { side, ratio: 0.5 };
    },
    [],
  );

  const handleRelationDragStart = (sourceId: string) => {
    setRelationSourceId(sourceId);
    setPreviewLine({ sourceId, mousePos: { x: 0, y: 0 } });
  };

  const handleRelationDragMove = (pos: { x: number; y: number }) => {
    setPreviewLine((prev) => (prev ? { ...prev, mousePos: pos } : null));
    const hoveredId = findTypeAtPosition(pos);
    setRelationDragHoveredId(hoveredId);
  };

  const handleRelationDragEnd = (pos: { x: number; y: number }) => {
    const targetId = findTypeAtPosition(pos);
    const currentPreview = previewLineRef.current;
    if (targetId && currentPreview) {
      const isSelfReference = targetId === currentPreview.sourceId;

      // Compute initial attachments from center-to-center direction
      const elements = useEditorStore.getState().canvasElements;
      const sourceEl = elements.find((el) => el.id === currentPreview.sourceId);
      const targetEl = elements.find((el) => el.id === targetId);

      let sourceAttachment: AttachmentPoint | undefined;
      let targetAttachment: AttachmentPoint | undefined;

      if (sourceEl && targetEl) {
        sourceAttachment = computeInitialAttachment(sourceEl, targetEl);
        targetAttachment = computeInitialAttachment(targetEl, sourceEl);
      }

      addElement({
        id: crypto.randomUUID(),
        type: 'relation',
        x: 0,
        y: 0,
        sourceId: currentPreview.sourceId,
        targetId: targetId,
        sourceAttachment,
        targetAttachment,
        ...(isSelfReference ? { isSelfReference: true } : {}),
      });
      setTool('select');
    }
    setPreviewLine(null);
    setRelationDragHoveredId(null);
    setRelationSourceId(null);
  };

  const handleShortSemanticClick = (id: string, clientX: number, clientY: number) => {
    const element = canvasElements.find((el) => el.id === id);
    if (element?.type === 'type' || element?.type === 'relation') {
      setShortSemanticTarget({ id, screenX: clientX, screenY: clientY });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (stageRef.current) {
      setStageRef(stageRef.current);
    }
    return () => setStageRef(null);
  }, []);

  // Clear shortSemantic popup when switching tools
  useEffect(() => {
    setShortSemanticTarget(null);
  }, [currentTool, setShortSemanticTarget]);

  // Space key for pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Global mouseup to stop panning when mouse is released outside the stage
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanning(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Keyboard shortcuts for Ctrl/Cmd +/- zoom and Ctrl/Cmd Z/Y undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.ctrlKey || e.metaKey;
      if (!isCmd) return;

      // Ignore if focus is on input elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl/Cmd + Z: Undo
      if (e.key === 'z' || e.code === 'KeyZ') {
        e.preventDefault();
        useEditorStore.getState().applyUndo();
        return;
      }

      // Ctrl/Cmd + Y: Redo
      if (e.key === 'y' || e.code === 'KeyY') {
        e.preventDefault();
        useEditorStore.getState().applyRedo();
        return;
      }

      if (e.key === '=' || e.key === '+' || e.code === 'Equal') {
        e.preventDefault();
        const currentZoom = useEditorStore.getState().zoom;
        const newZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
        useEditorStore.getState().setZoom(newZoom);
      } else if (e.key === '-' || e.code === 'Minus') {
        e.preventDefault();
        const currentZoom = useEditorStore.getState().zoom;
        const newZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
        useEditorStore.getState().setZoom(newZoom);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Skip stage-level click handling during drag operations;
    // drag events are handled by TypeNode directly.
    if (isDragging) return;

    // In select mode, handle box selection via onMouseDown/onMouseMove/onMouseUp
    if (currentTool === 'select') {
      // Clicks on stage-level elements (empty space) should only handle deselect
      // Box selection is handled by onMouseDown/onMouseMove/onMouseUp
      return;
    }

    if (currentTool === 'type') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const width = TYPE_NODE_DEFAULT_WIDTH;
        const height = TYPE_NODE_DEFAULT_HEIGHT;

        // Check if click is inside a generalization container
        const container = findContainerAtPosition(pointer);
        if (container) {
          addElement({
            id: crypto.randomUUID(),
            type: 'type',
            x: pointer.x - width / 2,
            y: pointer.y - height / 2,
            width,
            height,
            name: 'Type',
            containerId: container.id,
          });
        } else {
          addElement({
            id: crypto.randomUUID(),
            type: 'type',
            x: pointer.x - width / 2,
            y: pointer.y - height / 2,
            width,
            height,
            name: 'Type',
          });
        }
      }
      return;
    }

    if (currentTool === 'generalization') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const width = 200;
        const height = 120;

        let x = pointer.x - width / 2;
        let y = pointer.y - height / 2;

        // Check for overlap with existing generalization containers AND type nodes at default position
        const newRect: Rect = { x, y, width, height };
        const otherRects: Rect[] = [];

        // Add other generalization containers
        const existingGeneralizations = canvasElements.filter(
          (el) => el.type === 'generalization',
        );
        existingGeneralizations.forEach((g) => {
          otherRects.push({
            x: g.x,
            y: g.y,
            width: g.width ?? 200,
            height: g.height ?? 120,
          });
        });

        // Add standalone type nodes (potential parent types) to avoid overlap
        standaloneTypeNodes.forEach((t) => {
          otherRects.push({
            x: t.x,
            y: t.y,
            width: t.width ?? TYPE_NODE_DEFAULT_WIDTH,
            height: t.height ?? TYPE_NODE_DEFAULT_HEIGHT,
          });
        });

        if (otherRects.length > 0 && otherRects.some((r) => rectsOverlap(newRect, r))) {
          const offset = findNearestNonOverlappingPosition(newRect, otherRects);
          x = offset.x;
          y = offset.y;
        }

        addElement({
          id: crypto.randomUUID(),
          type: 'generalization',
          x,
          y,
          width,
          height,
          name: 'Generalization',
          isComplete: true,
        });
      }
      return;
    }

    if (currentTool === 'relation') {
      // Relation creation is handled by TypeNode drag events
      return;
    }

    if (currentTool === 'shortSemantic') {
      // Dismiss popup when clicking on empty stage space
      const clickedOnStage = e.target === e.target.getStage();
      if (clickedOnStage && shortSemanticTarget) {
        setShortSemanticTarget(null);
      }
      return;
    }

    if (currentTool === 'longSemantic') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const width = 240;
        const height = 160;

        addElement({
          id: crypto.randomUUID(),
          type: 'note',
          x: pointer.x - width / 2,
          y: pointer.y - height / 2,
          width,
          height,
          title: 'Note',
          content: '',
        });
      }
      return;
    }

    // Select mode is handled by onMouseDown/onMouseMove/onMouseUp for box selection
  };

  // ---- Panning + Box selection: Stage-level mouse handlers ----

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Panning takes priority: middle mouse button or space+left click
    if (e.evt.button === 1 || isSpacePressed) {
      setIsPanning(true);
      panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      e.evt.preventDefault();
      return;
    }

    if (isDragging) return;

    // In select mode, start box selection on empty stage
    if (currentTool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        const stage = stageRef.current;
        if (!stage) return;
        const pos = stage.getPointerPosition();
        if (!pos) return;

        isSelecting.current = true;
        selectionStart.current = { x: pos.x, y: pos.y };
        setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
        deselectAll();
        return;
      }
      // Clicked on an element — let the element handle it
      return;
    }

    // For non-select tools, delegate to the original click handler
    handleStageClick(e);
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning) {
      const dx = e.evt.clientX - panStartRef.current.x;
      const dy = e.evt.clientY - panStartRef.current.y;
      setPan(panX + dx, panY + dy);
      panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      e.evt.preventDefault();
      return;
    }

    if (!isSelecting.current || !selectionStart.current) return;

    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const startX = selectionStart.current.x;
    const startY = selectionStart.current.y;
    const x = Math.min(startX, pos.x);
    const y = Math.min(startY, pos.y);
    const width = Math.abs(pos.x - startX);
    const height = Math.abs(pos.y - startY);

    setSelectionRect({ x, y, width, height });
  };

  const handleStageMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isSelecting.current) return;

    isSelecting.current = false;

    // If selection rect is large enough, perform box selection
    if (
      selectionRect &&
      (selectionRect.width > 5 || selectionRect.height > 5)
    ) {
      const selectRect: Rect = {
        x: selectionRect.x,
        y: selectionRect.y,
        width: selectionRect.width,
        height: selectionRect.height,
      };
      const idsToSelect: string[] = [];
      const elements = useEditorStore.getState().canvasElements;
      elements.forEach((el) => {
        const bounds = getElementBounds(el);
        if (bounds && rectsOverlap(selectRect, bounds, 0)) {
          idsToSelect.push(el.id);
        }
      });
      if (idsToSelect.length > 0) {
        select(idsToSelect);
      }
    }

    // Clear selection rect regardless
    setSelectionRect(null);
    selectionStart.current = null;
  };

  const handleStageDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const clickedOnEmpty = e.target === stage;
    if (clickedOnEmpty) {
      resetView();
    }
  };

  const gridLines: React.ReactElement[] = [];
  if (gridEnabled) {
    for (let x = 0; x < dimensions.width; x += gridSize) {
      gridLines.push(
        <Line
          key={`v${x}`}
          x={0}
          y={0}
          points={[
            Math.round(x) + 0.5,
            0,
            Math.round(x) + 0.5,
            dimensions.height,
          ]}
          stroke="#e8e8ed"
          strokeWidth={0.5}
          listening={false}
        />,
      );
    }
    for (let y = 0; y < dimensions.height; y += gridSize) {
      gridLines.push(
        <Line
          key={`h${y}`}
          x={0}
          y={0}
          points={[
            0,
            Math.round(y) + 0.5,
            dimensions.width,
            Math.round(y) + 0.5,
          ]}
          stroke="#e8e8ed"
          strokeWidth={0.5}
          listening={false}
        />,
      );
    }
  }

  const relationElements = canvasElements.filter((el) => el.type === 'relation');

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ backgroundColor: 'var(--color-bg-canvas)' }}
    >
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        scaleX={zoom}
        scaleY={zoom}
        x={panX}
        y={panY}
        ref={stageRef}
        className={
          isPanning
            ? 'cursor-grabbing'
            : isSpacePressed
            ? 'cursor-grab'
            : currentTool === 'type' || currentTool === 'relation' || currentTool === 'generalization' || currentTool === 'shortSemantic' || currentTool === 'longSemantic'
            ? 'cursor-crosshair'
            : 'cursor-default'
        }
        onWheel={handleWheel}
        onDblClick={handleStageDblClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTap={handleStageClick}
      >
        {/* Grid Layer */}
        <Layer name="grid-layer" listening={false}>
          {gridLines}
        </Layer>

        {/* Relation Layer (behind type nodes) */}
        <Layer name="relation-layer">
          {relationElements.map((relEl) => (
            <RelationLine
              key={relEl.id}
              element={relEl}
              typeElements={typeNodes}
              isSelected={selectedIds.includes(relEl.id)}
              currentTool={currentTool}
              onShortSemanticClick={handleShortSemanticClick}
            />
          ))}

          {/* Preview line for drag-to-create relation */}
          {previewLine && (() => {
            const sourceEl = typeNodes.find((el) => el.id === previewLine.sourceId);
            if (!sourceEl) return null;
            const sourceW = sourceEl.width ?? TYPE_NODE_DEFAULT_WIDTH;
            const sourceH = sourceEl.height ?? TYPE_NODE_DEFAULT_HEIGHT;
            const sourceRect: Rect = {
              x: sourceEl.x,
              y: sourceEl.y,
              width: sourceW,
              height: sourceH,
            };
            const targetRect: Rect = {
              x: previewLine.mousePos.x - 0.5,
              y: previewLine.mousePos.y - 0.5,
              width: 1,
              height: 1,
            };
            const pathPoints = computeOrthogonalPath(sourceRect, targetRect);
            const flatPoints = pathPoints.flatMap((p) => [p.x, p.y]);
            return (
              <Line
                points={flatPoints}
                stroke="#666666"
                strokeWidth={1.5}
                dash={[5, 5]}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            );
          })()}
        </Layer>

        {/* Type Node Layer */}
        <Layer name="type-node-layer">
          {standaloneTypeNodes.map((el) => (
            <TypeNode
              key={el.id}
              element={el}
              isSelected={selectedIds.includes(el.id)}
              currentTool={currentTool}
              onSelect={select}
              isRelationSource={relationSourceId === el.id}
              isRelationDragTarget={relationDragHoveredId === el.id}
              onRelationDragStart={handleRelationDragStart}
              onRelationDragMove={handleRelationDragMove}
              onRelationDragEnd={handleRelationDragEnd}
              onShortSemanticClick={handleShortSemanticClick}
              onSelectDragMove={handleTypeSelectDragMove}
              onSelectDragStart={handleMultiDragStart}
            />
          ))}
          {generalizations.map((el) => {
            const childTypes = typeNodes.filter(
              (t) => t.containerId === el.id,
            );
            return (
              <GeneralizationBox
                key={el.id}
                element={el}
                isSelected={selectedIds.includes(el.id)}
                currentTool={currentTool}
                onSelect={select}
                childTypes={childTypes}
                onShortSemanticClick={handleShortSemanticClick}
                onDragStart={handleMultiDragStart}
                onDragMove={handleMultiDragMove}
              />
            );
          })}

          {/* Note elements */}
          {canvasElements.filter((el) => el.type === 'note').map((el) => (
            <NoteBox
              key={el.id}
              element={el}
              isSelected={selectedIds.includes(el.id)}
              currentTool={currentTool}
              onSelect={select}
              onDragStart={handleMultiDragStart}
              onDragMove={handleMultiDragMove}
            />
          ))}
        </Layer>

        {/* Selection Layer */}
        <Layer name="selection-layer">
          {/* Box selection rectangle */}
          {selectionRect && (selectionRect.width > 0 || selectionRect.height > 0) && (
            <KonvaRect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="#007AFF"
              fillOpacity={0.1}
              stroke="#007AFF"
              strokeWidth={1}
              dash={[6, 3]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {/* Short Semantic Statement popup */}
      {shortSemanticTarget && (() => {
        const targetElement = canvasElements.find(el => el.id === shortSemanticTarget.id);
        const isRelation = targetElement?.type === 'relation';
        return (
          <>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999,
              }}
              onClick={() => setShortSemanticTarget(null)}
            />
            <div
              style={{
                position: 'fixed',
                left: shortSemanticTarget.screenX,
                top: shortSemanticTarget.screenY - 8,
                zIndex: 1000,
              }}
            >
              <select
                autoFocus
                value={
                  canvasElements.find((el) => el.id === shortSemanticTarget.id)
                    ?.shortSemantic ?? ''
                }
                onChange={(e) => {
                  const val = e.target.value;
                  updateElement(shortSemanticTarget.id, {
                    shortSemantic: val || undefined,
                  });
                  setShortSemanticTarget(null);
                }}
                onBlur={() => setShortSemanticTarget(null)}
                className="text-sm border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                style={{
                  color: 'var(--color-text-primary)',
                  backgroundColor: 'var(--color-bg-primary)',
                  borderColor: 'var(--color-border-primary)',
                }}
              >
                <option value="">(none)</option>
                {isRelation ? (
                  <>
                    <option value="list">[list]</option>
                    <option value="class">[class]</option>
                    <option value="key">[key]</option>
                    <option value="hierarchy">[hierarchy]</option>
                  </>
                ) : (
                  <>
                    <option value="abstract">[abstract]</option>
                    <option value="immutable">[immutable]</option>
                    <option value="singleton">[singleton]</option>
                  </>
                )}
              </select>
            </div>
          </>
        );
      })()}
    </div>
  );
}

export default Canvas;
