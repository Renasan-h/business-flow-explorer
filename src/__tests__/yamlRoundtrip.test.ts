import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import type { Scenario } from '../scenario';
import { loadScenario, parseTemplateYaml } from '../scenario';
import { prepareEditorYamlSave } from '../editor/prepareEditorYamlSave';

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
afterEach(() => {
 vi.unstubAllGlobals();
 if (originalWindow) vi.stubGlobal('window', originalWindow);
 if (originalFetch) vi.stubGlobal('fetch', originalFetch);
});

function fixture() {
 const actors: Scenario['actors'] = [
  { id: 'web', name: 'Web', type: 'browser', position: { x: 200, y: 200 } },
  { id: 'api', name: 'API', type: 'api', position: { x: 500, y: 200 } },
 ];
 const steps: Scenario['steps'] = [{
  id: 'request', title: 'API呼び出し', description: '往復通信', bidirectional: true,
  reverseFrom: 'api', reverseTo: 'web', reversePayload: '200 OK',
  routing: 'orthogonal', waypoints: [{ x: 350, y: 180 }],
  reverseWaypoints: [{ x: 350, y: 220 }],
  actions: [{ type: 'transfer', from: 'web', to: 'api', payload: 'GET /items', durationMs: 1200 }],
 }];
 const metadata: Scenario['metadata'] = { id: 'roundtrip', title: '往復テスト', description: '', category: 'test' };
 const groups: NonNullable<Scenario['groups']> = [
  { id: 'system', name: 'システム', x: 100, y: 100, width: 600, height: 300, memberIds: ['web', 'api'] },
 ];
 const interfaces: NonNullable<Scenario['interfaces']> = [];
 return { actors, steps, metadata, groups, interfaces, templateReferences: [] };
}

describe('YAML保存・再読み込み', () => {
 it('保存したYAMLを読み込み、ノード・通信・復路・折れ線・領域を復元する', async () => {
  const data = fixture();
  const saved = prepareEditorYamlSave(data, '/scenarios/0/roundtrip.yaml');
  expect(saved.ok).toBe(true);
  if (!saved.ok) throw new Error(saved.error);
  expect(saved.filename).toBe('roundtrip.yaml');
  const parsed = parse(saved.yaml);
  expect(parsed.schemaVersion).toBe('1.0');
  expect(parsed.steps[0].reverseWaypoints).toEqual([{ x: 350, y: 220 }]);
  expect(parseTemplateYaml(saved.yaml).hasReferences).toBe(false);

  vi.stubGlobal('window', { location: { origin: 'https://example.test' } });
  const fetchMock = vi.fn(async () => ({ ok: true, text: async () => saved.yaml }));
  vi.stubGlobal('fetch', fetchMock);
  const loaded = await loadScenario('/scenarios/0/roundtrip.yaml');
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(loaded.metadata).toEqual(data.metadata);
  expect(loaded.actors.map(actor => [actor.id, actor.name])).toEqual([['web', 'Web'], ['api', 'API']]);
  expect(loaded.steps).toEqual(data.steps);
  expect(loaded.groups).toEqual(data.groups);
 });

 it('参照先がない通信を保存前に拒否する', () => {
  const data = fixture();
  data.steps[0].actions[0].to = 'missing';
  expect(prepareEditorYamlSave(data).ok).toBe(false);
 });

 it('空の通信・不正な経由点を保存前に拒否する', () => {
  const empty = fixture();
  empty.steps[0].actions = [];
  expect(prepareEditorYamlSave(empty).ok).toBe(false);
  const invalid = fixture();
  invalid.steps[0].waypoints = [{ x: Infinity, y: 0 }];
  expect(prepareEditorYamlSave(invalid).ok).toBe(false);
 });

 it('参照テンプレートを変更した場合は保存を拒否する', () => {
  const data = fixture();
  data.templateReferences.push({
   file: 'child.yaml', actorIds: ['web'], stepIds: ['request'],
   original: JSON.stringify({ actors: data.actors.filter(a => a.id === 'web'), steps: data.steps }),
  });
  data.steps[0].title = '変更後';
  expect(prepareEditorYamlSave(data).ok).toBe(false);
 });
});
