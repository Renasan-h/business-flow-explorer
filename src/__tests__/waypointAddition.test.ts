import { describe, expect, it } from 'vitest';
import type { Scenario } from '../scenario';
import { waypointAddition } from '../editor/waypointAddition';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];

const actors: Actor[] = [
 { id: 'web', name: 'Web', type: 'service', position: { x: 100, y: 200 } },
 { id: 'api', name: 'API', type: 'service', position: { x: 300, y: 200 } },
];
const step: Step = {
 id: 's1', title: '送信', description: '',
 actions: [{ type: 'transfer', from: 'web', to: 'api', payload: '', durationMs: 1000 }],
};

describe('経由点追加', () => {
 it('往路の中点へ経由点を追加する', () => {
  expect(waypointAddition(step, actors, 'forward')).toEqual({
   routing: 'orthogonal',
   waypoints: [{ x: 200, y: 200 }],
  });
 });

 it('双方向の復路だけに経由点を追加する', () => {
  const bidirectional = { ...step, bidirectional: true, reverseFrom: 'api', reverseTo: 'web' };
  expect(waypointAddition(bidirectional, actors, 'reverse')).toEqual({
   routing: 'orthogonal',
   reverseWaypoints: [{ x: 200, y: 200 }],
  });
 });

 it('片方向通信には復路経由点を作らない', () => {
  expect(waypointAddition(step, actors, 'reverse')).toBeNull();
 });

 it('存在しない接続先では変更しない', () => {
  expect(waypointAddition(step, actors.slice(0, 1), 'forward')).toBeNull();
 });

 it('経由点100個の上限を超えない', () => {
  const full = { ...step, waypoints: Array.from({ length: 100 }, (_, index) => ({ x: index, y: 200 })) };
  expect(waypointAddition(full, actors, 'forward')).toBeNull();
 });

 it('同じ座標のノード間には経由点を追加しない', () => {
  const samePosition = actors.map(actor => ({ ...actor, position: { x: 100, y: 200 } }));
  expect(waypointAddition(step, samePosition, 'forward')).toBeNull();
 });
});
