import useEditorStore from '../../store/useEditorStore';

const toolDisplayNames: Record<string, string> = {
  select: 'Select',
  type: 'Type',
  relation: 'Association / Mapping',
  generalization: 'Generalization',
  shortSemantic: 'Short Semantic Statement',
  longSemantic: 'Long Semantic Statement',
  note: 'Note',
};

function StatusBar() {
  const currentTool = useEditorStore((s) => s.currentTool);
  const zoom = useEditorStore((s) => s.zoom);
  const gridEnabled = useEditorStore((s) => s.gridEnabled);
  const setGridEnabled = useEditorStore((s) => s.setGridEnabled);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const saveErrorMessage = useEditorStore((s) => s.saveErrorMessage);

  const toolName = toolDisplayNames[currentTool] ?? currentTool;

  let statusText = '';
  let statusColor = '';
  switch (saveStatus) {
    case 'saving':
      statusText = 'Saving...';
      statusColor = 'var(--color-text-secondary)';
      break;
    case 'saved':
      statusText = 'Saved';
      statusColor = 'var(--color-success, #22c55e)';
      break;
    case 'error':
      statusText = saveErrorMessage || 'Save failed';
      statusColor = 'var(--color-danger, #ef4444)';
      break;
  }

  return (
    <footer
      className="flex items-center justify-between px-3 border-t text-xs select-none"
      style={{
        height: 'var(--statusbar-height)',
        backgroundColor: 'var(--color-bg-toolbar)',
        borderColor: 'var(--color-border-primary)',
        color: 'var(--color-text-secondary)',
      }}
    >
      <div className="flex items-center gap-3">
        <span>Tool: {toolName}</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setGridEnabled(!gridEnabled)}
          className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            fontSize: 'inherit',
            padding: 0,
          }}
          title={gridEnabled ? 'Click to hide grid' : 'Click to show grid'}
        >
          <span
            className="inline-block w-3 h-3 rounded-sm border"
            style={{
              backgroundColor: gridEnabled ? 'var(--color-success, #22c55e)' : 'transparent',
              borderColor: 'var(--color-text-secondary)',
            }}
          />
          <span>Grid: {gridEnabled ? 'On' : 'Off'}</span>
        </button>
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            fontSize: 'inherit',
            padding: 0,
          }}
          title={snapEnabled ? 'Click to disable snap-to-grid' : 'Click to enable snap-to-grid'}
        >
          <span
            className="inline-block w-3 h-3 rounded-sm border"
            style={{
              backgroundColor: snapEnabled ? 'var(--color-accent, #007AFF)' : 'transparent',
              borderColor: 'var(--color-text-secondary)',
            }}
          />
          <span>Snap: {snapEnabled ? 'On' : 'Off'}</span>
        </button>
        <span style={{ color: statusColor }}>{statusText}</span>
      </div>
    </footer>
  );
}

export default StatusBar;
