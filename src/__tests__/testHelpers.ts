/**
 * Shared test helpers for Konva canvas tests.
 *
 * Provides type-safe access to the Konva global stage registry so that
 * tests can inspect the rendered node tree and fire programmatic events.
 */
import Konva from 'konva';

/** Return the first (and typically only) Konva Stage in the test. */
export function getStage() {
  return Konva.stages[0];
}

/** Return the first (and typically only) Konva Stage, and wait if needed. */
export async function getStageAsync() {
  // In jsdom the stage is created synchronously during render, so this is
  // effectively synchronous, but we keep the async signature for convenience.
  return Konva.stages[0];
}

/**
 * Count the number of child nodes on a given layer matching an optional
 * class-name filter.
 */
export function countLayerChildren(
  stage: unknown,
  layerIndex: number,
  className?: string,
): number {
  const s = stage as {
    getLayers: () => { getChildren: (filter?: (n: unknown) => boolean) => unknown[] }[];
  };
  const layer = s.getLayers()[layerIndex];
  if (!layer) return 0;
  const children = layer.getChildren();
  if (!className) return children.length;
  return children.filter(
    (n) => (n as { getClassName: () => string }).getClassName() === className,
  ).length;
}
