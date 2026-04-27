import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Konva from 'konva';
import Toolbar from '../components/Toolbar/Toolbar';

/* ------------------------------------------------------------------ */
/*  Mock stores                                                        */
/* ------------------------------------------------------------------ */

const historyState = vi.hoisted(() => ({
  canUndo: vi.fn(() => false),
  canRedo: vi.fn(() => false),
  undo: vi.fn(() => null),
  redo: vi.fn(() => null),
  clear: vi.fn(),
}));

const diagramState = vi.hoisted(() => ({
  clearAll: vi.fn(),
  setElements: vi.fn(),
  deleteSelectedElements: vi.fn(),
  version: '1.0.0',
  metadata: { title: 'Test', createdAt: 0, updatedAt: 0 },
  elements: [] as unknown[],
}));

const editorState = vi.hoisted(() => ({
  selectedIds: [] as string[],
  gridEnabled: true,
  snapEnabled: true,
  setGridEnabled: vi.fn(),
  setSnapEnabled: vi.fn(),
}));

const fileState = vi.hoisted(() => ({
  currentFileId: 'file-1',
  files: [
    { id: 'file-1', title: 'Diagram 1', createdAt: 100, updatedAt: 300 },
    { id: 'file-2', title: 'Diagram 2', createdAt: 200, updatedAt: 200 },
  ],
  storageError: null as string | null,
  newFile: vi.fn(),
  saveCurrentFile: vi.fn(),
  loadFile: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  clearStorageError: vi.fn(),
  setCurrentFile: vi.fn(),
  loadInitialFile: vi.fn(),
}));

vi.mock('../store/useHistoryStore', () => ({
  useHistoryStore: vi.fn((selector?: (state: unknown) => unknown) => {
    if (selector) return selector(historyState);
    return historyState;
  }),
}));

vi.mock('../store/useDiagramStore', () => ({
  useDiagramStore: Object.assign(
    vi.fn((selector?: (state: unknown) => unknown) => {
      if (selector) return selector(diagramState);
      return diagramState;
    }),
    { getState: vi.fn(() => diagramState) },
  ),
}));

vi.mock('../store/useEditorStore', () => ({
  useEditorStore: vi.fn((selector?: (state: unknown) => unknown) => {
    if (selector) return selector(editorState);
    return editorState;
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

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historyState.canUndo.mockReturnValue(false);
    historyState.canRedo.mockReturnValue(false);
    historyState.undo.mockReturnValue(null);
    historyState.redo.mockReturnValue(null);
    fileState.currentFileId = 'file-1';
    fileState.files = [
      { id: 'file-1', title: 'Diagram 1', createdAt: 100, updatedAt: 300 },
      { id: 'file-2', title: 'Diagram 2', createdAt: 200, updatedAt: 200 },
    ];
    // Clear any existing Konva stages (none in test environment, but be safe)
    Konva.stages.length = 0;
  });

  it('renders without crashing', () => {
    const { container } = render(<Toolbar />);
    expect(container).toBeTruthy();
  });

  it('renders the AME logo and brand', () => {
    render(<Toolbar />);
    expect(screen.getByText('AME')).toBeInTheDocument();
  });

  it('renders all toolbar action buttons', () => {
    render(<Toolbar />);

    expect(screen.getByTitle('New')).toBeInTheDocument();
    expect(screen.getByTitle('Save')).toBeInTheDocument();
    expect(screen.getByTitle('Undo')).toBeInTheDocument();
    expect(screen.getByTitle('Redo')).toBeInTheDocument();
    expect(screen.getByTitle('Export PNG')).toBeInTheDocument();
    expect(screen.getByTitle('Export JSON')).toBeInTheDocument();
  });

  it('undo button is disabled when canUndo returns false', () => {
    render(<Toolbar />);
    const undoButton = screen.getByTitle('Undo');
    expect(undoButton).toBeDisabled();
  });

  it('undo button is enabled when canUndo returns true', () => {
    historyState.canUndo.mockReturnValue(true);
    render(<Toolbar />);
    const undoButton = screen.getByTitle('Undo');
    expect(undoButton).toBeEnabled();
  });

  it('redo button is disabled when canRedo returns false', () => {
    render(<Toolbar />);
    const redoButton = screen.getByTitle('Redo');
    expect(redoButton).toBeDisabled();
  });

  it('redo button is enabled when canRedo returns true', () => {
    historyState.canRedo.mockReturnValue(true);
    render(<Toolbar />);
    const redoButton = screen.getByTitle('Redo');
    expect(redoButton).toBeEnabled();
  });

  it('calls undo when undo button is clicked', async () => {
    historyState.canUndo.mockReturnValue(true);
    const user = userEvent.setup();
    render(<Toolbar />);

    await user.click(screen.getByTitle('Undo'));
    expect(historyState.undo).toHaveBeenCalledOnce();
  });

  it('calls redo when redo button is clicked', async () => {
    historyState.canRedo.mockReturnValue(true);
    const user = userEvent.setup();
    render(<Toolbar />);

    await user.click(screen.getByTitle('Redo'));
    expect(historyState.redo).toHaveBeenCalledOnce();
  });

  it('undo restores elements from returned state', async () => {
    historyState.canUndo.mockReturnValue(true);
    const mockState = { elements: [{ id: 'el1' }] };
    historyState.undo.mockReturnValue(mockState as never);
    const user = userEvent.setup();

    render(<Toolbar />);
    await user.click(screen.getByTitle('Undo'));

    expect(diagramState.setElements).toHaveBeenCalledWith(mockState.elements);
  });

  it('undo does not call setElements when no state is returned', async () => {
    historyState.canUndo.mockReturnValue(true);
    historyState.undo.mockReturnValue(null as never);
    const user = userEvent.setup();

    render(<Toolbar />);
    await user.click(screen.getByTitle('Undo'));

    expect(diagramState.setElements).not.toHaveBeenCalled();
  });

  it('redo restores elements from returned state', async () => {
    historyState.canRedo.mockReturnValue(true);
    const mockState = { elements: [{ id: 'el1' }] };
    historyState.redo.mockReturnValue(mockState as never);
    const user = userEvent.setup();

    render(<Toolbar />);
    await user.click(screen.getByTitle('Redo'));

    expect(diagramState.setElements).toHaveBeenCalledWith(mockState.elements);
  });

  /* ------------------------------------------------------------------ */
  /*  ME-45: New file                                                    */
  /* ------------------------------------------------------------------ */

  describe('ME-45 new file', () => {
    it('calls clearAll, clear, and newFile when New button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('New'));

      expect(diagramState.clearAll).toHaveBeenCalledOnce();
      expect(historyState.clear).toHaveBeenCalledOnce();
      expect(fileState.newFile).toHaveBeenCalledOnce();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-46: Save button                                                 */
  /* ------------------------------------------------------------------ */

  describe('ME-46 save', () => {
    it('calls saveCurrentFile when Save button is clicked', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('Save'));
      expect(fileState.saveCurrentFile).toHaveBeenCalledOnce();
    });
  });

  it('new, save, and export buttons are not disabled', () => {
    render(<Toolbar />);
    expect(screen.getByTitle('New')).toBeEnabled();
    expect(screen.getByTitle('Save')).toBeEnabled();
    expect(screen.getByTitle('Export PNG')).toBeEnabled();
    expect(screen.getByTitle('Export JSON')).toBeEnabled();
  });

  /* ------------------------------------------------------------------ */
  /*  ME-40: Delete button tests                                         */
  /* ------------------------------------------------------------------ */

  describe('ME-40 delete button', () => {
    it('renders the Delete button', () => {
      render(<Toolbar />);
      expect(screen.getByTitle('Delete')).toBeInTheDocument();
    });

    it('delete button is disabled when nothing is selected', () => {
      editorState.selectedIds = [];
      render(<Toolbar />);
      expect(screen.getByTitle('Delete')).toBeDisabled();
    });

    it('delete button is enabled when elements are selected', () => {
      editorState.selectedIds = ['type-1'];
      render(<Toolbar />);
      expect(screen.getByTitle('Delete')).toBeEnabled();
    });

    it('calls deleteSelectedElements with selectedIds when clicked', async () => {
      editorState.selectedIds = ['type-1', 'rel-1'];
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('Delete'));
      expect(diagramState.deleteSelectedElements).toHaveBeenCalledWith(['type-1', 'rel-1']);
    });

    it('does not call deleteSelectedElements when clicked with no selection', async () => {
      editorState.selectedIds = [];
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('Delete'));
      expect(diagramState.deleteSelectedElements).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-47/48: Grid and snap toggle tests                               */
  /* ------------------------------------------------------------------ */

  describe('ME-47/48 grid and snap toggles', () => {
    beforeEach(() => {
      editorState.gridEnabled = true;
      editorState.snapEnabled = true;
      vi.clearAllMocks();
    });

    it('renders grid toggle button with title "Hide Grid" when grid is enabled', () => {
      editorState.gridEnabled = true;
      render(<Toolbar />);
      expect(screen.getByTitle('Hide Grid')).toBeInTheDocument();
    });

    it('renders grid toggle button with title "Show Grid" when grid is disabled', () => {
      editorState.gridEnabled = false;
      render(<Toolbar />);
      expect(screen.getByTitle('Show Grid')).toBeInTheDocument();
    });

    it('calls setGridEnabled(false) when grid button clicked while enabled', async () => {
      editorState.gridEnabled = true;
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('Hide Grid'));
      expect(editorState.setGridEnabled).toHaveBeenCalledWith(false);
    });

    it('calls setGridEnabled(true) when grid button clicked while disabled', async () => {
      editorState.gridEnabled = false;
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('Show Grid'));
      expect(editorState.setGridEnabled).toHaveBeenCalledWith(true);
    });

    it('renders snap toggle button with title "Disable Snap" when snap is enabled', () => {
      editorState.snapEnabled = true;
      render(<Toolbar />);
      expect(screen.getByTitle('Disable Snap')).toBeInTheDocument();
    });

    it('renders snap toggle button with title "Enable Snap" when snap is disabled', () => {
      editorState.snapEnabled = false;
      render(<Toolbar />);
      expect(screen.getByTitle('Enable Snap')).toBeInTheDocument();
    });

    it('calls setSnapEnabled(false) when snap button clicked while enabled', async () => {
      editorState.snapEnabled = true;
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('Disable Snap'));
      expect(editorState.setSnapEnabled).toHaveBeenCalledWith(false);
    });

    it('calls setSnapEnabled(true) when snap button clicked while disabled', async () => {
      editorState.snapEnabled = false;
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('Enable Snap'));
      expect(editorState.setSnapEnabled).toHaveBeenCalledWith(true);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-51: File selector / switching                                   */
  /* ------------------------------------------------------------------ */

  describe('ME-51 file selector', () => {
    it('shows current file name', () => {
      render(<Toolbar />);
      expect(screen.getByTestId('file-selector-button')).toHaveTextContent('Diagram 1');
    });

    it('opens dropdown when clicking file selector button', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTestId('file-selector-button'));
      expect(screen.getByTestId('file-dropdown')).toBeInTheDocument();
    });

    it('shows all files in the dropdown', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTestId('file-selector-button'));

      expect(screen.getByTestId('file-dropdown')).toHaveTextContent('Diagram 1');
      expect(screen.getByTestId('file-dropdown')).toHaveTextContent('Diagram 2');
    });

    it('highlights the current file in the dropdown', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTestId('file-selector-button'));

      const currentItem = screen.getByTestId('file-item-file-1');
      expect(currentItem.className).toContain('bg-blue-50');
      expect(currentItem.className).toContain('text-[#0071e3]');
    });

    it('calls loadFile when selecting a different file', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTestId('file-selector-button'));
      await user.click(screen.getByTestId('file-item-file-2'));

      expect(fileState.loadFile).toHaveBeenCalledWith('file-2');
    });

    it('has a "New file" entry in the dropdown', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTestId('file-selector-button'));
      expect(screen.getByTestId('file-dropdown-new')).toBeInTheDocument();
      expect(screen.getByTestId('file-dropdown-new')).toHaveTextContent('New file');
    });

    it('calls newFile when clicking "New file" in dropdown', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTestId('file-selector-button'));
      await user.click(screen.getByTestId('file-dropdown-new'));

      expect(fileState.newFile).toHaveBeenCalledOnce();
    });

    it('displays files sorted by updatedAt descending in dropdown', async () => {
      fileState.files = [
        { id: 'file-3', title: 'Oldest', createdAt: 100, updatedAt: 100 },
        { id: 'file-1', title: 'Recent', createdAt: 200, updatedAt: 300 },
        { id: 'file-2', title: 'Middle', createdAt: 150, updatedAt: 200 },
      ];
      fileState.currentFileId = 'file-1';

      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTestId('file-selector-button'));

      // The dropdown should list items; we verify by checking the order of rendering
      const dropdown = screen.getByTestId('file-dropdown');
      expect(dropdown.textContent).toMatch(/Recent/);
      // The highest updatedAt (300 = file-1 "Recent") should appear first
      const fileItems = dropdown.querySelectorAll('[data-testid^="file-item-"]');
      expect(fileItems.length).toBe(3);
      // First item should be the most recently updated
      const firstItemTitle = fileItems[0].textContent;
      expect(firstItemTitle).toBe('Recent');
      // Second item should be the middle
      const secondItemTitle = fileItems[1].textContent;
      expect(secondItemTitle).toContain('Middle');
      // Third item should be the oldest
      const thirdItemTitle = fileItems[2].textContent;
      expect(thirdItemTitle).toContain('Oldest');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-52: Rename and delete                                           */
  /* ------------------------------------------------------------------ */

  describe('ME-52 rename', () => {
    it('shows rename input on double-click', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.dblClick(screen.getByTestId('file-selector-button'));
      expect(screen.getByTestId('file-rename-input')).toBeInTheDocument();
    });

    it('pre-fills rename input with current title', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.dblClick(screen.getByTestId('file-selector-button'));
      const input = screen.getByTestId('file-rename-input') as HTMLInputElement;
      expect(input.value).toBe('Diagram 1');
    });

    it('calls renameFile on Enter', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.dblClick(screen.getByTestId('file-selector-button'));
      const input = screen.getByTestId('file-rename-input');
      await user.clear(input);
      await user.type(input, 'Renamed{Enter}');

      expect(fileState.renameFile).toHaveBeenCalledWith('file-1', 'Renamed');
    });

    it('calls renameFile on blur', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.dblClick(screen.getByTestId('file-selector-button'));
      const input = screen.getByTestId('file-rename-input');
      await user.clear(input);
      await user.type(input, 'Blur Rename');
      await user.click(screen.getByTitle('New')); // Click somewhere else to trigger blur

      expect(fileState.renameFile).toHaveBeenCalledWith('file-1', 'Blur Rename');
    });

    it('does not call renameFile when Escape key is pressed', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.dblClick(screen.getByTestId('file-selector-button'));
      const input = screen.getByTestId('file-rename-input');
      await user.clear(input);
      await user.type(input, 'Cancelled Rename');
      await user.keyboard('{Escape}');

      expect(fileState.renameFile).not.toHaveBeenCalled();
      // Should exit rename mode (rename input no longer visible)
      expect(screen.queryByTestId('file-rename-input')).not.toBeInTheDocument();
    });

    it('does not call renameFile when the new title is empty after trim', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.dblClick(screen.getByTestId('file-selector-button'));
      const input = screen.getByTestId('file-rename-input');
      await user.clear(input);
      await user.type(input, '   '); // Only whitespace
      await user.keyboard('{Enter}');

      // renameFile should NOT be called since trimmed value is empty
      expect(fileState.renameFile).not.toHaveBeenCalled();
    });

    it('does not call renameFile when the new title is unchanged', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.dblClick(screen.getByTestId('file-selector-button'));
      const input = screen.getByTestId('file-rename-input');
      // Default value is 'Diagram 1', type the same thing
      await user.clear(input);
      await user.type(input, 'Diagram 1');
      await user.keyboard('{Enter}');

      // renameFile should NOT be called since title is unchanged
      expect(fileState.renameFile).not.toHaveBeenCalled();
    });
  });

  describe('ME-52 delete file', () => {
    it('shows delete button for each file in the dropdown', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTestId('file-selector-button'));

      expect(screen.getByTestId('file-delete-file-1')).toBeInTheDocument();
      expect(screen.getByTestId('file-delete-file-2')).toBeInTheDocument();
    });

    it('calls deleteFile when delete button is clicked and confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTestId('file-selector-button'));
      await user.click(screen.getByTestId('file-delete-file-2'));

      expect(window.confirm).toHaveBeenCalled();
      expect(fileState.deleteFile).toHaveBeenCalledWith('file-2');
      vi.restoreAllMocks();
    });

    it('does not call deleteFile when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTestId('file-selector-button'));
      await user.click(screen.getByTestId('file-delete-file-2'));

      expect(window.confirm).toHaveBeenCalled();
      expect(fileState.deleteFile).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-49: Export PNG                                                  */
  /* ------------------------------------------------------------------ */

  describe('ME-49 export PNG', () => {
    function setupKonvaStage() {
      const mockToDataURL = vi.fn(() => 'data:image/png;base64,mockpngdata');
      Konva.stages.push({ toDataURL: mockToDataURL } as never);
      return mockToDataURL;
    }

    it('exports PNG button is enabled and clickable', async () => {
      render(<Toolbar />);
      expect(screen.getByTitle('Export PNG')).toBeEnabled();
    });

    it('calls Konva stage.toDataURL with pixelRatio 2 when clicked', async () => {
      const toDataURL = setupKonvaStage();
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('Export PNG'));

      expect(toDataURL).toHaveBeenCalledWith(
        expect.objectContaining({
          pixelRatio: 2,
          mimeType: 'image/png',
        }),
      );
    });

    it('creates a download link with the current title as filename', async () => {
      setupKonvaStage();
      const createElementSpy = vi.spyOn(document, 'createElement');
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('Export PNG'));

      // Find the 'a' element that was created for download
      const anchorCalls = createElementSpy.mock.results.filter(
        (r) => r.value.tagName === 'A',
      );
      expect(anchorCalls.length).toBeGreaterThanOrEqual(1);
      const downloadLink = anchorCalls[0].value as HTMLAnchorElement;
      expect(downloadLink.download).toBe('Diagram 1.png');

      createElementSpy.mockRestore();
    });

    it('does nothing when no Konva stage exists (safety check)', async () => {
      // No stage set up — Konva.stages is empty
      const toDataURL = vi.fn();
      const user = userEvent.setup();
      render(<Toolbar />);

      // Should not throw even without a stage
      await expect(
        user.click(screen.getByTitle('Export PNG')),
      ).resolves.toBeUndefined();
      expect(toDataURL).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-50: Export JSON                                                 */
  /* ------------------------------------------------------------------ */

  describe('ME-50 export JSON', () => {
    it('exports JSON button is enabled and clickable', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);
      expect(screen.getByTitle('Export JSON')).toBeEnabled();
      await user.click(screen.getByTitle('Export JSON'));
      // Should not throw despite jsdom limitations on Blob/URL
      expect(screen.getByTitle('Export JSON')).toBeEnabled();
    });

    it('creates a download link with .json extension and correct filename', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByTitle('Export JSON'));

      // Find anchor elements created for download
      const anchorCalls = createElementSpy.mock.results.filter(
        (r) => r.value.tagName === 'A',
      );
      expect(anchorCalls.length).toBeGreaterThanOrEqual(1);
      const downloadLink = anchorCalls[0].value as HTMLAnchorElement;
      expect(downloadLink.download).toBe('Diagram 1.json');

      createElementSpy.mockRestore();
    });

    it('serialized JSON matches the schema structure (version, metadata, elements)', async () => {
      // Set up diagram state with actual test data
      diagramState.version = '1.0.0';
      diagramState.metadata = { title: 'Diagram 1', createdAt: 100, updatedAt: 300 };
      diagramState.elements = [
        {
          id: 'type-1',
          type: 'type',
          name: 'User',
          attributes: ['name: String'],
          methods: [],
          layout: { x: 10, y: 20, width: 180, height: 80 },
        },
      ];

      // Mock Blob to capture its content
      const originalBlob = globalThis.Blob;
      let capturedParts: unknown[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).Blob = class MockBlob {
        constructor(parts: unknown[], _options?: unknown) {
          capturedParts = parts;
        }
      } as unknown as typeof Blob;

      const user = userEvent.setup();
      render(<Toolbar />);
      await user.click(screen.getByTitle('Export JSON'));

      // Parse the captured blob parts back to JSON
      const jsonString = capturedParts[0] as string;
      const parsed = JSON.parse(jsonString);

      // Verify schema structure
      expect(parsed).toHaveProperty('version', '1.0.0');
      expect(parsed).toHaveProperty('metadata');
      expect(parsed.metadata).toHaveProperty('title', 'Diagram 1');
      expect(parsed.metadata).toHaveProperty('createdAt', 100);
      expect(parsed.metadata).toHaveProperty('updatedAt', 300);
      expect(parsed).toHaveProperty('elements');
      expect(parsed.elements).toHaveLength(1);
      expect(parsed.elements[0]).toHaveProperty('id', 'type-1');
      expect(parsed.elements[0]).toHaveProperty('type', 'type');
      expect(parsed.elements[0]).toHaveProperty('name', 'User');

      // Restore original Blob
      globalThis.Blob = originalBlob;
    });
  });
});
