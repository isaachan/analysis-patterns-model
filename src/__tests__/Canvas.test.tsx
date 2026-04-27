import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Canvas from '../components/Canvas/Canvas';
import type { DiagramElement, TypeElement, NoteElement, RelationElement, GeneralizationElement } from '../models/diagram';
import type { Group as KonvaGroup } from 'konva/lib/Group';
import { COLORS } from '../constants/designTokens';
import { rectsOverlap } from '../utils/geometry';
import { DEFAULT_GEN_WIDTH, DEFAULT_GEN_HEIGHT } from '../constants/defaults';
import { getStage } from './testHelpers';

/* ------------------------------------------------------------------ */
/*  Mutable mock state (vitest-hoisted so vi.mock factories can close  */
/*  over them).                                                        */
/* ------------------------------------------------------------------ */
const diagramState = vi.hoisted(() => ({
  elements: [] as DiagramElement[],
  addElement: vi.fn(),
  updateElement: vi.fn(),
}));

const editorState = vi.hoisted(() => ({
  currentTool: 'select' as string,
  selectedIds: [] as string[],
  zoom: 1,
  panX: 0,
  panY: 0,
  gridEnabled: true,
  snapEnabled: false,
  select: vi.fn(),
  deselectAll: vi.fn(),
  setZoom: vi.fn(),
  setPan: vi.fn(),
  relationSourceId: null as string | null,
  relationEndPoint: null as { x: number; y: number } | null,
  generalizationParentId: null as string | null,
  setGeneralizationParent: vi.fn(),
  clearGeneralizationState: vi.fn(),
  setTool: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Store mocks                                                        */
/* ------------------------------------------------------------------ */
vi.mock('../store/useDiagramStore', () => {
  const storeFn = Object.assign(
    vi.fn((selector?: (state: unknown) => unknown) => {
      return selector ? selector(diagramState) : diagramState;
    }),
    { getState: vi.fn(() => diagramState) },
  );
  return { useDiagramStore: storeFn };
});

vi.mock('../store/useEditorStore', () => {
  const storeFn = Object.assign(
    vi.fn((selector?: (state: unknown) => unknown) => {
      return selector ? selector(editorState) : editorState;
    }),
    { getState: vi.fn(() => editorState) },
  );
  return { useEditorStore: storeFn };
});

/* ------------------------------------------------------------------ */
/*  Helper to count children on a specific Konva layer                 */
/* ------------------------------------------------------------------ */
function countLayerChildren(
  stage: ReturnType<typeof getStage>,
  layerIndex: number,
  className?: string,
): number {
  const layer = stage.getLayers()[layerIndex];
  if (!layer) return 0;
  const children = layer.getChildren();
  if (!className) return children.length;
  return children.filter(
    (n: { getClassName: () => string }) => n.getClassName() === className,
  ).length;
}

/* ------------------------------------------------------------------ */
/*  Demo data shapes (matching what Canvas renders from DEMO_ELEMENTS) */
/* ------------------------------------------------------------------ */
const demoTypes: TypeElement[] = [
  {
    id: 'demo-type-1', type: 'type', name: 'Customer',
    attributes: ['customerId: int', 'name: string', 'email: string'],
    methods: ['placeOrder()'],
    layout: { x: 100, y: 150, width: 180, height: 110 },
  },
  {
    id: 'demo-type-2', type: 'type', name: 'Order',
    attributes: ['orderId: int', 'orderDate: Date', 'total: decimal'],
    methods: ['calculateTotal()'],
    layout: { x: 420, y: 150, width: 180, height: 110 },
  },
  {
    id: 'demo-type-3', type: 'type', name: 'Product',
    attributes: ['productId: int', 'name: string', 'price: decimal'],
    methods: [],
    layout: { x: 420, y: 380, width: 180, height: 100 },
  },
];

const demoRelations: RelationElement[] = [
  {
    id: 'demo-rel-1', type: 'relation',
    sourceId: 'demo-type-1', targetId: 'demo-type-2',
    sourceCardinality: 'exactly_one', targetCardinality: 'zero_or_many', label: 'places',
  },
  {
    id: 'demo-rel-2', type: 'relation',
    sourceId: 'demo-type-2', targetId: 'demo-type-3',
    sourceCardinality: 'zero_or_many', targetCardinality: 'exactly_one', label: 'contains',
  },
];

const demoNotes: NoteElement[] = [
  {
    id: 'demo-note-1', type: 'note',
    content: 'This is a demo semantic note',
    layout: { x: 100, y: 400, width: 200, height: 70 },
  },
];

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diagramState.elements = [];
    diagramState.addElement = vi.fn();
    diagramState.updateElement = vi.fn();
    editorState.currentTool = 'select';
    editorState.selectedIds = [];
    editorState.select = vi.fn();
    editorState.deselectAll = vi.fn();
    editorState.setTool = vi.fn();
    editorState.zoom = 1;
    editorState.panX = 0;
    editorState.panY = 0;
    editorState.gridEnabled = true;
    editorState.snapEnabled = false;
    editorState.relationSourceId = null;
    editorState.relationEndPoint = null;
    editorState.generalizationParentId = null;
    editorState.setGeneralizationParent = vi.fn();
    editorState.clearGeneralizationState = vi.fn();
  });

  it('renders without crashing', () => {
    const { container } = render(<Canvas />);
    expect(container).toBeTruthy();
  });

  it('renders the canvas container', () => {
    render(<Canvas />);
    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
  });

  it('renders a Konva Stage element', () => {
    const { container } = render(<Canvas />);
    const stageContainer = container.querySelector('.konvajs-content');
    expect(stageContainer).toBeTruthy();
  });

  it('renders six Konva layers as canvas elements', () => {
    const { container } = render(<Canvas />);
    // Each Konva Layer produces a <canvas> element
    const canvases = container.querySelectorAll('canvas');
    expect(canvases.length).toBe(6);
  });

  it('renders empty canvas when no elements exist in store', () => {
    render(<Canvas />);

    const stage = getStage();
    expect(stage).toBeDefined();

    const layers = stage.getLayers();
    expect(layers.length).toBe(6);

    // Layer 0 (grid): circles + 1 background rect
    expect(countLayerChildren(stage, 0)).toBeGreaterThan(0);

    // Layer 1 (type): 0 TypeNode / GeneralizationBox Groups
    expect(countLayerChildren(stage, 1)).toBe(0);

    // Layer 2 (relation): 0 RelationLine Groups
    expect(countLayerChildren(stage, 2)).toBe(0);

    // Layer 3 (note): 0 NoteBox Groups
    expect(countLayerChildren(stage, 3)).toBe(0);

    // Layer 4 (preview): 0 children
    expect(countLayerChildren(stage, 4)).toBe(0);

    // Layer 5 (selection): 0 rects when nothing is selected
    expect(countLayerChildren(stage, 5)).toBe(0);
  });

  it('renders real elements from store instead of demo data', () => {
    diagramState.elements = [demoTypes[0]]; // Just one type element

    render(<Canvas />);

    const stage = getStage();

    // Layer 1 (type): 1 TypeNode
    expect(countLayerChildren(stage, 1)).toBe(1);

    // Layer 2 (relation): 0 relations
    expect(countLayerChildren(stage, 2)).toBe(0);

    // Layer 3 (note): 0 notes
    expect(countLayerChildren(stage, 3)).toBe(0);
  });

  it('renders elements of all types from store', () => {
    diagramState.elements = [...demoTypes, ...demoRelations, ...demoNotes];

    render(<Canvas />);

    const stage = getStage();
    expect(countLayerChildren(stage, 1)).toBe(3); // 3 types
    expect(countLayerChildren(stage, 2)).toBe(2); // 2 relations
    expect(countLayerChildren(stage, 3)).toBe(1); // 1 note
  });

  it('renders selection highlight rects when elements are selected', () => {
    diagramState.elements = [demoTypes[0]];
    editorState.selectedIds = ['demo-type-1'];

    render(<Canvas />);

    const stage = getStage();
    // Layer 5 (selection) should have 1 Rect for the selected element
    expect(countLayerChildren(stage, 5)).toBe(1);
  });

  it('renders multiple selection rects when multiple elements are selected', () => {
    diagramState.elements = [...demoTypes];
    editorState.selectedIds = ['demo-type-1', 'demo-type-2'];

    render(<Canvas />);

    const stage = getStage();
    expect(countLayerChildren(stage, 5)).toBe(2);
  });

  it('renders no selection rects when nothing is selected', () => {
    diagramState.elements = [...demoTypes];

    render(<Canvas />);

    const stage = getStage();
    expect(countLayerChildren(stage, 5)).toBe(0);
  });

  it('does not render the Stage when dimensions are zero', () => {
    const origRO = globalThis.ResizeObserver;
    try {
      // Override ResizeObserver to return zero dimensions
      globalThis.ResizeObserver = class ZeroRO {
        constructor(cb: ResizeObserverCallback) {
          cb(
            [{ contentRect: { width: 0, height: 0 } as DOMRectReadOnly }] as unknown as ResizeObserverEntry[],
            this as unknown as ResizeObserver,
          );
        }
        observe() { /* noop */ }
        unobserve() { /* noop */ }
        disconnect() { /* noop */ }
      } as unknown as typeof ResizeObserver;

      const { container } = render(<Canvas />);
      const stageContainer = container.querySelector('.konvajs-content');
      expect(stageContainer).toBeFalsy();
    } finally {
      globalThis.ResizeObserver = origRO;
    }
  });

  it('calls deselectAll when stage background is clicked', () => {
    render(<Canvas />);

    const stage = getStage();
    act(() => {
      stage.fire('click', { evt: { offsetX: 10, offsetY: 10 } as MouseEvent });
    });

    // handleStageClick calls deselectAll when not in type mode
    expect(editorState.deselectAll).toHaveBeenCalled();
  });

  it('uses ResizeObserver to set Stage dimensions', () => {
    // The setup.ts mocks ResizeObserver to fire with {width: 1024, height: 768}
    render(<Canvas />);

    const stage = getStage();
    expect(stage.width()).toBe(1024);
    expect(stage.height()).toBe(768);
  });

  it('wires the editor store select handler', () => {
    render(<Canvas />);
    expect(editorState.select).not.toHaveBeenCalled();
  });

  it('wires the editor store deselectAll handler', () => {
    const { container } = render(<Canvas />);
    expect(editorState.deselectAll).not.toHaveBeenCalled();
    expect(container).toBeTruthy();
  });

  /* ------------------------------------------------------------------ */
  /*  Type tool creation tests (ME-6)                                    */
  /* ------------------------------------------------------------------ */

  it('creates a TypeElement when clicking canvas in type mode', () => {
    editorState.currentTool = 'type';

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 300, offsetY: 400 } as MouseEvent });
    });

    expect(diagramState.addElement).toHaveBeenCalledTimes(1);
    const element = diagramState.addElement.mock.calls[0][0] as TypeElement;
    expect(element.type).toBe('type');
    expect(element.name).toBe('Type');
    expect(element.attributes).toEqual([]);
    expect(element.methods).toEqual([]);
    expect(element.layout.width).toBe(180);
    expect(element.layout.height).toBe(60);
    // Center of click at (300, 400) with zoom=1, panX=0, panY=0
    expect(element.layout.x).toBe(300 - 180 / 2);
    expect(element.layout.y).toBe(400 - 60 / 2);
  });

  it('does NOT create a TypeElement when clicking canvas in select mode', () => {
    editorState.currentTool = 'select';

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 300, offsetY: 400 } as MouseEvent });
    });

    expect(diagramState.addElement).not.toHaveBeenCalled();
  });

  it('generates a unique id for each created TypeElement', () => {
    editorState.currentTool = 'type';

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 100, offsetY: 100 } as MouseEvent });
    });
    act(() => {
      stage.fire('click', { evt: { offsetX: 200, offsetY: 200 } as MouseEvent });
    });

    expect(diagramState.addElement).toHaveBeenCalledTimes(2);
    const id1 = diagramState.addElement.mock.calls[0][0].id;
    const id2 = diagramState.addElement.mock.calls[1][0].id;
    expect(id1).not.toBe(id2);
  });

  it('transforms click coordinates correctly with zoom and pan', () => {
    editorState.currentTool = 'type';
    editorState.zoom = 2;
    editorState.panX = 100;
    editorState.panY = 50;

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 500, offsetY: 300 } as MouseEvent });
    });

    const element = diagramState.addElement.mock.calls[0][0] as TypeElement;
    // canvasX = (500 - 100) / 2 = 200
    // canvasY = (300 - 50) / 2 = 125
    expect(element.layout.x).toBe(200 - 180 / 2);
    expect(element.layout.y).toBe(125 - 60 / 2);
  });

  it('stays in type mode after creating a TypeElement (continuous creation)', () => {
    editorState.currentTool = 'type';

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 100, offsetY: 100 } as MouseEvent });
    });

    // Tool should still be 'type'
    expect(editorState.currentTool).toBe('type');
  });

  /* ------------------------------------------------------------------ */
  /*  Cursor tests (ME-6)                                                */
  /* ------------------------------------------------------------------ */

  it('shows crosshair cursor when type tool is active', () => {
    editorState.currentTool = 'type';

    render(<Canvas />);
    const container = screen.getByTestId('canvas-container');
    expect(container.style.cursor).toBe('crosshair');
  });

  it('shows default cursor when select tool is active', () => {
    editorState.currentTool = 'select';

    render(<Canvas />);
    const container = screen.getByTestId('canvas-container');
    expect(container.style.cursor).toBe('');
  });

  describe('edge cases', () => {
    it('renders with a single element', () => {
      diagramState.elements = [demoTypes[0]];

      render(<Canvas />);
      const stage = getStage();
      expect(countLayerChildren(stage, 1)).toBe(1);
      expect(countLayerChildren(stage, 2)).toBe(0);
      expect(countLayerChildren(stage, 3)).toBe(0);
    });

    it('handles empty elements array by showing empty canvas (no demo data fallback)', () => {
      diagramState.elements = [];

      render(<Canvas />);
      const stage = getStage();
      // No demo data fallback: 0 types, 0 relations, 0 notes
      expect(countLayerChildren(stage, 1)).toBe(0);
      expect(countLayerChildren(stage, 2)).toBe(0);
      expect(countLayerChildren(stage, 3)).toBe(0);
    });

    it('handles relations that reference missing type layouts gracefully', () => {
      // A relation referencing a source/target that doesn't exist
      diagramState.elements = [
        {
          id: 'orphan-rel',
          type: 'relation',
          sourceId: 'nonexistent-1',
          targetId: 'nonexistent-2',
          sourceCardinality: 'exactly_one',
          targetCardinality: 'zero_or_many',
          label: 'orphan',
        },
      ];

      const { container } = render(<Canvas />);
      expect(container).toBeTruthy();

      const stage = getStage();
      // Relation layer should have 0 children (orphan relation returns null)
      expect(countLayerChildren(stage, 2)).toBe(0);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-6 additional edge-case tests                                    */
  /* ------------------------------------------------------------------ */

  describe('ME-6 type creation edge cases', () => {
    it('creates multiple Type nodes at different positions with correct coordinates', () => {
      editorState.currentTool = 'type';

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('click', { evt: { offsetX: 100, offsetY: 200 } as MouseEvent });
      });
      act(() => {
        stage.fire('click', { evt: { offsetX: 400, offsetY: 500 } as MouseEvent });
      });

      expect(diagramState.addElement).toHaveBeenCalledTimes(2);

      const el1 = diagramState.addElement.mock.calls[0][0] as TypeElement;
      const el2 = diagramState.addElement.mock.calls[1][0] as TypeElement;

      // First click at (100, 200)
      expect(el1.layout.x).toBe(100 - 180 / 2);
      expect(el1.layout.y).toBe(200 - 60 / 2);

      // Second click at (400, 500)
      expect(el2.layout.x).toBe(400 - 180 / 2);
      expect(el2.layout.y).toBe(500 - 60 / 2);

      // Positions must differ
      expect(el1.layout.x).not.toBe(el2.layout.x);
      expect(el1.layout.y).not.toBe(el2.layout.y);

      // Both have correct dimensions
      expect(el1.layout.width).toBe(180);
      expect(el1.layout.height).toBe(60);
      expect(el2.layout.width).toBe(180);
      expect(el2.layout.height).toBe(60);
    });

    it('transforms coordinates correctly at minimum zoom (0.1)', () => {
      editorState.currentTool = 'type';
      editorState.zoom = 0.1;
      editorState.panX = 50;
      editorState.panY = 30;

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('click', { evt: { offsetX: 200, offsetY: 100 } as MouseEvent });
      });

      const element = diagramState.addElement.mock.calls[0][0] as TypeElement;
      // canvasX = (200 - 50) / 0.1 = 1500
      // canvasY = (100 - 30) / 0.1 = 700
      expect(element.layout.x).toBe(1500 - 180 / 2);
      expect(element.layout.y).toBe(700 - 60 / 2);
    });

    it('transforms coordinates correctly at maximum zoom (5.0)', () => {
      editorState.currentTool = 'type';
      editorState.zoom = 5.0;
      editorState.panX = -200;
      editorState.panY = -100;

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('click', { evt: { offsetX: 800, offsetY: 600 } as MouseEvent });
      });

      const element = diagramState.addElement.mock.calls[0][0] as TypeElement;
      // canvasX = (800 - (-200)) / 5.0 = 1000 / 5 = 200
      // canvasY = (600 - (-100)) / 5.0 = 700 / 5 = 140
      expect(element.layout.x).toBe(200 - 180 / 2);
      expect(element.layout.y).toBe(140 - 60 / 2);
    });

    it('does not affect existing elements when creating a new Type node', () => {
      // Pre-populate with a type and a note
      diagramState.elements = [demoTypes[0], demoNotes[0]];
      editorState.currentTool = 'type';

      render(<Canvas />);
      const stage = getStage();

      // Sanity check: existing elements are on their layers
      expect(countLayerChildren(stage, 1)).toBe(1); // 1 type
      expect(countLayerChildren(stage, 3)).toBe(1); // 1 note

      act(() => {
        stage.fire('click', { evt: { offsetX: 500, offsetY: 300 } as MouseEvent });
      });

      // addElement was called to create the new Type
      expect(diagramState.addElement).toHaveBeenCalledTimes(1);

      // updateElement must NOT be called — existing elements are untouched
      expect(diagramState.updateElement).not.toHaveBeenCalled();

      // deselectAll must NOT be called — we stay in type mode
      expect(editorState.deselectAll).not.toHaveBeenCalled();
    });

    it('creates Type node at canvas origin (0,0) with no zoom/pan offsets', () => {
      editorState.currentTool = 'type';
      editorState.zoom = 1;
      editorState.panX = 0;
      editorState.panY = 0;

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('click', { evt: { offsetX: 0, offsetY: 0 } as MouseEvent });
      });

      const element = diagramState.addElement.mock.calls[0][0] as TypeElement;
      expect(element.layout.x).toBe(-180 / 2);
      expect(element.layout.y).toBe(-60 / 2);
    });

    it('shows default cursor for every non-type non-relation non-generalization non-semantic tool mode', () => {
      const nonCrosshairTools: Array<string> = [
        'select', 'note',
      ];

      for (const tool of nonCrosshairTools) {
        vi.clearAllMocks();
        editorState.currentTool = tool;

        const { unmount } = render(<Canvas />);
        const container = screen.getByTestId('canvas-container');
        expect(container.style.cursor, `expected default cursor for tool "${tool}"`).toBe('');
        unmount();
      }
    });

    it('shows crosshair cursor for relation tool', () => {
      editorState.currentTool = 'relation';

      render(<Canvas />);
      const canvasContainer = screen.getByTestId('canvas-container');
      expect(canvasContainer.style.cursor).toBe('crosshair');
    });

    it('shows crosshair cursor for generalization tool', () => {
      editorState.currentTool = 'generalization';

      render(<Canvas />);
      const canvasContainer = screen.getByTestId('canvas-container');
      expect(canvasContainer.style.cursor).toBe('crosshair');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-9: Drag to move Type node                                       */
  /* ------------------------------------------------------------------ */

  describe('ME-9 drag to move Type node', () => {
    it('updates element layout in store when TypeNode fires dragend', () => {
      diagramState.elements = [demoTypes[0]];

      render(<Canvas />);
      const stage = getStage();

      // Type layer is index 1
      const typeLayer = stage.getLayers()[1];
      const typeGroup = typeLayer.getChildren()[0];
      expect(typeGroup).toBeDefined();

      const newX = 350;
      const newY = 450;

      act(() => {
        typeGroup.x(newX);
        typeGroup.y(newY);
        typeGroup.fire('dragend');
      });

      expect(diagramState.updateElement).toHaveBeenCalledTimes(1);
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'demo-type-1',
        {
          layout: { ...demoTypes[0].layout, x: newX, y: newY },
        },
      );
    });

    it('preserves original width and height in updated layout after drag', () => {
      diagramState.elements = [demoTypes[0]];

      render(<Canvas />);
      const stage = getStage();

      const typeLayer = stage.getLayers()[1];
      const typeGroup = typeLayer.getChildren()[0];

      act(() => {
        typeGroup.x(999);
        typeGroup.y(888);
        typeGroup.fire('dragend');
      });

      // The updated layout must preserve the original width and height
      const updatedLayout = diagramState.updateElement.mock.calls[0][1].layout;
      expect(updatedLayout.width).toBe(demoTypes[0].layout.width);
      expect(updatedLayout.height).toBe(demoTypes[0].layout.height);
      expect(updatedLayout.x).toBe(999);
      expect(updatedLayout.y).toBe(888);
    });

    it('does not crash when dragging a non-existent element (no layout)', () => {
      // An element without 'layout' (e.g. RelationElement) should be
      // gracefully skipped by handleDragEnd.
      diagramState.elements = [{
        id: 'rel-no-layout',
        type: 'relation',
        sourceId: 'type-1',
        targetId: 'type-2',
        sourceCardinality: 'exactly_one',
        targetCardinality: 'zero_or_many',
        label: 'test',
      } as unknown as TypeElement];

      render(<Canvas />);
      const stage = getStage();

      // The type layer (index 1) should be empty since the only element
      // is a relation, not a type — but there is no TypeError.
      const typeLayer = stage.getLayers()[1];
      expect(typeLayer.getChildren().length).toBe(0);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-11: TypeNode name syncs from store                              */
  /* ------------------------------------------------------------------ */

  describe('ME-11 TypeNode name display', () => {
    it('renders TypeNode name text matching the store element name', () => {
      diagramState.elements = [demoTypes[0]];

      render(<Canvas />);
      const stage = getStage();

      const typeLayer = stage.getLayers()[1];
      const typeGroup = typeLayer.getChildren()[0];

      const textNodes = (typeGroup as unknown as KonvaGroup).find('Text') as unknown as Array<{ text: () => string }>;
      expect(textNodes.length).toBeGreaterThan(0);
      // First Text node is the entity name in the header
      expect(textNodes[0].text()).toBe('Customer');
    });

    it('renders TypeNode name text for Chinese element names from store', () => {
      const chineseType: TypeElement = {
        id: 'demo-type-4',
        type: 'type',
        name: '客户管理',
        attributes: [],
        methods: [],
        layout: { x: 200, y: 200, width: 180, height: 60 },
      };
      diagramState.elements = [chineseType];

      render(<Canvas />);
      const stage = getStage();

      const typeLayer = stage.getLayers()[1];
      const typeGroup = typeLayer.getChildren()[0];
      const textNodes = (typeGroup as unknown as KonvaGroup).find('Text') as unknown as Array<{ text: () => string }>;

      expect(textNodes.length).toBeGreaterThan(0);
      expect(textNodes[0].text()).toBe('客户管理');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-19: Click relation line to select in Canvas                      */
  /* ------------------------------------------------------------------ */

  describe('ME-19 click relation line to select', () => {
    it('calls select with relation id when a RelationLine group is clicked', () => {
      diagramState.elements = [...demoTypes, ...demoRelations];

      render(<Canvas />);
      const stage = getStage();

      // Relation layer is index 2
      const relationLayer = stage.getLayers()[2];
      const relationGroup = relationLayer.getChildren()[0];

      act(() => {
        relationGroup.fire('click');
      });

      // handleSelect calls select(id) which is editorState.select
      expect(editorState.select).toHaveBeenCalledWith('demo-rel-1');
    });

    it('calls select with the correct id for each relation when clicked', () => {
      diagramState.elements = [...demoTypes, ...demoRelations];

      render(<Canvas />);
      const stage = getStage();

      const relationLayer = stage.getLayers()[2];
      const groups = relationLayer.getChildren();

      // Click first relation
      act(() => {
        groups[0].fire('click');
      });
      expect(editorState.select).toHaveBeenCalledWith('demo-rel-1');

      // Click second relation
      act(() => {
        groups[1].fire('click');
      });
      expect(editorState.select).toHaveBeenCalledWith('demo-rel-2');
    });

    it('renders relation line with selection style when relation is selected', () => {
      diagramState.elements = [...demoTypes, ...demoRelations];
      editorState.selectedIds = ['demo-rel-1'];

      render(<Canvas />);
      const stage = getStage();

      // Relation layer is index 2
      const relationLayer = stage.getLayers()[2];

      // First relation Line should have selection stroke (query the Group's children)
      const firstGroup = relationLayer.getChildren()[0];
      const lines = (firstGroup as unknown as { getChildren: () => Array<{ getClassName: () => string; stroke: () => string; strokeWidth: () => number }> }).getChildren();
      const visibleLine = lines.find(
        (l: { getClassName: () => string; stroke: () => string }) =>
          l.getClassName() === 'Line' && l.stroke() !== 'transparent',
      );
      expect(visibleLine).toBeDefined();
      expect(visibleLine!.stroke()).toBe(COLORS.selection);
      expect(visibleLine!.strokeWidth()).toBe(3);
    });

    it('deselects relation when clicking blank canvas background', () => {
      diagramState.elements = [...demoTypes, ...demoRelations];
      editorState.selectedIds = ['demo-rel-1'];
      editorState.currentTool = 'select';
      editorState.deselectAll = vi.fn();

      render(<Canvas />);
      const stage = getStage();

      // Click on stage background (empty space)
      act(() => {
        stage.fire('click', { evt: { offsetX: 10, offsetY: 10 } as MouseEvent });
      });

      expect(editorState.deselectAll).toHaveBeenCalledTimes(1);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-15: Preview line is orthogonal                                  */
  /* ------------------------------------------------------------------ */

  describe('ME-15 preview line orthogonality', () => {
    it('renders preview Line with orthogonal points during drag', () => {
      diagramState.elements = [demoTypes[0]]; // Just type-1 as source
      editorState.currentTool = 'relation';
      editorState.relationSourceId = 'demo-type-1';
      editorState.relationEndPoint = { x: 500, y: 300 };

      render(<Canvas />);
      const stage = getStage();

      // Preview layer is index 4
      const previewLayer = stage.getLayers()[4];
      const children = previewLayer.getChildren();
      expect(children.length).toBe(1);

      const line = children[0] as unknown as { getClassName: () => string; points: () => number[] };
      expect(line.getClassName()).toBe('Line');

      const points = line.points();
      expect(points.length).toBe(8);

      // Verify all segments are axis-aligned
      for (let i = 0; i < points.length - 2; i += 2) {
        const isAxisAligned =
          points[i] === points[i + 2] || points[i + 1] === points[i + 3];
        expect(isAxisAligned).toBe(true);
      }
    });

    it('preview line starts at source type border', () => {
      diagramState.elements = [demoTypes[0]];
      editorState.currentTool = 'relation';
      editorState.relationSourceId = 'demo-type-1';
      editorState.relationEndPoint = { x: 500, y: 300 };

      render(<Canvas />);
      const stage = getStage();

      const previewLayer = stage.getLayers()[4];
      const line = previewLayer.getChildren()[0] as unknown as { points: () => number[] };
      const points = line.points();

      // Source layout: { x: 100, y: 150, width: 180, height: 110 }
      // Source right edge is at x=280 (for targets to the right, exit is on right edge)
      // First point should be on the source rect border
      const srcLayout = demoTypes[0].layout;
      expect(points[0]).toBeGreaterThanOrEqual(srcLayout.x);
      expect(points[0]).toBeLessThanOrEqual(srcLayout.x + srcLayout.width);
      expect(points[1]).toBeGreaterThanOrEqual(srcLayout.y);
      expect(points[1]).toBeLessThanOrEqual(srcLayout.y + srcLayout.height);
    });

    it('does not render preview line when not in relation mode', () => {
      diagramState.elements = [demoTypes[0]];
      editorState.currentTool = 'select';
      editorState.relationSourceId = 'demo-type-1';
      editorState.relationEndPoint = { x: 500, y: 300 };

      render(<Canvas />);
      const stage = getStage();

      const previewLayer = stage.getLayers()[4];
      expect(previewLayer.getChildren().length).toBe(0);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-42/43/44: Zoom with mouse wheel                                 */
  /* ------------------------------------------------------------------ */

  describe('ME-42/43/44 mouse wheel zoom', () => {
    it('zooms in (positive deltaY) calls setZoom with larger zoom', () => {
      render(<Canvas />);
      const stage = getStage();

      editorState.zoom = 1;
      editorState.setZoom = vi.fn();
      editorState.setPan = vi.fn();

      act(() => {
        stage.fire('wheel', {
          evt: {
            deltaY: -100,
            offsetX: 500,
            offsetY: 400,
            preventDefault: vi.fn(),
          } as unknown as WheelEvent,
        });
      });

      // Zoom should increase (deltaY < 0 = scroll up = zoom in)
      expect(editorState.setZoom).toHaveBeenCalled();
      const newZoom = editorState.setZoom.mock.calls[0][0];
      expect(newZoom).toBeGreaterThan(1);
    });

    it('zooms out (negative deltaY) calls setZoom with smaller zoom', () => {
      render(<Canvas />);
      const stage = getStage();

      editorState.zoom = 1;
      editorState.setZoom = vi.fn();
      editorState.setPan = vi.fn();

      act(() => {
        stage.fire('wheel', {
          evt: {
            deltaY: 100,
            offsetX: 500,
            offsetY: 400,
            preventDefault: vi.fn(),
          } as unknown as WheelEvent,
        });
      });

      expect(editorState.setZoom).toHaveBeenCalled();
      const newZoom = editorState.setZoom.mock.calls[0][0];
      expect(newZoom).toBeLessThan(1);
    });

    it('calls setPan to zoom toward cursor', () => {
      render(<Canvas />);
      const stage = getStage();

      editorState.zoom = 1;
      editorState.panX = 50;
      editorState.panY = 30;
      editorState.setZoom = vi.fn();
      editorState.setPan = vi.fn();

      act(() => {
        stage.fire('wheel', {
          evt: {
            deltaY: -100,
            offsetX: 500,
            offsetY: 400,
            preventDefault: vi.fn(),
          } as unknown as WheelEvent,
        });
      });

      // setPan should be called with updated values for zoom toward cursor
      expect(editorState.setPan).toHaveBeenCalled();
      // newPanX and newPanY are computed from the cursor position formula
      const [newPanX, newPanY] = editorState.setPan.mock.calls[0];
      expect(typeof newPanX).toBe('number');
      expect(typeof newPanY).toBe('number');
    });

    it('calls preventDefault on the wheel event', () => {
      render(<Canvas />);
      const stage = getStage();

      const preventDefault = vi.fn();

      act(() => {
        stage.fire('wheel', {
          evt: {
            deltaY: 100,
            offsetX: 500,
            offsetY: 400,
            preventDefault,
          } as unknown as WheelEvent,
        });
      });

      expect(preventDefault).toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-42/43/44: Space+drag panning                                    */
  /* ------------------------------------------------------------------ */

  describe('ME-42/43/44 space+drag panning', () => {
    beforeEach(() => {
      editorState.setPan = vi.fn();
      editorState.panX = 100;
      editorState.panY = 50;
    });

    it('pans canvas when space is held and mouse is dragged', () => {
      render(<Canvas />);
      const stage = getStage();

      // Press space key to enable pan mode
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space', bubbles: true }),
      );

      // Mousedown on stage while space is pressed
      act(() => {
        stage.fire('mousedown', {
          evt: {
            button: 0,
            clientX: 200,
            clientY: 150,
            preventDefault: vi.fn(),
          } as unknown as MouseEvent,
        });
      });

      // Mousemove while panning (dx=50, dy=30)
      act(() => {
        stage.fire('mousemove', {
          evt: {
            clientX: 250,
            clientY: 180,
          } as unknown as MouseEvent,
        });
      });

      // setPan should be called with (panX + dx, panY + dy) = (100 + 50, 50 + 30) = (150, 80)
      expect(editorState.setPan).toHaveBeenCalledWith(150, 80);
    });

    it('relative panning: second mousemove accumulates delta correctly', () => {
      // Use a real setPan mock that updates the store's pan values
      editorState.setPan = vi.fn((x: number, y: number) => {
        editorState.panX = x;
        editorState.panY = y;
      });
      editorState.panX = 100;
      editorState.panY = 50;

      render(<Canvas />);
      const stage = getStage();

      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space', bubbles: true }),
      );

      act(() => {
        stage.fire('mousedown', {
          evt: {
            button: 0,
            clientX: 200,
            clientY: 150,
            preventDefault: vi.fn(),
          } as unknown as MouseEvent,
        });
      });

      // First move: (250, 180) -> dx=50, dy=30 -> setPan(150, 80)
      act(() => {
        stage.fire('mousemove', {
          evt: { clientX: 250, clientY: 180 } as unknown as MouseEvent,
        });
      });

      // Second move: (300, 200) -> dx=50, dy=20 (from prev pos 250,180)
      // Now panX=150, panY=80 (updated by mock), so setPan(200, 100)
      act(() => {
        stage.fire('mousemove', {
          evt: { clientX: 300, clientY: 200 } as unknown as MouseEvent,
        });
      });

      expect(editorState.setPan).toHaveBeenLastCalledWith(200, 100);
    });

    it('stops panning when space key is released', () => {
      render(<Canvas />);
      const stage = getStage();

      // Press and release space
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space', bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keyup', { code: 'Space', bubbles: true }),
      );

      act(() => {
        stage.fire('mousedown', {
          evt: {
            button: 0,
            clientX: 200,
            clientY: 150,
            preventDefault: vi.fn(),
          } as unknown as MouseEvent,
        });
      });

      // Move mouse - should NOT pan since space is released
      act(() => {
        stage.fire('mousemove', {
          evt: { clientX: 250, clientY: 180 } as unknown as MouseEvent,
        });
      });

      expect(editorState.setPan).not.toHaveBeenCalled();
    });

    it('stops panning when mouse is released', () => {
      render(<Canvas />);
      const stage = getStage();

      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space', bubbles: true }),
      );

      act(() => {
        stage.fire('mousedown', {
          evt: {
            button: 0,
            clientX: 200,
            clientY: 150,
            preventDefault: vi.fn(),
          } as unknown as MouseEvent,
        });
      });

      // Move once
      act(() => {
        stage.fire('mousemove', {
          evt: { clientX: 250, clientY: 180 } as unknown as MouseEvent,
        });
      });

      // Release mouse
      act(() => {
        stage.fire('mouseup', {} as unknown as MouseEvent);
      });

      // Move again - should NOT pan
      vi.clearAllMocks();
      act(() => {
        stage.fire('mousemove', {
          evt: { clientX: 300, clientY: 220 } as unknown as MouseEvent,
        });
      });

      expect(editorState.setPan).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-42/43/44: Middle mouse button panning                           */
  /* ------------------------------------------------------------------ */

  describe('ME-42/43/44 middle mouse button panning', () => {
    beforeEach(() => {
      editorState.setPan = vi.fn();
      editorState.panX = 50;
      editorState.panY = 25;
    });

    it('pans canvas when middle mouse button is dragged', () => {
      render(<Canvas />);
      const stage = getStage();

      // Mousedown with middle button (button=1)
      act(() => {
        stage.fire('mousedown', {
          evt: {
            button: 1,
            clientX: 100,
            clientY: 200,
            preventDefault: vi.fn(),
          } as unknown as MouseEvent,
        });
      });

      // Mousemove while panning (dx=30, dy=40)
      act(() => {
        stage.fire('mousemove', {
          evt: { clientX: 130, clientY: 240 } as unknown as MouseEvent,
        });
      });

      // setPan(50+30, 25+40) = setPan(80, 65)
      expect(editorState.setPan).toHaveBeenCalledWith(80, 65);
    });

    it('does not pan with left mouse button without space key', () => {
      render(<Canvas />);
      const stage = getStage();

      // Left mouse button (button=0) without space key
      act(() => {
        stage.fire('mousedown', {
          evt: {
            button: 0,
            clientX: 100,
            clientY: 200,
            preventDefault: vi.fn(),
          } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mousemove', {
          evt: { clientX: 130, clientY: 240 } as unknown as MouseEvent,
        });
      });

      expect(editorState.setPan).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-48 snap to grid                                                  */
  /* ------------------------------------------------------------------ */

  describe('ME-48 snap to grid', () => {
    it('snaps dragged element position when snapEnabled is true', () => {
      editorState.snapEnabled = true;
      diagramState.elements = [demoTypes[0]];
      diagramState.updateElement = vi.fn();

      render(<Canvas />);
      const stage = getStage();

      // Ensure the store's getState returns snapEnabled: true
      editorState.snapEnabled = true;

      const typeLayer = stage.getLayers()[1];
      const typeGroup = typeLayer.getChildren()[0];

      // Drag to position that is not on grid (350, 450 -> snaps to 360, 460)
      act(() => {
        typeGroup.x(350);
        typeGroup.y(450);
        typeGroup.fire('dragend');
      });

      // With snap, 350 -> Math.round(350/20)*20 = 360
      // With snap, 450 -> Math.round(450/20)*20 = 460
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'demo-type-1',
        {
          layout: { ...demoTypes[0].layout, x: 360, y: 460 },
        },
      );
    });

    it('does not snap when snapEnabled is false', () => {
      editorState.snapEnabled = false;
      diagramState.elements = [demoTypes[0]];
      diagramState.updateElement = vi.fn();

      render(<Canvas />);
      const stage = getStage();

      const typeLayer = stage.getLayers()[1];
      const typeGroup = typeLayer.getChildren()[0];

      act(() => {
        typeGroup.x(351);
        typeGroup.y(449);
        typeGroup.fire('dragend');
      });

      // Without snap, exact values are used
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'demo-type-1',
        {
          layout: { ...demoTypes[0].layout, x: 351, y: 449 },
        },
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-41: Box select multiple elements                                 */
  /* ------------------------------------------------------------------ */

  describe('ME-41 box select', () => {
    beforeEach(() => {
      editorState.currentTool = 'select';
      editorState.select = vi.fn();
      editorState.deselectAll = vi.fn();
    });

    it('selects elements inside the selection rectangle', () => {
      diagramState.elements = [...demoTypes];

      render(<Canvas />);
      const stage = getStage();

      // Mousedown on empty canvas top-left
      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 0, offsetY: 0 } as MouseEvent,
        });
      });

      // Drag to cover all three types
      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 600, offsetY: 500 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 600, offsetY: 500 } as unknown as MouseEvent,
        });
      });

      expect(editorState.select).toHaveBeenCalledWith([
        'demo-type-1',
        'demo-type-2',
        'demo-type-3',
      ]);
    });

    it('selects only elements that intersect the selection rectangle', () => {
      diagramState.elements = [...demoTypes];

      render(<Canvas />);
      const stage = getStage();

      // Box from (0,0) to (300,300) captures only demo-type-1
      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 0, offsetY: 0 } as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 300, offsetY: 300 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 300, offsetY: 300 } as unknown as MouseEvent,
        });
      });

      expect(editorState.select).toHaveBeenCalledWith(['demo-type-1']);
    });

    it('includes note elements in box selection', () => {
      diagramState.elements = [...demoTypes, ...demoNotes];

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 0, offsetY: 0 } as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 600, offsetY: 600 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 600, offsetY: 600 } as unknown as MouseEvent,
        });
      });

      expect(editorState.select).toHaveBeenCalledTimes(1);
      const ids = editorState.select.mock.calls[0][0] as string[];
      expect(ids).toContain('demo-type-1');
      expect(ids).toContain('demo-type-2');
      expect(ids).toContain('demo-type-3');
      expect(ids).toContain('demo-note-1');
    });

    it('calls deselectAll when no elements are inside the selection box', () => {
      diagramState.elements = [...demoTypes];

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 1000, offsetY: 1000 } as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 1100, offsetY: 1100 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 1100, offsetY: 1100 } as unknown as MouseEvent,
        });
      });

      expect(editorState.deselectAll).toHaveBeenCalledOnce();
    });

    it('does not trigger box select when clicking on an element', () => {
      diagramState.elements = [demoTypes[0]];

      render(<Canvas />);
      const stage = getStage();

      // Click at the element's position
      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 150, offsetY: 180 } as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 300, offsetY: 300 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 300, offsetY: 300 } as unknown as MouseEvent,
        });
      });

      expect(editorState.select).not.toHaveBeenCalled();
      expect(editorState.deselectAll).not.toHaveBeenCalled();
    });

    it('does not trigger box select in non-select tool modes', () => {
      editorState.currentTool = 'type';
      diagramState.elements = [...demoTypes];

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 0, offsetY: 0 } as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 600, offsetY: 600 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 600, offsetY: 600 } as unknown as MouseEvent,
        });
      });

      expect(editorState.select).not.toHaveBeenCalled();
      expect(editorState.deselectAll).not.toHaveBeenCalled();
    });

    it('applies zoom and pan transforms to box select coordinates', () => {
      diagramState.elements = [demoTypes[0]];
      editorState.zoom = 2;
      editorState.panX = 100;
      editorState.panY = 50;

      render(<Canvas />);
      const stage = getStage();

      // Screen (200, 150) -> canvas (50, 50)
      // Screen (600, 450) -> canvas (250, 200)
      // Box from (50,50) to (250,200) covers demo-type-1 at (100,150)
      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 200, offsetY: 150 } as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 600, offsetY: 450 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 600, offsetY: 450 } as unknown as MouseEvent,
        });
      });

      expect(editorState.select).toHaveBeenCalledWith(['demo-type-1']);
    });

    /* ------------------------------------------------------------------ */
    /*  ME-41 box select edge cases                                        */
    /* ------------------------------------------------------------------ */

    it('selects elements when dragging in reverse direction (bottom-right to top-left)', () => {
      diagramState.elements = [demoTypes[0]];

      render(<Canvas />);
      const stage = getStage();

      // Mousedown at bottom-right (past the element)
      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 600, offsetY: 500 } as MouseEvent,
        });
      });

      // Drag up-left to cover the element (reverse direction)
      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 50, offsetY: 50 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 50, offsetY: 50 } as unknown as MouseEvent,
        });
      });

      expect(editorState.select).toHaveBeenCalledWith(['demo-type-1']);
    });

    it('selects elements that partially overlap the selection rectangle', () => {
      // demo-type-1 at (100, 150) with size 180x110
      // Create a selection rect that only covers the left half of the element
      diagramState.elements = [demoTypes[0]];

      render(<Canvas />);
      const stage = getStage();

      // Box from (80, 140) to (190, 260) partially covers demo-type-1
      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 80, offsetY: 140 } as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 190, offsetY: 260 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 190, offsetY: 260 } as unknown as MouseEvent,
        });
      });

      expect(editorState.select).toHaveBeenCalledWith(['demo-type-1']);
    });

    it('includes generalization elements in box selection', () => {
      const demoGen: GeneralizationElement = {
        id: 'demo-gen-1',
        type: 'generalization',
        name: 'Payment',
        childIds: ['child-1'],
        parentId: null,
        completeness: 'complete',
        layout: { x: 200, y: 200, width: 200, height: 80 },
      };
      diagramState.elements = [demoTypes[0], demoGen];

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 0, offsetY: 0 } as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 600, offsetY: 600 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 600, offsetY: 600 } as unknown as MouseEvent,
        });
      });

      expect(editorState.select).toHaveBeenCalledTimes(1);
      const ids = editorState.select.mock.calls[0][0] as string[];
      expect(ids).toContain('demo-type-1');
      expect(ids).toContain('demo-gen-1');
    });

    it('excludes relation elements from box selection (no layout property)', () => {
      diagramState.elements = [...demoTypes, ...demoRelations];

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 0, offsetY: 0 } as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mousemove', {
          evt: { offsetX: 600, offsetY: 600 } as unknown as MouseEvent,
        });
      });

      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 600, offsetY: 600 } as unknown as MouseEvent,
        });
      });

      const ids = editorState.select.mock.calls[0][0] as string[];
      // All three types should be selected
      expect(ids).toContain('demo-type-1');
      expect(ids).toContain('demo-type-2');
      expect(ids).toContain('demo-type-3');
      // Relations should NOT be in the selected ids
      expect(ids).not.toContain('demo-rel-1');
      expect(ids).not.toContain('demo-rel-2');
    });

    it('calls deselectAll when clicking (zero-area drag) on empty canvas background', () => {
      diagramState.elements = [demoTypes[0]];
      editorState.selectedIds = ['demo-type-1']; // simulate previously selected

      render(<Canvas />);
      const stage = getStage();

      // Mousedown on empty canvas
      act(() => {
        stage.fire('mousedown', {
          evt: { button: 0, offsetX: 10, offsetY: 10 } as MouseEvent,
        });
      });

      // Mouseup at the same position (zero-area, no effective drag)
      act(() => {
        stage.fire('mouseup', {
          evt: { offsetX: 10, offsetY: 10 } as unknown as MouseEvent,
        });
      });

      // The box select mouseup handler returns early for zero-area,
      // so it should NOT have called select or deselectAll directly.
      expect(editorState.select).not.toHaveBeenCalled();
      // deselectAll is handled by the click handler, not box select.
      // Verify box select did not call deselectAll itself.
      expect(editorState.deselectAll).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-27/28: Generalization creation flow                             */
  /* ------------------------------------------------------------------ */

  describe('ME-27/28 generalization creation flow', () => {
    it('clicking a Type in generalization mode calls setGeneralizationParent', () => {
      diagramState.elements = [demoTypes[0]];
      editorState.currentTool = 'generalization';

      render(<Canvas />);
      const stage = getStage();

      // Type layer is index 1
      const typeLayer = stage.getLayers()[1];
      const typeGroup = typeLayer.getChildren()[0];

      act(() => {
        typeGroup.fire('click');
      });

      expect(editorState.setGeneralizationParent).toHaveBeenCalledWith('demo-type-1');
    });

    it('clicking a Type in generalization mode also selects it', () => {
      diagramState.elements = [demoTypes[0]];
      editorState.currentTool = 'generalization';

      render(<Canvas />);
      const stage = getStage();

      const typeLayer = stage.getLayers()[1];
      const typeGroup = typeLayer.getChildren()[0];

      act(() => {
        typeGroup.fire('click');
      });

      expect(editorState.select).toHaveBeenCalledWith('demo-type-1');
    });

    it('clicking empty canvas in generalization mode without parent does nothing', () => {
      editorState.currentTool = 'generalization';
      editorState.generalizationParentId = null;

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('click', { evt: { offsetX: 300, offsetY: 400 } as MouseEvent });
      });

      // Should NOT create a generalization element
      expect(diagramState.addElement).not.toHaveBeenCalled();
      // Should NOT deselect
      expect(editorState.deselectAll).not.toHaveBeenCalled();
    });

    it('clicking empty canvas with generalizationParentId creates a container', () => {
      editorState.currentTool = 'generalization';
      editorState.generalizationParentId = 'demo-type-1';

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('click', { evt: { offsetX: 500, offsetY: 300 } as MouseEvent });
      });

      expect(diagramState.addElement).toHaveBeenCalledTimes(1);
      const element = diagramState.addElement.mock.calls[0][0];
      expect(element.type).toBe('generalization');
      expect(element.parentId).toBe('demo-type-1');
      expect(element.completeness).toBe('complete');
      expect(element.childIds).toEqual([]);
      expect(element.name).toBe('Generalization');
    });

    it('created generalization container has correct default dimensions', () => {
      editorState.currentTool = 'generalization';
      editorState.generalizationParentId = 'demo-type-1';

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('click', { evt: { offsetX: 500, offsetY: 300 } as MouseEvent });
      });

      const element = diagramState.addElement.mock.calls[0][0];
      expect(element.layout.width).toBe(220);
      expect(element.layout.height).toBe(140);
    });

    it('after creating generalization container, clears generalization state and switches to select', () => {
      editorState.currentTool = 'generalization';
      editorState.generalizationParentId = 'demo-type-1';

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('click', { evt: { offsetX: 500, offsetY: 300 } as MouseEvent });
      });

      expect(editorState.clearGeneralizationState).toHaveBeenCalled();
      expect(editorState.setTool).toHaveBeenCalledWith('select');
    });

    it('renders generalization box on the type layer', () => {
      diagramState.elements = [
        demoTypes[0],
        {
          id: 'demo-gen-1',
          type: 'generalization',
          name: 'Generalization',
          childIds: [],
          parentId: 'demo-type-1',
          completeness: 'complete',
          layout: { x: 200, y: 200, width: 220, height: 140 },
        },
      ];

      render(<Canvas />);
      const stage = getStage();

      // Type layer is index 1 - should have TypeNode + GeneralizationBox
      expect(countLayerChildren(stage, 1)).toBe(2);
    });

    it('auto-offsets when creating container that would overlap existing one (ME-31)', () => {
      const existingGen: DiagramElement = {
        id: 'existing-gen',
        type: 'generalization',
        name: 'Existing',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 200, y: 200, width: DEFAULT_GEN_WIDTH, height: DEFAULT_GEN_HEIGHT },
      };
      diagramState.elements = [demoTypes[0], existingGen];
      editorState.currentTool = 'generalization';
      editorState.generalizationParentId = 'demo-type-1';

      render(<Canvas />);
      const stage = getStage();

      // Click at center of existing container — new one would overlap
      const clickX = 200 + DEFAULT_GEN_WIDTH / 2;
      const clickY = 200 + DEFAULT_GEN_HEIGHT / 2;
      act(() => {
        stage.fire('click', { evt: { offsetX: clickX, offsetY: clickY } as MouseEvent });
      });

      expect(diagramState.addElement).toHaveBeenCalledTimes(1);
      const element = diagramState.addElement.mock.calls[0][0];
      // Position must be offset to avoid overlap
      const desiredX = clickX - DEFAULT_GEN_WIDTH / 2;
      const desiredY = clickY - DEFAULT_GEN_HEIGHT / 2;
      expect(element.layout.x).not.toBe(desiredX);
      expect(element.layout.y).not.toBe(desiredY);
      // Result must not overlap with the existing container
      const resultOverlapsExisting = rectsOverlap(element.layout, existingGen.layout);
      expect(resultOverlapsExisting).toBe(false);
    });

    it('auto-offsets when creating container that would overlap parent Type (ME-32)', () => {
      // demoTypes[0] layout: { x: 100, y: 150, width: 180, height: 110 }
      diagramState.elements = [demoTypes[0]];
      editorState.currentTool = 'generalization';
      editorState.generalizationParentId = 'demo-type-1';

      render(<Canvas />);
      const stage = getStage();

      // Click at center of parent Type — container would overlap it
      const typeCenterX = 100 + 180 / 2;
      const typeCenterY = 150 + 110 / 2;
      act(() => {
        stage.fire('click', { evt: { offsetX: typeCenterX, offsetY: typeCenterY } as MouseEvent });
      });

      expect(diagramState.addElement).toHaveBeenCalledTimes(1);
      const element = diagramState.addElement.mock.calls[0][0];
      // Result must not overlap with the parent Type
      const resultOverlapsParent = rectsOverlap(element.layout, demoTypes[0].layout);
      expect(resultOverlapsParent).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-29: Create child Types inside generalization container          */
  /* ------------------------------------------------------------------ */

  describe('ME-29 create child Types inside generalization container', () => {
    it('clicking inside a generalization container in type mode adds childId to container', () => {
      const genElement: DiagramElement = {
        id: 'demo-gen-1',
        type: 'generalization',
        name: 'Generalization',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 200, y: 200, width: 220, height: 140 },
      };
      diagramState.elements = [genElement];
      editorState.currentTool = 'type';

      render(<Canvas />);
      const stage = getStage();

      // Click inside the container (at layout center)
      act(() => {
        stage.fire('click', {
          evt: { offsetX: 310, offsetY: 270 } as MouseEvent,
        });
      });

      // Should have created a Type
      expect(diagramState.addElement).toHaveBeenCalledTimes(1);
      const createdType = diagramState.addElement.mock.calls[0][0];
      expect(createdType.type).toBe('type');

      // Should have updated the container with the new childId
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'demo-gen-1',
        expect.objectContaining({
          childIds: [createdType.id],
        }),
      );
    });

    it('calls updateElement for container layout when child is added inside (auto-resize)', () => {
      const genElement: DiagramElement = {
        id: 'demo-gen-1',
        type: 'generalization',
        name: 'Generalization',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 200, y: 200, width: DEFAULT_GEN_WIDTH, height: DEFAULT_GEN_HEIGHT },
      };
      diagramState.elements = [genElement];
      editorState.currentTool = 'type';

      render(<Canvas />);
      const stage = getStage();

      act(() => {
        stage.fire('click', {
          evt: { offsetX: 310, offsetY: 270 } as MouseEvent,
        });
      });

      // updateElement should have been called at least once for layout
      const layoutCalls = diagramState.updateElement.mock.calls.filter(
        (call: unknown[]) => (call[0] as string) === 'demo-gen-1' && typeof (call[1] as Record<string, unknown>).layout !== 'undefined',
      );
      expect(layoutCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('creates multiple children in a container and auto-resizes', () => {
      const genElement: DiagramElement = {
        id: 'demo-gen-1',
        type: 'generalization',
        name: 'Generalization',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 200, y: 200, width: DEFAULT_GEN_WIDTH, height: DEFAULT_GEN_HEIGHT },
      };
      diagramState.elements = [genElement];
      editorState.currentTool = 'type';

      render(<Canvas />);
      const stage = getStage();

      // Create first child
      act(() => {
        stage.fire('click', {
          evt: { offsetX: 260, offsetY: 240 } as MouseEvent,
        });
      });

      // Create second child at a different position inside the container
      act(() => {
        stage.fire('click', {
          evt: { offsetX: 360, offsetY: 300 } as MouseEvent,
        });
      });

      expect(diagramState.addElement).toHaveBeenCalledTimes(2);

      const childId1 = diagramState.addElement.mock.calls[0][0].id;
      const childId2 = diagramState.addElement.mock.calls[1][0].id;

      // Each click individually adds its child to the container (mock store
      // does not persist childIds between clicks, so each call has only one id)
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'demo-gen-1',
        expect.objectContaining({
          childIds: [childId1],
        }),
      );
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'demo-gen-1',
        expect.objectContaining({
          childIds: [childId2],
        }),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-29: Drag child Type into / out of generalization container      */
  /* ------------------------------------------------------------------ */

  describe('ME-29 drag child Type into or out of generalization container', () => {
    it('dragging a Type into a generalization container adds it as a child', () => {
      const genElement: DiagramElement = {
        id: 'gen-1',
        type: 'generalization',
        name: 'Gen',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 200, y: 200, width: DEFAULT_GEN_WIDTH, height: DEFAULT_GEN_HEIGHT },
      };
      // Type starts at a position outside the container
      const typeEl: TypeElement = {
        id: 'type-1',
        type: 'type',
        name: 'ChildType',
        attributes: [],
        methods: [],
        layout: { x: 50, y: 50, width: 180, height: 60 },
      };
      diagramState.elements = [genElement, typeEl];

      render(<Canvas />);
      const stage = getStage();

      // Type layer has type node at index 0 and gen box at index 1
      // (type nodes are rendered before generalization boxes)
      const typeLayer = stage.getLayers()[1];
      // Children: [TypeNode, GenBox]
      const typeGroup = typeLayer.getChildren()[0];

      // Drag the type so it overlaps the container
      act(() => {
        typeGroup.x(220);
        typeGroup.y(220);
        typeGroup.fire('dragend');
      });

      // The type's position should be updated
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'type-1',
        expect.objectContaining({
          layout: expect.objectContaining({ x: 220, y: 220 }),
        }),
      );

      // The container should have type-1 added to childIds
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'gen-1',
        expect.objectContaining({
          childIds: expect.arrayContaining(['type-1']),
        }),
      );
    });

    it('dragging a Type out of a generalization container removes it as a child', () => {
      // Type starts inside the container AND is registered as a child
      const genElement: DiagramElement = {
        id: 'gen-1',
        type: 'generalization',
        name: 'Gen',
        childIds: ['type-1'],
        parentId: null,
        completeness: 'complete',
        layout: { x: 200, y: 200, width: DEFAULT_GEN_WIDTH, height: DEFAULT_GEN_HEIGHT },
      };
      const typeEl: TypeElement = {
        id: 'type-1',
        type: 'type',
        name: 'ChildType',
        attributes: [],
        methods: [],
        layout: { x: 220, y: 220, width: 180, height: 60 },
      };
      diagramState.elements = [genElement, typeEl];

      render(<Canvas />);
      const stage = getStage();

      const typeLayer = stage.getLayers()[1];
      // Children: [TypeNode, GenBox]
      const typeGroup = typeLayer.getChildren()[0];

      // Drag the type far away from the container
      act(() => {
        typeGroup.x(600);
        typeGroup.y(600);
        typeGroup.fire('dragend');
      });

      // The container should have type-1 removed from childIds
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'gen-1',
        expect.objectContaining({
          childIds: [],
        }),
      );
    });

    it('moving a generalization container moves child types by the same delta', () => {
      const typeEl: TypeElement = {
        id: 'type-1',
        type: 'type',
        name: 'ChildType',
        attributes: [],
        methods: [],
        layout: { x: 220, y: 220, width: 180, height: 60 },
      };
      const genElement: DiagramElement = {
        id: 'gen-1',
        type: 'generalization',
        name: 'Gen',
        childIds: ['type-1'],
        parentId: null,
        completeness: 'complete',
        layout: { x: 200, y: 200, width: DEFAULT_GEN_WIDTH, height: DEFAULT_GEN_HEIGHT },
      };
      diagramState.elements = [genElement, typeEl];

      render(<Canvas />);
      const stage = getStage();

      // Type layer: TypeNode at index 0, GenBox at index 1
      const typeLayer = stage.getLayers()[1];
      const genGroup = typeLayer.getChildren()[1];

      // Drag container by delta (50, 30) — must not overlap anything
      const deltaX = 50;
      const deltaY = 30;
      act(() => {
        genGroup.x(200 + deltaX);
        genGroup.y(200 + deltaY);
        genGroup.fire('dragend');
      });

      // Child type should be moved by the same delta
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'type-1',
        expect.objectContaining({
          layout: expect.objectContaining({
            x: 220 + deltaX,
            y: 220 + deltaY,
          }),
        }),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-30: Generalization completeness visual                          */
  /* ------------------------------------------------------------------ */

  describe('ME-30 completeness visual', () => {
    it('renders generalization box with complete completeness by default', () => {
      const genElement: DiagramElement = {
        id: 'demo-gen-1',
        type: 'generalization',
        name: 'Generalization',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 200, y: 200, width: 220, height: 140 },
      };
      diagramState.elements = [genElement];

      render(<Canvas />);
      const stage = getStage();

      // Type layer should have the GeneralizationBox
      expect(countLayerChildren(stage, 1)).toBe(1);
    });

    it('renders generalization box with incomplete completeness', () => {
      const genElement: DiagramElement = {
        id: 'demo-gen-1',
        type: 'generalization',
        name: 'Generalization',
        childIds: [],
        parentId: null,
        completeness: 'incomplete',
        layout: { x: 200, y: 200, width: 220, height: 140 },
      };
      diagramState.elements = [genElement];

      render(<Canvas />);
      const stage = getStage();

      expect(countLayerChildren(stage, 1)).toBe(1);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-31: Drag generalization container prevents overlap              */
  /* ------------------------------------------------------------------ */

  describe('ME-31 generalization container drag overlap prevention', () => {
    it('prevents drag that would cause overlap between generalization containers', () => {
      const gen1: DiagramElement = {
        id: 'gen-1',
        type: 'generalization',
        name: 'Gen1',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 100, y: 100, width: 220, height: 140 },
      };
      const gen2: DiagramElement = {
        id: 'gen-2',
        type: 'generalization',
        name: 'Gen2',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 400, y: 100, width: 220, height: 140 },
      };
      diagramState.elements = [gen1, gen2];

      render(<Canvas />);
      const stage = getStage();

      // Type layer is index 1: [gen-1 Group, gen-2 Group]
      const typeLayer = stage.getLayers()[1];
      const gen1Group = typeLayer.getChildren()[0];

      // Drag gen-1 to x=350 so it overlaps gen-2 (which is at x=400)
      act(() => {
        gen1Group.x(350);
        gen1Group.y(100);
        gen1Group.fire('dragend');
      });

      // updateElement should NOT be called for gen-1 (overlap reverted)
      const gen1UpdateCalls = diagramState.updateElement.mock.calls.filter(
        (call: unknown[]) => call[0] === 'gen-1',
      );
      expect(gen1UpdateCalls.length).toBe(0);
    });

    it('allows drag to non-overlapping position', () => {
      const gen1: DiagramElement = {
        id: 'gen-1',
        type: 'generalization',
        name: 'Gen1',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 100, y: 100, width: 220, height: 140 },
      };
      const gen2: DiagramElement = {
        id: 'gen-2',
        type: 'generalization',
        name: 'Gen2',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 400, y: 100, width: 220, height: 140 },
      };
      diagramState.elements = [gen1, gen2];

      render(<Canvas />);
      const stage = getStage();

      const typeLayer = stage.getLayers()[1];
      const gen1Group = typeLayer.getChildren()[0];

      // Drag gen-1 to a non-overlapping position
      act(() => {
        gen1Group.x(50);
        gen1Group.y(300);
        gen1Group.fire('dragend');
      });

      // updateElement should be called for gen-1 (non-overlapping)
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'gen-1',
        expect.objectContaining({
          layout: expect.objectContaining({ x: 50, y: 300 }),
        }),
      );
    });

    it('allows drag when there is only one generalization container (no overlap possible)', () => {
      const gen: DiagramElement = {
        id: 'gen-1',
        type: 'generalization',
        name: 'OnlyGen',
        childIds: [],
        parentId: null,
        completeness: 'complete',
        layout: { x: 100, y: 100, width: 220, height: 140 },
      };
      diagramState.elements = [gen];

      render(<Canvas />);
      const stage = getStage();

      const typeLayer = stage.getLayers()[1];
      const genGroup = typeLayer.getChildren()[0];

      act(() => {
        genGroup.x(300);
        genGroup.y(300);
        genGroup.fire('dragend');
      });

      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'gen-1',
        expect.objectContaining({
          layout: expect.objectContaining({ x: 300, y: 300 }),
        }),
      );
    });
  });
});
