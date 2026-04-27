import type React from 'react';
import { useState } from 'react';
import { useZoomPan } from '../../hooks/useZoomPan';
import useEditorStore from '../../store/useEditorStore';
import useHistoryStore from '../../store/useHistoryStore';
import { downloadJSON, buildDiagram, downloadPNG } from '../../utils/export';

interface ToolbarButtonProps {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

function ToolbarButton({ title, children, onClick, disabled }: ToolbarButtonProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center w-7 h-7 rounded hover:bg-black/5 active:bg-black/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </button>
  );
}

function Separator() {
  return (
    <div
      className="w-px h-5 mx-1"
      style={{ backgroundColor: 'var(--color-border-secondary)' }}
    />
  );
}

function Toolbar() {
  const { zoom, zoomIn, zoomOut, resetView } = useZoomPan();
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const applyUndo = useEditorStore((s) => s.applyUndo);
  const applyRedo = useEditorStore((s) => s.applyRedo);
  const createNewFile = useEditorStore((s) => s.createNewFile);
  const switchFile = useEditorStore((s) => s.switchFile);
  const renameFile = useEditorStore((s) => s.renameFile);
  const deleteFile = useEditorStore((s) => s.deleteFile);
  const files = useEditorStore((s) => s.files);
  const currentFileId = useEditorStore((s) => s.currentFileId);
  const canvasElements = useEditorStore((s) => s.canvasElements);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const [showResolutionMenu, setShowResolutionMenu] = useState(false);
  const [showFileList, setShowFileList] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const handleDelete = () => {
    selectedIds.forEach((id) => deleteElement(id));
  };

  const currentFile = files.find((f) => f.id === currentFileId);
  const sortedFiles = [...files].sort((a, b) => b.updatedAt - a.updatedAt);
  const diagramTitle = currentFile?.title ?? 'diagram';

  const handleRenameConfirm = () => {
    if (isRenaming && currentFile) {
      const trimmed = renameValue.trim();
      if (trimmed) {
        renameFile(currentFile.id, trimmed);
      }
    }
    setIsRenaming(false);
  };

  const handleExportPNG = (pixelRatio: number) => {
    setShowResolutionMenu(false);
    const filename = `${diagramTitle}.png`;
    downloadPNG(filename, pixelRatio);
  };

  const handleExportJSON = () => {
    const diagram = buildDiagram(canvasElements, files, currentFileId);
    downloadJSON(diagram);
  };

  return (
    <header
      className="flex items-center gap-1 px-4 border-b select-none"
      style={{
        height: 'var(--toolbar-height)',
        backgroundColor: 'var(--color-bg-toolbar)',
        borderColor: 'var(--color-border-primary)',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <span
        className="font-semibold text-sm mr-2"
        style={{ color: 'var(--color-text-primary)' }}
      >
        AME
      </span>

      {/* File Switcher */}
      <div className="relative flex items-center">
        {isRenaming ? (
          <input
            autoFocus
            className="text-sm rounded outline-none"
            style={{
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-accent)',
              height: 24,
              width: Math.max(renameValue.length * 7.5 + 20, 80),
              padding: '0 6px',
            }}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameConfirm();
              } else if (e.key === 'Escape') {
                setIsRenaming(false);
              }
            }}
            onBlur={handleRenameConfirm}
            onFocus={(e) => e.target.select()}
          />
        ) : (
          <button
            className="flex items-center gap-1 text-sm rounded px-1.5 py-0.5 hover:bg-black/5 active:bg-black/10 transition-colors max-w-[160px]"
            style={{ color: 'var(--color-text-primary)' }}
            onClick={() => setShowFileList(!showFileList)}
            onDoubleClick={() => {
              if (currentFile) {
                setRenameValue(currentFile.title);
                setIsRenaming(true);
              }
            }}
          >
            <span className="truncate">{currentFile?.title || 'Untitled'}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className="flex-shrink-0"
              style={{
                color: 'var(--color-text-tertiary)',
                transform: showFileList ? 'rotate(180deg)' : undefined,
                transition: 'transform 0.15s ease',
              }}
            >
              <path
                d="M2 3.5l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {showFileList && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowFileList(false)}
            />
            <div
              className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-lg border py-1 min-w-[180px] max-h-[320px] overflow-y-auto"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-primary)',
              }}
            >
              {sortedFiles.length > 0 ? (
                sortedFiles.map((file) => {
                  const isCurrent = file.id === currentFileId;
                  return (
                    <div
                      key={file.id}
                      className="flex items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-black/5 transition-colors group"
                      style={{
                        color: isCurrent
                          ? 'var(--color-accent)'
                          : 'var(--color-text-primary)',
                        fontWeight: isCurrent ? 600 : 400,
                      }}
                      onClick={() => {
                        switchFile(file.id);
                        setShowFileList(false);
                      }}
                    >
                      <span className="flex-1 truncate mr-2">
                        {file.title}
                      </span>
                      <button
                        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                        style={{
                          color: 'var(--color-text-tertiary)',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(`Delete "${file.title}"?`)
                          ) {
                            deleteFile(file.id);
                            setShowFileList(false);
                          }
                        }}
                        title="Delete file"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2.5 3h7"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M4 3V2a1 1 0 011-1h2a1 1 0 011 1v1"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M9 3v7a1 1 0 01-1 1H4a1 1 0 01-1-1V3"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                        </svg>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div
                  className="px-3 py-2 text-sm"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  No files
                </div>
              )}

              {sortedFiles.length > 0 && (
                <div
                  className="border-t mx-2 my-1"
                  style={{ borderColor: 'var(--color-border-secondary)' }}
                />
              )}

              <button
                className="flex items-center gap-1.5 w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={() => {
                  createNewFile();
                  setShowFileList(false);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M6 2v8M2 6h8"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                New
              </button>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* New */}
      <ToolbarButton title="New" onClick={createNewFile}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      {/* Save */}
      <ToolbarButton title="Save">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 13V3a1 1 0 011-1h5.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V13a1 1 0 01-1 1H4a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 13V9h4v4" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </ToolbarButton>

      <Separator />

      {/* Undo */}
      <ToolbarButton title="Undo (Ctrl+Z)" onClick={applyUndo} disabled={!canUndo}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 7h6a3 3 0 010 6H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 4L4 7l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarButton>

      {/* Redo */}
      <ToolbarButton title="Redo (Ctrl+Y)" onClick={applyRedo} disabled={!canRedo}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 7H6a3 3 0 000 6h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarButton>

      {/* Delete */}
      <ToolbarButton title="Delete" onClick={handleDelete} disabled={selectedIds.length === 0}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 4h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.3" />
          <path d="M12 4v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6.5 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M9.5 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      <Separator />

      {/* Zoom Out */}
      <ToolbarButton title="Zoom Out" onClick={zoomOut}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M5.5 7h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      {/* Zoom percentage */}
      <span
        className="text-xs tabular-nums w-10 text-center"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {Math.round(zoom * 100)}%
      </span>

      {/* Zoom In */}
      <ToolbarButton title="Zoom In" onClick={zoomIn}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M5.5 7h3M7 5.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      {/* Reset View */}
      <ToolbarButton title="Reset View" onClick={resetView}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      <Separator />

      {/* Export */}
      <div className="relative">
        <ToolbarButton title="Export PNG" onClick={() => setShowResolutionMenu((prev) => !prev)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11 10l-3 3-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 13V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 11v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </ToolbarButton>
        {showResolutionMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowResolutionMenu(false)}
            />
            <div
              className="absolute top-full left-0 mt-1 z-20 rounded-md shadow-lg border py-1 min-w-[72px]"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-primary)',
              }}
            >
              <button
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
                onClick={() => handleExportPNG(1)}
              >
                1x
              </button>
              <button
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
                onClick={() => handleExportPNG(2)}
              >
                2x
              </button>
            </div>
          </>
        )}
      </div>

      {/* Export JSON */}
      <ToolbarButton title="Export JSON" onClick={handleExportJSON}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M5 4L2 8l3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 4l3 4-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarButton>
    </header>
  );
}

export default Toolbar;
