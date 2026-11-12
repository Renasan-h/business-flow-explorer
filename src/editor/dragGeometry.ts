import type { Scenario } from '../scenario';
import { clampNodePosition } from './nodeGeometry';

type Actor = Scenario['actors'][number];
type Point = { x: number; y: number };
type Size = { width: number; height: number };
type MemberPosition = Point & { id: string };

/** 領域の移動先をキャンバスの左上境界内に収める。 */
export function movedGroupOrigin(initial: Point, delta: Point): Point {
 return { x: Math.max(0, initial.x + delta.x), y: Math.max(0, initial.y + delta.y) };
}

/** 領域移動に伴い、所属ノードの開始位置から移動量を適用する。 */
export function moveGroupMembers(actors: Actor[], members: MemberPosition[], initial: Point, next: Point, bounds: Size): Actor[] {
 const memberPositions = new Map(members.map(item => [item.id, item]));
 return actors.map(actor => {
  const position = memberPositions.get(actor.id);
  if (!position) return actor;
  return {
   ...actor,
   position: clampNodePosition(actor, {
    x: position.x + next.x - initial.x,
    y: position.y + next.y - initial.y,
   }, bounds),
  };
 });
}

/** ノード中心を固定したまま、キャンバス境界に合わせてサイズを制限する。 */
export function resizedNodeSize(initial: Point, size: Size, delta: Point, bounds: Size): Size {
 const maxWidth = Math.min(800, initial.x * 2, (bounds.width - initial.x) * 2);
 const maxHeight = Math.min(500, initial.y * 2, (bounds.height - initial.y) * 2);
 return {
  width: Math.max(100, Math.min(maxWidth, size.width + delta.x * 2)),
  height: Math.max(60, Math.min(maxHeight, size.height + delta.y * 2)),
 };
}

/** 領域リサイズ時の最小サイズを適用する。 */
export function resizedGroupSize(initial: Size, delta: Point): Size {
 return {
  width: Math.max(200, initial.width + delta.x),
  height: Math.max(120, initial.height + delta.y),
 };
}
