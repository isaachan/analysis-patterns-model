import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeftSidebar from '../components/LeftSidebar/LeftSidebar';

/* ------------------------------------------------------------------ */
/*  Mock store                                                         */
/* ------------------------------------------------------------------ */

const editorState = vi.hoisted(() => ({
  currentTool: 'select' as string,
  setTool: vi.fn(),
}));

vi.mock('../store/useEditorStore', () => ({
  useEditorStore: vi.fn((selector?: (state: unknown) => unknown) => {
    if (selector) return selector(editorState);
    return editorState;
  }),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('LeftSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorState.currentTool = 'select';
  });

  it('renders without crashing', () => {
    const { container } = render(<LeftSidebar />);
    expect(container).toBeTruthy();
  });

  it('renders the Elements header', () => {
    render(<LeftSidebar />);
    expect(screen.getByText('Elements')).toBeInTheDocument();
  });

  it('renders all five modeling elements', () => {
    render(<LeftSidebar />);
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Association/Mapping')).toBeInTheDocument();
    expect(screen.getByText('Generalization')).toBeInTheDocument();
    expect(screen.getByText('Short Semantic Statement')).toBeInTheDocument();
    expect(screen.getByText('Long Semantic Statement')).toBeInTheDocument();
  });

  it('each tool button has the correct Chinese tooltip', () => {
    render(<LeftSidebar />);

    expect(screen.getByTestId('tool-item-type')).toHaveAttribute('title', '创建Type节点');
    expect(screen.getByTestId('tool-item-relation')).toHaveAttribute('title', '创建两个Type之间的Association/Mapping连线');
    expect(screen.getByTestId('tool-item-generalization')).toHaveAttribute('title', '创建类型泛化划分容器');
    expect(screen.getByTestId('tool-item-short-statement')).toHaveAttribute('title', '添加短语义标记');
    expect(screen.getByTestId('tool-item-long-statement')).toHaveAttribute('title', '添加长语义便签');
  });

  it('clicking Type calls setTool with "type"', async () => {
    const user = userEvent.setup();
    render(<LeftSidebar />);

    await user.click(screen.getByTestId('tool-item-type'));
    expect(editorState.setTool).toHaveBeenCalledWith('type');
  });

  it('clicking Association/Mapping calls setTool with "relation"', async () => {
    const user = userEvent.setup();
    render(<LeftSidebar />);

    await user.click(screen.getByTestId('tool-item-relation'));
    expect(editorState.setTool).toHaveBeenCalledWith('relation');
  });

  it('clicking Generalization calls setTool with "generalization"', async () => {
    const user = userEvent.setup();
    render(<LeftSidebar />);

    await user.click(screen.getByTestId('tool-item-generalization'));
    expect(editorState.setTool).toHaveBeenCalledWith('generalization');
  });

  it('clicking Short Semantic Statement calls setTool with "short-semantic"', async () => {
    const user = userEvent.setup();
    render(<LeftSidebar />);

    await user.click(screen.getByTestId('tool-item-short-statement'));
    expect(editorState.setTool).toHaveBeenCalledWith('short-semantic');
  });

  it('clicking Long Semantic Statement calls setTool with "long-semantic"', async () => {
    const user = userEvent.setup();
    render(<LeftSidebar />);

    await user.click(screen.getByTestId('tool-item-long-statement'));
    expect(editorState.setTool).toHaveBeenCalledWith('long-semantic');
  });

  it('highlights Type button when current tool is "type"', () => {
    editorState.currentTool = 'type';
    render(<LeftSidebar />);

    const typeButton = screen.getByTestId('tool-item-type');
    const relationButton = screen.getByTestId('tool-item-relation');

    // The active button has bg-[#0071e3] class which maps to text white
    expect(typeButton.className).toContain('text-white');
    expect(relationButton.className).not.toContain('text-white');
  });

  it('highlights Association/Mapping button when current tool is "relation"', () => {
    editorState.currentTool = 'relation';
    render(<LeftSidebar />);

    const relationButton = screen.getByTestId('tool-item-relation');
    expect(relationButton.className).toContain('text-white');
  });

  it('highlights Generalization button when current tool is "generalization"', () => {
    editorState.currentTool = 'generalization';
    render(<LeftSidebar />);

    const genButton = screen.getByTestId('tool-item-generalization');
    expect(genButton.className).toContain('text-white');
  });

  it('highlights Short Semantic Statement button when current tool is "short-semantic"', () => {
    editorState.currentTool = 'short-semantic';
    render(<LeftSidebar />);

    const shortButton = screen.getByTestId('tool-item-short-statement');
    const longButton = screen.getByTestId('tool-item-long-statement');
    expect(shortButton.className).toContain('text-white');
    expect(longButton.className).not.toContain('text-white');
  });

  it('highlights Long Semantic Statement button when current tool is "long-semantic"', () => {
    editorState.currentTool = 'long-semantic';
    render(<LeftSidebar />);

    const shortButton = screen.getByTestId('tool-item-short-statement');
    const longButton = screen.getByTestId('tool-item-long-statement');
    expect(shortButton.className).not.toContain('text-white');
    expect(longButton.className).toContain('text-white');
  });

  it('no button is highlighted when tool is "select"', () => {
    editorState.currentTool = 'select';
    render(<LeftSidebar />);

    const toolItems = [
      'tool-item-type',
      'tool-item-relation',
      'tool-item-generalization',
      'tool-item-short-statement',
      'tool-item-long-statement',
    ];
    for (const testId of toolItems) {
      const btn = screen.getByTestId(testId);
      expect(btn.className).not.toContain('text-white');
    }
  });
});
