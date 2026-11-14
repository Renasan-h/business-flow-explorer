import type { Scenario } from '../scenario';
import type { DragStart } from './dragStartState';
import { movedGroupOrigin, movedNodePosition, resizedNodeSize } from './dragGeometry';

type Actor = Scenario['actors'][number];
type Point = { x: number; y: number };
type Size = { width: number; height: number };

export type DragMoveResult =
 | { kind: 'group'; id: string; next: Point; resize: boolean }
 | { kind: 'actor-resize'; id: string; size: Size }
 | { kind: 'actor-move'; id: string; position: Point }
 | { kind: 'pan'; offset: Point }
 | { kind: 'none' };

/**
 * ポインター移動の結果をドラッグ開始時点の値から計算する。
 * Reactの状態更新は行わず、FlowEditorは結果の反映だけを担当する。
 */
export function resolveEditorDragMove(
 drag: DragStart,
 delta: Point,
 actors: Actor[],
 bounds: Size,
): DragMoveResult {
 if (drag.groupId) {
  return { kind: 'group', id: drag.groupId, next: movedGroupOrigin(drag.initial, delta), resize: Boolean(drag.resizeGroup) };
 }
 if (drag.actorId && drag.resizeActor) {
  if (!drag.initialSize) return { kind: 'none' };
  return { kind: 'actor-resize', id: drag.actorId,
   size: resizedNodeSize(drag.initial, drag.initialSize, delta, bounds) };
 }
 if (drag.actorId) {
  const actor = actors.find(item => item.id === drag.actorId);
  if (!actor) return { kind: 'none' };
  return { kind: 'actor-move', id: drag.actorId,
   position: movedNodePosition(actor, drag.initial, delta, bounds) };
 }
 return { kind: 'pan', offset: { x: drag.offset.x + delta.x, y: drag.offset.y + delta.y } };
}
