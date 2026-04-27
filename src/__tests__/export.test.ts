import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serializeDiagram, deserializeDiagram } from '../utils/export';
import type { DiagramState } from '../models/diagram';

/* ------------------------------------------------------------------ */
/*  Sample diagram states for testing                                  */
/* ------------------------------------------------------------------ */

function makeState(overrides?: Partial<DiagramState>): DiagramState {
  return {
    version: '1.0.0',
    metadata: {
      title: overrides?.metadata?.title ?? 'Test Diagram',
      createdAt: overrides?.metadata?.createdAt ?? 1000,
      updatedAt: overrides?.metadata?.updatedAt ?? 2000,
    },
    elements: overrides?.elements ?? [],
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('serializeDiagram / deserializeDiagram (ME-50)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ------------------------------------------------------------------ */
  /*  serializeDiagram                                                   */
  /* ------------------------------------------------------------------ */

  describe('serializeDiagram', () => {
    it('produces valid JSON string', () => {
      const state = makeState();
      const json = serializeDiagram(state);
      expect(json).toBeTruthy();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('output matches the DiagramState schema structure (version, metadata, elements)', () => {
      const state = makeState({
        metadata: { title: 'Schema Test', createdAt: 100, updatedAt: 200 },
        elements: [
          {
            id: 'type-1',
            type: 'type',
            name: 'User',
            attributes: ['name: String'],
            methods: ['getName()'],
            layout: { x: 10, y: 20, width: 180, height: 80 },
          },
        ],
      });

      const json = serializeDiagram(state);
      const parsed = JSON.parse(json);

      // Root must have version, metadata, elements
      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('elements');

      // Version
      expect(parsed.version).toBe('1.0.0');

      // Metadata
      expect(parsed.metadata).toHaveProperty('title', 'Schema Test');
      expect(parsed.metadata).toHaveProperty('createdAt', 100);
      expect(parsed.metadata).toHaveProperty('updatedAt', 200);

      // Elements
      expect(parsed.elements).toHaveLength(1);
      expect(parsed.elements[0]).toHaveProperty('id', 'type-1');
      expect(parsed.elements[0]).toHaveProperty('type', 'type');
      expect(parsed.elements[0]).toHaveProperty('name', 'User');
      expect(parsed.elements[0]).toHaveProperty('attributes', ['name: String']);
      expect(parsed.elements[0]).toHaveProperty('methods', ['getName()']);
      expect(parsed.elements[0]).toHaveProperty('layout');
      expect(parsed.elements[0].layout).toEqual({ x: 10, y: 20, width: 180, height: 80 });
    });

    it('handles empty elements array', () => {
      const state = makeState({ elements: [] });
      const parsed = JSON.parse(serializeDiagram(state));
      expect(parsed.elements).toEqual([]);
    });

    it('handles relation elements with cardinality', () => {
      const state = makeState({
        elements: [
          {
            id: 'rel-1',
            type: 'relation',
            sourceId: 'type-1',
            targetId: 'type-2',
            sourceCardinality: 'zero_or_many',
            targetCardinality: 'exactly_one',
            label: 'has',
          },
        ],
      });

      const parsed = JSON.parse(serializeDiagram(state));
      expect(parsed.elements[0].type).toBe('relation');
      expect(parsed.elements[0].sourceCardinality).toBe('zero_or_many');
      expect(parsed.elements[0].targetCardinality).toBe('exactly_one');
      expect(parsed.elements[0].label).toBe('has');
    });

    it('handles generalization elements', () => {
      const state = makeState({
        elements: [
          {
            id: 'gen-1',
            type: 'generalization',
            name: 'GenGroup',
            childIds: ['type-1', 'type-2'],
            parentId: 'type-3',
            completeness: 'complete',
            layout: { x: 0, y: 0, width: 100, height: 60 },
          },
        ],
      });

      const parsed = JSON.parse(serializeDiagram(state));
      expect(parsed.elements[0].type).toBe('generalization');
      expect(parsed.elements[0].childIds).toEqual(['type-1', 'type-2']);
      expect(parsed.elements[0].parentId).toBe('type-3');
    });

    it('handles note elements', () => {
      const state = makeState({
        elements: [
          {
            id: 'note-1',
            type: 'note',
            content: 'This is a note',
            layout: { x: 50, y: 50, width: 200, height: 100 },
          },
        ],
      });

      const parsed = JSON.parse(serializeDiagram(state));
      expect(parsed.elements[0].type).toBe('note');
      expect(parsed.elements[0].content).toBe('This is a note');
    });

    it('pretty-prints with 2-space indentation', () => {
      const state = makeState();
      const json = serializeDiagram(state);
      const lines = json.split('\n');
      // Should have multiple lines (pretty-printed)
      expect(lines.length).toBeGreaterThan(1);
      // Each line should have proper indentation
      expect(lines[1]).toMatch(/^ {2}"/); // 2-space indent for first key
    });
  });

  /* ------------------------------------------------------------------ */
  /*  deserializeDiagram                                                 */
  /* ------------------------------------------------------------------ */

  describe('deserializeDiagram', () => {
    it('parses valid JSON back into a DiagramState', () => {
      const original = makeState({
        metadata: { title: 'Round Trip', createdAt: 100, updatedAt: 200 },
        elements: [
          {
            id: 'type-1',
            type: 'type',
            name: 'RoundTrip',
            attributes: [],
            methods: [],
            layout: { x: 0, y: 0, width: 100, height: 60 },
          },
        ],
      });

      const json = serializeDiagram(original);
      const restored = deserializeDiagram(json);

      expect(restored.version).toBe(original.version);
      expect(restored.metadata.title).toBe(original.metadata.title);
      expect(restored.elements).toHaveLength(original.elements.length);
      expect(restored.elements[0].id).toBe(original.elements[0].id);
    });

    it('round-trips preserves all element fields', () => {
      const original = makeState({
        elements: [
          {
            id: 'type-1',
            type: 'type',
            name: 'User',
            attributes: ['name: String', 'age: Int'],
            methods: ['getName()', 'setName(String)'],
            layout: { x: 100, y: 200, width: 180, height: 100 },
          },
          {
            id: 'rel-1',
            type: 'relation',
            sourceId: 'type-1',
            targetId: 'type-2',
            sourceCardinality: 'zero_or_many',
            targetCardinality: 'one_or_many',
            label: 'has many',
          },
        ],
      });

      const json = serializeDiagram(original);
      const restored = deserializeDiagram(json);

      expect(restored).toEqual(original);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Round-trip integrity                                                */
  /* ------------------------------------------------------------------ */

  describe('round-trip integrity', () => {
    it('serialize then deserialize returns equivalent state', () => {
      const state = makeState({
        metadata: { title: 'Integrity', createdAt: 100, updatedAt: 200 },
        elements: [
          {
            id: 'type-1',
            type: 'type',
            name: 'Entity',
            attributes: ['id: ID'],
            methods: [],
            layout: { x: 50, y: 50, width: 150, height: 60 },
          },
        ],
      });

      const json = serializeDiagram(state);
      const restored = deserializeDiagram(json);

      expect(restored.metadata.title).toBe('Integrity');
      expect(restored.version).toBe('1.0.0');
      expect(restored.elements).toHaveLength(1);
      expect(restored.elements[0].type).toBe('type');
    });
  });
});
