import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RightSidebar from '../components/RightSidebar/RightSidebar';
import type { DiagramElement } from '../models/diagram';

/* ------------------------------------------------------------------ */
/*  Mock stores                                                        */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Sample elements                                                    */
/* ------------------------------------------------------------------ */

const sampleType: DiagramElement = {
  id: 'type-1',
  type: 'type',
  name: 'Customer',
  attributes: ['name: string', 'email: string'],
  methods: ['placeOrder()'],
  layout: { x: 100, y: 150, width: 180, height: 110 },
};

const sampleRelation: DiagramElement = {
  id: 'rel-1',
  type: 'relation',
  sourceId: 'type-1',
  targetId: 'type-2',
  sourceCardinality: 'exactly_one',
  targetCardinality: 'zero_or_many',
  label: 'places',
};

const sampleGeneralization: DiagramElement = {
  id: 'gen-1',
  type: 'generalization',
  name: 'Animal',
  childIds: ['cat', 'dog'],
  parentId: null,
  completeness: 'complete',
  layout: { x: 200, y: 300, width: 180, height: 80 },
};

const sampleNote: DiagramElement = {
  id: 'note-1',
  type: 'note',
  content: 'This is a semantic note for documentation.',
  layout: { x: 50, y: 50, width: 200, height: 70 },
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('RightSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorState.selectedIds = [];
    diagramState.elements = [];
  });

  it('renders without crashing', () => {
    const { container } = render(<RightSidebar />);
    expect(container).toBeTruthy();
  });

  it('renders the Properties header', () => {
    render(<RightSidebar />);
    expect(screen.getByText('Properties')).toBeInTheDocument();
  });

  it('shows placeholder text when nothing is selected', () => {
    render(<RightSidebar />);
    expect(
      screen.getByText('Select an element to edit its properties'),
    ).toBeInTheDocument();
  });

  it('shows placeholder when no elements match selected IDs', () => {
    editorState.selectedIds = ['nonexistent'];
    render(<RightSidebar />);
    expect(
      screen.getByText('Select an element to edit its properties'),
    ).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */
  /*  ME-10: Right sidebar shows selected Type name                      */
  /* ------------------------------------------------------------------ */

  describe('ME-10 selected Type properties', () => {
    it('shows "Name" label and current value when a Type element is selected', () => {
      editorState.selectedIds = ['type-1'];
      diagramState.elements = [sampleType];

      render(<RightSidebar />);

      // The "Name" label should be present
      expect(screen.getByText('Name')).toBeInTheDocument();
      // The current value should be displayed in the input
      expect(screen.getByDisplayValue('Customer')).toBeInTheDocument();
    });

    it('shows placeholder when nothing is selected', () => {
      render(<RightSidebar />);
      expect(
        screen.getByText('Select an element to edit its properties'),
      ).toBeInTheDocument();
    });
  });

  it('shows element name and properties for a single Type element', () => {
    editorState.selectedIds = ['type-1'];
    diagramState.elements = [sampleType];

    render(<RightSidebar />);

    // Name is in an editable input
    expect(screen.getByDisplayValue('Customer')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // attributes count
    expect(screen.getByText('1')).toBeInTheDocument(); // methods count
    expect(screen.getByText('100')).toBeInTheDocument(); // x
    expect(screen.getByText('150')).toBeInTheDocument(); // y
  });

  it('shows properties for a single Relation element', () => {
    editorState.selectedIds = ['rel-1'];
    diagramState.elements = [sampleRelation];

    render(<RightSidebar />);

    // Cardinality dropdowns should be rendered with correct values
    const sourceSelect = screen.getByTestId('source-cardinality-select');
    expect(sourceSelect).toHaveValue('exactly_one');
    const targetSelect = screen.getByTestId('target-cardinality-select');
    expect(targetSelect).toHaveValue('zero_or_many');
  });

  it('shows properties for a single Generalization element', () => {
    editorState.selectedIds = ['gen-1'];
    diagramState.elements = [sampleGeneralization];

    render(<RightSidebar />);

    expect(screen.getByDisplayValue('Animal')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // children count
    expect(screen.getByText('(none)')).toBeInTheDocument(); // parent
  });

  it('shows properties for a single Note element', () => {
    editorState.selectedIds = ['note-1'];
    diagramState.elements = [sampleNote];

    render(<RightSidebar />);

    expect(screen.getByDisplayValue('This is a semantic note for documentation.')).toBeInTheDocument();
  });

  it('shows multi-selection count when multiple elements are selected', () => {
    editorState.selectedIds = ['type-1', 'rel-1'];
    diagramState.elements = [sampleType, sampleRelation];

    render(<RightSidebar />);

    expect(screen.getByText('2 elements selected')).toBeInTheDocument();
  });

  it('shows element type label for Type element', () => {
    editorState.selectedIds = ['type-1'];
    diagramState.elements = [sampleType];

    render(<RightSidebar />);
    // The label "Type" and value "Type" both appear; verify at least two exist
    const typeElements = screen.getAllByText('Type');
    expect(typeElements.length).toBeGreaterThanOrEqual(2);
  });

  it('shows element type label for Relation element', () => {
    editorState.selectedIds = ['rel-1'];
    diagramState.elements = [sampleRelation];

    render(<RightSidebar />);
    expect(screen.getByText('Association/Mapping')).toBeInTheDocument();
  });

  it('shows element type label for Generalization element', () => {
    editorState.selectedIds = ['gen-1'];
    diagramState.elements = [sampleGeneralization];

    render(<RightSidebar />);
    expect(screen.getByText('Generalization')).toBeInTheDocument();
  });

  it('shows element type label for Note element', () => {
    editorState.selectedIds = ['note-1'];
    diagramState.elements = [sampleNote];

    render(<RightSidebar />);
    expect(screen.getByText('Semantic Statement')).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */
  /*  ME-11: Editable name field tests                                   */
  /* ------------------------------------------------------------------ */

  describe('ME-11 EditableField input', () => {
    it('renders an <input> element for the Name field of a Type element', () => {
      editorState.selectedIds = ['type-1'];
      diagramState.elements = [sampleType];

      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-name');
      expect(input.tagName).toBe('INPUT');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders an <input> element for the Name field of a Generalization element', () => {
      editorState.selectedIds = ['gen-1'];
      diagramState.elements = [sampleGeneralization];

      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-name');
      expect(input.tagName).toBe('INPUT');
      expect(input).toHaveDisplayValue('Animal');
    });

    it('renders an <input> element for the Content field of a Note element', () => {
      editorState.selectedIds = ['note-1'];
      diagramState.elements = [sampleNote];

      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-content');
      expect(input.tagName).toBe('INPUT');
      expect(input).toHaveDisplayValue('This is a semantic note for documentation.');
    });

    it('calls updateElement with new name on blur for Type element', async () => {
      editorState.selectedIds = ['type-1'];
      diagramState.elements = [sampleType];

      const user = userEvent.setup();
      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-name');
      await user.clear(input);
      await user.type(input, 'UpdatedCustomer');
      await user.click(document.body); // blur the input

      expect(diagramState.updateElement).toHaveBeenCalledWith('type-1', { name: 'UpdatedCustomer' });
    });

    it('calls updateElement with new name on Enter key for Type element', async () => {
      editorState.selectedIds = ['type-1'];
      diagramState.elements = [sampleType];

      const user = userEvent.setup();
      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-name');
      await user.clear(input);
      await user.type(input, 'Renamed{Enter}');

      expect(diagramState.updateElement).toHaveBeenCalledWith('type-1', { name: 'Renamed' });
    });

    it('calls updateElement with new name on blur for Generalization element', async () => {
      editorState.selectedIds = ['gen-1'];
      diagramState.elements = [sampleGeneralization];

      const user = userEvent.setup();
      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-name');
      await user.clear(input);
      await user.type(input, 'UpdatedAnimal');
      await user.click(document.body);

      expect(diagramState.updateElement).toHaveBeenCalledWith('gen-1', { name: 'UpdatedAnimal' });
    });

    it('calls updateElement with new content on blur for Note element', async () => {
      editorState.selectedIds = ['note-1'];
      diagramState.elements = [sampleNote];

      const user = userEvent.setup();
      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-content');
      await user.clear(input);
      await user.type(input, 'Updated content');
      await user.click(document.body);

      expect(diagramState.updateElement).toHaveBeenCalledWith('note-1', { content: 'Updated content' });
    });

    it('does not call updateElement when the value has not changed on blur', async () => {
      editorState.selectedIds = ['type-1'];
      diagramState.elements = [sampleType];

      const user = userEvent.setup();
      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-name');
      await user.click(input);
      await user.click(document.body); // blur without changing

      expect(diagramState.updateElement).not.toHaveBeenCalled();
    });

    it('supports Chinese text in the Name input', () => {
      const chineseElement: DiagramElement = {
        ...sampleType,
        id: 'type-cn',
        name: '客户管理',
      };
      editorState.selectedIds = ['type-cn'];
      diagramState.elements = [chineseElement];

      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-name');
      expect(input).toHaveDisplayValue('客户管理');
    });

    it('saves name with Chinese characters on blur', async () => {
      editorState.selectedIds = ['type-1'];
      diagramState.elements = [sampleType];

      const user = userEvent.setup();
      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-name');
      await user.clear(input);
      await user.type(input, '客户管理子系统');
      await user.click(document.body);

      expect(diagramState.updateElement).toHaveBeenCalledWith('type-1', { name: '客户管理子系统' });
    });

    it('saves name with mixed Chinese/English characters on Enter', async () => {
      editorState.selectedIds = ['type-1'];
      diagramState.elements = [sampleType];

      const user = userEvent.setup();
      render(<RightSidebar />);

      const input = screen.getByTestId('editable-field-name');
      await user.clear(input);
      await user.type(input, '客户管理Subsystem{Enter}');

      expect(diagramState.updateElement).toHaveBeenCalledWith('type-1', { name: '客户管理Subsystem' });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-20/21/22: Cardinality dropdown tests                            */
  /* ------------------------------------------------------------------ */

  describe('ME-20/21/22 cardinality dropdown selectors', () => {
    it('renders source cardinality dropdown with correct value for Relation element', () => {
      editorState.selectedIds = ['rel-1'];
      diagramState.elements = [sampleRelation];

      render(<RightSidebar />);

      const sourceSelect = screen.getByTestId('source-cardinality-select');
      expect(sourceSelect).toBeInTheDocument();
      expect(sourceSelect).toHaveValue('exactly_one');
    });

    it('renders target cardinality dropdown with correct value for Relation element', () => {
      editorState.selectedIds = ['rel-1'];
      diagramState.elements = [sampleRelation];

      render(<RightSidebar />);

      const targetSelect = screen.getByTestId('target-cardinality-select');
      expect(targetSelect).toBeInTheDocument();
      expect(targetSelect).toHaveValue('zero_or_many');
    });

    it('source cardinality dropdown has all four options', () => {
      editorState.selectedIds = ['rel-1'];
      diagramState.elements = [sampleRelation];

      render(<RightSidebar />);

      const sourceSelect = screen.getByTestId('source-cardinality-select');
      const options = Array.from(sourceSelect.querySelectorAll('option')).map(
        (opt) => opt.getAttribute('value'),
      );
      expect(options).toEqual([
        'exactly_one',
        'zero_or_one',
        'one_or_many',
        'zero_or_many',
      ]);
    });

    it('changing source cardinality calls updateElement', async () => {
      editorState.selectedIds = ['rel-1'];
      diagramState.elements = [sampleRelation];

      const user = userEvent.setup();
      render(<RightSidebar />);

      const sourceSelect = screen.getByTestId('source-cardinality-select');
      await user.selectOptions(sourceSelect, 'zero_or_many');

      expect(diagramState.updateElement).toHaveBeenCalledWith('rel-1', {
        sourceCardinality: 'zero_or_many',
      });
    });

    it('renders completeness dropdown for Generalization element', () => {
      editorState.selectedIds = ['gen-1'];
      diagramState.elements = [sampleGeneralization];

      render(<RightSidebar />);

      const select = screen.getByTestId('completeness-select');
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('complete');
    });

    it('changing completeness dropdown calls updateElement', async () => {
      editorState.selectedIds = ['gen-1'];
      diagramState.elements = [sampleGeneralization];

      const user = userEvent.setup();
      render(<RightSidebar />);

      const select = screen.getByTestId('completeness-select');
      await user.selectOptions(select, 'incomplete');

      expect(diagramState.updateElement).toHaveBeenCalledWith('gen-1', {
        completeness: 'incomplete',
      });
    });

    it('completeness dropdown has both options', () => {
      editorState.selectedIds = ['gen-1'];
      diagramState.elements = [sampleGeneralization];

      render(<RightSidebar />);

      const select = screen.getByTestId('completeness-select');
      const options = Array.from(select.querySelectorAll('option')).map(
        (opt) => opt.getAttribute('value'),
      );
      expect(options).toEqual(['complete', 'incomplete']);
    });

    it('changing target cardinality calls updateElement', async () => {
      editorState.selectedIds = ['rel-1'];
      diagramState.elements = [sampleRelation];

      const user = userEvent.setup();
      render(<RightSidebar />);

      const targetSelect = screen.getByTestId('target-cardinality-select');
      await user.selectOptions(targetSelect, 'one_or_many');

      expect(diagramState.updateElement).toHaveBeenCalledWith('rel-1', {
        targetCardinality: 'one_or_many',
      });
    });

    it('renders Source and Target cardinality selects', () => {
      editorState.selectedIds = ['rel-1'];
      diagramState.elements = [sampleRelation];

      render(<RightSidebar />);

      expect(screen.getByTestId('source-cardinality-select')).toBeInTheDocument();
      expect(screen.getByTestId('target-cardinality-select')).toBeInTheDocument();
    });
  });
});
