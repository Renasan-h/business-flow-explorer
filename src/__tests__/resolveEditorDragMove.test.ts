import { describe, expect, it } from 'vitest';
import type { Scenario } from '../scenario';
import type { DragStart } from '../editor/dragStartState';
import { resolveEditorDragMove } from '../editor/resolveEditorDragMove';

const actors: Scenario['actors'] = [
 { id: 'a', name: 'A', type: 'service', position: { x: 200, y: 200 } },
];
const bounds = { width: 3600, height: 1800 };
const base: DragStart = {
 id: 1, actorId: null, x: 10, y: 20,
 initial: { x: 100, y: 100 }, offset: { x: 5, y: 8 },
};

describe('ドラッグ操作の判定', () => {
 it('キャンバスのパンを開始時点のオフセットから計算する', () => {
  expect(resolveEditorDragMove(base, { x: 20, y: -5 }, actors, bounds))
   .toEqual({ kind: 'pan', offset: { x: 25, y: 3 } });
 });

 it('領域移動では移動先を返す', () => {
  expect(resolveEditorDragMove({ ...base, groupId: 'g' }, { x: 30, y: -200 }, actors, bounds))
   .toEqual({ kind: 'group', id: 'g', next: { x: 130, y: 0 }, resize: false });
 });

 it('領域リサイズを区別する', () => {
  expect(resolveEditorDragMove({ ...base, groupId: 'g', resizeGroup: true }, { x: 10, y: 20 }, actors, bounds))
   .toMatchObject({ kind: 'group', id: 'g', resize: true });
 });

 it('ノード移動は開始座標から計算する', () => {
  expect(resolveEditorDragMove({ ...base, actorId: 'a', initial: { x: 200, y: 200 } }, { x: 40, y: 30 }, actors, bounds))
   .toEqual({ kind: 'actor-move', id: 'a', position: { x: 240, y: 230 } });
 });

 it('ノードサイズ変更を区別する', () => {
  expect(resolveEditorDragMove({ ...base, actorId: 'a', resizeActor: true, initial: { x: 200, y: 200 },
   initialSize: { width: 150, height: 76 } }, { x: 20, y: 10 }, actors, bounds))
   .toEqual({ kind: 'actor-resize', id: 'a', size: { width: 190, height: 96 } });
 });

 it('存在しないノードは更新しない', () => {
  expect(resolveEditorDragMove({ ...base, actorId: 'missing' }, { x: 10, y: 10 }, actors, bounds))
   .toEqual({ kind: 'none' });
 });
});
