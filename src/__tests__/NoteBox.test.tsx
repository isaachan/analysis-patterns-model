import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import NoteBox from '../components/Canvas/NoteBox';
import type { NoteElement } from '../models/diagram';
import { getStage } from './testHelpers';

const sampleElement: NoteElement = {
  id: 'test-note-1',
  type: 'note',
  content: 'This is a test note',
  layout: { x: 50, y: 50, width: 200, height: 70 },
};

describe('NoteBox', () => {
  it('renders without crashing inside a Konva Stage', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <NoteBox
            element={sampleElement}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );
    expect(container).toBeTruthy();
  });

  it('triggers onSelect callback when the group is clicked', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <Stage width={800} height={600}>
        <Layer>
          <NoteBox
            element={sampleElement}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    act(() => {
      group.fire('click');
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleElement.id);
  });

  it('triggers onDragEnd callback with new coordinates', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <Stage width={800} height={600}>
        <Layer>
          <NoteBox
            element={sampleElement}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    act(() => {
      group.x(120);
      group.y(180);
      group.fire('dragend');
    });

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledWith(sampleElement.id, 120, 180);
  });
});
