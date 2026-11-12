// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveEditorSelection } from '../editor/selection';
import { readInterfaceFields } from '../editor/readInterfaceFields';
import { loadTemplateCatalog } from '../editor/loadTemplateCatalog';
import { writeEditorYaml } from '../editor/writeEditorYaml';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe('選択・IF定義・ファイル操作', () => {
 it('SVGのノード・通信・領域と空白を区別する', () => {
  const container = document.createElement('div');
  container.innerHTML = '<div data-actor-id="a"><span id="node"></span></div><div data-step-id="s" id="step"></div><div data-group-id="g" id="group"></div><div id="blank"></div>';
  document.body.append(container);
  expect(resolveEditorSelection(container.querySelector('#node')!)).toEqual({ actorId: 'a', stepId: null, groupId: null });
  expect(resolveEditorSelection(container.querySelector('#step')!)).toEqual({ actorId: null, stepId: 's', groupId: null });
  expect(resolveEditorSelection(container.querySelector('#group')!)).toEqual({ actorId: null, stepId: null, groupId: 'g' });
  expect(resolveEditorSelection(container.querySelector('#blank')!)).toEqual({ actorId: null, stepId: null, groupId: null });
 });
 it('IF定義のJSON配列を読み込み、必須フラグを補完する', async () => {
  const file = { name: 'fields.json', size: 80, text: async () => '[{"name":"id","type":"string"}]' } as File;
  expect(await readInterfaceFields(file)).toEqual([{ name: 'id', type: 'string', required: false, description: '' }]);
 });
 it('IF定義の不正形式・不正required値を拒否する', async () => {
  const file = { name: 'fields.yaml', size: 80, text: async () => 'fields:\n  - name: id\n    type: string\n    required: yes' } as File;
  await expect(readInterfaceFields(file)).rejects.toThrow('boolean');
  const oversized = { name: 'large.json', size: 2_000_001 } as File;
  await expect(readInterfaceFields(oversized)).rejects.toThrow('2MB');
 });
 it('テンプレート一覧の取得先は編集中シナリオと同じルート', async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [] }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await loadTemplateCatalog('/scenarios/3/main.yaml')).toEqual([]);
  expect(fetchMock).toHaveBeenCalledWith('/scenarios/3/catalog.json', { cache: 'no-store' });
 });
 it('保存APIが使える場合はファイルへ書き込み、閉じる', async () => {
  const write = vi.fn(async () => {});
  const close = vi.fn(async () => {});
  const showSaveFilePicker = vi.fn(async () => ({ createWritable: async () => ({ write, close }) }));
  Object.assign(window, { showSaveFilePicker });
  try {
   expect(await writeEditorYaml('test.yaml', 'content')).toBe('saved');
   expect(write).toHaveBeenCalledWith('content');
   expect(close).toHaveBeenCalledOnce();
  } finally {
   Reflect.deleteProperty(window, 'showSaveFilePicker');
  }
 });
});
