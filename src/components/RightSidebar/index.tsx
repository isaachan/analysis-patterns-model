import { useState, useEffect, useRef } from 'react';
import useEditorStore, {
  type AssociationTag,
} from '../../store/useEditorStore';

const CARDINALITY_OPTIONS = ['', '[1,1]', '[0,1]', '[1,*]', '[0,*]'] as const;

const ASSOCIATION_TAGS: { value: AssociationTag; label: string }[] = [
  { value: 'hierarchy', label: 'Hierarchy' },
  { value: 'dag', label: 'DAG' },
  { value: 'multiple_hierarchies', label: 'Multiple Hierarchies' },
];

function RightSidebar() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const canvasElements = useEditorStore((s) => s.canvasElements);
  const updateElement = useEditorStore((s) => s.updateElement);

  const selectedElement =
    selectedIds.length > 0
      ? canvasElements.find((el) => el.id === selectedIds[0])
      : null;

  const hasSelection = selectedIds.length > 0 && !!selectedElement;

  const [editingName, setEditingName] = useState('');
  const shouldSaveOnBlur = useRef(true);

  // Reset local editing name when selection changes (intentionally only depends on id)
  useEffect(() => {
    setEditingName(selectedElement?.name || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElement?.id]);

  const getElementTypeLabel = (type: string) => {
    switch (type) {
      case 'type':
        return 'Type Node';
      case 'relation':
        return 'Relation';
      case 'generalization':
        return 'Generalization Container';
      case 'rect':
        return 'Rectangle';
      case 'line':
        return 'Line';
      case 'text':
        return 'Text';
      default:
        return type;
    }
  };

  return (
    <aside
      className="border-l overflow-y-auto"
      style={{
        width: 'var(--right-sidebar-width)',
        backgroundColor: 'var(--color-bg-sidebar)',
        borderColor: 'var(--color-border-primary)',
      }}
    >
      {selectedIds.length > 1 ? (
        <div className="flex flex-col items-center justify-center h-full px-4">
          <div className="mb-3 opacity-40">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <p
            className="text-sm text-center font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {selectedIds.length} elements selected
          </p>
          <p
            className="text-xs text-center mt-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Drag to move all selected elements
          </p>
          <p
            className="text-xs text-center mt-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Press Delete to remove all
          </p>
        </div>
      ) : hasSelection && selectedElement ? (
        <div className="p-4 space-y-5">
          {/* Properties Header */}
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Properties
          </h3>

          {/* Element Type Badge */}
          <div>
            <span
              className="inline-block px-2 py-0.5 text-xs font-medium rounded-md"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {getElementTypeLabel(selectedElement.type)}
            </span>
          </div>

          {/* Name Field */}
          <div className="space-y-1.5">
            <label
              className="block text-xs leading-none"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              名称
            </label>
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => {
                if (shouldSaveOnBlur.current && selectedElement) {
                  updateElement(selectedElement.id, { name: editingName });
                }
                shouldSaveOnBlur.current = true;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (selectedElement) {
                    updateElement(selectedElement.id, { name: editingName });
                  }
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                  setEditingName(selectedElement?.name || '');
                  shouldSaveOnBlur.current = false;
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Untitled"
              className="w-full text-sm font-medium border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{
                color: 'var(--color-text-primary)',
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-primary)',
              }}
            />
          </div>

          {/* Note-specific controls */}
          {selectedElement.type === 'note' && (
            <>
              <div className="space-y-1.5">
                <label
                  className="block text-xs leading-none"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Title Type
                </label>
                <select
                  value={selectedElement.titleType ?? 'Note'}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      titleType: e.target.value,
                    })
                  }
                  className="w-full text-sm border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{
                    color: 'var(--color-text-primary)',
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)',
                  }}
                >
                  <option value="Constraint">Constraint</option>
                  <option value="Derivation">Derivation</option>
                  <option value="Note">Note</option>
                </select>
              </div>

              {/* Attach to target element */}
              <div className="space-y-1.5">
                <label
                  className="block text-xs leading-none"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Attach to
                </label>
                <select
                  value={selectedElement.attachedToId ?? ''}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      attachedToId: e.target.value || undefined,
                    })
                  }
                  className="w-full text-sm border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{
                    color: 'var(--color-text-primary)',
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)',
                  }}
                >
                  <option value="">(None)</option>
                  {canvasElements
                    .filter((el) => el.type === 'type' || el.type === 'relation')
                    .map((el) => (
                      <option key={el.id} value={el.id}>
                        {el.type === 'type'
                          ? `Type: ${el.name || 'Unnamed'}`
                          : `Relation: ${el.name || el.id.slice(0, 8)}`}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}

          <hr
            className="border-t"
            style={{ borderColor: 'var(--color-border-primary)' }}
          />

          {/* Relation-specific controls */}
          {selectedElement.type === 'relation' ? (
            <>
              {/* Cardinality Section */}
              <div className="space-y-2">
                <h4
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Cardinality
                </h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label
                      className="block text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Source
                    </label>
                    <select
                      value={selectedElement.sourceCardinality ?? ''}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          sourceCardinality: e.target.value || undefined,
                        })
                      }
                      className="w-full text-sm border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      style={{
                        color: 'var(--color-text-primary)',
                        backgroundColor: 'var(--color-bg-primary)',
                        borderColor: 'var(--color-border-primary)',
                      }}
                    >
                      {CARDINALITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt || '(none)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label
                      className="block text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Target
                    </label>
                    <select
                      value={selectedElement.targetCardinality ?? ''}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          targetCardinality: e.target.value || undefined,
                        })
                      }
                      className="w-full text-sm border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      style={{
                        color: 'var(--color-text-primary)',
                        backgroundColor: 'var(--color-bg-primary)',
                        borderColor: 'var(--color-border-primary)',
                      }}
                    >
                      {CARDINALITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt || '(none)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Association Section (only for self-references) */}
              {selectedElement.isSelfReference && (
                <>
                  <hr
                    className="border-t"
                    style={{ borderColor: 'var(--color-border-primary)' }}
                  />
                  <div className="space-y-2">
                    <h4
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Association
                    </h4>
                    <div className="space-y-2">
                      {ASSOCIATION_TAGS.map((tag) => {
                        const currentTags =
                          selectedElement.associationTags ?? [];
                        const isChecked = currentTags.includes(tag.value);
                        return (
                          <label
                            key={tag.value}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const newTags = isChecked
                                  ? currentTags.filter((t) => t !== tag.value)
                                  : [...currentTags, tag.value];
                                updateElement(selectedElement.id, {
                                  associationTags: newTags.length > 0 ? newTags : undefined,
                                });
                              }}
                              className="rounded focus:ring-blue-500"
                            />
                            {tag.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {/* Position Section */}
              <div className="space-y-2">
                <h4
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Position
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      className="block text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      X
                    </label>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {Math.round(selectedElement.x)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label
                      className="block text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Y
                    </label>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {Math.round(selectedElement.y)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Size Section (only if width/height are available) */}
              {selectedElement.width != null && selectedElement.height != null && (
                <>
                  <hr
                    className="border-t"
                    style={{ borderColor: 'var(--color-border-primary)' }}
                  />
                  <div className="space-y-2">
                    <h4
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Size
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label
                          className="block text-xs"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          W
                        </label>
                        <p
                          className="text-sm"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {Math.round(selectedElement.width)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <label
                          className="block text-xs"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          H
                        </label>
                        <p
                          className="text-sm"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {Math.round(selectedElement.height)}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Generalization-specific controls */}
              {selectedElement.type === 'generalization' && (
                <>
                  <hr
                    className="border-t"
                    style={{ borderColor: 'var(--color-border-primary)' }}
                  />
                  <div className="space-y-2">
                    <h4
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Generalization
                    </h4>
                    {/* Parent Type selector */}
                    <div className="space-y-1">
                      <label
                        className="block text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Parent Type
                      </label>
                      <select
                        value={selectedElement.parentTypeId ?? ''}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            parentTypeId: e.target.value || undefined,
                          })
                        }
                        className="w-full text-sm border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        style={{
                          color: 'var(--color-text-primary)',
                          backgroundColor: 'var(--color-bg-primary)',
                          borderColor: 'var(--color-border-primary)',
                        }}
                      >
                        <option value="">(none)</option>
                        {canvasElements
                          .filter((el) => el.type === 'type')
                          .map((typeEl) => (
                            <option key={typeEl.id} value={typeEl.id}>
                              {typeEl.name || 'Type'}
                            </option>
                          ))}
                      </select>
                    </div>
                    {/* isComplete toggle */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="isComplete"
                        checked={selectedElement.isComplete ?? true}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            isComplete: e.target.checked,
                          })
                        }
                        className="rounded focus:ring-blue-500"
                      />
                      <label
                        htmlFor="isComplete"
                        className="text-sm"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Complete (single bottom border)
                      </label>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col h-full px-4 py-4 space-y-4 overflow-y-auto">
          {/* Canvas Settings */}
          <div className="space-y-3">
            <h3
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Canvas Settings
            </h3>
            {/* Grid toggle */}
            <label className="flex items-center justify-between text-sm cursor-pointer">
              <span style={{ color: 'var(--color-text-primary)' }}>Show Grid</span>
              <GridToggle />
            </label>
            {/* Grid size */}
            <label className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--color-text-primary)' }}>Grid Size (px)</span>
              <GridSizeInput />
            </label>
            {/* Snap toggle */}
            <label className="flex items-center justify-between text-sm cursor-pointer">
              <span style={{ color: 'var(--color-text-primary)' }}>Snap to Grid</span>
              <SnapToggle />
            </label>
          </div>

          <hr className="border-t" style={{ borderColor: 'var(--color-border-primary)' }} />

          <div className="flex flex-col items-center justify-center flex-1 px-2">
            <div className="mb-3 opacity-30">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M12 16v-4M12 8h.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p
              className="text-sm text-center leading-relaxed"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Select an element to view and edit its properties
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

function GridToggle() {
  const gridEnabled = useEditorStore((s) => s.gridEnabled);
  const setGridEnabled = useEditorStore((s) => s.setGridEnabled);
  return (
    <button
      onClick={() => setGridEnabled(!gridEnabled)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
      style={{
        backgroundColor: gridEnabled ? 'var(--color-accent, #007AFF)' : 'var(--color-bg-secondary)',
      }}
      role="switch"
      aria-checked={gridEnabled}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          gridEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

function GridSizeInput() {
  const gridSize = useEditorStore((s) => s.gridSize);
  const setGridSize = useEditorStore((s) => s.setGridSize);
  return (
    <input
      type="number"
      min={5}
      max={100}
      value={gridSize}
      onChange={(e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 5 && val <= 100) {
          setGridSize(val);
        }
      }}
      className="w-16 text-sm border rounded-md px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      style={{
        color: 'var(--color-text-primary)',
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border-primary)',
      }}
    />
  );
}

function SnapToggle() {
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  return (
    <button
      onClick={() => setSnapEnabled(!snapEnabled)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
      style={{
        backgroundColor: snapEnabled ? 'var(--color-accent, #007AFF)' : 'var(--color-bg-secondary)',
      }}
      role="switch"
      aria-checked={snapEnabled}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          snapEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

export default RightSidebar;
