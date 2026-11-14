import { describe, expect, it } from 'vitest';
import { selectionAfterActorDeletion, selectionAfterStepDeletion } from '../editor/deletionSelection';

describe('削除後の選択状態', () => {
 it('削除対象ノードだけを選択と接続元から除外する', () => {
  expect(selectionAfterActorDeletion('a', {
   selectedActor: 'a', selectedActors: ['a', 'b', 'c'], source: 'a',
  })).toEqual({ selectedActor: null, selectedActors: ['b', 'c'], source: null });
 });

 it('削除対象以外の選択状態を保持する', () => {
  expect(selectionAfterActorDeletion('a', {
   selectedActor: 'b', selectedActors: ['b', 'c'], source: 'c',
  })).toEqual({ selectedActor: 'b', selectedActors: ['b', 'c'], source: 'c' });
 });

 it('削除対象ステップの選択と再生順指定を解除する', () => {
  expect(selectionAfterStepDeletion('s1', { selectedStep: 's1', orderSource: 's1' }))
   .toEqual({ selectedStep: null, orderSource: null });
 });

 it('削除対象以外のステップ選択と再生順指定を維持する', () => {
  expect(selectionAfterStepDeletion('s1', { selectedStep: 's2', orderSource: 's3' }))
   .toEqual({ selectedStep: 's2', orderSource: 's3' });
 });
});
