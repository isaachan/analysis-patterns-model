import { useCallback, useRef, useState, useEffect } from 'react';
import Konva from 'konva';
import { useHistoryStore } from '../../store/useHistoryStore';
import { useDiagramStore } from '../../store/useDiagramStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useFileStore } from '../../store/useFileStore';

/* ------------------------------------------------------------------ */
/*  Inline SVG icon components                                         */
/* ------------------------------------------------------------------ */

function NewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 2h8l4 4v8H2V2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 2h9l3 3v9H2V2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="4" y="8" width="8" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="4" y="2" width="5" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 7h6a3 3 0 110 6H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 4L4 7l3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M12 7H6a3 3 0 000 6h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 4l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExportPNGIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" />
      <path
        d="M1.5 12.5l4-4 2 2 3-3 3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExportJSONIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.5 3L2 8l3.5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 3l3.5 5-3.5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4h10M5.5 4V2.5a1 1 0 011-1h3a1 1 0 011 1V4M12 4v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 7v4M9.5 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 3h8M4 3V2a1 1 0 011-1h2a1 1 0 011 1v1M9 3v7a1 1 0 01-1 1H4a1 1 0 01-1-1V3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 5.5h13M1.5 10.5h13M5.5 1.5v13M10.5 1.5v13" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function SnapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  ToolbarButton sub-component                                        */
/* ------------------------------------------------------------------ */

interface ToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, disabled = false, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={`toolbar-button-${title.toLowerCase().replace(/\s+/g, '-')}`}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        disabled
          ? 'cursor-not-allowed text-gray-300'
          : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  FileSelector sub-component                                         */
/* ------------------------------------------------------------------ */

function FileSelector() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const currentFileId = useFileStore((s) => s.currentFileId);
  const files = useFileStore((s) => s.files);
  const loadFile = useFileStore((s) => s.loadFile);
  const newFile = useFileStore((s) => s.newFile);
  const deleteFile = useFileStore((s) => s.deleteFile);
  const renameFile = useFileStore((s) => s.renameFile);

  const currentFile = files.find((f) => f.id === currentFileId);
  const currentTitle = currentFile?.title ?? 'Untitled';

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  /* Focus the rename input when entering rename mode */
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleDoubleClick = useCallback(() => {
    if (currentFileId) {
      setRenameValue(currentTitle);
      setIsRenaming(true);
    }
  }, [currentFileId, currentTitle]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && currentFileId && trimmed !== currentTitle) {
      renameFile(currentFileId, trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, currentFileId, currentTitle, renameFile]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRenameSubmit();
      } else if (e.key === 'Escape') {
        setIsRenaming(false);
      }
    },
    [handleRenameSubmit],
  );

  const handleSelectFile = useCallback(
    (id: string) => {
      loadFile(id);
      setDropdownOpen(false);
    },
    [loadFile],
  );

  const handleNewFile = useCallback(() => {
    newFile();
    setDropdownOpen(false);
  }, [newFile]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string, title: string) => {
      e.stopPropagation();
      if (window.confirm(`Delete "${title}"? This action cannot be undone.`)) {
        deleteFile(id);
      }
    },
    [deleteFile],
  );

  const toggleDropdown = useCallback(() => {
    if (!isRenaming) {
      setDropdownOpen((prev) => !prev);
    }
  }, [isRenaming]);

  const sortedFiles = [...files].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="relative" ref={dropdownRef} data-testid="file-selector">
      {/* Current file title display / rename input */}
      <div className="flex items-center gap-1">
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            data-testid="file-rename-input"
            className="h-7 w-40 rounded border border-[#0071e3] px-2 text-sm outline-none"
          />
        ) : (
          <button
            onClick={toggleDropdown}
            onDoubleClick={handleDoubleClick}
            data-testid="file-selector-button"
            title="Double-click to rename"
            className="flex h-7 max-w-48 items-center gap-1 rounded px-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <span className="truncate">{currentTitle}</span>
            <span className="shrink-0 text-gray-400">
              <ChevronDownIcon />
            </span>
          </button>
        )}
      </div>

      {/* Dropdown file list */}
      {dropdownOpen && (
        <div
          data-testid="file-dropdown"
          className="absolute top-full left-0 z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {sortedFiles.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">No files</div>
          ) : (
            sortedFiles.map((file) => (
              <div
                key={file.id}
                data-testid={`file-item-${file.id}`}
                className={`group flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-50 ${
                  file.id === currentFileId
                    ? 'bg-blue-50 font-medium text-[#0071e3]'
                    : 'text-gray-700'
                }`}
                onClick={() => handleSelectFile(file.id)}
              >
                <span className="truncate">{file.title}</span>
                <button
                  data-testid={`file-delete-${file.id}`}
                  onClick={(e) => handleDelete(e, file.id, file.title)}
                  className="shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  title={`Delete "${file.title}"`}
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}

          {/* Divider */}
          {sortedFiles.length > 0 && <div className="my-1 border-t border-gray-100" />}

          {/* New file entry */}
          <button
            data-testid="file-dropdown-new"
            onClick={handleNewFile}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <PlusIcon />
            <span>New file</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toolbar component                                                  */
/* ------------------------------------------------------------------ */

function Toolbar() {
  const canUndo = useHistoryStore((s) => s.canUndo());
  const canRedo = useHistoryStore((s) => s.canRedo());
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const clearHistory = useHistoryStore((s) => s.clear);
  const setElements = useDiagramStore((s) => s.setElements);
  const clearDiagram = useDiagramStore((s) => s.clearAll);
  const deleteSelectedElements = useDiagramStore((s) => s.deleteSelectedElements);

  const selectedIds = useEditorStore((s) => s.selectedIds);
  const gridEnabled = useEditorStore((s) => s.gridEnabled);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setGridEnabled = useEditorStore((s) => s.setGridEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);

  const newFile = useFileStore((s) => s.newFile);
  const saveCurrentFile = useFileStore((s) => s.saveCurrentFile);
  const currentFileId = useFileStore((s) => s.currentFileId);
  const files = useFileStore((s) => s.files);

  const currentTitle = files.find((f) => f.id === currentFileId)?.title ?? 'Untitled';

  const handleUndo = useCallback(() => {
    const state = undo();
    if (state) {
      setElements(state.elements);
    }
  }, [undo, setElements]);

  const handleRedo = useCallback(() => {
    const state = redo();
    if (state) {
      setElements(state.elements);
    }
  }, [redo, setElements]);

  const handleDelete = useCallback(() => {
    if (selectedIds.length > 0) {
      deleteSelectedElements(selectedIds);
    }
  }, [selectedIds, deleteSelectedElements]);

  const handleNew = useCallback(() => {
    clearDiagram();
    clearHistory();
    newFile();
  }, [clearDiagram, clearHistory, newFile]);

  const handleSave = useCallback(() => {
    saveCurrentFile();
  }, [saveCurrentFile]);

  const handleExportPNG = useCallback(() => {
    const stage = Konva.stages[0];
    if (!stage) return;

    const dataURL = stage.toDataURL({
      pixelRatio: 2,
      mimeType: 'image/png',
    });

    const link = document.createElement('a');
    link.download = `${currentTitle}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentTitle]);

  const handleExportJSON = useCallback(() => {
    const diagramState = useDiagramStore.getState();
    const json = JSON.stringify(
      {
        version: diagramState.version,
        metadata: diagramState.metadata,
        elements: diagramState.elements,
      },
      null,
      2,
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${currentTitle}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentTitle]);

  const handleToggleGrid = useCallback(() => {
    setGridEnabled(!gridEnabled);
  }, [gridEnabled, setGridEnabled]);

  const handleToggleSnap = useCallback(() => {
    setSnapEnabled(!snapEnabled);
  }, [snapEnabled, setSnapEnabled]);

  return (
    <div className="flex w-full items-center justify-between" data-testid="toolbar">
      {/* Left section: brand + file management */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0071e3] text-xs font-bold text-white">
          A
        </div>
        <span className="text-sm font-semibold text-[#1d1d1f]">AME</span>

        <div className="mx-1.5 h-5 w-px bg-gray-200" />

        {/* File selector dropdown */}
        <FileSelector />

        <div className="mx-1.5 h-5 w-px bg-gray-200" />

        {/* File operations */}
        <ToolbarButton onClick={handleNew} title="New">
          <NewIcon />
        </ToolbarButton>
        <ToolbarButton onClick={handleSave} title="Save">
          <SaveIcon />
        </ToolbarButton>
      </div>

      {/* Center section: edit / view / export tools */}
      <div className="flex items-center gap-1">
        {/* Edit operations */}
        <ToolbarButton onClick={handleUndo} disabled={!canUndo} title="Undo">
          <UndoIcon />
        </ToolbarButton>
        <ToolbarButton onClick={handleRedo} disabled={!canRedo} title="Redo">
          <RedoIcon />
        </ToolbarButton>

        <div className="mx-1.5 h-5 w-px bg-gray-200" />

        {/* Delete / edit operations */}
        <ToolbarButton onClick={handleDelete} disabled={selectedIds.length === 0} title="Delete">
          <DeleteIcon />
        </ToolbarButton>

        <div className="mx-1.5 h-5 w-px bg-gray-200" />

        {/* Grid toggle */}
        <ToolbarButton onClick={handleToggleGrid} title={gridEnabled ? 'Hide Grid' : 'Show Grid'}>
          <span className={gridEnabled ? 'text-[#0071e3]' : 'text-gray-400'}>
            <GridIcon />
          </span>
        </ToolbarButton>

        {/* Snap toggle */}
        <ToolbarButton onClick={handleToggleSnap} title={snapEnabled ? 'Disable Snap' : 'Enable Snap'}>
          <span className={snapEnabled ? 'text-[#0071e3]' : 'text-gray-400'}>
            <SnapIcon />
          </span>
        </ToolbarButton>

        <div className="mx-1.5 h-5 w-px bg-gray-200" />

        {/* Export operations */}
        <ToolbarButton onClick={handleExportPNG} title="Export PNG">
          <ExportPNGIcon />
        </ToolbarButton>
        <ToolbarButton onClick={handleExportJSON} title="Export JSON">
          <ExportJSONIcon />
        </ToolbarButton>
      </div>

      {/* Spacer to balance the logo area */}
      <div className="w-16" />
    </div>
  );
}

export default Toolbar;
