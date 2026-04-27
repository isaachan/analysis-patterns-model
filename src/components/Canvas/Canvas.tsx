import { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Stage, Layer, Rect, Line } from 'react-konva';
import Konva from 'konva';
import { useEditorStore } from '../../store/useEditorStore';
import { useDiagramStore } from '../../store/useDiagramStore';
import { COLORS } from '../../constants/designTokens';
import {
  TYPE_NODE_MIN_HEIGHT,
  calcTypeNodeWidth,
  GRID_SIZE,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_GEN_WIDTH,
  DEFAULT_GEN_HEIGHT,
  GEN_PADDING,
  DEFAULT_NOTE_WIDTH,
  NOTE_MIN_HEIGHT,
} from '../../constants/defaults';
import { nanoid } from 'nanoid';
import type {
  DiagramElement,
  TypeElement,
  RelationElement,
  NoteElement,
  GeneralizationElement,
  LongSemanticElement,
  Layout,
} from '../../models/diagram';
import type { Point } from '../../utils/geometry';
import {
  getRectBorderIntersection,
  snapToGrid,
  rectsOverlap,
  computeBoundingBox,
  findNonOverlappingPosition,
  anchorToPoint,
  computeAnchorFromPoint,
} from '../../utils/geometry';
import GridLayer from './GridLayer';
import TypeNode from './TypeNode';
import RelationLine from './RelationLine';
import NoteBox from './NoteBox';
import LongSemanticBox from './LongSemanticBox';
import GeneralizationBox from './GeneralizationBox';

/* ------------------------------------------------------------------ */
/*  CanvasHandle — imperative API exposed to parent                    */
/* ------------------------------------------------------------------ */

export interface CanvasHandle {
  /** Returns the underlying Konva Stage, or null if not yet mounted. */
  getStage: () => Konva.Stage | null;
}

/**
 * Compute preview line points (orthogonal) from a source Type's border to a
 * target point (cursor position).
 *
 * When a sourceAnchor is provided the preview line exits the type at that
 * anchor position rather than at the center-based intersection (ME-55).
 */
function computePreviewPoints(
  sourceLayout: Layout,
  targetPoint: Point,
  sourceAnchor?: { edge: 'top' | 'right' | 'bottom' | 'left'; offset: number },
): number[] {
  const sourceCenter = {
    x: sourceLayout.x + sourceLayout.width / 2,
    y: sourceLayout.y + sourceLayout.height / 2,
  };

  const sourceExit = sourceAnchor
    ? anchorToPoint(sourceLayout, sourceAnchor.edge, sourceAnchor.offset)
    : getRectBorderIntersection(sourceLayout, sourceCenter, targetPoint);

  const dx = Math.abs(targetPoint.x - sourceExit.x);
  const dy = Math.abs(targetPoint.y - sourceExit.y);

  if (dx > dy) {
    const midX = (sourceExit.x + targetPoint.x) / 2;
    return [
      sourceExit.x,
      sourceExit.y,
      midX,
      sourceExit.y,
      midX,
      targetPoint.y,
      targetPoint.x,
      targetPoint.y,
    ];
  } else {
    const midY = (sourceExit.y + targetPoint.y) / 2;
    return [
      sourceExit.x,
      sourceExit.y,
      sourceExit.x,
      midY,
      targetPoint.x,
      midY,
      targetPoint.x,
      targetPoint.y,
    ];
  }
}

/** Helper: recalculate a generalization container's layout to fit its children. */
function recalcContainerLayout(
  currentLayout: Layout,
  childTypes: TypeElement[],
): Layout {
  if (childTypes.length === 0) {
    // No children: use default size
    return {
      x: currentLayout.x,
      y: currentLayout.y,
      width: DEFAULT_GEN_WIDTH,
      height: DEFAULT_GEN_HEIGHT,
    };
  }

  const childLayouts = childTypes.map((c) => c.layout);
  const bbox = computeBoundingBox(childLayouts, GEN_PADDING);
  if (!bbox) {
    return {
      x: currentLayout.x,
      y: currentLayout.y,
      width: DEFAULT_GEN_WIDTH,
      height: DEFAULT_GEN_HEIGHT,
    };
  }

  return {
    x: bbox.x,
    y: bbox.y,
    width: Math.max(bbox.width, DEFAULT_GEN_WIDTH),
    height: Math.max(bbox.height, DEFAULT_GEN_HEIGHT),
  };
}

/* ------------------------------------------------------------------ */
/*  Canvas component                                                    */
/* ------------------------------------------------------------------ */

/**
 * Main canvas component.
 *
 * Sets up a Konva Stage with six layers:
 *   Grid Layer (bottom)      – dot-grid background
 *   Type Layer               – Type nodes and Generalization boxes
 *   Relation Layer           – relation lines with cardinality markers
 *   Note Layer               – semantic note boxes
 *   Preview Layer            – dynamic relation preview line during drag-to-create
 *   Selection Layer (top)    – selection highlight borders
 *
 * Exposes a CanvasHandle via forwardRef for export functionality.
 */
const Canvas = forwardRef<CanvasHandle, object>(function Canvas(_props: object, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const stageRef = useRef<Konva.Stage>(null);

  /* Expose the stage ref to parent via imperative handle */
  useImperativeHandle(
    ref,
    () => ({
      getStage: () => stageRef.current,
    }),
    [],
  );

  /* ------------------------------------------------------------------ */
  /*  Store subscriptions                                                */
  /* ------------------------------------------------------------------ */
  const elements = useDiagramStore((s) => s.elements);
  const addElement = useDiagramStore((s) => s.addElement);
  const updateElement = useDiagramStore((s) => s.updateElement);

  const currentTool = useEditorStore((s) => s.currentTool);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);

  const relationSourceId = useEditorStore((s) => s.relationSourceId);
  const setRelationSource = useEditorStore((s) => s.setRelationSource);
  const relationEndPoint = useEditorStore((s) => s.relationEndPoint);
  const setRelationEndPoint = useEditorStore((s) => s.setRelationEndPoint);
  const clearRelationState = useEditorStore((s) => s.clearRelationState);

  const generalizationParentId = useEditorStore((s) => s.generalizationParentId);
  const setGeneralizationParent = useEditorStore((s) => s.setGeneralizationParent);
  const clearGeneralizationState = useEditorStore((s) => s.clearGeneralizationState);
  const setTool = useEditorStore((s) => s.setTool);

  /* ------------------------------------------------------------------ */
  /*  Refs for drag-to-create tracking (only accessed in event handlers)  */
  /* ------------------------------------------------------------------ */
  const relationDragRef = useRef({
    isDragging: false,
    hasMoved: false,
    sourceId: '',
    sourceAnchor: undefined as { edge: 'top' | 'right' | 'bottom' | 'left'; offset: number } | undefined,
    startPos: { x: 0, y: 0 },
  });

  /* ------------------------------------------------------------------ */
  /*  Refs for zoom and pan                                              */
  /* ------------------------------------------------------------------ */
  const isSpaceKeyDown = useRef(false);
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  /* ------------------------------------------------------------------ */
  /*  Refs and state for box select                                      */
  /* ------------------------------------------------------------------ */
  const boxSelectRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [boxSelectRenderRect, setBoxSelectRenderRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Resize handling                                                    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Space key listeners for pan                                        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpaceKeyDown.current = true;
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceKeyDown.current = false;
        isPanning.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Filter elements by type                                            */
  /* ------------------------------------------------------------------ */
  const typeElements = elements.filter(
    (el): el is TypeElement => el.type === 'type',
  );
  const relationElements = elements.filter(
    (el): el is RelationElement => el.type === 'relation',
  );
  const noteElements = elements.filter(
    (el): el is NoteElement => el.type === 'note',
  );
  const generalizationElements = elements.filter(
    (el): el is GeneralizationElement => el.type === 'generalization',
  );
  const longSemanticElements = elements.filter(
    (el): el is LongSemanticElement => el.type === 'longSemantic',
  );

  /* ------------------------------------------------------------------ */
  /*  Build type layout map                                              */
  /* ------------------------------------------------------------------ */
  const typeLayoutMap = useCallback(() => {
    const map = new Map<string, Layout>();
    for (const el of typeElements) {
      map.set(el.id, el.layout);
    }
    return map;
  }, [typeElements]);

  const layoutMap = typeLayoutMap();

  /* ------------------------------------------------------------------ */
  /*  Build general layout map (for attachment resolving)                */
  /* ------------------------------------------------------------------ */
  const generalLayoutMap = useMemo(() => {
    const map = new Map<string, Layout>();
    for (const el of elements) {
      if ('layout' in el) {
        map.set(el.id, el.layout);
      }
    }
    return map;
  }, [elements]);

  /* ------------------------------------------------------------------ */
  /*  Convert screen to canvas coordinates                               */
  /* ------------------------------------------------------------------ */
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Point => ({
      x: (screenX - panX) / zoom,
      y: (screenY - panY) / zoom,
    }),
    [panX, panY, zoom],
  );

  /* ------------------------------------------------------------------ */
  /*  Create a relation between two type elements                        */
  /* ------------------------------------------------------------------ */
  const createRelation = useCallback(
    (
      sourceId: string,
      targetId: string,
      sourceAnchor?: { edge: 'top' | 'right' | 'bottom' | 'left'; offset: number },
      targetAnchor?: { edge: 'top' | 'right' | 'bottom' | 'left'; offset: number },
    ) => {
      const newId = nanoid();
      addElement({
        id: newId,
        type: 'relation',
        sourceId,
        targetId,
        sourceCardinality: 'exactly_one',
        targetCardinality: 'exactly_one',
        label: '',
        sourceAnchor,
        targetAnchor,
      });
      clearRelationState();
      // Auto-switch to select tool and select the new relation
      useEditorStore.getState().setTool('select');
      useEditorStore.getState().select(newId);
    },
    [addElement, clearRelationState],
  );

  /** Find a TypeElement at the given canvas position. */
  const findTypeAtPoint = useCallback(
    (point: Point): TypeElement | undefined => {
      return typeElements.find((el) => {
        const r = el.layout;
        return (
          point.x >= r.x &&
          point.x <= r.x + r.width &&
          point.y >= r.y &&
          point.y <= r.y + r.height
        );
      });
    },
    [typeElements],
  );

  /** Find a GeneralizationElement at the given canvas position. */
  const findGeneralizationAtPoint = useCallback(
    (point: Point): GeneralizationElement | undefined => {
      return generalizationElements.find((el) => {
        const r = el.layout;
        return (
          point.x >= r.x &&
          point.x <= r.x + r.width &&
          point.y >= r.y &&
          point.y <= r.y + r.height
        );
      });
    },
    [generalizationElements],
  );

  /* ------------------------------------------------------------------ */
  /*  Interaction handlers                                               */
  /* ------------------------------------------------------------------ */

  /** Stage click: create Type in type mode, Generalization in generalization mode, deselect otherwise. */
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const canvasPos = screenToCanvas(e.evt.offsetX, e.evt.offsetY);

      if (currentTool === 'type') {
        const name = 'Type';
        const width = calcTypeNodeWidth(name);

        const layout: Layout = {
          x: canvasPos.x - width / 2,
          y: canvasPos.y - TYPE_NODE_MIN_HEIGHT / 2,
          width,
          height: TYPE_NODE_MIN_HEIGHT,
        };

        const newTypeId = nanoid();

        addElement({
          id: newTypeId,
          type: 'type',
          name,
          attributes: [],
          methods: [],
          layout,
        });

        // Check if click is inside a generalization container → add as child
        const container = findGeneralizationAtPoint(canvasPos);
        if (container) {
          const newChildIds = [...container.childIds, newTypeId];
          updateElement(container.id, {
            childIds: newChildIds,
          } as Partial<DiagramElement>);

          // Recalculate container layout to fit the new child
          const childTypes = useDiagramStore
            .getState()
            .elements.filter(
              (el): el is TypeElement =>
                el.type === 'type' && newChildIds.includes(el.id),
            );
          const newLayout = recalcContainerLayout(container.layout, childTypes);
          updateElement(container.id, {
            layout: newLayout,
          } as Partial<DiagramElement>);
        }
      } else if (currentTool === 'generalization') {
        if (generalizationParentId) {
          // Parent has been selected — create container at click position
          const genId = nanoid();
          const genLayout: Layout = {
            x: canvasPos.x - DEFAULT_GEN_WIDTH / 2,
            y: canvasPos.y - DEFAULT_GEN_HEIGHT / 2,
            width: DEFAULT_GEN_WIDTH,
            height: DEFAULT_GEN_HEIGHT,
          };

          // Avoid overlap with existing generalization containers
          const allGenerals = useDiagramStore
            .getState()
            .elements.filter(
              (el): el is GeneralizationElement => el.type === 'generalization',
            );
          const existingLayouts = allGenerals.map((g) => g.layout);

          // Also avoid overlap with the parent Type
          const parentEl = useDiagramStore
            .getState()
            .elements.find((el) => el.id === generalizationParentId);
          if (parentEl && 'layout' in parentEl) {
            existingLayouts.push(parentEl.layout);
          }

          const nonOverlappingLayout = findNonOverlappingPosition(
            genLayout,
            existingLayouts,
          );

          addElement({
            id: genId,
            type: 'generalization',
            name: 'Generalization',
            childIds: [],
            parentId: generalizationParentId,
            completeness: 'complete',
            layout: nonOverlappingLayout,
          });

          // Auto-switch to select tool and select the new container
          clearGeneralizationState();
          setTool('select');
          useEditorStore.getState().select(genId);
        }
        // If generalizationParentId is null, clicking empty canvas does nothing
        // (hint shown in status bar). Return early to avoid falling through to deselectAll.
        return;
      } else if (currentTool === 'long-semantic') {
        // Create a free-floating long semantic note at click position
        const noteId = nanoid();
        addElement({
          id: noteId,
          type: 'longSemantic',
          heading: 'note',
          body: '',
          layout: {
            x: canvasPos.x - DEFAULT_NOTE_WIDTH / 2,
            y: canvasPos.y - NOTE_MIN_HEIGHT / 2,
            width: DEFAULT_NOTE_WIDTH,
            height: NOTE_MIN_HEIGHT,
          },
        });
        // Auto-switch to select and select the new note
        setTool('select');
        useEditorStore.getState().select(noteId);
      } else if (currentTool === 'short-semantic') {
        // In short-semantic mode, clicking empty canvas just deselects
        // (selecting elements is handled by the element click handlers)
        deselectAll();
      } else if (currentTool === 'relation' && relationSourceId) {
        // Click on empty canvas while picking target -> cancel
        clearRelationState();
      } else {
        deselectAll();
      }
    },
    [
      currentTool,
      generalizationParentId,
      addElement,
      updateElement,
      deselectAll,
      setTool,
      clearGeneralizationState,
      panX,
      panY,
      zoom,
      relationSourceId,
      clearRelationState,
      screenToCanvas,
      findGeneralizationAtPoint,
    ],
  );

  /** Click on a Type node in select or other non-relation modes. */
  const handleSelect = useCallback(
    (id: string) => {
      select(id);
    },
    [select],
  );

  /** Click on a Type node in long-semantic mode — create an attached note. */
  const handleLongSemanticTypeClick = useCallback(
    (id: string) => {
      const state = useDiagramStore.getState();
      const targetEl = state.elements.find((el) => el.id === id);
      if (!targetEl || !('layout' in targetEl)) return;

      const targetLayout = targetEl.layout;
      // Place note below the Type
      const noteId = nanoid();
      const noteLayout: Layout = {
        x: targetLayout.x,
        y: targetLayout.y + targetLayout.height + 24,
        width: DEFAULT_NOTE_WIDTH,
        height: NOTE_MIN_HEIGHT,
      };
      addElement({
        id: noteId,
        type: 'longSemantic',
        heading: 'note',
        body: '',
        attachedTo: id,
        layout: noteLayout,
      });
      setTool('select');
      useEditorStore.getState().select(noteId);
    },
    [addElement, setTool],
  );

  /** Click on a Type node in generalization mode — set as parent. */
  const handleGeneralizationTypeClick = useCallback(
    (id: string) => {
      setGeneralizationParent(id);
      select(id);
    },
    [setGeneralizationParent, select],
  );

  /** Click on a Type node in relation mode (click-click creation). */
  const handleRelationClick = useCallback(
    (id: string) => {
      if (relationSourceId === null) {
        // First click: set as relation source
        setRelationSource(id);
      } else {
        // Second click: create relation
        createRelation(relationSourceId, id);
      }
    },
    [relationSourceId, setRelationSource, createRelation],
  );

  /** Stage mousedown: start drag-to-create relation or begin pan. */
  const handleStageMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Pan handling: space+drag or middle mouse button
      if (isSpaceKeyDown.current || e.evt.button === 1) {
        isPanning.current = true;
        lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
        e.evt.preventDefault();
        return;
      }

      // Box select: in select tool, left-click on empty canvas starts a
      // selection-rectangle drag. If the click landed on an element the
      // element's own click handler will manage selection instead.
      if (currentTool === 'select' && e.evt.button === 0) {
        const canvasPos = screenToCanvas(e.evt.offsetX, e.evt.offsetY);
        const allElements = useDiagramStore.getState().elements;
        const clickedElement = allElements.find((el) => {
          if ('layout' in el) {
            const r = el.layout;
            return (
              canvasPos.x >= r.x &&
              canvasPos.x <= r.x + r.width &&
              canvasPos.y >= r.y &&
              canvasPos.y <= r.y + r.height
            );
          }
          return false;
        });
        if (!clickedElement) {
          boxSelectRef.current = {
            startX: canvasPos.x,
            startY: canvasPos.y,
            currentX: canvasPos.x,
            currentY: canvasPos.y,
          };
          setBoxSelectRenderRect({
            x: canvasPos.x,
            y: canvasPos.y,
            width: 0,
            height: 0,
          });
          return;
        }
      }

      if (currentTool !== 'relation') return;
      if (relationDragRef.current.isDragging) return;

      // Walk up the target hierarchy to find a type-node group
      let target: Konva.Node | null = e.target;
      let foundTypeId: string | null = null;
      while (target) {
        if (target.name() === 'type-node') {
          foundTypeId = target.id();
          break;
        }
        target = target.getParent();
      }

      if (foundTypeId) {
        const canvasPos = screenToCanvas(e.evt.offsetX, e.evt.offsetY);
        // Compute source anchor from click position on the type box
        const sourceTypeEl = typeElements.find((t) => t.id === foundTypeId);
        const sourceAnchor = sourceTypeEl
          ? computeAnchorFromPoint(sourceTypeEl.layout, canvasPos)
          : undefined;
        relationDragRef.current = {
          isDragging: true,
          hasMoved: false,
          sourceId: foundTypeId,
          sourceAnchor,
          startPos: canvasPos,
        };
        setRelationSource(foundTypeId);
      }
    },
    [currentTool, screenToCanvas, setRelationSource],
  );

  /** Stage mousemove: update preview line during drag-to-create, or pan. */
  const handleStageMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Pan handling
      if (isPanning.current) {
        const dx = e.evt.clientX - lastPanPos.current.x;
        const dy = e.evt.clientY - lastPanPos.current.y;
        lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
        const editor = useEditorStore.getState();
        editor.setPan(editor.panX + dx, editor.panY + dy);
        return;
      }

      // Box select drag: update the selection rectangle while dragging
      if (boxSelectRef.current) {
        const canvasPos = screenToCanvas(e.evt.offsetX, e.evt.offsetY);
        boxSelectRef.current.currentX = canvasPos.x;
        boxSelectRef.current.currentY = canvasPos.y;
        const x = Math.min(boxSelectRef.current.startX, canvasPos.x);
        const y = Math.min(boxSelectRef.current.startY, canvasPos.y);
        setBoxSelectRenderRect({
          x,
          y,
          width: Math.abs(canvasPos.x - boxSelectRef.current.startX),
          height: Math.abs(canvasPos.y - boxSelectRef.current.startY),
        });
        return;
      }

      if (currentTool !== 'relation') return;
      if (!relationDragRef.current.isDragging) return;

      const canvasPos = screenToCanvas(e.evt.offsetX, e.evt.offsetY);
      const dx = canvasPos.x - relationDragRef.current.startPos.x;
      const dy = canvasPos.y - relationDragRef.current.startPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 5) {
        relationDragRef.current.hasMoved = true;
      }

      if (relationDragRef.current.hasMoved) {
        setRelationEndPoint(canvasPos);
      }
    },
    [currentTool, screenToCanvas, setRelationEndPoint],
  );

  /** Stage mouseup: complete or cancel drag-to-create relation, or end pan. */
  const handleStageMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // End pan
      if (isPanning.current) {
        isPanning.current = false;
        return;
      }

      // Box select complete: determine which elements fall inside the
      // selection rectangle and select them all.
      if (boxSelectRef.current) {
        const bs = boxSelectRef.current;
        const rect = {
          x: Math.min(bs.startX, bs.currentX),
          y: Math.min(bs.startY, bs.currentY),
          width: Math.abs(bs.currentX - bs.startX),
          height: Math.abs(bs.currentY - bs.startY),
        };

        // Zero-area "click" — let the click handler handle deselection
        if (rect.width < 1 || rect.height < 1) {
          boxSelectRef.current = null;
          setBoxSelectRenderRect(null);
          return;
        }

        const allElements = useDiagramStore.getState().elements;
        const selected = allElements.filter((el) => {
          if ('layout' in el) {
            return rectsOverlap(rect, el.layout);
          }
          return false;
        });

        const editor = useEditorStore.getState();
        if (selected.length > 0) {
          editor.select(selected.map((el) => el.id));
        } else {
          editor.deselectAll();
        }

        boxSelectRef.current = null;
        setBoxSelectRenderRect(null);
        return;
      }

      if (currentTool !== 'relation') return;
      if (!relationDragRef.current.isDragging) return;

      if (relationDragRef.current.hasMoved) {
        const canvasPos = screenToCanvas(e.evt.offsetX, e.evt.offsetY);
        const targetType = findTypeAtPoint(canvasPos);
        if (targetType) {
          // Compute target anchor from cursor position on the target type edge
          const targetAnchor = computeAnchorFromPoint(targetType.layout, canvasPos);
          createRelation(
            relationDragRef.current.sourceId,
            targetType.id,
            relationDragRef.current.sourceAnchor,
            targetAnchor,
          );
        } else {
          // Released on empty space -> cancel
          clearRelationState();
        }
      }
      // If not moved (was a click), the click handler handles it.

      relationDragRef.current.isDragging = false;
    },
    [
      currentTool,
      screenToCanvas,
      findTypeAtPoint,
      createRelation,
      clearRelationState,
    ],
  );

  /** Mouse wheel zoom (zoom toward cursor position). */
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const editor = useEditorStore.getState();
      const oldZoom = editor.zoom;
      const oldPanX = editor.panX;
      const oldPanY = editor.panY;

      const delta = -e.evt.deltaY;
      const factor = delta > 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));

      // Zoom toward cursor position
      const stageX = e.evt.offsetX;
      const stageY = e.evt.offsetY;
      const newPanX = stageX - (stageX - oldPanX) * (oldZoom / newZoom);
      const newPanY = stageY - (stageY - oldPanY) * (oldZoom / newZoom);

      editor.setZoom(newZoom);
      editor.setPan(newPanX, newPanY);
    },
    [],
  );

  /**
   * Handle drag end for all draggable elements (Type, Note, Generalization).
   * Generalization containers require special handling:
   * - Move children along with the container
   * - Prevent overlap with other containers
   */
  const handleDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      const state = useDiagramStore.getState();
      const el = state.elements.find((e) => e.id === id);
      if (!el || !('layout' in el)) return;

      const prevLayout: Layout = el.layout;
      const snap = useEditorStore.getState().snapEnabled;
      const snappedX = snap ? snapToGrid(x, GRID_SIZE) : x;
      const snappedY = snap ? snapToGrid(y, GRID_SIZE) : y;

      if (el.type === 'generalization') {
        const gen = el as GeneralizationElement;
        const newLayout: Layout = {
          ...prevLayout,
          x: snappedX,
          y: snappedY,
        };

        // Check overlap with other generalization containers (excluding self)
        const otherGens = state.elements.filter(
          (e): e is GeneralizationElement =>
            e.type === 'generalization' && e.id !== id,
        );
        const hasOverlap = otherGens.some((other) =>
          rectsOverlap(newLayout, other.layout),
        );

        if (hasOverlap) {
          // Revert — do not update any positions (Konva will snap back on re-render)
          return;
        }

        // Compute delta for moving children
        const deltaX = snappedX - prevLayout.x;
        const deltaY = snappedY - prevLayout.y;

        // Update container position
        updateElement(id, {
          layout: newLayout,
        } as Partial<DiagramElement>);

        // Move children by the same delta
        for (const childId of gen.childIds) {
          const child = state.elements.find((e) => e.id === childId);
          if (child && 'layout' in child) {
            const childLayout = (child as TypeElement | NoteElement).layout;
            updateElement(childId, {
              layout: {
                ...childLayout,
                x: childLayout.x + deltaX,
                y: childLayout.y + deltaY,
              },
            } as Partial<DiagramElement>);
          }
        }
      } else if (el.type === 'type') {
        // Update Type position
        updateElement(id, {
          layout: { ...prevLayout, x: snappedX, y: snappedY },
        } as Partial<DiagramElement>);

        // Check if the Type was dropped inside (or moved out of) a generalization container
        const newTypeLayout: Layout = {
          ...prevLayout,
          x: snappedX,
          y: snappedY,
        };
        const gens = state.elements.filter(
          (e): e is GeneralizationElement => e.type === 'generalization',
        );
        for (const gen of gens) {
          const wasChild = gen.childIds.includes(id);
          const isInside = rectsOverlap(newTypeLayout, gen.layout);

          if (isInside && !wasChild) {
            // Type was dragged INTO the container
            const newChildIds = [...gen.childIds, id];
            updateElement(gen.id, {
              childIds: newChildIds,
            } as Partial<DiagramElement>);

            // Recalculate container size
            const childTypes = state.elements.filter(
              (el): el is TypeElement =>
                el.type === 'type' && newChildIds.includes(el.id),
            );
            const newGenLayout = recalcContainerLayout(gen.layout, childTypes);
            updateElement(gen.id, {
              layout: newGenLayout,
            } as Partial<DiagramElement>);
          } else if (!isInside && wasChild) {
            // Type was dragged OUT of the container
            updateElement(gen.id, {
              childIds: gen.childIds.filter((cid) => cid !== id),
            } as Partial<DiagramElement>);

            // Recalculate container size (shrink if needed)
            const childTypes = state.elements.filter(
              (el): el is TypeElement =>
                el.type === 'type' &&
                gen.childIds.filter((cid) => cid !== id).includes(el.id),
            );
            const newGenLayout = recalcContainerLayout(gen.layout, childTypes);
            updateElement(gen.id, {
              layout: newGenLayout,
            } as Partial<DiagramElement>);
          }
        }
      } else {
        // Note or other layout element
        updateElement(id, {
          layout: { ...prevLayout, x: snappedX, y: snappedY },
        } as Partial<DiagramElement>);
      }
    },
    [updateElement],
  );

  /* ------------------------------------------------------------------ */
  /*  Derived preview line points (computed during render, not via ref)  */
  /* ------------------------------------------------------------------ */
  const previewLinePoints: number[] = useMemo(() => {
    if (
      currentTool === 'relation' &&
      relationSourceId &&
      relationEndPoint
    ) {
      const sourceEl = typeElements.find((el) => el.id === relationSourceId);
      if (sourceEl) {
        // Use the source anchor from drag ref for the preview line (ME-55)
        return computePreviewPoints(
          sourceEl.layout,
          relationEndPoint,
          relationDragRef.current.sourceAnchor,
        );
      }
    }
    return [];
  }, [currentTool, relationSourceId, relationEndPoint, typeElements]);

  /* ------------------------------------------------------------------ */
  /*  Derived relation target highlight (computed during render)         */
  /* ------------------------------------------------------------------ */
  const relationTargetId: string | null = useMemo(() => {
    if (currentTool === 'relation' && relationSourceId && relationEndPoint) {
      const hoveredType = findTypeAtPoint(relationEndPoint);
      return hoveredType ? hoveredType.id : null;
    }
    return null;
  }, [currentTool, relationSourceId, relationEndPoint, findTypeAtPoint]);

  /* ------------------------------------------------------------------ */
  /*  Build selection highlight rects                                    */
  /* ------------------------------------------------------------------ */
  const selectionRects = useMemo(
    () =>
      elements
        .filter((el) => selectedIds.includes(el.id) && 'layout' in el)
        .map((el) => {
          const layout = (el as TypeElement | NoteElement | GeneralizationElement).layout;
          return (
            <Rect
              key={`sel-${el.id}`}
              x={layout.x - 3}
              y={layout.y - 3}
              width={layout.width + 6}
              height={layout.height + 6}
              stroke={COLORS.selection}
              strokeWidth={2}
              cornerRadius={6}
              dash={[5, 3]}
              listening={false}
            />
          );
        }),
    [elements, selectedIds],
  );

  /* ------------------------------------------------------------------ */
  /*  Compute cursor style                                               */
  /* ------------------------------------------------------------------ */
  let cursorStyle: string | undefined;
  if (currentTool === 'type') {
    cursorStyle = 'crosshair';
  } else if (currentTool === 'relation') {
    cursorStyle = 'crosshair';
  } else if (currentTool === 'generalization') {
    cursorStyle = 'crosshair';
  } else if (currentTool === 'short-semantic') {
    cursorStyle = 'crosshair';
  } else if (currentTool === 'long-semantic') {
    cursorStyle = 'crosshair';
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      data-testid="canvas-container"
      style={{ cursor: cursorStyle }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          scaleX={zoom}
          scaleY={zoom}
          x={panX}
          y={panY}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onWheel={handleWheel}
          data-testid="konva-stage"
        >
          {/* Layer 1: Grid (bottom-most) */}
          <Layer data-testid="grid-layer" listening={false}>
            <GridLayer width={dimensions.width} height={dimensions.height} />
          </Layer>

          {/* Layer 2: Type + Generalization */}
          <Layer data-testid="type-layer">
            {typeElements.map((el) => {
              let typeOnSelect = handleSelect;
              if (currentTool === 'generalization') {
                typeOnSelect = handleGeneralizationTypeClick;
              } else if (currentTool === 'long-semantic') {
                typeOnSelect = handleLongSemanticTypeClick;
              }
              return (
                <TypeNode
                  key={el.id}
                  element={el}
                  isSelected={selectedIds.includes(el.id)}
                  onSelect={
                    currentTool === 'short-semantic'
                      ? handleSelect
                      : typeOnSelect
                  }
                  onDragEnd={handleDragEnd}
                  onRelationClick={
                    currentTool === 'relation' ? handleRelationClick : undefined
                  }
                  isRelationSource={
                    currentTool === 'relation' && relationSourceId === el.id
                  }
                  isRelationTarget={
                    currentTool === 'relation' &&
                    !!relationSourceId &&
                    !!relationTargetId &&
                    relationTargetId === el.id
                  }
                />
              );
            })}
            {generalizationElements.map((el) => {
              const parentTypeLayout = el.parentId
                ? layoutMap.get(el.parentId) ?? null
                : null;
              return (
                <GeneralizationBox
                  key={el.id}
                  element={el}
                  parentLayout={parentTypeLayout}
                  isSelected={selectedIds.includes(el.id)}
                  onSelect={handleSelect}
                  onDragEnd={handleDragEnd}
                />
              );
            })}
          </Layer>

          {/* Layer 3: Relation */}
          <Layer data-testid="relation-layer">
            {relationElements.map((el) => {
              const sourceLayout = layoutMap.get(el.sourceId);
              const targetLayout = layoutMap.get(el.targetId);
              if (!sourceLayout || !targetLayout) return null;
              return (
                <RelationLine
                  key={el.id}
                  element={el}
                  sourcePosition={sourceLayout}
                  targetPosition={targetLayout}
                  isSelected={selectedIds.includes(el.id)}
                  onSelect={handleSelect}
                />
              );
            })}
          </Layer>

          {/* Layer 4: Note + Long Semantic */}
          <Layer data-testid="note-layer">
            {noteElements.map((el) => (
              <NoteBox
                key={el.id}
                element={el}
                isSelected={selectedIds.includes(el.id)}
                onSelect={handleSelect}
                onDragEnd={handleDragEnd}
              />
            ))}
            {longSemanticElements.map((el) => {
              const attachedLayout = el.attachedTo
                ? generalLayoutMap.get(el.attachedTo) ?? null
                : null;
              return (
                <LongSemanticBox
                  key={el.id}
                  element={el}
                  attachedLayout={attachedLayout}
                  isSelected={selectedIds.includes(el.id)}
                  onSelect={handleSelect}
                  onDragEnd={handleDragEnd}
                />
              );
            })}
          </Layer>

          {/* Layer 5: Preview line (dynamic, during drag-to-create relation) */}
          <Layer data-testid="preview-layer" listening={false}>
            {previewLinePoints.length > 0 && (
              <Line
                points={previewLinePoints}
                stroke={COLORS.relationLine}
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
                tension={0}
                dash={[6, 3]}
              />
            )}
          </Layer>

          {/* Layer 6: Selection highlights (top-most) */}
          <Layer data-testid="selection-layer" listening={false}>
            {selectionRects}
            {boxSelectRenderRect && (
              <Rect
                x={boxSelectRenderRect.x}
                y={boxSelectRenderRect.y}
                width={boxSelectRenderRect.width}
                height={boxSelectRenderRect.height}
                fill="rgba(0, 113, 227, 0.08)"
                stroke={COLORS.selection}
                strokeWidth={1}
                dash={[4, 2]}
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
});

export { computePreviewPoints, Canvas };
export default Canvas;
