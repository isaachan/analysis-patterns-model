import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import GridLayer from '../components/Canvas/GridLayer';
import { getStage } from './testHelpers';

// Mock the editor store so we can control gridEnabled.
const mockGridEnabled = vi.hoisted(() => ({ current: true }));

vi.mock('../store/useEditorStore', () => ({
  useEditorStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      gridEnabled: mockGridEnabled.current,
      selectedIds: [],
      zoom: 1,
      panX: 0,
      panY: 0,
      select: vi.fn(),
      deselectAll: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

describe('GridLayer', () => {
  beforeEach(() => {
    mockGridEnabled.current = true;
  });

  it('renders without crashing inside a Konva Stage', () => {
    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <GridLayer width={800} height={600} />
        </Layer>
      </Stage>,
    );
    expect(container).toBeTruthy();
  });

  it('generates the correct number of grid dots for 200x200 with 20px grid', () => {
    render(
      <Stage width={200} height={200}>
        <Layer>
          <GridLayer width={200} height={200} />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];

    // GRID_SIZE = 20, so ceil(200/20)+1 = 11 columns, 11 rows = 121 dots.
    const circles = layer.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
    );
    expect(circles.length).toBe(121);
  });

  it('renders zero dots when grid is disabled', () => {
    mockGridEnabled.current = false;

    render(
      <Stage width={200} height={200}>
        <Layer>
          <GridLayer width={200} height={200} />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];

    const circles = layer.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
    );
    expect(circles.length).toBe(0);
  });

  it('renders a transparent background Rect to catch pointer events', () => {
    render(
      <Stage width={400} height={300}>
        <Layer>
          <GridLayer width={400} height={300} />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];

    const rects = layer.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Rect',
    );
    expect(rects.length).toBeGreaterThanOrEqual(1);

    const bgRect = rects[rects.length - 1] as {
      width: () => number;
      height: () => number;
      listening: () => boolean;
    };
    expect(bgRect.width()).toBe(400);
    expect(bgRect.height()).toBe(300);
    expect(bgRect.listening()).toBe(true);
  });

  it('handles zero dimensions gracefully', () => {
    render(
      <Stage width={0} height={0}>
        <Layer>
          <GridLayer width={0} height={0} />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];

    // ceil(0/20) + 1 = 1 column, 1 row = 1 dot.
    const circles = layer.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
    );
    expect(circles.length).toBe(1);
  });

  it('handles very small dimensions (e.g., 1x1)', () => {
    render(
      <Stage width={1} height={1}>
        <Layer>
          <GridLayer width={1} height={1} />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];

    // ceil(1/20) + 1 = 2, so 2x2 = 4 dots.
    const circles = layer.getChildren(
      (n) => (n as { getClassName: () => string }).getClassName() === 'Circle',
    );
    expect(circles.length).toBe(4);
  });
});
