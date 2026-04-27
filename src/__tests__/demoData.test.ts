import { describe, it, expect } from 'vitest';
import { DEMO_ELEMENTS } from '../components/Canvas/demoData';
import type { TypeElement, RelationElement, NoteElement } from '../models/diagram';

describe('DEMO_ELEMENTS', () => {
  it('contains type elements with required layout properties', () => {
    const types = DEMO_ELEMENTS.filter(
      (el): el is TypeElement => el.type === 'type',
    );
    expect(types.length).toBe(3);

    for (const t of types) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(Array.isArray(t.attributes)).toBe(true);
      expect(Array.isArray(t.methods)).toBe(true);
      expect(t.layout).toBeDefined();
      expect(t.layout.x).toBeGreaterThanOrEqual(0);
      expect(t.layout.y).toBeGreaterThanOrEqual(0);
      expect(t.layout.width).toBeGreaterThan(0);
      expect(t.layout.height).toBeGreaterThan(0);
    }
  });

  it('contains relation elements linking type nodes', () => {
    const relations = DEMO_ELEMENTS.filter(
      (el): el is RelationElement => el.type === 'relation',
    );
    expect(relations.length).toBe(2);

    const typeIds = DEMO_ELEMENTS.filter((el) => el.type === 'type').map(
      (t) => t.id,
    );

    for (const r of relations) {
      expect(typeIds).toContain(r.sourceId);
      expect(typeIds).toContain(r.targetId);
      expect(r.sourceCardinality).toBeTruthy();
      expect(r.targetCardinality).toBeTruthy();
    }
  });

  it('contains a note element', () => {
    const notes = DEMO_ELEMENTS.filter(
      (el): el is NoteElement => el.type === 'note',
    );
    expect(notes.length).toBe(1);

    const note = notes[0];
    expect(note.content).toBeTruthy();
    expect(note.layout).toBeDefined();
    expect(note.layout.width).toBeGreaterThan(0);
    expect(note.layout.height).toBeGreaterThan(0);
  });

  it('every element has a unique id', () => {
    const ids = DEMO_ELEMENTS.map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
