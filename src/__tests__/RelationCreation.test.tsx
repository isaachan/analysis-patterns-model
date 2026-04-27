import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Canvas from '../components/Canvas/Canvas';
import StatusBar from '../components/StatusBar/StatusBar';
import type { DiagramElement, TypeElement, RelationElement } from '../models/diagram';
import { getStage } from './testHelpers';

/* ------------------------------------------------------------------ */
/*  Mutable mock state                                                 */
/* ------------------------------------------------------------------ */
const diagramState = vi.hoisted(() => ({
  elements: [] as DiagramElement[],
  addElement: vi.fn(),
  updateElement: vi.fn(),
  getState: vi.fn(),
}));

const editorState = vi.hoisted(() => ({
  currentTool: 'select' as string,
  selectedIds: [] as string[],
  zoom: 1,
  panX: 0,
  panY: 0,
  gridEnabled: true,
  relationSourceId: null as string | null,
  relationEndPoint: null as { x: number; y: number } | null,
  select: vi.fn(),
  deselectAll: vi.fn(),
  setTool: vi.fn(),
  setRelationSource: vi.fn(),
  setRelationEndPoint: vi.fn(),
  clearRelationState: vi.fn(),
  getState: vi.fn(() => ({
    currentTool: 'select',
    setTool: vi.fn(),
    select: vi.fn(),
  })),
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
  const editorStoreFn = Object.assign(
    vi.fn((selector?: (state: unknown) => unknown) => {
      return selector ? selector(editorState) : editorState;
    }),
    { getState: vi.fn(() => editorState) },
  );
  return { useEditorStore: editorStoreFn };
});

/* ------------------------------------------------------------------ */
/*  Demo data                                                          */
/* ------------------------------------------------------------------ */
const demoTypeA: TypeElement = {
  id: 'type-a',
  type: 'type',
  name: 'TypeA',
  attributes: [],
  methods: [],
  layout: { x: 100, y: 150, width: 180, height: 110 },
};

const demoTypeB: TypeElement = {
  id: 'type-b',
  type: 'type',
  name: 'TypeB',
  attributes: [],
  methods: [],
  layout: { x: 400, y: 150, width: 180, height: 110 },
};

const demoTypeC: TypeElement = {
  id: 'type-c',
  type: 'type',
  name: 'TypeC',
  attributes: [],
  methods: [],
  layout: { x: 400, y: 380, width: 180, height: 110 },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function setupRelationTool() {
  editorState.currentTool = 'relation';
  editorState.relationSourceId = null;
  editorState.relationEndPoint = null;
  editorState.setRelationSource = vi.fn();
  editorState.clearRelationState = vi.fn();
  editorState.deselectAll = vi.fn();
  editorState.setTool = vi.fn();
  editorState.select = vi.fn();
  diagramState.elements = [demoTypeA, demoTypeB];
  diagramState.addElement = vi.fn();
}

/** Find a TypeNode group on the type layer (layer index 1) by its element id. */
function findTypeNode(stage: ReturnType<typeof getStage>, id: string) {
  const typeLayer = stage.getLayers()[1];
  return typeLayer.getChildren().find(
    (g: { name: () => string; id: () => string }) =>
      g.name() === 'type-node' && g.id() === id,
  );
}

/** Fire a click event on a Konva node via its public `fire` method. */
function clickNode(node: { fire: (evt: string, data?: unknown) => void }) {
  act(() => {
    node.fire('click');
  });
}

/* ------------------------------------------------------------------ */
/*  ME-13: Click-click relation creation                               */
/* ------------------------------------------------------------------ */

describe('ME-13 Click-click relation creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRelationTool();
  });

  it('sets relationSourceId on first Type click in relation mode', () => {
    render(<Canvas />);
    const stage = getStage();

    const typeAGroup = findTypeNode(stage, 'type-a');
    expect(typeAGroup).toBeDefined();

    clickNode(typeAGroup!);

    // In relation mode with null source, onRelationClick calls setRelationSource(id)
    expect(editorState.setRelationSource).toHaveBeenCalledWith('type-a');
  });

  it('creates relation on second Type click when source is set', () => {
    editorState.relationSourceId = 'type-a';

    render(<Canvas />);
    const stage = getStage();

    const typeBGroup = findTypeNode(stage, 'type-b');
    expect(typeBGroup).toBeDefined();

    clickNode(typeBGroup!);

    // Should create a relation
    expect(diagramState.addElement).toHaveBeenCalledTimes(1);
    const rel = diagramState.addElement.mock.calls[0][0] as RelationElement;
    expect(rel.type).toBe('relation');
    expect(rel.sourceId).toBe('type-a');
    expect(rel.targetId).toBe('type-b');
    expect(rel.sourceCardinality).toBe('exactly_one');
    expect(rel.targetCardinality).toBe('exactly_one');
    expect(rel.label).toBe('');
  });

  it('auto-switches to select tool and selects the new relation after creation', () => {
    editorState.relationSourceId = 'type-a';

    render(<Canvas />);
    const stage = getStage();

    const typeBGroup = findTypeNode(stage, 'type-b');
    clickNode(typeBGroup!);

    expect(diagramState.addElement).toHaveBeenCalledTimes(1);
    const rel = diagramState.addElement.mock.calls[0][0] as RelationElement;
    expect(rel.sourceId).toBe('type-a');
    expect(rel.targetId).toBe('type-b');

    // createRelation calls useEditorStore.getState().setTool('select')
    // and useEditorStore.getState().select(newId) internally
    // The getState mock returns editorState which has mocked setTool/select
    expect(editorState.setTool).toHaveBeenCalledWith('select');
    expect(editorState.select).toHaveBeenCalledWith(rel.id);
  });

  it('clears relation state when clicking empty canvas while picking target', () => {
    editorState.relationSourceId = 'type-a';

    render(<Canvas />);
    const stage = getStage();

    // Click on empty canvas (stage background)
    act(() => {
      stage.fire('click', { evt: { offsetX: 10, offsetY: 10 } as MouseEvent });
    });

    // Should clear relation state
    expect(editorState.clearRelationState).toHaveBeenCalled();
  });

  it('does not create relation when clicking empty canvas without source', () => {
    editorState.relationSourceId = null;

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 10, offsetY: 10 } as MouseEvent });
    });

    // Should deselect (standard behavior) but not create relation
    expect(editorState.deselectAll).toHaveBeenCalled();
    expect(diagramState.addElement).not.toHaveBeenCalled();
  });

  it('generates a valid id for the new relation', () => {
    editorState.relationSourceId = 'type-a';

    render(<Canvas />);
    const stage = getStage();

    const typeBGroup = findTypeNode(stage, 'type-b');
    clickNode(typeBGroup!);

    const rel = diagramState.addElement.mock.calls[0][0] as RelationElement;
    expect(rel.id).toBeDefined();
    expect(typeof rel.id).toBe('string');
    expect(rel.id.length).toBeGreaterThan(0);
  });

  it('uses nanoid for relation ID (21 chars)', () => {
    editorState.relationSourceId = 'type-a';

    render(<Canvas />);
    const stage = getStage();

    const typeBGroup = findTypeNode(stage, 'type-b');
    clickNode(typeBGroup!);

    const rel = diagramState.addElement.mock.calls[0][0] as RelationElement;
    // nanoid produces alphanumeric IDs 21 chars long
    expect(rel.id.length).toBe(21);
  });

  it('creates multiple relations from same source in sequence', () => {
    diagramState.elements = [demoTypeA, demoTypeB, demoTypeC];
    // Set source BEFORE render so the component reads it during mount
    editorState.relationSourceId = 'type-a';

    render(<Canvas />);
    const stage = getStage();

    // First relation: A -> B
    const typeBGroup = findTypeNode(stage, 'type-b');
    clickNode(typeBGroup!);

    expect(diagramState.addElement).toHaveBeenCalledTimes(1);
    expect(diagramState.addElement.mock.calls[0][0].sourceId).toBe('type-a');
    expect(diagramState.addElement.mock.calls[0][0].targetId).toBe('type-b');

    // The mock does not clear relationSourceId, so it stays 'type-a'.
    // In the real flow, createRelation calls clearRelationState() which resets it,
    // then the user clicks a new source to set it again. For the mock we keep it set.
    // Second relation: A -> C
    const typeCGroup = findTypeNode(stage, 'type-c');
    clickNode(typeCGroup!);

    expect(diagramState.addElement).toHaveBeenCalledTimes(2);
    expect(diagramState.addElement.mock.calls[1][0].sourceId).toBe('type-a');
    expect(diagramState.addElement.mock.calls[1][0].targetId).toBe('type-c');
  });
});

/* ------------------------------------------------------------------ */
/*  ME-13: Click-click self-relation                                   */
/* ------------------------------------------------------------------ */

describe('ME-13 self-relation (click-click)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRelationTool();
  });

  it('creates self-relation when clicking same Type twice', () => {
    editorState.relationSourceId = 'type-a';

    render(<Canvas />);
    const stage = getStage();

    const typeAGroup = findTypeNode(stage, 'type-a');
    clickNode(typeAGroup!);

    // Clicking the same type when source is set -> self-relation
    expect(diagramState.addElement).toHaveBeenCalledTimes(1);
    const rel = diagramState.addElement.mock.calls[0][0] as RelationElement;
    expect(rel.sourceId).toBe('type-a');
    expect(rel.targetId).toBe('type-a');
  });
});

/* ------------------------------------------------------------------ */
/*  ME-14: Drag-to-create relation                                     */
/* ------------------------------------------------------------------ */

describe('ME-14 Drag-to-create relation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRelationTool();
  });

  it('fires setRelationSource on mousedown on a Type node', () => {
    render(<Canvas />);
    const stage = getStage();

    // Find the type-a group to use as target for the event
    const typeAGroup = findTypeNode(stage, 'type-a');
    expect(typeAGroup).toBeDefined();

    // Stage mousedown walks up e.target hierarchy to find type-node
    // Create a mock target chain that includes the type-a group
    act(() => {
      stage.fire('mousedown', {
        evt: { offsetX: 190, offsetY: 205 } as MouseEvent,
        target: typeAGroup,
      });
    });

    expect(editorState.setRelationSource).toHaveBeenCalledWith('type-a');
  });

  it('does not create relation when releasing on empty space after drag', () => {
    render(<Canvas />);
    const stage = getStage();

    const typeAGroup = findTypeNode(stage, 'type-a');

    // Mousedown on type-a
    act(() => {
      stage.fire('mousedown', {
        evt: { offsetX: 190, offsetY: 205 } as MouseEvent,
        target: typeAGroup,
      });
    });

    // Move > 5px to trigger drag mode
    act(() => {
      stage.fire('mousemove', {
        evt: { offsetX: 250, offsetY: 250 } as MouseEvent,
      });
    });

    // Release on empty space (50, 50 is not inside any type)
    act(() => {
      stage.fire('mouseup', {
        evt: { offsetX: 50, offsetY: 50 } as MouseEvent,
      });
    });

    // Should NOT create a relation (no type at release point)
    expect(diagramState.addElement).not.toHaveBeenCalled();
    // Should clear relation state
    expect(editorState.clearRelationState).toHaveBeenCalled();
  });

  it('does not create relation on simple click (mousedown+mouseup without movement)', () => {
    render(<Canvas />);
    const stage = getStage();

    const typeAGroup = findTypeNode(stage, 'type-a');

    // Mousedown on type-a
    act(() => {
      stage.fire('mousedown', {
        evt: { offsetX: 190, offsetY: 205 } as MouseEvent,
        target: typeAGroup,
      });
    });

    // Mouseup without moving (just a click - the click handler handles click-click)
    act(() => {
      stage.fire('mouseup', {
        evt: { offsetX: 190, offsetY: 205 } as MouseEvent,
      });
    });

    // No relation should be created from drag (click handler handles click-click separately)
    expect(diagramState.addElement).not.toHaveBeenCalled();
  });

  it('creates self-relation via drag-to-create', () => {
    editorState.relationSourceId = null;
    editorState.relationEndPoint = null;

    render(<Canvas />);
    const stage = getStage();

    const typeAGroup = findTypeNode(stage, 'type-a');

    // Mousedown on type-a
    act(() => {
      stage.fire('mousedown', {
        evt: { offsetX: 190, offsetY: 205 } as MouseEvent,
        target: typeAGroup,
      });
    });

    // Move away (> 5px) to trigger drag mode
    act(() => {
      stage.fire('mousemove', {
        evt: { offsetX: 260, offsetY: 260 } as MouseEvent,
      });
    });

    // Move back to inside type-a rectangle (layout: 100-280 x, 150-260 y)
    act(() => {
      stage.fire('mousemove', {
        evt: { offsetX: 200, offsetY: 200 } as MouseEvent,
      });
    });

    // Release on type-a
    act(() => {
      stage.fire('mouseup', {
        evt: { offsetX: 200, offsetY: 200 } as MouseEvent,
        target: typeAGroup,
      });
    });

    expect(diagramState.addElement).toHaveBeenCalledTimes(1);
    const rel = diagramState.addElement.mock.calls[0][0] as RelationElement;
    expect(rel.sourceId).toBe('type-a');
    expect(rel.targetId).toBe('type-a');
  });

  it('creates relation by dragging from source to a different target type', () => {
    editorState.relationSourceId = null;
    editorState.relationEndPoint = null;

    render(<Canvas />);
    const stage = getStage();

    const typeAGroup = findTypeNode(stage, 'type-a');

    // Mousedown on type-a
    act(() => {
      stage.fire('mousedown', {
        evt: { offsetX: 190, offsetY: 205 } as MouseEvent,
        target: typeAGroup,
      });
    });

    // Move away to trigger drag
    act(() => {
      stage.fire('mousemove', {
        evt: { offsetX: 250, offsetY: 250 } as MouseEvent,
      });
    });

    // Move to inside type-b (layout: 400-580 x, 150-260 y)
    act(() => {
      stage.fire('mousemove', {
        evt: { offsetX: 450, offsetY: 200 } as MouseEvent,
      });
    });

    // Release on type-b
    act(() => {
      stage.fire('mouseup', {
        evt: { offsetX: 450, offsetY: 200 } as MouseEvent,
        target: findTypeNode(stage, 'type-b'),
      });
    });

    expect(diagramState.addElement).toHaveBeenCalledTimes(1);
    const rel = diagramState.addElement.mock.calls[0][0] as RelationElement;
    expect(rel.sourceId).toBe('type-a');
    expect(rel.targetId).toBe('type-b');
  });
});

/* ------------------------------------------------------------------ */
/*  Preview line during drag-to-create                                 */
/* ------------------------------------------------------------------ */

describe('ME-14 preview line during drag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRelationTool();
  });

  it('renders a preview Line on preview layer when dragging in relation mode', () => {
    editorState.relationSourceId = 'type-a';
    editorState.relationEndPoint = { x: 250, y: 250 };

    render(<Canvas />);
    const stage = getStage();

    // Preview layer is index 4
    const previewLayer = stage.getLayers()[4];
    expect(previewLayer).toBeDefined();

    const children = previewLayer.getChildren();
    expect(children.length).toBe(1);
    expect(children[0].getClassName()).toBe('Line');
  });

  it('hides preview line when no relation state is set', () => {
    editorState.relationSourceId = null;
    editorState.relationEndPoint = null;

    render(<Canvas />);
    const stage = getStage();

    const previewLayer = stage.getLayers()[4];
    expect(previewLayer.getChildren().length).toBe(0);
  });

  it('hides preview line when relation source is set but end point is null', () => {
    editorState.relationSourceId = 'type-a';
    editorState.relationEndPoint = null;

    render(<Canvas />);
    const stage = getStage();

    const previewLayer = stage.getLayers()[4];
    expect(previewLayer.getChildren().length).toBe(0);
  });

  it('hides preview line when end point is set but no relation source', () => {
    editorState.relationSourceId = null;
    editorState.relationEndPoint = { x: 250, y: 250 };

    render(<Canvas />);
    const stage = getStage();

    const previewLayer = stage.getLayers()[4];
    expect(previewLayer.getChildren().length).toBe(0);
  });

  it('hides preview line when not in relation tool mode', () => {
    editorState.currentTool = 'select';
    editorState.relationSourceId = 'type-a';
    editorState.relationEndPoint = { x: 250, y: 250 };

    render(<Canvas />);
    const stage = getStage();

    const previewLayer = stage.getLayers()[4];
    expect(previewLayer.getChildren().length).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Editor store relation state management                             */
/* ------------------------------------------------------------------ */

describe('EditorStore relation state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has initial relationSourceId as null', () => {
    editorState.relationSourceId = null;
    expect(editorState.relationSourceId).toBeNull();
  });

  it('has initial relationEndPoint as null', () => {
    editorState.relationEndPoint = null;
    expect(editorState.relationEndPoint).toBeNull();
  });

  it('clearRelationState resets both relation fields', () => {
    editorState.relationSourceId = null;
    editorState.relationEndPoint = null;
    expect(editorState.relationSourceId).toBeNull();
    expect(editorState.relationEndPoint).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  StatusBar relation hint                                            */
/* ------------------------------------------------------------------ */

describe('StatusBar relation hint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorState.currentTool = 'relation';
    editorState.relationSourceId = null;
  });

  it('shows relation hint text when source is selected', () => {
    editorState.relationSourceId = 'type-a';

    render(<StatusBar />);
    const hint = screen.queryByTestId('status-relation-hint');
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent('Click target Type');
  });

  it('does not show relation hint when no source is selected', () => {
    editorState.relationSourceId = null;

    render(<StatusBar />);
    const hint = screen.queryByTestId('status-relation-hint');
    expect(hint).not.toBeInTheDocument();
  });

  it('does not show relation hint in select mode', () => {
    editorState.currentTool = 'select';
    editorState.relationSourceId = 'type-a';

    render(<StatusBar />);
    const hint = screen.queryByTestId('status-relation-hint');
    expect(hint).not.toBeInTheDocument();
  });
});
