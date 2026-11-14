import { describe, expect, it } from 'vitest';
import { updateDraggedGroup } from '../editor/dragGeometry';

const groups = [
 { id: 'g1', x: 100, y: 80, width: 400, height: 300, name: '領域1' },
 { id: 'g2', x: 500, y: 500, width: 300, height: 200, name: '領域2' },
];

describe('領域ドラッグの状態更新', () => {
 it('指定領域だけを移動し、他の領域を変更しない', () => {
  const result = updateDraggedGroup(groups, 'g1', { x: 100, y: 80 }, undefined, { x: 30, y: -20 }, false);
  expect(result[0]).toMatchObject({ x: 130, y: 60, width: 400, height: 300 });
  expect(result[1]).toBe(groups[1]);
 });

 it('領域リサイズでは位置を変更せず、開始時のサイズを基準にする', () => {
  const result = updateDraggedGroup(groups, 'g1', { x: 100, y: 80 }, { width: 400, height: 300 }, { x: 50, y: 30 }, true);
  expect(result[0]).toMatchObject({ x: 100, y: 80, width: 450, height: 330 });
 });

 it('左上の境界を超える移動を制限する', () => {
  const result = updateDraggedGroup(groups, 'g1', { x: 100, y: 80 }, undefined, { x: -300, y: -300 }, false);
  expect(result[0]).toMatchObject({ x: 0, y: 0 });
 });

 it('リサイズ時の最小サイズを維持する', () => {
  const result = updateDraggedGroup(groups, 'g1', { x: 100, y: 80 }, undefined, { x: -500, y: -500 }, true);
  expect(result[0]).toMatchObject({ width: 200, height: 120 });
 });
});
