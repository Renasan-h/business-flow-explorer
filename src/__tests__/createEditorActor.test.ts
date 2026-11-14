import { describe, expect, it } from 'vitest';
import { createEditorActor } from '../editor/createEditorActor';

describe('新規ノードの配置', () => {
 const bounds = { width: 3600, height: 1800 };
 const size = { width: 150, height: 76 };

 it('表示中心にノードを配置し、IDと採番を反映する', () => {
  expect(createEditorActor('actor-1', 3, { x: 1800, y: 900 }, bounds, size)).toEqual({
   id: 'actor-1',
   name: '新しいノード 3',
   type: 'service',
   position: { x: 1800, y: 900 },
  });
 });

 it('左上端ではノードの半径分を確保する', () => {
  const actor = createEditorActor('a', 1, { x: -500, y: -300 }, bounds, size);
  expect(actor.position).toEqual({ x: 75, y: 38 });
 });

 it('右下端ではノードが描画領域からはみ出さない', () => {
  const actor = createEditorActor('b', 2, { x: 5000, y: 3000 }, bounds, size);
  expect(actor.position).toEqual({ x: 3525, y: 1762 });
 });
});
