import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import type { Group as KonvaGroup } from 'konva/lib/Group';
import type { Text as KonvaText } from 'konva/lib/shapes/Text';
import type { Rect as KonvaRect } from 'konva/lib/shapes/Rect';
import TypeNode from '../components/Canvas/TypeNode';
import type { TypeElement } from '../models/diagram';
import { getStage } from './testHelpers';
import { calcTypeNodeWidth, TYPE_NODE_WIDTH, TYPE_NODE_MAX_WIDTH } from '../constants/defaults';
import { COLORS } from '../constants/designTokens';

const sampleElement: TypeElement = {
  id: 'test-type-1',
  type: 'type',
  name: 'TestEntity',
  attributes: ['attr1: string', 'attr2: int'],
  methods: ['doSomething()'],
  layout: { x: 100, y: 100, width: 180, height: 110 },
};

describe('TypeNode', () => {
  it('renders without crashing inside a Konva Stage', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <TypeNode
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

  it('accepts isSelected prop', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    const { container: selectedContainer } = render(
      <Stage width={800} height={600}>
        <Layer>
          <TypeNode
            element={sampleElement}
            isSelected={true}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const { container: unselectedContainer } = render(
      <Stage width={800} height={600}>
        <Layer>
          <TypeNode
            element={sampleElement}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    expect(selectedContainer).toBeTruthy();
    expect(unselectedContainer).toBeTruthy();
  });

  it('triggers onSelect callback when the group is clicked', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <Stage width={800} height={600}>
        <Layer>
          <TypeNode
            element={sampleElement}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    expect(stage).toBeDefined();

    // First layer, first child is the Group created by TypeNode.
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];

    act(() => {
      group.fire('click');
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleElement.id);
  });

  it('triggers onDragEnd callback with new x,y after drag', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <Stage width={800} height={600}>
        <Layer>
          <TypeNode
            element={sampleElement}
            isSelected={false}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
          />
        </Layer>
      </Stage>,
    );

    const stage = getStage();
    expect(stage).toBeDefined();

    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];
    expect(group).toBeDefined();

    const newX = 250;
    const newY = 350;

    act(() => {
      // Simulate Konva's internal position update that happens during drag.
      group.x(newX);
      group.y(newY);
      group.fire('dragend');
    });

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledWith(sampleElement.id, newX, newY);
  });

  /* ------------------------------------------------------------------ */
  /*  ME-8: hover visual feedback and selection highlight                */
  /* ------------------------------------------------------------------ */

  describe('ME-8 hover visual feedback', () => {
    it('changes header fill on mouse enter and reverts on mouse leave', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;

      // There are two Rects: body background (index 0) and header (index 1)
      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      const headerRect = rectNodes[1];

      // Initially, header uses the default typeHeader color
      expect(headerRect.fill()).toBe(COLORS.typeHeader);

      // Simulate mouse enter
      act(() => {
        group.fire('mouseenter');
      });
      expect(headerRect.fill()).toBe(COLORS.hover);

      // Simulate mouse leave
      act(() => {
        group.fire('mouseleave');
      });
      expect(headerRect.fill()).toBe(COLORS.typeHeader);
    });

    it('changes body fill on mouse enter and reverts on mouse leave', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;

      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      const bodyRect = rectNodes[0];

      // Default body fill
      expect(bodyRect.fill()).toBe(COLORS.typeBg);

      // On hover: body gets a subtle blue tint
      act(() => {
        group.fire('mouseenter');
      });
      expect(bodyRect.fill()).toBe('#f0f5ff');

      // Leave revert
      act(() => {
        group.fire('mouseleave');
      });
      expect(bodyRect.fill()).toBe(COLORS.typeBg);
    });

    it('enhances shadow on hover', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;

      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      const bodyRect = rectNodes[0];

      // Default shadow
      expect(bodyRect.shadowBlur()).toBe(6);

      // Enhanced shadow on hover
      act(() => {
        group.fire('mouseenter');
      });
      expect(bodyRect.shadowBlur()).toBe(10);

      // Revert on leave
      act(() => {
        group.fire('mouseleave');
      });
      expect(bodyRect.shadowBlur()).toBe(6);
    });
  });

  describe('ME-8 selection highlight', () => {
    it('shows selection border when isSelected is true', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={true}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      const bodyRect = rectNodes[0];

      // When selected, stroke matches COLORS.selection and width is 2
      expect(bodyRect.stroke()).toBe(COLORS.selection);
      expect(bodyRect.strokeWidth()).toBe(2);
    });

    it('shows default border when not selected', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      const bodyRect = rectNodes[0];

      // When not selected, stroke matches typeBorder and width is 1
      expect(bodyRect.stroke()).toBe(COLORS.typeBorder);
      expect(bodyRect.strokeWidth()).toBe(1);
    });

    it('clicking the group still triggers onSelect', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0];

      act(() => {
        group.fire('click');
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(sampleElement.id);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-7: name centering and auto-sizing tests                         */
  /* ------------------------------------------------------------------ */

  describe('ME-7 name display - centered text', () => {
    it('renders the name Text with the correct content', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      // Use Konva's find method to locate Text descendants
      const textNodes = group.find('Text') as unknown as KonvaText[];
      expect(textNodes.length).toBeGreaterThan(0);
      const nameText = textNodes[0];
      expect(nameText.text()).toBe(sampleElement.name);
    });

    it('applies horizontal center alignment to the name text', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const textNodes = group.find('Text') as unknown as KonvaText[];
      const nameText = textNodes[0];
      expect(nameText.align()).toBe('center');
    });

    it('applies vertical middle alignment to the name text', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const textNodes = group.find('Text') as unknown as KonvaText[];
      const nameText = textNodes[0];
      expect(nameText.verticalAlign()).toBe('middle');
    });

    it('uses a readable font size (13px) for the name text', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const textNodes = group.find('Text') as unknown as KonvaText[];
      const nameText = textNodes[0];
      expect(nameText.fontSize()).toBe(13);
    });

    it('uses bold font style for the name text', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const textNodes = group.find('Text') as unknown as KonvaText[];
      const nameText = textNodes[0];
      expect(nameText.fontStyle()).toBe('bold');
    });

    it('spans the full header width with centered text', () => {
      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const textNodes = group.find('Text') as unknown as KonvaText[];
      const nameText = textNodes[0];
      expect(nameText.width()).toBe(sampleElement.layout.width);
      expect(nameText.x()).toBe(0);
      expect(nameText.y()).toBe(0);
    });
  });

  describe('ME-7 name display - auto-size width', () => {
    it('calcTypeNodeWidth returns minimum width for a short name', () => {
      const width = calcTypeNodeWidth('X');
      expect(width).toBe(TYPE_NODE_WIDTH);
    });

    it('calcTypeNodeWidth returns minimum width for a default name "Type"', () => {
      const width = calcTypeNodeWidth('Type');
      expect(width).toBe(TYPE_NODE_WIDTH);
    });

    it('calcTypeNodeWidth scales width with longer names', () => {
      // 20 chars * 9 + 16 = 196
      const width = calcTypeNodeWidth('ABCDEFGHIJKLMNOPQRST');
      expect(width).toBeGreaterThan(TYPE_NODE_WIDTH);
      expect(width).toBeLessThan(TYPE_NODE_MAX_WIDTH);
    });

    it('calcTypeNodeWidth enforces maximum width for very long names', () => {
      // 100 chars * 9 + 16 = 916, clamped to MAX_WIDTH
      const width = calcTypeNodeWidth('A'.repeat(100));
      expect(width).toBe(TYPE_NODE_MAX_WIDTH);
    });

    it('calcTypeNodeWidth clamps at minimum width for empty string', () => {
      const width = calcTypeNodeWidth('');
      expect(width).toBe(TYPE_NODE_WIDTH);
    });

    it('calcTypeNodeWidth clamps at minimum width for very short Chinese text', () => {
      const width = calcTypeNodeWidth('人');
      expect(width).toBe(TYPE_NODE_WIDTH);
    });

    it('calcTypeNodeWidth enforces maximum width for very long Chinese text', () => {
      // 50 Chinese chars * 9 + 16 = 466, clamped to MAX_WIDTH
      const width = calcTypeNodeWidth('长'.repeat(50));
      expect(width).toBe(TYPE_NODE_MAX_WIDTH);
    });

    it('calcTypeNodeWidth clamps at minimum width for short mixed Chinese/English text', () => {
      const width = calcTypeNodeWidth('客户A');
      expect(width).toBe(TYPE_NODE_WIDTH);
    });

    it('renders a TypeNode with auto-sized width that exceeds minimum', () => {
      const longNameElement: TypeElement = {
        id: 'test-long-name',
        type: 'type',
        name: 'VeryLongTypeNameForTesting',
        attributes: [],
        methods: [],
        layout: {
          x: 50,
          y: 50,
          width: calcTypeNodeWidth('VeryLongTypeNameForTesting'),
          height: 60,
        },
      };

      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={longNameElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      // First Rect is the body background — its width should be the auto-sized width
      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      expect(rectNodes.length).toBeGreaterThan(0);
      const bodyRect = rectNodes[0];
      expect(bodyRect.width()).toBeGreaterThan(TYPE_NODE_WIDTH);
    });

    it('renders a TypeNode with min width for a short name', () => {
      const shortNameElement: TypeElement = {
        id: 'test-short-name',
        type: 'type',
        name: 'A',
        attributes: [],
        methods: [],
        layout: {
          x: 50,
          y: 50,
          width: calcTypeNodeWidth('A'),
          height: 60,
        },
      };

      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={shortNameElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      expect(rectNodes.length).toBeGreaterThan(0);
      const bodyRect = rectNodes[0];
      expect(bodyRect.width()).toBe(TYPE_NODE_WIDTH);
    });

    it('renders a TypeNode with max width for an extremely long name', () => {
      const veryLongName = 'A'.repeat(100);
      const maxNameElement: TypeElement = {
        id: 'test-max-name',
        type: 'type',
        name: veryLongName,
        attributes: [],
        methods: [],
        layout: {
          x: 50,
          y: 50,
          width: calcTypeNodeWidth(veryLongName),
          height: 60,
        },
      };

      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={maxNameElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      expect(rectNodes.length).toBeGreaterThan(0);
      const bodyRect = rectNodes[0];
      expect(bodyRect.width()).toBe(TYPE_NODE_MAX_WIDTH);
    });

    it('renders a TypeNode with Chinese name and displays centered text', () => {
      const chineseElement: TypeElement = {
        id: 'test-chinese',
        type: 'type',
        name: '客户管理子系统',
        attributes: ['customerId: int', 'name: string'],
        methods: [],
        layout: {
          x: 100,
          y: 100,
          width: calcTypeNodeWidth('客户管理子系统'),
          height: 60,
        },
      };

      const onSelect = vi.fn();
      const onDragEnd = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={chineseElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const textNodes = group.find('Text') as unknown as KonvaText[];
      const nameText = textNodes[0];
      expect(nameText.text()).toBe('客户管理子系统');
      expect(nameText.align()).toBe('center');
      expect(nameText.verticalAlign()).toBe('middle');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-13/ME-14: relation source/target highlighting                   */
  /* ------------------------------------------------------------------ */

  describe('ME-13/ME-14 relation source and target highlighting', () => {
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('shows thicker selection-color border when isRelationSource is true', () => {
      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
              isRelationSource={true}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      const bodyRect = rectNodes[0];

      expect(bodyRect.stroke()).toBe(COLORS.selection);
      expect(bodyRect.strokeWidth()).toBe(3);
    });

    it('shows thicker selection-color border when isRelationTarget is true', () => {
      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
              isRelationTarget={true}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      const bodyRect = rectNodes[0];

      expect(bodyRect.stroke()).toBe(COLORS.selection);
      expect(bodyRect.strokeWidth()).toBe(3);
    });

    it('shows blue-tinted body fill when isRelationTarget is true', () => {
      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
              isRelationTarget={true}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      const bodyRect = rectNodes[0];

      expect(bodyRect.fill()).toBe('#e8f4ff');
    });

    it('uses default border when neither source nor target', () => {
      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
              isRelationSource={false}
              isRelationTarget={false}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0] as unknown as KonvaGroup;
      const rectNodes = group.find('Rect') as unknown as KonvaRect[];
      const bodyRect = rectNodes[0];

      expect(bodyRect.stroke()).toBe(COLORS.typeBorder);
      expect(bodyRect.strokeWidth()).toBe(1);
    });

    it('prevents dragging when onRelationClick is provided (relation mode)', () => {
      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
              onRelationClick={vi.fn()}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0];

      // In relation mode the node should not be draggable
      expect((group as unknown as { draggable: () => boolean }).draggable()).toBe(false);
    });

    it('calls onRelationClick instead of onSelect when in relation mode', () => {
      const onRelationClick = vi.fn();

      render(
        <Stage width={800} height={600}>
          <Layer>
            <TypeNode
              element={sampleElement}
              isSelected={false}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
              onRelationClick={onRelationClick}
            />
          </Layer>
        </Stage>,
      );

      const stage = getStage();
      const group = stage.getLayers()[0].getChildren()[0];

      act(() => {
        group.fire('click');
      });

      expect(onRelationClick).toHaveBeenCalledWith(sampleElement.id);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
