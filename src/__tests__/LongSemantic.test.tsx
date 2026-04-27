import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stage, Layer } from 'react-konva';
import Canvas from '../components/Canvas/Canvas';
import LongSemanticBox from '../components/Canvas/LongSemanticBox';
import RightSidebar from '../components/RightSidebar/RightSidebar';
import type {
  DiagramElement,
  LongSemanticElement,
  TypeElement,
  Layout,
} from '../models/diagram';
import { getStage } from './testHelpers';
import { COLORS } from '../constants/designTokens';
import { DEFAULT_NOTE_WIDTH, NOTE_MIN_HEIGHT } from '../constants/defaults';

/* ------------------------------------------------------------------ */
/*  Helper types for Konva node inspection                             */
/* ------------------------------------------------------------------ */
interface KonvaGroupLike {
  getChildren: (filter?: (child: unknown) => boolean) => unknown[];
}
interface KonvaTextLike {
  text: () => string;
  x: () => number;
  y: () => number;
  fill: () => string;
  fontSize?: () => number;
}
interface KonvaRectLike {
  fill: () => string;
  stroke: () => string;
  strokeWidth: () => number;
  width: () => number;
  height: () => number;
}
interface KonvaLineLike {
  points: () => number[];
  stroke: () => string;
  strokeWidth: () => number;
  dash: () => number[];
}

function asGroup(n: unknown): KonvaGroupLike {
  return n as KonvaGroupLike;
}

/* ------------------------------------------------------------------ */
/*  Mutable mock state (shared by Canvas and RightSidebar tests)       */
/* ------------------------------------------------------------------ */
const diagramState = vi.hoisted(() => ({
  elements: [] as DiagramElement[],
  addElement: vi.fn(),
  updateElement: vi.fn(),
  deleteElement: vi.fn(),
  deleteSelectedElements: vi.fn(),
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
/*  Sample elements                                                    */
/* ------------------------------------------------------------------ */

const sampleType: TypeElement = {
  id: 'type-1',
  type: 'type',
  name: 'Customer',
  attributes: [],
  methods: [],
  layout: { x: 100, y: 150, width: 180, height: 60 },
};

const sampleLongSemantic: LongSemanticElement = {
  id: 'longsem-1',
  type: 'longSemantic',
  heading: 'note',
  body: 'This is a semantic note body content.',
  layout: { x: 300, y: 300, width: DEFAULT_NOTE_WIDTH, height: NOTE_MIN_HEIGHT },
};

const sampleLongSemanticConstraint: LongSemanticElement = {
  id: 'longsem-constraint',
  type: 'longSemantic',
  heading: 'constraint',
  body: 'A constraint rule for the entity.',
  layout: { x: 400, y: 400, width: DEFAULT_NOTE_WIDTH, height: NOTE_MIN_HEIGHT },
};

const sampleLongSemanticDerivation: LongSemanticElement = {
  id: 'longsem-derivation',
  type: 'longSemantic',
  heading: 'derivation',
  body: 'Derived from other attributes.',
  layout: { x: 500, y: 500, width: DEFAULT_NOTE_WIDTH, height: NOTE_MIN_HEIGHT },
};

const sampleLongSemanticAttached: LongSemanticElement = {
  id: 'longsem-attached',
  type: 'longSemantic',
  heading: 'note',
  body: 'Attached semantic note.',
  attachedTo: 'type-1',
  layout: { x: 100, y: 234, width: DEFAULT_NOTE_WIDTH, height: NOTE_MIN_HEIGHT },
};

/* ================================================================== */
/*  ME-36/37: Long Semantic tool and note creation (Canvas)            */
/* ================================================================== */

describe('ME-36/37: Long Semantic tool and note creation', () => {
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
    editorState.generalizationParentId = null;
    editorState.setGeneralizationParent = vi.fn();
    editorState.clearGeneralizationState = vi.fn();
  });

  function countLayerChildren(
    stage: ReturnType<typeof getStage>,
    layerIndex: number,
  ): number {
    const layer = stage.getLayers()[layerIndex];
    if (!layer) return 0;
    return layer.getChildren().length;
  }

  it('creates a LongSemanticElement when clicking canvas in long-semantic mode', () => {
    editorState.currentTool = 'long-semantic';

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 300, offsetY: 400 } as MouseEvent });
    });

    expect(diagramState.addElement).toHaveBeenCalledTimes(1);
    const element = diagramState.addElement.mock.calls[0][0] as LongSemanticElement;
    expect(element.type).toBe('longSemantic');
    expect(element.heading).toBe('note');
    expect(element.body).toBe('');
    expect(element.attachedTo).toBeUndefined();
  });

  it('created note has default width and minimum height', () => {
    editorState.currentTool = 'long-semantic';

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 300, offsetY: 400 } as MouseEvent });
    });

    const element = diagramState.addElement.mock.calls[0][0] as LongSemanticElement;
    expect(element.layout.width).toBe(DEFAULT_NOTE_WIDTH);
    expect(element.layout.height).toBe(NOTE_MIN_HEIGHT);
  });

  it('switches tool to select after creating a LongSemantic note', () => {
    editorState.currentTool = 'long-semantic';

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 300, offsetY: 400 } as MouseEvent });
    });

    expect(editorState.setTool).toHaveBeenCalledWith('select');
  });

  it('selects the newly created LongSemantic note after creation', () => {
    editorState.currentTool = 'long-semantic';

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 300, offsetY: 400 } as MouseEvent });
    });

    const element = diagramState.addElement.mock.calls[0][0] as LongSemanticElement;
    expect(editorState.select).toHaveBeenCalledWith(element.id);
  });

  it('does not create a LongSemanticElement when clicking canvas in select mode', () => {
    editorState.currentTool = 'select';

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 300, offsetY: 400 } as MouseEvent });
    });

    expect(diagramState.addElement).not.toHaveBeenCalled();
  });

  it('creates note with correct coordinates', () => {
    editorState.currentTool = 'long-semantic';

    render(<Canvas />);
    const stage = getStage();

    act(() => {
      stage.fire('click', { evt: { offsetX: 500, offsetY: 300 } as MouseEvent });
    });

    const element = diagramState.addElement.mock.calls[0][0] as LongSemanticElement;
    expect(element.layout.x).toBe(500 - DEFAULT_NOTE_WIDTH / 2);
    expect(element.layout.y).toBe(300 - NOTE_MIN_HEIGHT / 2);
  });

  it('renders LongSemanticElement on the note layer', () => {
    diagramState.elements = [sampleLongSemantic as DiagramElement];

    render(<Canvas />);
    const stage = getStage();

    // Note layer is index 3
    expect(countLayerChildren(stage, 3)).toBe(1);
  });

  it('creates attached note when clicking a Type in long-semantic mode', () => {
    diagramState.elements = [sampleType as DiagramElement];
    editorState.currentTool = 'long-semantic';

    render(<Canvas />);
    const stage = getStage();

    const typeLayer = stage.getLayers()[1];
    const typeGroup = typeLayer.getChildren()[0];

    act(() => {
      typeGroup.fire('click');
    });

    expect(diagramState.addElement).toHaveBeenCalledTimes(1);
    const element = diagramState.addElement.mock.calls[0][0] as LongSemanticElement;
    expect(element.type).toBe('longSemantic');
    expect(element.attachedTo).toBe('type-1');
    expect(element.heading).toBe('note');
    expect(element.body).toBe('');
  });

  it('places attached note below the Type', () => {
    diagramState.elements = [sampleType as DiagramElement];
    editorState.currentTool = 'long-semantic';

    render(<Canvas />);
    const stage = getStage();

    const typeLayer = stage.getLayers()[1];
    const typeGroup = typeLayer.getChildren()[0];

    act(() => {
      typeGroup.fire('click');
    });

    const element = diagramState.addElement.mock.calls[0][0] as LongSemanticElement;
    expect(element.layout.x).toBe(sampleType.layout.x);
    expect(element.layout.y).toBe(sampleType.layout.y + sampleType.layout.height + 24);
  });

  it('switches to select and selects the note after creating attached note', () => {
    diagramState.elements = [sampleType as DiagramElement];
    editorState.currentTool = 'long-semantic';

    render(<Canvas />);
    const stage = getStage();

    const typeLayer = stage.getLayers()[1];
    const typeGroup = typeLayer.getChildren()[0];

    act(() => {
      typeGroup.fire('click');
    });

    expect(editorState.setTool).toHaveBeenCalledWith('select');

    const element = diagramState.addElement.mock.calls[0][0] as LongSemanticElement;
    expect(editorState.select).toHaveBeenCalledWith(element.id);
  });
});

/* ================================================================== */
/*  ME-37: LongSemanticBox rendering tests                             */
/* ================================================================== */

describe('ME-37: LongSemanticBox rendering', () => {
  function renderLongSemantic(
    element: LongSemanticElement = sampleLongSemantic,
    attachedLayout: Layout | null = null,
    isSelected = false,
    onSelect = vi.fn(),
    onDragEnd = vi.fn(),
  ) {
    return render(
      <Stage width={800} height={600}>
        <Layer>
          <LongSemanticBox
            element={element}
            attachedLayout={attachedLayout}
            isSelected={isSelected}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );
  }

  it('renders without crashing', () => {
    const { container } = renderLongSemantic();
    expect(container).toBeTruthy();
  });

  it('renders heading text with correct label for "note" heading', () => {
    renderLongSemantic();

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const headingText = textNodes.find((t) => t.text().startsWith('Note'));
    expect(headingText).toBeDefined();
    expect(headingText!.text()).toBe('Note:');
  });

  it('renders "Constraint:" label for constraint heading', () => {
    renderLongSemantic(sampleLongSemanticConstraint);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const headingText = textNodes.find((t) => t.text().includes('Constraint'));
    expect(headingText).toBeDefined();
    expect(headingText!.text()).toBe('Constraint:');
  });

  it('renders "Derivation:" label for derivation heading', () => {
    renderLongSemantic(sampleLongSemanticDerivation);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const headingText = textNodes.find((t) => t.text().includes('Derivation'));
    expect(headingText).toBeDefined();
    expect(headingText!.text()).toBe('Derivation:');
  });

  it('renders body text', () => {
    renderLongSemantic();

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const bodyText = textNodes.find((t) => t.text() === sampleLongSemantic.body);
    expect(bodyText).toBeDefined();
    expect(bodyText!.text()).toBe(sampleLongSemantic.body);
  });

  it('renders two Text elements (heading + body)', () => {
    renderLongSemantic();

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    );

    expect(textNodes.length).toBe(2);
  });

  it('renders a folded corner triangle (top-right)', () => {
    renderLongSemantic();

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const rectNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Rect',
    ) as KonvaRectLike[];
    const lineNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
    ) as KonvaLineLike[];

    // 2 Rects: body background + fold corner background
    expect(rectNodes.length).toBe(2);
    // At least 1 Line for the fold triangle border
    expect(lineNodes.length).toBeGreaterThanOrEqual(1);

    // The fold Rect should be at top-right corner area
    const foldRect = rectNodes[1];
    expect(foldRect.width()).toBe(18);
    expect(foldRect.height()).toBe(18);
  });

  it('uses amber color for constraint heading', () => {
    renderLongSemantic(sampleLongSemanticConstraint);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const constraintHeading = textNodes.find((t) => t.text().includes('Constraint'));
    expect(constraintHeading).toBeDefined();
    expect(constraintHeading!.fill()).toBe(COLORS.constraintColor);
  });

  it('uses gray color for note heading', () => {
    renderLongSemantic(sampleLongSemantic);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const noteHeading = textNodes.find((t) => t.text().includes('Note'));
    expect(noteHeading).toBeDefined();
    expect(noteHeading!.fill()).toBe(COLORS.noteHeadingColor);
  });

  it('uses blue color for derivation heading', () => {
    renderLongSemantic(sampleLongSemanticDerivation);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const derivationHeading = textNodes.find((t) => t.text().includes('Derivation'));
    expect(derivationHeading).toBeDefined();
    expect(derivationHeading!.fill()).toBe(COLORS.derivationColor);
  });

  it('shows selection border when isSelected is true', () => {
    renderLongSemantic(sampleLongSemantic, null, true);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const rectNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Rect',
    ) as KonvaRectLike[];

    const bodyRect = rectNodes[0];
    expect(bodyRect.stroke()).toBe(COLORS.selection);
    expect(bodyRect.strokeWidth()).toBe(2);
  });

  it('shows default border when not selected', () => {
    renderLongSemantic(sampleLongSemantic, null, false);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const rectNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Rect',
    ) as KonvaRectLike[];

    const bodyRect = rectNodes[0];
    expect(bodyRect.stroke()).toBe(COLORS.longNoteBorder);
    expect(bodyRect.strokeWidth()).toBe(1);
  });

  it('can be dragged (onDragEnd fires)', () => {
    const onDragEnd = vi.fn();
    renderLongSemantic(sampleLongSemantic, null, false, vi.fn(), onDragEnd);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    const newX = 400;
    const newY = 500;

    act(() => {
      (group as unknown as { x: (v: number) => void }).x(newX);
      (group as unknown as { y: (v: number) => void }).y(newY);
      group.fire('dragend');
    });

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledWith(sampleLongSemantic.id, newX, newY);
  });

  it('triggers onSelect callback when clicked', () => {
    const onSelect = vi.fn();
    renderLongSemantic(sampleLongSemantic, null, false, onSelect);

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    act(() => {
      group.fire('click');
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleLongSemantic.id);
  });

  it('renders with correct background color', () => {
    renderLongSemantic();

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const rectNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Rect',
    ) as KonvaRectLike[];

    const bodyRect = rectNodes[0];
    expect(bodyRect.fill()).toBe(COLORS.longNoteBg);
  });

  /* ------------------------------------------------------------------ */
  /*  ME-39: Attachment dashed connector line                            */
  /* ------------------------------------------------------------------ */

  describe('ME-39: Attachment connector line', () => {
    it('renders dashed connector line when attachedLayout is provided', () => {
      renderLongSemantic(
        sampleLongSemanticAttached,
        sampleType.layout,
        false,
        vi.fn(),
        vi.fn(),
      );

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0] as unknown as KonvaGroupLike;

      const allLines = group.getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      // Should have at least 1 Line (the connector) — filter for ones with 4 points
      const connectorLines = allLines.filter((l) => l.points().length === 4);
      expect(connectorLines.length).toBe(1);

      const connectorLine = connectorLines[0];
      expect(connectorLine.stroke()).toBe(COLORS.connectorLine);
      expect(connectorLine.dash()).toEqual([4, 3]);
    });

    it('does not render connector line when attachedLayout is null', () => {
      renderLongSemantic(sampleLongSemantic, null, false, vi.fn(), vi.fn());

      const stage = getStage();
      const layer = stage.getLayers()[0];
      const group = layer.getChildren()[0] as unknown as KonvaGroupLike;

      const allLines = group.getChildren(
        (n) => (n as { getClassName: () => string }).getClassName() === 'Line',
      ) as KonvaLineLike[];

      // No 4-point connector lines should exist
      const connectorLines = allLines.filter((l) => l.points().length === 4);
      expect(connectorLines.length).toBe(0);
    });
  });
});

/* ================================================================== */
/*  ME-38: RightSidebar for LongSemanticElement                        */
/* ================================================================== */

describe('ME-38: RightSidebar Long Semantic properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorState.selectedIds = [];
    diagramState.elements = [];
  });

  it('renders heading dropdown with 3 options when a LongSemantic element is selected', () => {
    editorState.selectedIds = ['longsem-1'];
    diagramState.elements = [sampleLongSemantic as DiagramElement];

    render(<RightSidebar />);

    const headingSelect = screen.getByTestId('note-heading-select');
    expect(headingSelect).toBeInTheDocument();

    const options = Array.from(headingSelect.querySelectorAll('option')).map(
      (opt) => opt.getAttribute('value'),
    );
    expect(options).toEqual(['constraint', 'derivation', 'note']);
  });

  it('heading dropdown shows current heading value', () => {
    editorState.selectedIds = ['longsem-1'];
    diagramState.elements = [sampleLongSemantic as DiagramElement];

    render(<RightSidebar />);

    const headingSelect = screen.getByTestId('note-heading-select');
    expect(headingSelect).toHaveValue('note');
  });

  it('changing heading calls updateElement with new heading', async () => {
    const user = userEvent.setup();
    editorState.selectedIds = ['longsem-1'];
    diagramState.elements = [sampleLongSemantic as DiagramElement];

    render(<RightSidebar />);

    const headingSelect = screen.getByTestId('note-heading-select');
    await user.selectOptions(headingSelect, 'constraint');

    expect(diagramState.updateElement).toHaveBeenCalledWith(
      'longsem-1',
      { heading: 'constraint' },
    );
  });

  it('renders body textarea with current body content', () => {
    editorState.selectedIds = ['longsem-1'];
    diagramState.elements = [sampleLongSemantic as DiagramElement];

    render(<RightSidebar />);

    const textarea = screen.getByTestId('note-body-textarea');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('This is a semantic note body content.');
  });

  it('changing body textarea calls updateElement', async () => {
    const user = userEvent.setup();
    editorState.selectedIds = ['longsem-1'];
    diagramState.elements = [sampleLongSemantic as DiagramElement];

    render(<RightSidebar />);

    const textarea = screen.getByTestId('note-body-textarea');
    await user.clear(textarea);

    // updateElement should have been called with empty body after clear
    expect(diagramState.updateElement).toHaveBeenCalledWith(
      'longsem-1',
      { body: '' },
    );
  });

  it('shows position info (X, Y, Width, Height)', () => {
    editorState.selectedIds = ['longsem-1'];
    diagramState.elements = [sampleLongSemantic as DiagramElement];

    render(<RightSidebar />);

    // X and Y are both 300, but the element has width 220 and height 80
    const xValues = screen.getAllByText('300');
    expect(xValues.length).toBe(2); // X and Y both equal 300
    expect(screen.getByText(DEFAULT_NOTE_WIDTH.toString())).toBeInTheDocument();
    expect(screen.getByText(NOTE_MIN_HEIGHT.toString())).toBeInTheDocument();
  });

  it('shows heading select for constraint heading type', () => {
    editorState.selectedIds = ['longsem-constraint'];
    diagramState.elements = [sampleLongSemanticConstraint as DiagramElement];

    render(<RightSidebar />);

    const headingSelect = screen.getByTestId('note-heading-select');
    expect(headingSelect).toHaveValue('constraint');
  });

  it('shows heading select for derivation heading type', () => {
    editorState.selectedIds = ['longsem-derivation'];
    diagramState.elements = [sampleLongSemanticDerivation as DiagramElement];

    render(<RightSidebar />);

    const headingSelect = screen.getByTestId('note-heading-select');
    expect(headingSelect).toHaveValue('derivation');
  });

  it('body textarea supports multiline content', () => {
    const multiLineEl: LongSemanticElement = {
      ...sampleLongSemantic,
      body: 'Line 1\nLine 2\nLine 3',
    };
    editorState.selectedIds = ['longsem-1'];
    diagramState.elements = [multiLineEl as DiagramElement];

    render(<RightSidebar />);

    const textarea = screen.getByTestId('note-body-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Line 1\nLine 2\nLine 3');
  });

  /* ------------------------------------------------------------------ */
  /*  ME-39: Attachment display in RightSidebar                          */
  /* ------------------------------------------------------------------ */

  describe('ME-39: Attachment display in RightSidebar', () => {
    it('shows attached target info when element has attachedTo', () => {
      editorState.selectedIds = ['longsem-attached'];
      diagramState.elements = [
        sampleType as DiagramElement,
        sampleLongSemanticAttached as DiagramElement,
      ];

      render(<RightSidebar />);

      expect(screen.getByText(/Type: Customer/)).toBeInTheDocument();
    });

    it('shows "Free-floating" text when element has no attachedTo', () => {
      editorState.selectedIds = ['longsem-1'];
      diagramState.elements = [sampleLongSemantic as DiagramElement];

      render(<RightSidebar />);

      expect(screen.getByText('Free-floating (未附着)')).toBeInTheDocument();
    });

    it('renders detach button when element is attached', () => {
      editorState.selectedIds = ['longsem-attached'];
      diagramState.elements = [
        sampleType as DiagramElement,
        sampleLongSemanticAttached as DiagramElement,
      ];

      render(<RightSidebar />);

      const detachButton = screen.getByText('解除附着');
      expect(detachButton).toBeInTheDocument();
    });

    it('clicking detach button calls updateElement with attachedTo: undefined', async () => {
      const user = userEvent.setup();
      editorState.selectedIds = ['longsem-attached'];
      diagramState.elements = [
        sampleType as DiagramElement,
        sampleLongSemanticAttached as DiagramElement,
      ];

      render(<RightSidebar />);

      const detachButton = screen.getByText('解除附着');
      await user.click(detachButton);

      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'longsem-attached',
        { attachedTo: undefined },
      );
    });

    it('does not show detach button when element is free-floating', () => {
      editorState.selectedIds = ['longsem-1'];
      diagramState.elements = [sampleLongSemantic as DiagramElement];

      render(<RightSidebar />);

      expect(screen.queryByText('解除附着')).not.toBeInTheDocument();
    });
  });
});
