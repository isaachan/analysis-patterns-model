import type { DiagramElement } from '../../models/diagram';

/**
 * Demo diagram elements for the initial Konva canvas integration.
 *
 * These elements demonstrate basic shapes (rectangles, lines, text)
 * rendered in the appropriate Konva layers. They are shown when the
 * diagram store contains no elements, and replaced by real user data
 * once the user starts working.
 */
export const DEMO_ELEMENTS: DiagramElement[] = [
  {
    id: 'demo-type-1',
    type: 'type',
    name: 'Customer',
    attributes: ['customerId: int', 'name: string', 'email: string'],
    methods: ['placeOrder()'],
    layout: { x: 100, y: 150, width: 180, height: 110 },
  },
  {
    id: 'demo-type-2',
    type: 'type',
    name: 'Order',
    attributes: ['orderId: int', 'orderDate: Date', 'total: decimal'],
    methods: ['calculateTotal()'],
    layout: { x: 420, y: 150, width: 180, height: 110 },
  },
  {
    id: 'demo-type-3',
    type: 'type',
    name: 'Product',
    attributes: ['productId: int', 'name: string', 'price: decimal'],
    methods: [],
    layout: { x: 420, y: 380, width: 180, height: 100 },
  },
  {
    id: 'demo-rel-1',
    type: 'relation',
    sourceId: 'demo-type-1',
    targetId: 'demo-type-2',
    sourceCardinality: 'exactly_one',
    targetCardinality: 'zero_or_many',
    label: 'places',
  },
  {
    id: 'demo-rel-2',
    type: 'relation',
    sourceId: 'demo-type-2',
    targetId: 'demo-type-3',
    sourceCardinality: 'zero_or_many',
    targetCardinality: 'exactly_one',
    label: 'contains',
  },
  {
    id: 'demo-note-1',
    type: 'note',
    content: 'This is a demo semantic note',
    layout: { x: 100, y: 400, width: 200, height: 70 },
  },
];
