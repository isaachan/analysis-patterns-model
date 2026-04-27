import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBar from '../components/StatusBar/StatusBar';

/* ------------------------------------------------------------------ */
/*  Mock stores                                                        */
/* ------------------------------------------------------------------ */

const editorState = vi.hoisted(() => ({
  currentTool: 'select' as string,
  zoom: 1,
  gridEnabled: true,
  snapEnabled: true,
  generalizationParentId: null as string | null,
}));

const diagramState = vi.hoisted(() => ({
  elements: [] as unknown[],
}));

const fileState = vi.hoisted(() => ({
  storageError: null as string | null,
  clearStorageError: vi.fn(),
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

vi.mock('../store/useFileStore', () => ({
  useFileStore: vi.fn((selector?: (state: unknown) => unknown) => {
    if (selector) return selector(fileState);
    return fileState;
  }),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    editorState.currentTool = 'select';
    editorState.zoom = 1;
    diagramState.elements = [];
    fileState.storageError = null;
    editorState.generalizationParentId = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    const { container } = render(<StatusBar />);
    expect(container).toBeTruthy();
  });

  it('shows the current tool name', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('status-tool')).toHaveTextContent('Tool: Select');
  });

  it('shows "Association/Mapping" for relation tool', () => {
    editorState.currentTool = 'relation';
    render(<StatusBar />);
    expect(screen.getByTestId('status-tool')).toHaveTextContent('Tool: Association/Mapping');
  });

  it('shows "Semantic Statement" for note tool', () => {
    editorState.currentTool = 'note';
    render(<StatusBar />);
    expect(screen.getByTestId('status-tool')).toHaveTextContent('Tool: Semantic Statement');
  });

  it('shows "Generalization" for generalization tool', () => {
    editorState.currentTool = 'generalization';
    render(<StatusBar />);
    expect(screen.getByTestId('status-tool')).toHaveTextContent('Tool: Generalization');
  });

  it('shows "Type" for type tool', () => {
    editorState.currentTool = 'type';
    render(<StatusBar />);
    expect(screen.getByTestId('status-tool')).toHaveTextContent('Tool: Type');
  });

  it('shows "Short Semantic Statement" for short-semantic tool', () => {
    editorState.currentTool = 'short-semantic';
    render(<StatusBar />);
    expect(screen.getByTestId('status-tool')).toHaveTextContent('Tool: Short Semantic Statement');
  });

  it('shows "Long Semantic Statement" for long-semantic tool', () => {
    editorState.currentTool = 'long-semantic';
    render(<StatusBar />);
    expect(screen.getByTestId('status-tool')).toHaveTextContent('Tool: Long Semantic Statement');
  });

  it('shows element count as 0 when no elements', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('status-elements')).toHaveTextContent('Elements: 0');
  });

  it('shows element count correctly', () => {
    diagramState.elements = [{}, {}, {}]; // 3 elements
    render(<StatusBar />);
    expect(screen.getByTestId('status-elements')).toHaveTextContent('Elements: 3');
  });

  it('shows zoom percentage as 100% by default', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('status-zoom')).toHaveTextContent('Zoom: 100%');
  });

  it('shows zoom percentage rounded correctly', () => {
    editorState.zoom = 1.5;
    render(<StatusBar />);
    expect(screen.getByTestId('status-zoom')).toHaveTextContent('Zoom: 150%');
  });

  it('shows zoom percentage for fractional zoom', () => {
    editorState.zoom = 0.75;
    render(<StatusBar />);
    expect(screen.getByTestId('status-zoom')).toHaveTextContent('Zoom: 75%');
  });

  /* ------------------------------------------------------------------ */
  /*  ME-46: Storage error display                                      */
  /* ------------------------------------------------------------------ */

  describe('ME-46 storage error display', () => {
    it('does not show storage error when there is none', () => {
      fileState.storageError = null;
      render(<StatusBar />);
      expect(screen.queryByTestId('status-storage-error')).not.toBeInTheDocument();
    });

    it('shows storage error message when one is set', () => {
      fileState.storageError = 'Storage quota exceeded. Unable to save.';
      render(<StatusBar />);
      expect(screen.getByTestId('status-storage-error')).toBeInTheDocument();
      expect(screen.getByTestId('status-storage-error')).toHaveTextContent(
        'Storage quota exceeded. Unable to save.',
      );
    });

    it('shows storage error with red text styling', () => {
      fileState.storageError = 'Failed to save.';
      render(<StatusBar />);
      const errorEl = screen.getByTestId('status-storage-error');
      expect(errorEl.className).toContain('text-red-500');
    });

    it('auto-clears storage error after 5 seconds', () => {
      fileState.storageError = 'Temporary error';
      render(<StatusBar />);

      // Error should be visible initially
      expect(screen.getByTestId('status-storage-error')).toBeInTheDocument();

      // Advance 4.9 seconds — error should still be visible
      vi.advanceTimersByTime(4900);
      expect(screen.getByTestId('status-storage-error')).toBeInTheDocument();

      // Advance past 5 seconds — clearStorageError should have been called
      vi.advanceTimersByTime(200);
      expect(fileState.clearStorageError).toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-47/48: Grid and snap status tests                               */
  /* ------------------------------------------------------------------ */

  describe('ME-47/48 grid and snap status', () => {
    it('shows Grid: ON when gridEnabled is true', () => {
      editorState.gridEnabled = true;
      render(<StatusBar />);
      expect(screen.getByTestId('status-grid')).toHaveTextContent('Grid: ON');
    });

    it('shows Grid: OFF when gridEnabled is false', () => {
      editorState.gridEnabled = false;
      render(<StatusBar />);
      expect(screen.getByTestId('status-grid')).toHaveTextContent('Grid: OFF');
    });

    it('shows Snap: ON when snapEnabled is true', () => {
      editorState.snapEnabled = true;
      render(<StatusBar />);
      expect(screen.getByTestId('status-snap')).toHaveTextContent('Snap: ON');
    });

    it('shows Snap: OFF when snapEnabled is false', () => {
      editorState.snapEnabled = false;
      render(<StatusBar />);
      expect(screen.getByTestId('status-snap')).toHaveTextContent('Snap: OFF');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-27/28: Generalization hints in status bar                       */
  /* ------------------------------------------------------------------ */

  describe('ME-27/28 generalization hints', () => {
    it('shows generalization hint to click a parent Type when no parent selected', () => {
      editorState.currentTool = 'generalization';
      editorState.generalizationParentId = null;
      render(<StatusBar />);
      expect(screen.getByTestId('status-generalization-hint')).toHaveTextContent(
        'Click a parent Type first to create a generalization container.',
      );
    });

    it('shows generalization hint to click empty canvas when parent is selected', () => {
      editorState.currentTool = 'generalization';
      editorState.generalizationParentId = 'type-1';
      render(<StatusBar />);
      expect(screen.getByTestId('status-generalization-hint')).toHaveTextContent(
        'Click empty canvas to place generalization container.',
      );
    });

    it('does not show generalization hint when not in generalization mode', () => {
      editorState.currentTool = 'select';
      editorState.generalizationParentId = null;
      render(<StatusBar />);
      expect(screen.queryByTestId('status-generalization-hint')).not.toBeInTheDocument();
    });

    it('does not show generalization hint when switching to select mode after having a parent', () => {
      editorState.currentTool = 'select';
      editorState.generalizationParentId = 'type-1';
      render(<StatusBar />);
      expect(screen.queryByTestId('status-generalization-hint')).not.toBeInTheDocument();
    });
  });
});
