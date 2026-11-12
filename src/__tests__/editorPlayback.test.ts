import { describe, expect, it } from 'vitest';
import type { Scenario } from '../scenario';
import { decideConnection } from '../editor/decideConnection';
import { withConnectionDirection } from '../editor/connectionDirection';
import { removeActorConnections, removeActorFromGroups } from '../editor/removeActorReferences';
import { completeMarqueeSelection, dragSelectedActors } from '../editor/multiSelection';
import { reorderSteps } from '../editor/reorderSteps';
import { playbackActors, playbackSteps } from '../branchPlayback';
import { playbackValidationError } from '../scenario';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
const actor = (id: string, x: number, type: Actor['type'] = 'service'): Actor =>
 ({ id, name: id, type, position: { x, y: 200 } });
const step = (id: string, from: string, to: string): Step =>
 ({ id, title: id, description: '', actions: [{ type: 'transfer', from, to, payload: id, durationMs: 1000 }] });

describe('編集画面の操作ロジック', () => {
 const actors = [actor('a', 200), actor('b', 500), actor('c', 800)];
 it('通信を追加し、逆方向は重複せず双方向に統合する', () => {
  const created = decideConnection('a', 'b', actors, [], 'new');
  expect(created.kind).toBe('create');
  if (created.kind !== 'create') throw new Error('新規通信が作成されませんでした');
  const reverse = decideConnection('b', 'a', actors, [created.step], 'other');
  expect(reverse).toMatchObject({ kind: 'reverse', stepId: 'new' });
  expect(withConnectionDirection(created.step, true)).toMatchObject({
   bidirectional: true, reverseFrom: 'b', reverseTo: 'a',
  });
  expect(withConnectionDirection(withConnectionDirection(created.step, true), false).reverseFrom).toBeUndefined();
 });
 it('範囲選択と複数移動で相対位置を維持する', () => {
  expect(completeMarqueeSelection(actors, { x: 100, y: 100 }, { x: 600, y: 300 }, [], false, 150, 76))
   .toEqual(['a', 'b']);
  const moved = dragSelectedActors(actors, [{ id: 'a', x: 200, y: 200 }, { id: 'b', x: 500, y: 200 }],
   { x: 0, y: 0 }, { x: 100, y: 40 },
   { width: 1200, height: 800, nodeWidth: 150, nodeHeight: 76 });
  expect(moved.map(a => a.position)).toEqual([{ x: 300, y: 240 }, { x: 600, y: 240 }, { x: 800, y: 200 }]);
 });
 it('削除ノードの通信とグループ参照を除去する', () => {
  expect(removeActorConnections([step('s1', 'a', 'b'), step('s2', 'b', 'c')], 'a').map(s => s.id)).toEqual(['s2']);
  expect(removeActorFromGroups([{ id: 'g', name: '領域', x: 0, y: 0, width: 300, height: 200, memberIds: ['a', 'b'] }], 'a')[0].memberIds).toEqual(['b']);
 });
 it('再生順を入れ替え、orderを再採番する', () => {
  const ordered = reorderSteps([step('s1', 'a', 'b'), step('s2', 'b', 'c')], 's2', 's1');
  expect(ordered.map(s => [s.id, s.order])).toEqual([['s2', 1], ['s1', 2]]);
 });
});

describe('再生画面の分岐と通信検証', () => {
 const actors = [actor('start', 200), actor('decision', 400, 'decision'), actor('yes', 600), actor('no', 800)];
 const steps = [step('start', 'start', 'decision'), step('yes', 'decision', 'yes'), step('no', 'decision', 'no')];
 it('選択した分岐のみを再生し、非選択ノードを隠す', () => {
  expect(playbackSteps(actors, steps, { decision: 'no' }).map(s => s.id)).toEqual(['start', 'no']);
  expect(playbackActors(actors, steps, { decision: 'no' }).map(a => a.id)).toEqual(['start', 'decision', 'no']);
 });
 it('復路未設定の双方向通信は再生開始を拒否する', () => {
  const broken = { ...steps[0], bidirectional: true };
  expect(playbackValidationError({ actors, steps: [broken] })).toContain('未設定');
  expect(playbackValidationError({ actors, steps: [withConnectionDirection(broken, true)] })).toBeNull();
 });
});
