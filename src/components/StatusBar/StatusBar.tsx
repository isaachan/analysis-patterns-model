import { useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { useDiagramStore } from '../../store/useDiagramStore';
import { useFileStore } from '../../store/useFileStore';

/* ------------------------------------------------------------------ */
/*  Tool display labels                                                */
/* ------------------------------------------------------------------ */

const TOOL_LABELS: Record<string, string> = {
  select: 'Select',
  type: 'Type',
  relation: 'Association/Mapping',
  generalization: 'Generalization',
  note: 'Semantic Statement',
  'short-semantic': 'Short Semantic Statement',
  'long-semantic': 'Long Semantic Statement',
};

/* ------------------------------------------------------------------ */
/*  StatusBar component                                                */
/* ------------------------------------------------------------------ */

function StatusBar() {
  const currentTool = useEditorStore((s) => s.currentTool);
  const zoom = useEditorStore((s) => s.zoom);
  const elements = useDiagramStore((s) => s.elements);
  const relationSourceId = useEditorStore((s) => s.relationSourceId);
  const generalizationParentId = useEditorStore((s) => s.generalizationParentId);
  const gridEnabled = useEditorStore((s) => s.gridEnabled);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);

  const storageError = useFileStore((s) => s.storageError);
  const clearStorageError = useFileStore((s) => s.clearStorageError);

  /* Auto-dismiss storage error after 5 seconds */
  useEffect(() => {
    if (storageError) {
      const timer = setTimeout(clearStorageError, 5000);
      return () => clearTimeout(timer);
    }
  }, [storageError, clearStorageError]);

  const toolLabel = TOOL_LABELS[currentTool] ?? currentTool;

  /* Show relation hint when in relation mode and a source is selected */
  const relationHint =
    currentTool === 'relation' && relationSourceId
      ? 'Click target Type or drag to create relation. Click empty canvas to cancel.'
      : '';

  /* Show generalization hint */
  const generalizationHint =
    currentTool === 'generalization'
      ? generalizationParentId
        ? 'Click empty canvas to place generalization container.'
        : 'Click a parent Type first to create a generalization container.'
      : '';

  return (
    <div className="flex w-full items-center justify-between text-xs text-gray-500" data-testid="status-bar">
      <div className="flex items-center gap-4">
        <span data-testid="status-tool">Tool: {toolLabel}</span>
        {relationHint && (
          <span data-testid="status-relation-hint" className="italic text-[#0071e3]">
            {relationHint}
          </span>
        )}
        {generalizationHint && (
          <span data-testid="status-generalization-hint" className="italic text-[#0071e3]">
            {generalizationHint}
          </span>
        )}
        {storageError && (
          <span data-testid="status-storage-error" className="text-red-500">
            {storageError}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span data-testid="status-grid">Grid: {gridEnabled ? 'ON' : 'OFF'}</span>
        <span data-testid="status-snap">Snap: {snapEnabled ? 'ON' : 'OFF'}</span>
        <span data-testid="status-elements">Elements: {elements.length}</span>
        <span data-testid="status-zoom">Zoom: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}

export default StatusBar;
