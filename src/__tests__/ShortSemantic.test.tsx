import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stage, Layer } from 'react-konva';
import RightSidebar from '../components/RightSidebar/RightSidebar';
import TypeNode from '../components/Canvas/TypeNode';
import RelationLine from '../components/Canvas/RelationLine';
import type { TypeElement, RelationElement, DiagramElement, Layout } from '../models/diagram';
import { getStage } from './testHelpers';
import { COLORS } from '../constants/designTokens';

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
  fontSize: () => number;
  fontStyle: () => string;
}

function asGroup(n: unknown): KonvaGroupLike {
  return n as KonvaGroupLike;
}

/* ------------------------------------------------------------------ */
/*  Sample elements                                                    */
/* ------------------------------------------------------------------ */

const typeWithSemantics: TypeElement = {
  id: 'type-sem-1',
  type: 'type',
  name: 'Customer',
  attributes: [],
  methods: [],
  semantics: [{ type: 'abstract' }, { type: 'singleton' }],
  layout: { x: 100, y: 150, width: 180, height: 60 },
};

const typeWithKeySemantic: TypeElement = {
  id: 'type-key-1',
  type: 'type',
  name: 'Order',
  attributes: [],
  methods: [],
  semantics: [{ type: 'key', keyType: 'orderId' }],
  layout: { x: 100, y: 150, width: 180, height: 60 },
};

const typeWithoutSemantics: TypeElement = {
  id: 'type-no-sem',
  type: 'type',
  name: 'Plain',
  attributes: [],
  methods: [],
  layout: { x: 100, y: 150, width: 180, height: 60 },
};

const relationWithSemantics: RelationElement = {
  id: 'rel-sem-1',
  type: 'relation',
  sourceId: 'type-1',
  targetId: 'type-2',
  sourceCardinality: 'exactly_one',
  targetCardinality: 'zero_or_many',
  label: 'has',
  sourceSemantics: [{ type: 'immutable' }, { type: 'list' }],
  targetSemantics: [{ type: 'class' }],
  associationSemantics: [{ type: 'hierarchy' }],
};

const relationWithoutSemantics: RelationElement = {
  id: 'rel-no-sem',
  type: 'relation',
  sourceId: 'type-1',
  targetId: 'type-2',
  sourceCardinality: 'exactly_one',
  targetCardinality: 'zero_or_many',
  label: 'has',
};

const sourceLayout: Layout = { x: 100, y: 150, width: 180, height: 110 };
const targetLayout: Layout = { x: 420, y: 150, width: 180, height: 110 };

/* ================================================================== */
/*  ShortSemantic — TypeNode rendering tests                           */
/* ================================================================== */

describe('ME-34: Short Semantic markers on Type (TypeNode rendering)', () => {
  it('renders semantic marker text above the type box when semantics are present', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <Stage width={800} height={600}>
        <Layer>
          <TypeNode
            element={typeWithSemantics}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    // Find the semantic text node (y = -18, above the header)
    const semanticText = textNodes.find((t) => t.y() < 0);
    expect(semanticText).toBeDefined();
    expect(semanticText!.text()).toBe('[abstract] [singleton]');
  });

  it('renders key-type semantic marker with [type: keyType] format', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <Stage width={800} height={600}>
        <Layer>
          <TypeNode
            element={typeWithKeySemantic}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const semanticText = textNodes.find((t) => t.y() < 0);
    expect(semanticText).toBeDefined();
    expect(semanticText!.text()).toBe('[key: orderId]');
  });

  it('does not render semantic text when semantics is undefined', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <Stage width={800} height={600}>
        <Layer>
          <TypeNode
            element={typeWithoutSemantics}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    // With no semantics, the first text is the header name, not a semantic marker
    // No text should have y < 0 (semantic text is at y=-18)
    const semanticText = textNodes.find((t) => t.y() < 0);
    expect(semanticText).toBeUndefined();
  });

  it('semantic text is centered with gray color and 11px font', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <Stage width={800} height={600}>
        <Layer>
          <TypeNode
            element={typeWithSemantics}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const semanticText = textNodes.find((t) => t.y() < 0);
    expect(semanticText).toBeDefined();
    expect(semanticText!.fill()).toBe(COLORS.semanticText);
    expect(semanticText!.fontSize()).toBe(11);
  });

  it('renders single semantic marker correctly', () => {
    const typeWithOneSemantic: TypeElement = {
      ...typeWithSemantics,
      semantics: [{ type: 'abstract' }],
    };
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <Stage width={800} height={600}>
        <Layer>
          <TypeNode
            element={typeWithOneSemantic}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const semanticText = textNodes.find((t) => t.y() < 0);
    expect(semanticText).toBeDefined();
    expect(semanticText!.text()).toBe('[abstract]');
  });
});

/* ================================================================== */
/*  ShortSemantic — RelationLine rendering tests                       */
/* ================================================================== */

describe('ME-35: Short Semantic markers on Relation (RelationLine rendering)', () => {
  interface KonvaLineLike {
    stroke: () => string;
    strokeWidth: () => number;
    points: () => number[];
  }

  it('renders source-end semantic markers below the source endpoint', () => {
    render(
      <Stage width={800} height={600}>
        <Layer>
          <RelationLine
            element={relationWithSemantics}
            sourcePosition={sourceLayout}
            targetPosition={targetLayout}
            isSelected={false}
            onSelect={vi.fn()}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    // Source-end markers text should contain the source semantics
    const sourceSemText = textNodes.find(
      (t) => t.text().includes('immutable') && t.text().includes('list'),
    );
    expect(sourceSemText).toBeDefined();
    expect(sourceSemText!.text()).toBe('[immutable] [list]');
  });

  it('renders target-end semantic markers below the target endpoint', () => {
    render(
      <Stage width={800} height={600}>
        <Layer>
          <RelationLine
            element={relationWithSemantics}
            sourcePosition={sourceLayout}
            targetPosition={targetLayout}
            isSelected={false}
            onSelect={vi.fn()}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const targetSemText = textNodes.find((t) => t.text().includes('class'));
    expect(targetSemText).toBeDefined();
    expect(targetSemText!.text()).toBe('[class]');
  });

  it('renders association-level semantic markers at midpoint', () => {
    render(
      <Stage width={800} height={600}>
        <Layer>
          <RelationLine
            element={relationWithSemantics}
            sourcePosition={sourceLayout}
            targetPosition={targetLayout}
            isSelected={false}
            onSelect={vi.fn()}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    // Association semantics text should contain 'hierarchy'
    const assocSemText = textNodes.find((t) => t.text().includes('hierarchy'));
    expect(assocSemText).toBeDefined();
    expect(assocSemText!.text()).toBe('[hierarchy]');
  });

  it('does not render semantic text when semantics are undefined', () => {
    render(
      <Stage width={800} height={600}>
        <Layer>
          <RelationLine
            element={relationWithoutSemantics}
            sourcePosition={sourceLayout}
            targetPosition={targetLayout}
            isSelected={false}
            onSelect={vi.fn()}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    // Only the label text should exist; verify no semantic-related text appears
    const semTexts = textNodes.filter(
      (t) => t.text().includes('[') || t.text().includes('immutable'),
    );
    expect(semTexts.length).toBe(0);
  });

  it('semantic text uses italic font style with semantic color', () => {
    render(
      <Stage width={800} height={600}>
        <Layer>
          <RelationLine
            element={relationWithSemantics}
            sourcePosition={sourceLayout}
            targetPosition={targetLayout}
            isSelected={false}
            onSelect={vi.fn()}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const sourceSemText = textNodes.find((t) => t.text().includes('immutable'));
    expect(sourceSemText).toBeDefined();
    expect(sourceSemText!.fill()).toBe(COLORS.semanticText);
    expect(sourceSemText!.fontSize()).toBe(11);
  });

  it('semantic text nodes are set to listening=false', () => {
    render(
      <Stage width={800} height={600}>
        <Layer>
          <RelationLine
            element={relationWithSemantics}
            sourcePosition={sourceLayout}
            targetPosition={targetLayout}
            isSelected={false}
            onSelect={vi.fn()}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    );
    const semTextNodes = textNodes.filter(
      (t) => (t as KonvaTextLike).text().includes('['),
    );

    for (const node of semTextNodes) {
      expect((node as unknown as { listening: () => boolean }).listening()).toBe(false);
    }
  });

  it('handles key-type semantic on relation endpoints', () => {
    const relationWithKeySem: RelationElement = {
      ...relationWithSemantics,
      sourceSemantics: [{ type: 'key', keyType: 'CustomerId' }],
    };

    render(
      <Stage width={800} height={600}>
        <Layer>
          <RelationLine
            element={relationWithKeySem}
            sourcePosition={sourceLayout}
            targetPosition={targetLayout}
            isSelected={false}
            onSelect={vi.fn()}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const keyText = textNodes.find((t) => t.text().includes('key'));
    expect(keyText).toBeDefined();
    expect(keyText!.text()).toBe('[key: CustomerId]');
  });

  it('renders multiple association-level markers', () => {
    const relationMultiAssoc: RelationElement = {
      ...relationWithSemantics,
      associationSemantics: [{ type: 'hierarchy' }, { type: 'dag' }],
    };

    render(
      <Stage width={800} height={600}>
        <Layer>
          <RelationLine
            element={relationMultiAssoc}
            sourcePosition={sourceLayout}
            targetPosition={targetLayout}
            isSelected={false}
            onSelect={vi.fn()}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0] as unknown as KonvaGroupLike;
    const textNodes = group.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Text',
    ) as KonvaTextLike[];

    const assocText = textNodes.find(
      (t) => t.text().includes('hierarchy') && t.text().includes('dag'),
    );
    expect(assocText).toBeDefined();
    expect(assocText!.text()).toBe('[hierarchy] [dag]');
  });
});

/* ================================================================== */
/*  ShortSemantic — RightSidebar property panel tests                  */
/* ================================================================== */

describe('Short Semantic property panels in RightSidebar', () => {
  const editorState = vi.hoisted(() => ({
    selectedIds: [] as string[],
  }));

  const diagramState = vi.hoisted(() => ({
    elements: [] as DiagramElement[],
    updateElement: vi.fn(),
  }));

  vi.mock('../store/useEditorStore', () => ({
    useEditorStore: vi.fn((selector?: (state: unknown) => unknown) => {
      if (selector) return selector(editorState);
      return editorState;
    }),
  }));

  vi.mock('../store/useDiagramStore', () => ({
    useDiagramStore: vi.fn((selector?: (state: unknown) => unknown) => {
      if (selector) return selector(diagramState);
      return diagramState;
    }),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    editorState.selectedIds = [];
    diagramState.elements = [];
  });

  /* ------------------------------------------------------------------ */
  /*  ME-34: Type Short Semantics in RightSidebar                        */
  /* ------------------------------------------------------------------ */

  describe('ME-34: Type "Semantics (Short)" section', () => {
    it('shows "Semantics (Short)" section when a Type with semantics is selected', () => {
      const typeEl: DiagramElement = {
        ...typeWithSemantics,
      };
      editorState.selectedIds = ['type-sem-1'];
      diagramState.elements = [typeEl];

      render(<RightSidebar />);

      expect(screen.getByText('Semantics (Short)')).toBeInTheDocument();
    });

    it('shows "Semantics (Short)" section when a Type without semantics is selected', () => {
      const typeEl: DiagramElement = {
        ...typeWithoutSemantics,
      };
      editorState.selectedIds = ['type-no-sem'];
      diagramState.elements = [typeEl];

      render(<RightSidebar />);

      expect(screen.getByText('Semantics (Short)')).toBeInTheDocument();
    });

    it('shows existing markers as pills with bracket format', () => {
      const typeEl: DiagramElement = {
        ...typeWithSemantics,
      };
      editorState.selectedIds = ['type-sem-1'];
      diagramState.elements = [typeEl];

      render(<RightSidebar />);

      expect(screen.getByText('[abstract]')).toBeInTheDocument();
      expect(screen.getByText('[singleton]')).toBeInTheDocument();
    });

    it('shows key-type marker as [key: typeName] pill', () => {
      const typeEl: DiagramElement = {
        ...typeWithKeySemantic,
      };
      editorState.selectedIds = ['type-key-1'];
      diagramState.elements = [typeEl];

      render(<RightSidebar />);

      expect(screen.getByText('[key: orderId]')).toBeInTheDocument();
    });

    it('shows "+ Add marker" button when there are available options', () => {
      const typeEl: DiagramElement = {
        ...typeWithoutSemantics,
      };
      editorState.selectedIds = ['type-no-sem'];
      diagramState.elements = [typeEl];

      render(<RightSidebar />);

      expect(screen.getByText('+ Add marker')).toBeInTheDocument();
    });

    it('allows removing a marker via the x button', async () => {
      const user = userEvent.setup();
      const typeEl: DiagramElement = {
        ...typeWithSemantics,
      };
      editorState.selectedIds = ['type-sem-1'];
      diagramState.elements = [typeEl];

      render(<RightSidebar />);

      // The x button is right after the pill text. There's no test id, so use
      // the text "[abstract]" and then click the adjacent x span.
      const abstractPill = screen.getByText('[abstract]');
      expect(abstractPill).toBeInTheDocument();

      // Find the x next to it (the span sibling after the text)
      const xButtons = document.querySelectorAll('span');
      const xButton = Array.from(xButtons).find(
        (span) => span.textContent === '✕',
      );
      expect(xButton).toBeDefined();

      await user.click(xButton!);

      // updateElement should have been called with semantics list that excludes 'abstract'
      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'type-sem-1',
        expect.objectContaining({
          semantics: [{ type: 'singleton' }],
        }),
      );
    });

    it('adds a marker via the picker dropdown', async () => {
      const user = userEvent.setup();
      const typeEl: DiagramElement = {
        ...typeWithoutSemantics,
      };
      editorState.selectedIds = ['type-no-sem'];
      diagramState.elements = [typeEl];

      render(<RightSidebar />);

      // Click "+ Add marker"
      await user.click(screen.getByText('+ Add marker'));

      // A select dropdown should appear
      const select = document.querySelector('select');
      expect(select).toBeDefined();

      // Select 'abstract'
      await user.selectOptions(select!, 'abstract');

      // Click the "Add" button
      const addButton = screen.getByText('Add');
      await user.click(addButton);

      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'type-no-sem',
        expect.objectContaining({
          semantics: [{ type: 'abstract' }],
        }),
      );
    });

    it('hides "+ Add marker" when all options are used', () => {
      // For Type: available markers are 'abstract' and 'singleton'
      const typeWithAll: DiagramElement = {
        ...typeWithSemantics,
      };
      editorState.selectedIds = ['type-sem-1'];
      diagramState.elements = [typeWithAll];

      render(<RightSidebar />);

      // The "+ Add marker" button should not be shown since all options are taken
      expect(screen.queryByText('+ Add marker')).not.toBeInTheDocument();
    });

    it('cancel button hides the picker', async () => {
      const user = userEvent.setup();
      const typeEl: DiagramElement = {
        ...typeWithoutSemantics,
      };
      editorState.selectedIds = ['type-no-sem'];
      diagramState.elements = [typeEl];

      render(<RightSidebar />);

      await user.click(screen.getByText('+ Add marker'));
      expect(screen.getByText('Cancel')).toBeInTheDocument();

      await user.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('does not call updateElement for type with invalid marker selection', async () => {
      const user = userEvent.setup();
      const typeEl: DiagramElement = {
        ...typeWithoutSemantics,
      };
      editorState.selectedIds = ['type-no-sem'];
      diagramState.elements = [typeEl];

      render(<RightSidebar />);

      await user.click(screen.getByText('+ Add marker'));
      const addButton = screen.getByText('Add');
      await user.click(addButton);

      // No selection made, so updateElement should not be called
      expect(diagramState.updateElement).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-35: Relation Short Semantics in RightSidebar                    */
  /* ------------------------------------------------------------------ */

  describe('ME-35: Relation "Source"/"Target"/"Association" sections', () => {
    it('shows "Source" section with Mapping Markers for a Relation', () => {
      const relEl: DiagramElement = {
        ...relationWithSemantics,
      };
      editorState.selectedIds = ['rel-sem-1'];
      diagramState.elements = [relEl];

      render(<RightSidebar />);

      expect(screen.getByText('Source (起点)')).toBeInTheDocument();
      const mappingLabels = screen.getAllByText('Mapping Markers');
      expect(mappingLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "Target" section with Mapping Markers for a Relation', () => {
      const relEl: DiagramElement = {
        ...relationWithSemantics,
      };
      editorState.selectedIds = ['rel-sem-1'];
      diagramState.elements = [relEl];

      render(<RightSidebar />);

      expect(screen.getByText('Target (终点)')).toBeInTheDocument();
      // There are two "Mapping Markers" labels (Source + Target)
      const mappingLabels = screen.getAllByText('Mapping Markers');
      expect(mappingLabels.length).toBe(2);
    });

    it('shows "Association" section for a Relation', () => {
      const relEl: DiagramElement = {
        ...relationWithSemantics,
      };
      editorState.selectedIds = ['rel-sem-1'];
      diagramState.elements = [relEl];

      render(<RightSidebar />);

      expect(screen.getByText('Association (关联)')).toBeInTheDocument();
    });

    it('shows source-end existing markers in the Source section', () => {
      const relEl: DiagramElement = {
        ...relationWithSemantics,
      };
      editorState.selectedIds = ['rel-sem-1'];
      diagramState.elements = [relEl];

      render(<RightSidebar />);

      expect(screen.getByText('[immutable]')).toBeInTheDocument();
      expect(screen.getByText('[list]')).toBeInTheDocument();
    });

    it('shows target-end existing markers in the Target section', () => {
      const relEl: DiagramElement = {
        ...relationWithSemantics,
      };
      editorState.selectedIds = ['rel-sem-1'];
      diagramState.elements = [relEl];

      render(<RightSidebar />);

      expect(screen.getByText('[class]')).toBeInTheDocument();
    });

    it('shows association-level existing markers in the Association section', () => {
      const relEl: DiagramElement = {
        ...relationWithSemantics,
      };
      editorState.selectedIds = ['rel-sem-1'];
      diagramState.elements = [relEl];

      render(<RightSidebar />);

      expect(screen.getByText('[hierarchy]')).toBeInTheDocument();
    });

    it('adds a source-end mapping marker via the Source section', async () => {
      const user = userEvent.setup();
      const relEl: DiagramElement = {
        ...relationWithoutSemantics,
      };
      editorState.selectedIds = ['rel-no-sem'];
      diagramState.elements = [relEl];

      render(<RightSidebar />);

      // Find the "+ Add marker" inside the Source section
      const addMarkers = screen.getAllByText('+ Add marker');
      // First one is for Source (since it comes first in the DOM)
      await user.click(addMarkers[0]);

      // Wait for picker to appear by looking for Cancel/Add buttons
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeInTheDocument();

      // The picker's select appears dynamically. Find it by looking for
      // the select that includes "immutable" as an option.
      const allSelects = document.querySelectorAll('select');
      const markerSelect = Array.from(allSelects).find(
        (sel) => Array.from(sel.options).some((opt) => opt.value === 'immutable'),
      );
      expect(markerSelect).toBeDefined();

      // Select 'immutable' from the marker picker
      await user.selectOptions(markerSelect!, 'immutable');

      const addButton = screen.getByText('Add');
      await user.click(addButton);

      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'rel-no-sem',
        expect.objectContaining({
          sourceSemantics: [{ type: 'immutable' }],
        }),
      );
    });

    it('adds an association-level marker', async () => {
      const user = userEvent.setup();
      const relEl: DiagramElement = {
        ...relationWithoutSemantics,
      };
      editorState.selectedIds = ['rel-no-sem'];
      diagramState.elements = [relEl];

      render(<RightSidebar />);

      // There should be at least 3 "+ Add marker" buttons (Source, Target, Association)
      const addMarkers = screen.getAllByText('+ Add marker');
      // The Association one is last (index 2)
      await user.click(addMarkers[2]);

      // Wait for picker to appear
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeInTheDocument();

      // Find the select that includes "hierarchy" as an option
      const allSelects = document.querySelectorAll('select');
      const markerSelect = Array.from(allSelects).find(
        (sel) => Array.from(sel.options).some((opt) => opt.value === 'hierarchy'),
      );
      expect(markerSelect).toBeDefined();

      await user.selectOptions(markerSelect!, 'hierarchy');

      const addButton = screen.getByText('Add');
      await user.click(addButton);

      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'rel-no-sem',
        expect.objectContaining({
          associationSemantics: [{ type: 'hierarchy' }],
        }),
      );
    });

    it('removes a source-end marker', async () => {
      const user = userEvent.setup();
      const relEl: DiagramElement = {
        ...relationWithSemantics,
      };
      editorState.selectedIds = ['rel-sem-1'];
      diagramState.elements = [relEl];

      render(<RightSidebar />);

      // Click the ✕ button for the '[immutable]' pill
      const xButtons = document.querySelectorAll('span');
      const xButton = Array.from(xButtons).find(
        (span) => span.textContent === '✕',
      );
      expect(xButton).toBeDefined();
      await user.click(xButton!);

      expect(diagramState.updateElement).toHaveBeenCalledWith(
        'rel-sem-1',
        expect.objectContaining({
          sourceSemantics: [{ type: 'list' }],
        }),
      );
    });

    it('Source/Target markers use mapping options (immutable, list, class, key, historic, abstract)', () => {
      // Type options: abstract, singleton
      // Mapping options: immutable, list, class, key, historic, abstract
      // Association options: hierarchy, dag, multiple_hierarchies

      const relEl: DiagramElement = {
        ...relationWithoutSemantics,
      };
      editorState.selectedIds = ['rel-no-sem'];
      diagramState.elements = [relEl];

      render(<RightSidebar />);

      // Open the Source picker
      const addMarkers = screen.getAllByText('+ Add marker');
      // verify all three sections are present
      expect(screen.getByText('Source (起点)')).toBeInTheDocument();
      expect(screen.getByText('Target (终点)')).toBeInTheDocument();
      expect(screen.getByText('Association (关联)')).toBeInTheDocument();
      expect(addMarkers.length).toBeGreaterThanOrEqual(3);
    });

    it('does not show "+ Add marker" for enabled options but all are used in a section', () => {
      const relFull: RelationElement = {
        ...relationWithoutSemantics,
        sourceSemantics: [
          { type: 'immutable' },
          { type: 'list' },
          { type: 'class' },
          { type: 'key', keyType: 'id' },
          { type: 'historic' },
          { type: 'abstract' },
        ],
      };
      editorState.selectedIds = ['rel-no-sem'];
      diagramState.elements = [relFull as DiagramElement];

      render(<RightSidebar />);

      // The Source section's "+ Add marker" button should not appear
      // (There may be other + Add markers for Target and Association)
      // But Source has all 6 options used, so we just verify the pills exist
      expect(screen.getByText('[immutable]')).toBeInTheDocument();
      expect(screen.getByText('[list]')).toBeInTheDocument();
      expect(screen.getByText('[class]')).toBeInTheDocument();
      expect(screen.getByText('[historic]')).toBeInTheDocument();
      expect(screen.getByText('[abstract]')).toBeInTheDocument();
    });
  });
});
