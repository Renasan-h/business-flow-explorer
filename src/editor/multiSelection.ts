import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];
export type EditorPoint = { x: number; y: number };
export type SelectionRectangle = { left: number; right: number; top: number; bottom: number };
export type DragOrigin = { id: string; x: number; y: number };

/** ドラッグ方向に依存しない矩形へ正規化する。 */
export function selectionRectangle(start: EditorPoint, end: EditorPoint): SelectionRectangle {
 return {
  left: Math.min(start.x, end.x),
  right: Math.max(start.x, end.x),
  top: Math.min(start.y, end.y),
  bottom: Math.max(start.y, end.y),
 };
}

/** ノードの描画矩形と選択範囲が重なっていれば選択対象にする。 */
export function actorsInSelection(
 actors: Actor[], rect: SelectionRectangle, nodeWidth: number, nodeHeight: number,
): string[] {
 return actors.filter(actor =>
  actor.position.x + (actor.width ?? nodeWidth) / 2 >= rect.left &&
  actor.position.x - (actor.width ?? nodeWidth) / 2 <= rect.right &&
  actor.position.y + (actor.height ?? nodeHeight) / 2 >= rect.top &&
  actor.position.y - (actor.height ?? nodeHeight) / 2 <= rect.bottom
 ).map(actor => actor.id);
}

/** 複数ノードの相対位置を維持しながら、全ノードを描画範囲内に収める移動量。 */
export function boundedGroupDelta(
 initial: DragOrigin[], delta: EditorPoint,
 bounds: { width: number; height: number; nodeWidth: number; nodeHeight: number },
): EditorPoint {
 if (!initial.length) return { x: 0, y: 0 };
 const minX = Math.max(...initial.map(item => bounds.nodeWidth / 2 - item.x));
 const maxX = Math.min(...initial.map(item => bounds.width - bounds.nodeWidth / 2 - item.x));
 const minY = Math.max(...initial.map(item => bounds.nodeHeight / 2 - item.y));
 const maxY = Math.min(...initial.map(item => bounds.height - bounds.nodeHeight / 2 - item.y));
 return { x: Math.max(minX, Math.min(maxX, delta.x)), y: Math.max(minY, Math.min(maxY, delta.y)) };
}

/** 元座標を基準に再計算し、ポインター移動回数による誤差蓄積を防ぐ。 */
export function moveSelectedActors(actors: Actor[], initial: DragOrigin[], delta: EditorPoint): Actor[] {
 const origins = new Map(initial.map(item => [item.id, item]));
 return actors.map(actor => {
  const origin = origins.get(actor.id);
  return origin ? { ...actor, position: { x: origin.x + delta.x, y: origin.y + delta.y } } : actor;
 });
}
