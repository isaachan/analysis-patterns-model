import type { Diagram, DiagramElement, DiagramMetadata } from '../models/diagram';
import type { CanvasElement, FileMeta } from '../store/useEditorStore';
import { getStageRef } from './stageRef';

export function buildDiagram(
  canvasElements: CanvasElement[],
  files: FileMeta[],
  currentFileId: string | null,
): Diagram {
  const currentFile = files.find((f) => f.id === currentFileId);

  const metadata: DiagramMetadata = {
    title: currentFile?.title ?? 'Untitled',
    createdAt: currentFile?.createdAt ?? Date.now(),
    updatedAt: currentFile?.updatedAt ?? Date.now(),
  };

  const elements: DiagramElement[] = [];

  for (const el of canvasElements) {
    switch (el.type) {
      case 'type':
        elements.push({
          id: el.id,
          type: 'type',
          name: el.name ?? '',
          position: { x: el.x, y: el.y },
          size: { width: el.width ?? 100, height: el.height ?? 50 },
        });
        break;
      case 'relation':
        elements.push({
          id: el.id,
          type: 'relation',
          sourceId: el.sourceId ?? '',
          targetId: el.targetId ?? '',
          ...(el.sourceCardinality ? { sourceCardinality: el.sourceCardinality } : {}),
          ...(el.targetCardinality ? { targetCardinality: el.targetCardinality } : {}),
        });
        break;
      case 'generalization':
        elements.push({
          id: el.id,
          type: 'generalization',
          position: { x: el.x, y: el.y },
          size: { width: el.width ?? 200, height: el.height ?? 150 },
          parentTypeId: el.parentTypeId,
          childTypeIds: canvasElements
            .filter((child) => child.containerId === el.id)
            .map((child) => child.id),
          isComplete: el.isComplete ?? true,
        });
        break;
      case 'note':
        elements.push({
          id: el.id,
          type: 'note',
          title: el.title ?? '',
          content: el.content ?? '',
          position: { x: el.x, y: el.y },
          size: { width: el.width ?? 200, height: el.height ?? 100 },
          ...(el.attachedToId ? { attachedToId: el.attachedToId } : {}),
        });
        break;
    }
  }

  return {
    version: '1.0',
    metadata,
    elements,
  };
}

export function exportToJSON(diagram: Diagram): string {
  return JSON.stringify(diagram, null, 2);
}

export function downloadJSON(diagram: Diagram, filename?: string): void {
  const json = exportToJSON(diagram);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${diagram.metadata.title}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPNG(pixelRatio: number): string | null {
  const stage = getStageRef();
  if (!stage) return null;
  return stage.toDataURL({ pixelRatio });
}

export function downloadPNG(filename: string, pixelRatio: number): void {
  const dataUrl = exportPNG(pixelRatio);
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
