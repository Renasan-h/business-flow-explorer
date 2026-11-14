import type { Scenario } from '../scenario';
import { insertWaypointBetweenNodes } from './waypointInsertion';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
type Direction = 'forward' | 'reverse';

/**
 * 接続線の指定方向へ経由点を追加する更新内容を計算する。
 * 不正な接続先、復路未設定、経由点上限の場合は変更しない。
 */
export function waypointAddition(
 step: Step | undefined,
 actors: Actor[],
 direction: Direction,
): Partial<Step> | null {
 if (!step) return null;
 const action = step.actions[0];
 const fromId = direction === 'reverse' ? step.reverseFrom : action?.from;
 const toId = direction === 'reverse' ? step.reverseTo : action?.to;
 if (!fromId || !toId || (direction === 'reverse' && !step.bidirectional)) return null;
 const from = actors.find(actor => actor.id === fromId);
 const to = actors.find(actor => actor.id === toId);
 if (!from || !to) return null;
 const field = direction === 'reverse' ? 'reverseWaypoints' : 'waypoints';
 const existing = step[field] ?? [];
 if (existing.length >= 100) return null;
 const waypoints = insertWaypointBetweenNodes(from.position, to.position, existing);
 if (waypoints.length === existing.length) return null;
 return { routing: 'orthogonal', [field]: waypoints };
}
