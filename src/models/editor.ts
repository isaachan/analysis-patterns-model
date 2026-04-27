export type ToolMode = 'select' | 'type' | 'relation' | 'generalization' | 'shortSemantic' | 'longSemantic' | 'note';

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
}
