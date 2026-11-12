import type { Scenario } from '../scenario';
import { containsNodePoint } from './nodeGeometry';

type Point = { x: number; y: number };
type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];

/** 前面に描画されたノードを優先して接続先を判定する。 */
export function findConnectionDropTarget(actors: Actor[], point: Point): Actor | undefined {
 return [...actors].reverse().find(actor => containsNodePoint(actor, point));
}

/** 再生順マーカーの中心に近いステップを、既存の表示順で判定する。 */
export function findPlaybackOrderDropTarget(
 steps: Step[],
 point: Point,
 orderPoint: (step: Step) => Point | null,
): string | undefined {
 return steps.find(step => {
  const center = orderPoint(step);
  return center !== null && Math.hypot(center.x - point.x, center.y - point.y) < 32;
 })?.id;
}
