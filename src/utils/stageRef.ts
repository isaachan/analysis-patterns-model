import type Konva from 'konva';

let _stageRef: Konva.Stage | null = null;

export function setStageRef(ref: Konva.Stage | null) {
  _stageRef = ref;
}

export function getStageRef(): Konva.Stage | null {
  return _stageRef;
}
