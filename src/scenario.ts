import { z } from 'zod';
import { parse } from 'yaml';
import { layoutActors } from './layout';

const actor = z.object({
 id: z.string().min(1),
 name: z.string().min(1),
 ip: z.string().optional(),
 instanceName: z.string().optional(),
 type: z.enum(['person', 'server', 'database', 'service']),
 position: z.object({ x: z.number(), y: z.number() }).optional(),
});
const action = z.object({
 type: z.literal('transfer'),
 from: z.string(),
 to: z.string(),
 payload: z.string(),
 durationMs: z.number().positive(),
});
const step = z.object({
 id: z.string().min(1),
 title: z.string(),
 description: z.string(),
 order: z.number().finite().optional(),
 actions: z.array(action).min(1),
});
const metadata = z.object({
 id: z.string(),
 title: z.string(),
 description: z.string(),
 category: z.string(),
});
const fragmentSchema = z.object({
 actors: z.array(actor).optional(),
 steps: z.array(step).optional(),
 actorFiles: z.array(z.string().min(1)).optional(),
});
const scenarioSchema = fragmentSchema.extend({
 schemaVersion: z.literal('1.0'),
 metadata,
});
type Actor = z.infer<typeof actor>;
type Step = z.infer<typeof step>;
type ScenarioData = z.infer<typeof scenarioSchema>;
export type Scenario = Omit<ScenarioData, 'actors' | 'steps'> & {
 actors: (Actor & { position: { x: number; y: number } })[];
 steps: Step[];
};

// @ファイル名 はYAML構文ではないため、パース前に参照行と本文を分離する。
function splitReferences(source: string): { references: string[]; body: string } {
 const references: string[] = [];
 const body = source.split(/\r?\n/).map(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return line;
  if (!trimmed.startsWith('@')) return line;
  if (!/^@[^\s#]+(?:\s+#.*)?$/.test(trimmed)) {
   throw new Error('不正なシナリオ参照: ' + trimmed);
  }
  references.push(trimmed.slice(1).split(/\s+#/, 1)[0]);
  return '';
 }).join('\n');
 return { references, body };
}

// 同一IDのactorは統合し、同じ項目に異なる値があれば黙って上書きしない。
function mergeActor(existing: Actor, incoming: Actor): Actor {
 const result: Actor = { ...existing };
 for (const key of ['name', 'type', 'ip', 'instanceName', 'position'] as const) {
  const previous = existing[key];
  const next = incoming[key];
  if (next === undefined) continue;
  if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(next)) {
   throw new Error(`actor "${existing.id}" の ${key} が参照ファイル間で矛盾しています`);
  }
  // optionalな属性は、いずれかのファイルに指定があれば採用する。
  Object.assign(result, { [key]: previous ?? next });
 }
 return result;
}

async function readFragments(path: string, ancestors: Set<string>): Promise<{
 actors: Actor[];
 steps: Step[];
 root?: ScenarioData;
}> {
 // 参照は読み込み元ファイルを基準とし、scenariosディレクトリ外への移動を禁止する。
 const url = new URL(path, window.location.origin);
 if (url.origin !== window.location.origin || !url.pathname.startsWith('/scenarios/')) {
  throw new Error('参照先は /scenarios/ 内のファイルに限定されます: ' + path);
 }
 const canonical = url.pathname;
 if (ancestors.has(canonical)) throw new Error('シナリオの循環参照: ' + [...ancestors, canonical].join(' → '));
 const nextAncestors = new Set([...ancestors, canonical]);
 const response = await fetch(canonical, { cache: 'no-store' });
 if (!response.ok) throw new Error('シナリオの読み込みに失敗しました: ' + canonical);
 const { references, body } = splitReferences(await response.text());
 const parsed = parse(body) ?? {};
 const isRoot = 'schemaVersion' in parsed || 'metadata' in parsed;
 const data = isRoot ? scenarioSchema.parse(parsed) : fragmentSchema.parse(parsed);
 const actors: Actor[] = [];
 const steps: Step[] = [];
 const byId = new Map<string, number>();
 const addActor = (item: Actor) => {
  const index = byId.get(item.id);
  if (index === undefined) {
   byId.set(item.id, actors.length);
   actors.push(item);
  } else actors[index] = mergeActor(actors[index], item);
 };
 // 共通Actorファイルにはステップを含めない。
 for (const actorFile of data.actorFiles ?? []) {
  const resolved = new URL(actorFile, url);
  const fragment = await readFragments(resolved.href, nextAncestors);
  if (fragment.root || fragment.steps.length > 0) {
   throw new Error('actorFilesにはactorsのみを定義してください: ' + actorFile);
  }
  fragment.actors.forEach(addActor);
 }
 // サブシナリオは参照の記述順で展開する。
 for (const reference of references) {
  const resolved = new URL(reference, url).pathname;
  const fragment = await readFragments(resolved, nextAncestors);
  fragment.actors.forEach(addActor);
  steps.push(...fragment.steps);
 }
 (data.actors ?? []).forEach(addActor);
 // orderは同一ファイル内だけに適用し、ファイル間の順序は維持する。
 const ownSteps = (data.steps ?? []).map((item, index) => ({ item, index }))
  .sort((a, b) => (a.item.order ?? Infinity) - (b.item.order ?? Infinity) || a.index - b.index)
  .map(entry => entry.item);
 steps.push(...ownSteps);
 return { actors, steps, root: isRoot ? data as ScenarioData : undefined };
}

export async function loadScenario(path: string): Promise<Scenario> {
 const result = await readFragments(path, new Set());
 if (!result.root) throw new Error('親シナリオにはschemaVersionとmetadataが必要です');
 if (result.actors.length < 2) throw new Error('actorは2件以上必要です');
 if (result.steps.length === 0) throw new Error('stepは1件以上必要です');
 const ids = new Set(result.actors.map(item => item.id));
 const stepIds = new Set<string>();
 for (const item of result.steps) {
  if (stepIds.has(item.id)) throw new Error('step IDが重複しています: ' + item.id);
  stepIds.add(item.id);
  for (const transfer of item.actions) {
   if (!ids.has(transfer.from) || !ids.has(transfer.to)) {
    throw new Error(`step "${item.id}" の参照先actorが存在しません: ${transfer.from} → ${transfer.to}`);
   }
  }
 }
 // ファイル間の順序は展開時に確定済みなので全体では再ソートしない。
 const merged = { ...result.root, actors: result.actors, steps: result.steps };
 return { ...merged, actors: layoutActors(merged) };
}

export async function listScenarios(): Promise<string[]> {
 const response = await fetch('/scenarios/index.json', { cache: 'no-store' });
 if (!response.ok) throw new Error('Scenario index load failed');
 return z.array(z.string()).parse(await response.json());
}
