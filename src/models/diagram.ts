export interface DiagramMetadata {
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TypeElement {
  id: string;
  type: 'type';
  name: string;
  position: Position;
  size: Size;
}

export interface RelationElement {
  id: string;
  type: 'relation';
  sourceId: string;
  targetId: string;
  sourceCardinality?: string;
  targetCardinality?: string;
}

export interface GeneralizationElement {
  id: string;
  type: 'generalization';
  position: Position;
  size: Size;
  parentTypeId?: string;
  childTypeIds: string[];
  isComplete: boolean;
}

export interface NoteElement {
  id: string;
  type: 'note';
  title: string;
  content: string;
  position: Position;
  size: Size;
  attachedToId?: string;
}

export type DiagramElement = TypeElement | RelationElement | GeneralizationElement | NoteElement;

export interface Diagram {
  version: string;
  metadata: DiagramMetadata;
  elements: DiagramElement[];
}
