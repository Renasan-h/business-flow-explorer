import { describe, expect, it } from 'vitest';
import { resolveCanvasSelection } from '../editor/resolveCanvasSelection';

describe('ポインター開始時の選択判定', () => {
 it('ノード選択では通信線と領域の選択を解除する', () => {
  expect(resolveCanvasSelection('web', null)).toEqual({
   kind: 'actor', selectedActor: 'web', selectedStep: null, selectedGroup: null,
  });
 });

 it('通信線選択はドラッグを開始しない種類として返す', () => {
  expect(resolveCanvasSelection(null, 'step1')).toEqual({
   kind: 'step', selectedActor: null, selectedStep: 'step1', selectedGroup: null,
  });
 });

 it('空白クリックですべての単一選択を解除する', () => {
  expect(resolveCanvasSelection(null, null)).toEqual({
   kind: 'empty', selectedActor: null, selectedStep: null, selectedGroup: null,
  });
 });

 it('ノードと通信線が重なった場合はノードを優先する', () => {
  expect(resolveCanvasSelection('web', 'step1').kind).toBe('actor');
 });
});
