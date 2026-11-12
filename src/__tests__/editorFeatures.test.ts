import { describe, expect, it } from 'vitest';
import type { Scenario } from '../scenario';
import { insertWaypointBetweenNodes } from '../editor/waypointInsertion';
import { moveDraggedWaypoint, waypointMenuState } from '../editor/waypointEditing';
import { findConnectionDropTarget, findPlaybackOrderDropTarget } from '../editor/pointerDropTargets';
import { prepareTemplateImport } from '../editor/prepareTemplateImport';
import { duplicateEditorActor } from '../editor/duplicateEditorActor';
import { boundedGroupOrigin } from '../editor/visibleCanvasPlacement';
import { validateEditorScenario } from '../editor/validateEditorScenario';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
const actor = (id: string, x: number): Actor => ({ id, name: id, type: 'service', position: { x, y: 100 } });
const step = (id: string, from: string, to: string): Step => ({
 id, title: id, description: '', actions: [{ type: 'transfer', from, to, payload: '', durationMs: 1000 }],
});

describe('経由点とキャンバス', () => {
 it('最長区間へ経由点を追加し、同一点なら追加しない', () => {
  expect(insertWaypointBetweenNodes({ x: 0, y: 0 }, { x: 100, y: 0 }, []))
   .toEqual([{ x: 50, y: 0 }]);
  expect(insertWaypointBetweenNodes({ x: 0, y: 0 }, { x: 0, y: 0 }, [])).toEqual([]);
 });
 it('復路の経由点だけを移動し、キャンバス外の値を制限する', () => {
  const original = { ...step('s', 'a', 'b'), bidirectional: true,
   waypoints: [{ x: 10, y: 20 }], reverseWaypoints: [{ x: 20, y: 30 }] };
  const moved = moveDraggedWaypoint([original], { stepId: 's', index: 0, direction: 'reverse' },
   { x: -100, y: 999 }, { width: 500, height: 400 })[0];
  expect(moved.waypoints).toEqual([{ x: 10, y: 20 }]);
  expect(moved.reverseWaypoints).toEqual([{ x: 0, y: 400 }]);
  expect(waypointMenuState(moved)).toEqual({ reverse: true, forwardCount: 1, reverseCount: 1 });
 });
 it('重なったノードは前面を優先し、再生順マーカーを検出する', () => {
  const actors = [actor('back', 100), actor('front', 100)];
  expect(findConnectionDropTarget(actors, { x: 100, y: 100 })?.id).toBe('front');
  expect(findPlaybackOrderDropTarget([step('s', 'back', 'front')], { x: 120, y: 100 },
   () => ({ x: 100, y: 100 }))).toBe('s');
 });
 it('領域をキャンバス境界内に配置する', () => {
  expect(boundedGroupOrigin({ x: 900, y: 900 }, { width: 300, height: 200 },
   { width: 1000, height: 800 })).toEqual({ x: 700, y: 600 });
 });
});

describe('テンプレート・複製・保存検証', () => {
 const actors = [actor('a', 200), actor('b', 500)];
 it('直接展開でID衝突を採番し、通信参照を付け替える', () => {
  const result = prepareTemplateImport({
   actors: [{ id: 'a', name: 'copy', type: 'service', position: { x: 300, y: 100 } }],
   steps: [step('s', 'a', 'b')],
  }, 'inline', actors, [step('s', 'a', 'b')]);
  expect(result.newActors[0].id).toBe('a-2');
  expect(result.newSteps[0].id).toBe('s-2');
  expect(result.newSteps[0].actions[0].from).toBe('a-2');
  expect(result.renamed).toBe(2);
 });
 it('参照モードは重複IDを拒否する', () => {
  expect(() => prepareTemplateImport({ actors: [actor('a', 100)], steps: [] },
   'reference', actors, [])).toThrow('重複');
 });
 it('複製後のタグ配列は元ノードと共有しない', () => {
  const original = { ...actors[0], tags: ['original'] };
  const copy = duplicateEditorActor(original, 'copy', { width: 1200, height: 800 });
  copy.tags?.push('new');
  expect(original.tags).toEqual(['original']);
  expect(copy.id).toBe('copy');
 });
 it('重複ノードID・空通信・不正グループを保存前に拒否する', () => {
  expect(validateEditorScenario([actors[0], actors[0]], [step('s', 'a', 'b')], [])).not.toBeNull();
  expect(validateEditorScenario(actors, [{ ...step('s', 'a', 'b'), actions: [] }], [])).not.toBeNull();
  expect(validateEditorScenario(actors, [step('s', 'a', 'b')],
   [{ id: 'g', name: 'invalid', x: 0, y: 0, width: -1, height: 100 }])).not.toBeNull();
 });
});
