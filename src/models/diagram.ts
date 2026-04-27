/** Unique identifier for diagram elements */
export type ElementId = string;

/** Supported diagram element types */
export type ElementType = 'type' | 'relation' | 'generalization' | 'note' | 'longSemantic';

/** A short semantic marker (bracketed label attached to types, mappings, or associations) */
export interface ShortSemantic {
  /** Marker type identifier */
  type: string;
  /** Optional parameter (e.g. key type for 'key' marker) */
  keyType?: string;
}

/** Long semantic heading types */
export type LongSemanticHeading = 'constraint' | 'derivation' | 'note';

/** Cardinality notation for relation endpoints */
export type Cardinality = 'exactly_one' | 'zero_or_one' | 'zero_or_many' | 'one_or_many';

/** Base layout properties shared by all elements */
export interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A Type node representing a concept/class in the model */
export interface TypeElement {
  id: ElementId;
  type: 'type';
  name: string;
  attributes: string[];
  methods: string[];
  /** Short semantic markers (abstract, singleton, etc.) */
  semantics?: ShortSemantic[];
  layout: Layout;
}

/** Which edge of a type box an anchor attaches to */
export type AnchorEdge = 'top' | 'right' | 'bottom' | 'left';

/** Defines where a relation line attaches to a type box edge */
export interface Anchor {
  edge: AnchorEdge;
  /** Normalized position along the edge (0–1).
   *  top/bottom: 0=left, 1=right.
   *  left/right: 0=top, 1=bottom. */
  offset: number;
}

/** A relation line connecting two Type nodes */
export interface RelationElement {
  id: ElementId;
  type: 'relation';
  sourceId: ElementId;
  targetId: ElementId;
  sourceCardinality: Cardinality;
  targetCardinality: Cardinality;
  label: string;
  /** Short semantic markers attached to the source-end mapping */
  sourceSemantics?: ShortSemantic[];
  /** Short semantic markers attached to the target-end mapping */
  targetSemantics?: ShortSemantic[];
  /** Short semantic markers attached to the association (midpoint) */
  associationSemantics?: ShortSemantic[];
  /** Where the line attaches on the source type box edge (free placement) */
  sourceAnchor?: Anchor;
  /** Where the line attaches on the target type box edge (free placement) */
  targetAnchor?: Anchor;
  /** Intermediate bend points for custom path routing */
  waypoints?: Array<{ x: number; y: number }>;
}

/** A generalization container (subtype/supertype relationship) */
export interface GeneralizationElement {
  id: ElementId;
  type: 'generalization';
  name: string;
  childIds: ElementId[];
  parentId: ElementId | null;
  /** Complete = single bottom line (rect's own bottom edge); Incomplete = double bottom line (extra line inside) */
  completeness: 'complete' | 'incomplete';
  layout: Layout;
}

/** A note/annotation box on the canvas */
export interface NoteElement {
  id: ElementId;
  type: 'note';
  content: string;
  layout: Layout;
}

/** A long semantic statement sticky-note */
export interface LongSemanticElement {
  id: ElementId;
  type: 'longSemantic';
  heading: LongSemanticHeading;
  body: string;
  /** Attached Type or Relation id; undefined = free-floating */
  attachedTo?: ElementId;
  layout: Layout;
}

/** Union type of all diagram elements */
export type DiagramElement =
  | TypeElement
  | RelationElement
  | GeneralizationElement
  | NoteElement
  | LongSemanticElement;

/** Diagram metadata */
export interface DiagramMetadata {
  title: string;
  createdAt: number;
  updatedAt: number;
}

/** The root diagram state */
export interface DiagramState {
  version: string;
  metadata: DiagramMetadata;
  elements: DiagramElement[];
}
