/**
 * Export utilities for the diagram editor.
 * Handles serialization of diagram data for export (PNG, SVG, JSON).
 */

import type { DiagramState } from '../models/diagram';

/**
 * Serialize the diagram state to a JSON string for export.
 * Strips runtime-specific fields and keeps only semantic data.
 *
 * @param state - The current diagram state
 * @returns A JSON string of the diagram data
 */
export function serializeDiagram(state: DiagramState): string {
  return JSON.stringify(state, null, 2);
}

/**
 * Parse a JSON string back into a DiagramState.
 *
 * @param json - The JSON string to parse
 * @returns The parsed diagram state
 */
export function deserializeDiagram(json: string): DiagramState {
  return JSON.parse(json) as DiagramState;
}

/**
 * Export the current diagram as a downloadable JSON file.
 */
export function downloadDiagramJson(state: DiagramState, filename?: string): void {
  const json = serializeDiagram(state);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${state.metadata.title || 'diagram'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
