import type { Scenario } from '../scenario';

type Step = Scenario['steps'][number];
type Point = { x: number; y: number };
export type WaypointDirection = 'forward' | 'reverse';

/** 経由点をキャンバスの範囲内に収める。 */
export function clampWaypoint(point: Point, bounds: { width: number; height: number }): Point {
 return {
  x: Math.max(0, Math.min(bounds.width, point.x)),
  y: Math.max(0, Math.min(bounds.height, point.y)),
 };
}

/** 往路・復路の指定経由点だけを更新し、他の通信設定を維持する。 */
export function moveWaypoint(step: Step, direction: WaypointDirection, index: number, position: Point): Step {
 const key = direction === 'reverse' ? 'reverseWaypoints' : 'waypoints';
 const waypoints = step[key];
 if (!waypoints || index < 0 || index >= waypoints.length) return step;
 return { ...step, [key]: waypoints.map((point, currentIndex) => currentIndex === index ? position : point) };
}

/** ドラッグ対象の経由点だけを移動し、キャンバス外への移動を防ぐ。 */
export function moveDraggedWaypoint(
 steps: Step[],
 target: { stepId: string; index: number; direction: WaypointDirection },
 point: Point,
 bounds: { width: number; height: number },
): Step[] {
 const position = clampWaypoint(point, bounds);
 return steps.map(step => step.id === target.stepId
  ? moveWaypoint(step, target.direction, target.index, position)
  : step);
}

/** メニューで表示する方向別の経由点数を取得する。 */
export function waypointMenuState(step: Step | undefined): { reverse: boolean; forwardCount: number; reverseCount: number } {
 return {
  reverse: Boolean(step?.bidirectional),
  forwardCount: step?.waypoints?.length ?? 0,
  reverseCount: step?.reverseWaypoints?.length ?? 0,
 };
}
