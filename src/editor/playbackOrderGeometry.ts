import type { Scenario } from '../scenario';
import { offsetRoute, pointOnRoute, routeConnection, routeViaWaypoints } from '../connectionRouting';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
type Point = { x: number; y: number };

/** 通信線の描画と同じ条件で往路の座標列を求める。 */
function forwardRoute(step: Step, actors: Actor[]): Point[] | null {
 const action = step.actions[0];
 if (!action || !actors.some(actor => actor.id === action.from) || !actors.some(actor => actor.id === action.to)) return null;
 return step.routing === 'orthogonal' && step.waypoints?.length
  ? routeViaWaypoints(actors, action.from, action.to, step.waypoints)
  : routeConnection(actors, action.from, action.to, step.routing ?? 'straight');
}

/** 再生順番号は表示中の往路の経路長50%地点に置く。 */
export function playbackOrderPoint(step: Step, actors: Actor[], steps: Step[]): Point | null {
 const points = forwardRoute(step, actors);
 const action = step.actions[0];
 if (!points || !action) return null;
 const bidirectional = Boolean(step.bidirectional) || steps.some(other => other.actions.some(otherAction =>
  otherAction.from === action.to && otherAction.to === action.from));
 return pointOnRoute(bidirectional ? offsetRoute(points, -12) : points, 0.5);
}

/** 短い通信線でも操作できる範囲を確保しつつ、経路長に合わせて半径を調整する。 */
export function playbackOrderRadius(step: Step, actors: Actor[]): number {
 const points = forwardRoute(step, actors);
 if (!points) return 16;
 const length = points.slice(1).reduce((total, point, index) =>
  total + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
 return Math.max(12, Math.min(21, Math.round(length / 18)));
}
