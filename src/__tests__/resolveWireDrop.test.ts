import { describe, expect, it } from 'vitest';
import type { Scenario } from '../scenario';
import { resolveWireDrop } from '../editor/resolveWireDrop';

const actors: Scenario['actors'] = [
 { id: 'web', name: 'Web', type: 'service', position: { x: 100, y: 100 } },
 { id: 'api', name: 'API', type: 'service', position: { x: 300, y: 100 } },
];

describe('通信線のドロップ結果', () => {
 it('接続先ノード上でドロップすると接続を要求する', () => {
  expect(resolveWireDrop(actors, 'web', { x: 300, y: 100 }))
   .toEqual({ kind: 'connect', from: 'web', to: 'api' });
 });

 it('ノード外へのドロップでは案内を返す', () => {
  expect(resolveWireDrop(actors, 'web', { x: 900, y: 900 }))
   .toEqual({ kind: 'invalid', message: '接続先ノードの上でドロップしてください。' });
 });

 it('接続開始元がなければ変更しない', () => {
  expect(resolveWireDrop(actors, null, { x: 300, y: 100 }))
   .toEqual({ kind: 'none' });
 });
});
