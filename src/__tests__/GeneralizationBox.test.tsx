import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import GeneralizationBox from '../components/Canvas/GeneralizationBox';
import type { GeneralizationElement, Layout } from '../models/diagram';
import { getStage } from './testHelpers';
import type { Group } from 'konva/lib/Group';

const sampleElement: GeneralizationElement = {
  id: 'test-gen-1',
  type: 'generalization',
  name: 'Payment',
  childIds: ['credit-card', 'paypal'],
  parentId: null,
  completeness: 'complete',
  layout: { x: 200, y: 300, width: 200, height: 80 },
};

describe('GeneralizationBox', () => {
  it('renders without crashing inside a Konva Stage', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <GeneralizationBox
            element={sampleElement}
            parentLayout={null}
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
          <GeneralizationBox
            element={sampleElement}
            parentLayout={null}
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
          <GeneralizationBox
            element={sampleElement}
            parentLayout={null}
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
      group.x(300);
      group.y(400);
      group.fire('dragend');
    });

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledWith(sampleElement.id, 300, 400);
  });

  it('renders connection line when parentLayout is provided', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();
    const parentLayout: Layout = {
      x: 100,
      y: 100,
      width: 180,
      height: 60,
    };

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <GeneralizationBox
            element={sampleElement}
            parentLayout={parentLayout}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );
    expect(container).toBeTruthy();
  });

  it('renders incomplete completeness with extra line', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();
    const incompleteElement: GeneralizationElement = {
      ...sampleElement,
      completeness: 'incomplete',
    };

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <GeneralizationBox
            element={incompleteElement}
            parentLayout={null}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );
    expect(container).toBeTruthy();
  });

  it('has one more child for incomplete completeness (extra inner line)', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    // Render complete
    const completeElement = { ...sampleElement, completeness: 'complete' as const };
    const { unmount } = render(
      <Stage width={800} height={600}>
        <Layer>
          <GeneralizationBox
            element={completeElement}
            parentLayout={null}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    const layer = stage.getLayers()[0];
    const completeChildren = (layer.getChildren()[0] as unknown as Group).getChildren().length;
    unmount();

    // Render incomplete
    const incompleteElement = { ...sampleElement, completeness: 'incomplete' as const };
    render(
      <Stage width={800} height={600}>
        <Layer>
          <GeneralizationBox
            element={incompleteElement}
            parentLayout={null}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage2 = getStage();
    const layer2 = stage2.getLayers()[0];
    const incompleteChildren = (layer2.getChildren()[0] as unknown as Group).getChildren().length;

    // Incomplete has one extra Line for the inner bottom stroke
    expect(incompleteChildren).toBe(completeChildren + 1);
  });

  it('renders connection line as a Line child when parentLayout is provided', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();
    const parentLayout: Layout = {
      x: 100, y: 100, width: 180, height: 60,
    };

    render(
      <Stage width={800} height={600}>
        <Layer>
          <GeneralizationBox
            element={sampleElement}
            parentLayout={parentLayout}
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
    const lineChildren = (group as unknown as { getChildren: (filter?: unknown) => Array<{ getClassName: () => string }> }).getChildren().filter(
      (n) => n.getClassName() === 'Line',
    );

    // Should have at least one Line (the connection line)
    expect(lineChildren.length).toBeGreaterThanOrEqual(1);
  });
});
