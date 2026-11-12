// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import FlowPreview from '../FlowPreview';
import FlowEditor from '../FlowEditor';
import type { Scenario } from '../scenario';

const scenario: Scenario = {
 schemaVersion: '1.0',
 metadata: { id: 'ui', title: '画面検証', description: '', category: 'test' },
 actors: [
  { id: 'web', name: 'Web', type: 'browser', position: { x: 200, y: 200 } },
  { id: 'api', name: 'API', type: 'api', position: { x: 500, y: 200 } },
 ],
 steps: [
  { id: 'request', title: 'リクエスト', description: '', actions: [{ type: 'transfer', from: 'web', to: 'api', payload: 'GET', durationMs: 1000 }] },
  { id: 'response', title: 'レスポンス', description: '', actions: [{ type: 'transfer', from: 'api', to: 'web', payload: '200', durationMs: 1000 }] },
 ],
 groups: [],
 interfaces: [],
};
let root: Root | undefined;
let host: HTMLDivElement | undefined;
async function mount(node: ReactNode) {
 host = document.createElement('div');
 document.body.append(host);
 root = createRoot(host);
 await act(async () => { root!.render(node); });
 return host;
}
afterEach(async () => {
 if (root) await act(async () => root!.unmount());
 host?.remove();
 root = undefined;
 host = undefined;
 vi.restoreAllMocks();
});
describe('編集・再生画面のDOM回帰テスト', () => {
 it('再生画面で次へ・前へ・速度変更・編集画面に戻るを操作できる', async () => {
  const onClose = vi.fn();
  const el = await mount(<FlowPreview actors={scenario.actors} steps={scenario.steps}
   title="画面検証" onClose={onClose} onDeleteStep={vi.fn()} onExit={vi.fn()}/>);
  const button = (name: string) => [...el.querySelectorAll('button')].find(item => item.textContent?.trim() === name);
  expect(el.textContent).toContain('1 / 2');
  await act(async () => { button('次へ')!.click(); });
  expect(el.textContent).toContain('2 / 2');
  await act(async () => { button('前へ')!.click(); });
  expect(el.textContent).toContain('1 / 2');
  await act(async () => { button('2x')!.click(); });
  expect(button('2x')?.getAttribute('aria-pressed')).toBe('true');
  await act(async () => { button('編集画面に戻る')!.click(); });
  expect(onClose).toHaveBeenCalledOnce();
 });
 it('編集画面の基本操作UIを表示する', async () => {
  const el = await mount(<FlowEditor initial={scenario} onClose={vi.fn()}/>);
  expect(el.querySelector('.editor-canvas')).not.toBeNull();
  expect(el.textContent).toContain('Web');
  expect(el.textContent).toContain('API');
 });
});
