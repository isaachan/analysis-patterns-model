import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { ToolMode } from '../../models/editor';

interface ToolButton {
  mode: ToolMode;
  label: string;
  tooltip?: string;
  icon: React.ReactNode;
}

const toolButtons: ToolButton[] = [
  {
    mode: 'select',
    label: 'Select',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 2.5v13l4.5-3.5L11 16l1.5-.5-2-4.5 3-.5L4 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    mode: 'type',
    label: 'Type',
    tooltip: '创建Type节点',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2.5" y="3.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <text x="9" y="12" textAnchor="middle" fontSize="9" fill="currentColor" fontWeight="600">T</text>
      </svg>
    ),
  },
  {
    mode: 'relation',
    label: 'Association / Mapping',
    tooltip: '创建两个Type之间的Association/Mapping连线',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 9h10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M16 9l-3.5-3v6l3.5-3z" fill="currentColor" />
      </svg>
    ),
  },
  {
    mode: 'generalization',
    label: 'Generalization',
    tooltip: '创建类型泛化划分容器',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="3" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <line x1="2" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    mode: 'shortSemantic',
    label: 'Short Semantic Statement',
    tooltip: '添加Short Semantic Statement标记',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 4h12l-2 5H5L3 4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M5 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M6 14h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    mode: 'longSemantic',
    label: 'Long Semantic Statement',
    tooltip: '添加Long Semantic Statement便签',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 3h10a2 2 0 012 2v8a2 2 0 01-2 2H5l-2 2V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M6 7h6M6 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const LeftSidebar: React.FC = () => {
  const currentTool = useEditorStore((s) => s.currentTool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <aside
      className="border-r flex flex-col items-center py-3 gap-1 overflow-y-auto"
      style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--color-bg-sidebar)',
        borderColor: 'var(--color-border-primary)',
      }}
    >
      {toolButtons.map((btn) => {
        const isActive = currentTool === btn.mode;
        return (
          <button
            key={btn.mode}
            title={btn.tooltip || btn.label}
            onClick={() => setTool(btn.mode)}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
            style={{
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              backgroundColor: isActive ? 'var(--color-hover)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--color-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {btn.icon}
          </button>
        );
      })}
    </aside>
  );
};

export default LeftSidebar;
