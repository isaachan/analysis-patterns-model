import { useEditorStore } from '../../store/useEditorStore';
import type { ToolMode } from '../../models/editor';

/* ------------------------------------------------------------------ */
/*  Tool item definition                                               */
/* ------------------------------------------------------------------ */

interface ToolItem {
  id: string;
  label: string;
  tool: ToolMode;
  tooltip: string;
  icon: React.ReactNode;
}

function TypeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <text x="8" y="11.5" textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" fontFamily="-apple-system, sans-serif">T</text>
    </svg>
  );
}

function RelationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h12M11 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GeneralizationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ShortStatementIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <text x="8" y="12" textAnchor="middle" fontSize="12" fontWeight="500" fill="currentColor" fontFamily="-apple-system, sans-serif">[ ]</text>
    </svg>
  );
}

function LongStatementIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 1h6l4 4v10H3V1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const TOOL_ITEMS: ToolItem[] = [
  { id: 'type', label: 'Type', tool: 'type', tooltip: '创建Type节点', icon: <TypeIcon /> },
  { id: 'relation', label: 'Association/Mapping', tool: 'relation', tooltip: '创建两个Type之间的Association/Mapping连线', icon: <RelationIcon /> },
  { id: 'generalization', label: 'Generalization', tool: 'generalization', tooltip: '创建类型泛化划分容器', icon: <GeneralizationIcon /> },
  { id: 'short-statement', label: 'Short Semantic Statement', tool: 'short-semantic', tooltip: '添加短语义标记', icon: <ShortStatementIcon /> },
  { id: 'long-statement', label: 'Long Semantic Statement', tool: 'long-semantic', tooltip: '添加长语义便签', icon: <LongStatementIcon /> },
];

/* ------------------------------------------------------------------ */
/*  ToolItemButton sub-component                                       */
/* ------------------------------------------------------------------ */

interface ToolItemButtonProps {
  item: ToolItem;
  isActive: boolean;
  onClick: () => void;
}

function ToolItemButton({ item, isActive, onClick }: ToolItemButtonProps) {
  return (
    <button
      onClick={onClick}
      title={item.tooltip}
      data-testid={`tool-item-${item.id}`}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
        isActive
          ? 'bg-[#0071e3] text-white'
          : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
      }`}
    >
      <span className="shrink-0">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  LeftSidebar component                                              */
/* ------------------------------------------------------------------ */

function LeftSidebar() {
  const currentTool = useEditorStore((s) => s.currentTool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div className="flex h-full flex-col p-3" data-testid="left-sidebar">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Elements
      </h3>
      <nav className="flex flex-col gap-1" role="listbox" aria-label="Modeling elements">
        {TOOL_ITEMS.map((item) => (
          <ToolItemButton
            key={item.id}
            item={item}
            isActive={currentTool === item.tool}
            onClick={() => setTool(item.tool)}
          />
        ))}
      </nav>
    </div>
  );
}

export default LeftSidebar;
