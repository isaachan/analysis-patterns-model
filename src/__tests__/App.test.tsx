import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

/* ------------------------------------------------------------------ */
/*  Hoisted mock references                                            */
/* ------------------------------------------------------------------ */

const mockHooks = vi.hoisted(() => ({
  useAutoSave: vi.fn(),
  useKeyboard: vi.fn(),
}));

const editorState = vi.hoisted(() => ({
  currentTool: 'select' as string,
  selectedIds: [] as string[],
  hoveredId: null as string | null,
  zoom: 1,
  panX: 0,
  panY: 0,
  gridEnabled: true,
  snapEnabled: true,
  isDragging: false,
  setTool: vi.fn(),
  select: vi.fn(),
  deselectAll: vi.fn(),
  setZoom: vi.fn(),
  setPan: vi.fn(),
  resetView: vi.fn(),
  setHoveredId: vi.fn(),
  setGridEnabled: vi.fn(),
  setSnapEnabled: vi.fn(),
}));

const diagramState = vi.hoisted(() => ({
  version: '1.0.0',
  metadata: { title: 'Untitled Diagram', createdAt: 0, updatedAt: 0 },
  elements: [] as unknown[],
  addElement: vi.fn(),
  updateElement: vi.fn(),
  deleteElement: vi.fn(),
  setElements: vi.fn(),
  clearAll: vi.fn(),
}));

const historyState = vi.hoisted(() => ({
  past: [] as unknown[],
  future: [] as unknown[],
  maxSize: 100,
  push: vi.fn(),
  undo: vi.fn(() => null),
  redo: vi.fn(() => null),
  canUndo: vi.fn(() => false),
  canRedo: vi.fn(() => false),
  clear: vi.fn(),
}));

const fileState = vi.hoisted(() => ({
  currentFileId: 'file-1',
  files: [{ id: 'file-1', title: 'Diagram 1', createdAt: 100, updatedAt: 200 }],
  storageError: null as string | null,
  loadInitialFile: vi.fn(),
  newFile: vi.fn(),
  saveCurrentFile: vi.fn(),
  loadFile: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  clearStorageError: vi.fn(),
  setCurrentFile: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Store mocks                                                       */
/* ------------------------------------------------------------------ */

vi.mock('../store/useEditorStore', () => ({
  useEditorStore: vi.fn(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      if (selector) return selector(editorState as unknown as Record<string, unknown>);
      return editorState;
    },
  ),
}));

vi.mock('../store/useDiagramStore', () => ({
  useDiagramStore: vi.fn(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      if (selector) return selector(diagramState as unknown as Record<string, unknown>);
      return diagramState;
    },
  ),
}));

vi.mock('../store/useHistoryStore', () => ({
  useHistoryStore: vi.fn(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      if (selector) return selector(historyState as unknown as Record<string, unknown>);
      return historyState;
    },
  ),
}));

vi.mock('../store/useFileStore', () => ({
  useFileStore: vi.fn(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      if (selector) return selector(fileState as unknown as Record<string, unknown>);
      return fileState;
    },
  ),
}));

vi.mock('../hooks/useAutoSave', () => ({
  useAutoSave: mockHooks.useAutoSave,
}));

vi.mock('../hooks/useKeyboard', () => ({
  useKeyboard: mockHooks.useKeyboard,
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('App layout (ME-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all five layout zones', () => {
    render(<App />);

    // Zone 1: Top toolbar
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();

    // Zone 2: Left sidebar with element selection
    expect(screen.getByTestId('left-sidebar')).toBeInTheDocument();

    // Zone 3: Central canvas area
    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();

    // Zone 4: Right sidebar with property configuration
    expect(screen.getByTestId('right-sidebar')).toBeInTheDocument();

    // Zone 5: Bottom status bar
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('renders the AME brand in the toolbar', () => {
    render(<App />);
    expect(screen.getByText('AME')).toBeInTheDocument();
  });

  it('renders ZoomControls as an overlay on the canvas', () => {
    render(<App />);
    expect(screen.getByTestId('zoom-controls')).toBeInTheDocument();
  });

  it('renders Elements header in the left sidebar', () => {
    render(<App />);
    expect(screen.getByText('Elements')).toBeInTheDocument();
  });

  it('renders Properties header in the right sidebar', () => {
    render(<App />);
    expect(screen.getByText('Properties')).toBeInTheDocument();
  });

  it('renders toolbar action buttons', () => {
    render(<App />);
    expect(screen.getByTitle('New')).toBeInTheDocument();
    expect(screen.getByTitle('Save')).toBeInTheDocument();
    expect(screen.getByTitle('Undo')).toBeInTheDocument();
    expect(screen.getByTitle('Redo')).toBeInTheDocument();
    expect(screen.getByTitle('Export PNG')).toBeInTheDocument();
    expect(screen.getByTitle('Export JSON')).toBeInTheDocument();
  });

  it('renders all five modeling element tools in the left sidebar', () => {
    render(<App />);
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Association/Mapping')).toBeInTheDocument();
    expect(screen.getByText('Generalization')).toBeInTheDocument();
    expect(screen.getByText('Short Semantic Statement')).toBeInTheDocument();
    expect(screen.getByText('Long Semantic Statement')).toBeInTheDocument();
  });

  it('renders zoom controls with zoom in, zoom out, and reset', () => {
    render(<App />);
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Reset zoom to 100%')).toBeInTheDocument();
  });

  it('renders status bar with tool, element count, and zoom info', () => {
    render(<App />);
    expect(screen.getByTestId('status-tool')).toBeInTheDocument();
    expect(screen.getByTestId('status-elements')).toBeInTheDocument();
    expect(screen.getByTestId('status-zoom')).toBeInTheDocument();
  });

  it('has proper flex layout structure', () => {
    const { container } = render(<App />);
    const rootDiv = container.firstChild as HTMLElement;
    // Root is a full-screen column flex container
    expect(rootDiv.className).toContain('flex');
    expect(rootDiv.className).toContain('h-screen');
    expect(rootDiv.className).toContain('w-screen');
    expect(rootDiv.className).toContain('flex-col');
    expect(rootDiv.className).toContain('overflow-hidden');

    // The main content area should be a row flex container with left sidebar, canvas, right sidebar
    const header = rootDiv.querySelector('header');
    const footer = rootDiv.querySelector('footer');
    const mainContent = rootDiv.querySelector('.flex-1.overflow-hidden')?.parentElement;

    expect(header).toBeTruthy();
    expect(footer).toBeTruthy();
    expect(mainContent).toBeTruthy();

    // Left sidebar should be width w-56 (224px)
    const leftSidebar = rootDiv.querySelector('aside');
    expect(leftSidebar?.className).toContain('w-56');

    // Right sidebar should be width w-64 (256px)
    const rightSidebars = rootDiv.querySelectorAll('aside');
    expect(rightSidebars.length).toBe(2);
    expect(rightSidebars[1].className).toContain('w-64');
  });

  it('renders the status bar at the bottom with tool, elements, and zoom info', () => {
    render(<App />);
    const statusBar = screen.getByTestId('status-bar');
    expect(statusBar).toBeInTheDocument();
    expect(statusBar.textContent).toContain('Tool:');
    expect(statusBar.textContent).toContain('Elements:');
    expect(statusBar.textContent).toContain('Zoom:');
  });

  /* ------------------------------------------------------------------ */
  /*  ME-46: Auto-save & initial file load                               */
  /* ------------------------------------------------------------------ */

  describe('ME-46 auto-save and initial load', () => {
    it('calls useAutoSave and useKeyboard hooks', () => {
      render(<App />);
      expect(mockHooks.useAutoSave).toHaveBeenCalled();
      expect(mockHooks.useKeyboard).toHaveBeenCalled();
    });

    it('calls loadInitialFile on mount', () => {
      render(<App />);
      expect(fileState.loadInitialFile).toHaveBeenCalledOnce();
    });
  });
});
