import { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { useDiagramStore } from '../../store/useDiagramStore';
import type {
  DiagramElement,
  TypeElement,
  RelationElement,
  GeneralizationElement,
  NoteElement,
  LongSemanticElement,
  ShortSemantic,
} from '../../models/diagram';
import type { LongSemanticHeading } from '../../models/diagram';

/* ------------------------------------------------------------------ */
/*  Short Semantic helper                                              */
/* ------------------------------------------------------------------ */

/** Predefined marker options grouped by slot type */
const MARKER_OPTIONS: Record<string, { value: string; label: string; slot: string }[]> = {
  type: [
    { value: 'abstract', label: 'abstract', slot: 'type' },
    { value: 'singleton', label: 'singleton', slot: 'type' },
  ],
  mapping: [
    { value: 'immutable', label: 'immutable', slot: 'mapping' },
    { value: 'list', label: 'list', slot: 'mapping' },
    { value: 'class', label: 'class', slot: 'mapping' },
    { value: 'key', label: 'key: …', slot: 'mapping' },
    { value: 'historic', label: 'historic', slot: 'mapping' },
    { value: 'abstract', label: 'abstract', slot: 'mapping' },
  ],
  association: [
    { value: 'hierarchy', label: 'hierarchy', slot: 'association' },
    { value: 'dag', label: 'dag', slot: 'association' },
    { value: 'multiple_hierarchies', label: 'multiple_hierarchies', slot: 'association' },
  ],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ELEMENT_TYPE_LABELS: Record<string, string> = {
  type: 'Type',
  relation: 'Association/Mapping',
  generalization: 'Generalization',
  note: 'Semantic Statement',
  longSemantic: 'Long Semantic Statement',
};

/* ------------------------------------------------------------------ */
/*  PropertyRow sub-component                                          */
/* ------------------------------------------------------------------ */

interface PropertyRowProps {
  label: string;
  value: string | number;
}

function PropertyRow({ label, value }: PropertyRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="max-w-[60%] truncate text-right text-xs text-gray-900">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section sub-component                                              */
/* ------------------------------------------------------------------ */

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="mb-4">
      <h4 className="mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</h4>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single element properties                                          */
/* ------------------------------------------------------------------ */

interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * An editable text field that auto-saves on blur or Enter key press.
 *
 * Uses local state for responsive typing while debouncing the actual
 * save to the store until the user commits (blur / Enter).
 */
function EditableField({ label, value, onChange }: EditableFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const prevValueRef = useRef(value);

  // Sync when the prop changes externally (e.g. undo, reset).
  useEffect(() => {
    if (value !== prevValueRef.current) {
      setLocalValue(value);
      prevValueRef.current = value;
    }
  }, [value]);

  const commit = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit();
        (e.target as HTMLInputElement).blur();
      }
    },
    [commit],
  );

  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        data-testid={`editable-field-${label.toLowerCase()}`}
      />
    </div>
  );
}

function renderTypeProperties(
  element: TypeElement,
  onUpdateName: (name: string) => void,
  updateElement: (id: string, updates: Partial<DiagramElement>) => void,
) {
  return (
    <>
      <EditableField label="Name" value={element.name} onChange={onUpdateName} />
      <Section title="Details">
        <PropertyRow label="Type" value={ELEMENT_TYPE_LABELS[element.type]} />
        <PropertyRow label="ID" value={element.id} />
        <PropertyRow label="Attributes" value={element.attributes.length} />
        <PropertyRow label="Methods" value={element.methods.length} />
      </Section>
      <Section title="Semantics (Short)">
        <SemanticPills
          semantics={element.semantics}
          allowedOptions={MARKER_OPTIONS.type}
          onAdd={(marker) =>
            updateElement(element.id, {
              semantics: [...(element.semantics ?? []), marker],
            } as Partial<DiagramElement>)
          }
          onRemove={(index) =>
            updateElement(element.id, {
              semantics: (element.semantics ?? []).filter((_, i) => i !== index),
            } as Partial<DiagramElement>)
          }
        />
      </Section>
      <Section title="Position">
        <PropertyRow label="X" value={element.layout.x} />
        <PropertyRow label="Y" value={element.layout.y} />
        <PropertyRow label="Width" value={element.layout.width} />
        <PropertyRow label="Height" value={element.layout.height} />
      </Section>
    </>
  );
}

function renderRelationProperties(
  element: RelationElement,
  updateElement: (id: string, updates: Partial<DiagramElement>) => void,
) {
  return (
    <>
      <Section title="Details">
        <PropertyRow label="Type" value={ELEMENT_TYPE_LABELS[element.type]} />
        <PropertyRow label="ID" value={element.id} />
        <PropertyRow label="Label" value={element.label || '(none)'} />
      </Section>
      <Section title="Source (起点)">
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-500">Cardinality</label>
          <select
            data-testid="source-cardinality-select"
            value={element.sourceCardinality}
            onChange={(e) =>
              updateElement(element.id, {
                sourceCardinality: e.target.value,
              } as Partial<DiagramElement>)
            }
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="exactly_one">[1,1]</option>
            <option value="zero_or_one">[0,1]</option>
            <option value="one_or_many">[1,*]</option>
            <option value="zero_or_many">[0,*]</option>
          </select>
        </div>
        <div className="mb-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">Mapping Markers</label>
          <SemanticPills
            semantics={element.sourceSemantics}
            allowedOptions={MARKER_OPTIONS.mapping}
            onAdd={(marker) =>
              updateElement(element.id, {
                sourceSemantics: [...(element.sourceSemantics ?? []), marker],
              } as Partial<DiagramElement>)
            }
            onRemove={(index) =>
              updateElement(element.id, {
                sourceSemantics: (element.sourceSemantics ?? []).filter((_, i) => i !== index),
              } as Partial<DiagramElement>)
            }
          />
        </div>
      </Section>
      <Section title="Target (终点)">
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-500">Cardinality</label>
          <select
            data-testid="target-cardinality-select"
            value={element.targetCardinality}
            onChange={(e) =>
              updateElement(element.id, {
                targetCardinality: e.target.value,
              } as Partial<DiagramElement>)
            }
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="exactly_one">[1,1]</option>
            <option value="zero_or_one">[0,1]</option>
            <option value="one_or_many">[1,*]</option>
            <option value="zero_or_many">[0,*]</option>
          </select>
        </div>
        <div className="mb-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">Mapping Markers</label>
          <SemanticPills
            semantics={element.targetSemantics}
            allowedOptions={MARKER_OPTIONS.mapping}
            onAdd={(marker) =>
              updateElement(element.id, {
                targetSemantics: [...(element.targetSemantics ?? []), marker],
              } as Partial<DiagramElement>)
            }
            onRemove={(index) =>
              updateElement(element.id, {
                targetSemantics: (element.targetSemantics ?? []).filter((_, i) => i !== index),
              } as Partial<DiagramElement>)
            }
          />
        </div>
      </Section>
      <Section title="Association (关联)">
        <SemanticPills
          semantics={element.associationSemantics}
          allowedOptions={MARKER_OPTIONS.association}
          onAdd={(marker) =>
            updateElement(element.id, {
              associationSemantics: [...(element.associationSemantics ?? []), marker],
            } as Partial<DiagramElement>)
          }
          onRemove={(index) =>
            updateElement(element.id, {
              associationSemantics: (element.associationSemantics ?? []).filter((_, i) => i !== index),
            } as Partial<DiagramElement>)
          }
        />
      </Section>
    </>
  );
}

function renderGeneralizationProperties(
  element: GeneralizationElement,
  onUpdateName: (name: string) => void,
  updateElement: (id: string, updates: Partial<DiagramElement>) => void,
) {
  return (
    <>
      <EditableField label="Name" value={element.name} onChange={onUpdateName} />
      <Section title="Details">
        <PropertyRow label="Type" value={ELEMENT_TYPE_LABELS[element.type]} />
        <PropertyRow label="ID" value={element.id} />
        <PropertyRow label="Children" value={element.childIds.length} />
        <PropertyRow label="Parent" value={element.parentId || '(none)'} />
      </Section>
      <Section title="Completeness">
        <div className="mb-3">
          <label
            className="mb-1 block text-xs font-medium text-gray-500"
            htmlFor="completeness-select"
          >
            Partition Type
          </label>
          <select
            id="completeness-select"
            data-testid="completeness-select"
            value={element.completeness}
            onChange={(e) =>
              updateElement(element.id, {
                completeness: e.target.value,
              } as Partial<DiagramElement>)
            }
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="complete">Complete (single line)</option>
            <option value="incomplete">Incomplete (double line)</option>
          </select>
        </div>
      </Section>
      <Section title="Position">
        <PropertyRow label="X" value={element.layout.x} />
        <PropertyRow label="Y" value={element.layout.y} />
        <PropertyRow label="Width" value={element.layout.width} />
        <PropertyRow label="Height" value={element.layout.height} />
      </Section>
    </>
  );
}

function renderNoteProperties(
  element: NoteElement,
  onUpdateContent: (content: string) => void,
) {
  return (
    <>
      <EditableField label="Content" value={element.content} onChange={onUpdateContent} />
      <Section title="Details">
        <PropertyRow label="Type" value={ELEMENT_TYPE_LABELS[element.type]} />
        <PropertyRow label="ID" value={element.id} />
      </Section>
      <Section title="Position">
        <PropertyRow label="X" value={element.layout.x} />
        <PropertyRow label="Y" value={element.layout.y} />
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Short Semantic marker pills UI                                     */
/* ------------------------------------------------------------------ */

interface SemanticPillsProps {
  semantics: ShortSemantic[] | undefined;
  /** Allowed marker options for this slot */
  allowedOptions: { value: string; label: string }[];
  onAdd: (marker: ShortSemantic) => void;
  onRemove: (index: number) => void;
}

function SemanticPills({ semantics, allowedOptions, onAdd, onRemove }: SemanticPillsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [keyTypeValue, setKeyTypeValue] = useState('');
  const [selectedValue, setSelectedValue] = useState('');

  const current = semantics ?? [];

  const handleAdd = () => {
    if (!selectedValue) return;
    const marker: ShortSemantic = selectedValue === 'key'
      ? { type: 'key', keyType: keyTypeValue || 'TypeId' }
      : { type: selectedValue };
    onAdd(marker);
    setShowPicker(false);
    setSelectedValue('');
    setKeyTypeValue('');
  };

  // Filter out markers already present in this slot
  const usedTypes = new Set(current.map((s) => s.type));
  const available = allowedOptions.filter((o) => !usedTypes.has(o.value));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {current.map((s, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#f2f2f7', border: '1px solid #d2d2d7',
              padding: '1px 6px 1px 8px', borderRadius: 999,
              fontSize: 11, fontFamily: 'SF Mono, Menlo, monospace',
              color: '#1d1d1f',
            }}
          >
            {s.keyType ? `[${s.type}: ${s.keyType}]` : `[${s.type}]`}
            <span
              onClick={() => onRemove(i)}
              style={{ color: '#86868b', cursor: 'pointer', fontSize: 13, marginLeft: 2 }}
            >
              ✕
            </span>
          </span>
        ))}
        {available.length > 0 && !showPicker && (
          <span
            onClick={() => setShowPicker(true)}
            style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'transparent', border: '1px dashed #007aff',
              padding: '1px 8px', borderRadius: 999,
              fontSize: 11, color: '#007aff', cursor: 'pointer',
            }}
          >
            + Add marker
          </span>
        )}
      </div>
      {showPicker && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            style={{
              fontSize: 11, padding: '2px 4px',
              border: '1px solid #d2d2d7', borderRadius: 4,
            }}
          >
            <option value="">— select —</option>
            {available.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {selectedValue === 'key' && (
            <input
              type="text"
              placeholder="TypeId"
              value={keyTypeValue}
              onChange={(e) => setKeyTypeValue(e.target.value)}
              style={{
                fontSize: 11, padding: '2px 4px',
                border: '1px solid #d2d2d7', borderRadius: 4,
              }}
            />
          )}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowPicker(false)}
              style={{ fontSize: 10, padding: '2px 8px', border: '1px solid #d2d2d7', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              style={{ fontSize: 10, padding: '2px 8px', border: 'none', borderRadius: 4, background: '#007aff', color: '#fff', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Long Semantic properties                                           */
/* ------------------------------------------------------------------ */

const HEADING_OPTIONS: { value: LongSemanticHeading; label: string }[] = [
  { value: 'constraint', label: 'Constraint — 业务约束' },
  { value: 'derivation', label: 'Derivation — 派生映射计算逻辑' },
  { value: 'note', label: 'Note — 非正式描述' },
];

function renderLongSemanticProperties(
  element: LongSemanticElement,
  updateElement: (id: string, updates: Partial<DiagramElement>) => void,
  allElements: DiagramElement[],
) {
  const attachedToEl = element.attachedTo
    ? allElements.find((el) => el.id === element.attachedTo)
    : null;

  const attachedLabel = attachedToEl
    ? attachedToEl.type === 'type'
      ? `Type: ${(attachedToEl as TypeElement).name}`
      : attachedToEl.type === 'relation'
        ? `Relation: ${(attachedToEl as RelationElement).label || (attachedToEl as RelationElement).id}`
        : attachedToEl.id
    : null;

  return (
    <>
      <Section title="Long Semantic">
        {/* Heading type dropdown */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-500" htmlFor="note-heading">
            标题类型 / Heading
          </label>
          <select
            id="note-heading"
            data-testid="note-heading-select"
            value={element.heading}
            onChange={(e) =>
              updateElement(element.id, {
                heading: e.target.value,
              } as Partial<DiagramElement>)
            }
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {HEADING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Body textarea */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-500" htmlFor="note-body">
            正文 / Body
          </label>
          <textarea
            id="note-body"
            data-testid="note-body-textarea"
            value={element.body}
            onChange={(e) =>
              updateElement(element.id, {
                body: e.target.value,
              } as Partial<DiagramElement>)
            }
            rows={4}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Attached target info */}
        <Section title="Attached To">
          {attachedLabel ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 999,
                  border: '1px solid #e5e5ea', fontSize: 11,
                  background: '#fff',
                }}
              >
                {attachedLabel}
              </span>
              <button
                onClick={() =>
                  updateElement(element.id, {
                    attachedTo: undefined,
                  } as Partial<DiagramElement>)
                }
                style={{
                  border: 'none', background: 'transparent',
                  color: '#007aff', cursor: 'pointer', fontSize: 12,
                }}
              >
                解除附着
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Free-floating (未附着)</p>
          )}
        </Section>
      </Section>
      <Section title="Position">
        <PropertyRow label="X" value={element.layout.x} />
        <PropertyRow label="Y" value={element.layout.y} />
        <PropertyRow label="Width" value={element.layout.width} />
        <PropertyRow label="Height" value={element.layout.height} />
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main render dispatcher                                             */
/* ------------------------------------------------------------------ */

function renderElementProperties(
  element: DiagramElement,
  updateElement: (id: string, updates: Partial<DiagramElement>) => void,
  allElements: DiagramElement[],
) {
  switch (element.type) {
    case 'type':
      return renderTypeProperties(element, (name) =>
        updateElement(element.id, { name } as Partial<DiagramElement>),
      updateElement,
      );
    case 'relation':
      return renderRelationProperties(element, updateElement);
    case 'generalization':
      return renderGeneralizationProperties(element, (name) =>
        updateElement(element.id, { name } as Partial<DiagramElement>),
      updateElement,
      );
    case 'note':
      return renderNoteProperties(element, (content) =>
        updateElement(element.id, { content } as Partial<DiagramElement>),
      );
    case 'longSemantic':
      return renderLongSemanticProperties(element, updateElement, allElements);
  }
}

/* ------------------------------------------------------------------ */
/*  RightSidebar component                                              */
/* ------------------------------------------------------------------ */

function RightSidebar() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const elements = useDiagramStore((s) => s.elements);
  const updateElement = useDiagramStore((s) => s.updateElement);
  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

  const renderContent = () => {
    if (selectedIds.length === 0 || selectedElements.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-center text-sm text-gray-400">
            Select an element to edit its properties
          </p>
        </div>
      );
    }

    if (selectedElements.length === 1) {
      return (
        <div className="flex-1 overflow-y-auto">
          {renderElementProperties(selectedElements[0], updateElement, elements)}
        </div>
      );
    }

    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-center text-sm text-gray-400">
          {selectedIds.length} elements selected
        </p>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col p-3" data-testid="right-sidebar">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Properties
      </h3>
      {renderContent()}
    </div>
  );
}

export default RightSidebar;
