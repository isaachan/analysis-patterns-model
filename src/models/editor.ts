/** Tool modes available in the editor */
export type ToolMode = 'select' | 'type' | 'relation' | 'generalization' | 'note' | 'short-semantic' | 'long-semantic';

/** Editor UI state (transient, not persisted) */
export interface EditorState {
  currentTool: ToolMode;
  selectedIds: string[];
  hoveredId: string | null;
  zoom: number;
  panX: number;
  panY: number;
  gridEnabled: boolean;
  snapEnabled: boolean;
  isDragging: boolean;
  /** ID of the source Type for relation creation (click-click or drag mode) */
  relationSourceId: string | null;
  /** End point of the preview line during drag-to-create (canvas coordinates) */
  relationEndPoint: { x: number; y: number } | null;
  /** ID of the parent Type selected during generalization creation flow */
  generalizationParentId: string | null;
}
