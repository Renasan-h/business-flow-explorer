import { z } from 'zod';
import { parse } from 'yaml';
import { layoutActors } from './layout';
import { NODE_TYPES, NODE_ICONS } from './nodeCatalog';

// YAMLは外部入力なので、TypeScript型に加えてZodで実行時に構造を検証する。
const actor = z.object({
 id: z.string().min(1),
 name: z.string().min(1),
 ip: z.string().optional(),
 instanceName: z.string().optional(),
 type: z.enum(NODE_TYPES.map(item => item.value) as [typeof NODE_TYPES[number]['value'], ...typeof NODE_TYPES[number]['value'][]]),
 // 任意の表示情報。既存YAMLとの互換性のためすべて省略可能。
 icon: z.enum(NODE_ICONS.map(item => item.value) as [typeof NODE_ICONS[number]['value'], ...typeof NODE_ICONS[number]['value'][]]).optional(),
 description: z.string().optional(),
 environment: z.string().optional(),
 endpoint: z.string().optional(),
 tags: z.array(z.string()).optional(),
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
 // 未指定時は直線。折れ線を選んだ通信だけYAMLに保存する。
 routing: z.enum(['straight', 'orthogonal']).optional(),
 // 1件の通信定義で往復2本の接続線を描く。省略時は片方向。
 bidirectional: z.boolean().optional(),
 // 条件分岐ノードから出る経路を識別するラベル（例: 成功 / 失敗）。
 branchLabel: z.string().optional(),
 actions: z.array(action).min(1),
});
const metadata = z.object({
 id: z.string(),
 title: z.string(),
 description: z.string(),
 category: z.string(),
});
// Actor定義とファイル参照を同じ配列に混在させる。
const actorEntry = z.union([actor, z.object({ file: z.string().min(1) }).strict()]);
const stepEntry = z.union([step, z.object({
 file: z.string().min(1),
 handoff: action.omit({ type: true }).optional(),
}).strict()]);
const fragmentSchema = z.object({
 actors: z.array(actorEntry).optional(),
 steps: z.array(stepEntry).optional(),
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

// 同一IDのactorは統合し、同じ項目に異なる値があれば黙って上書きしない。
function mergeActor(existing: Actor, incoming: Actor): Actor {
 const result: Actor = { ...existing };
 for (const key of ['name', 'type', 'ip', 'instanceName', 'icon', 'description', 'environment', 'endpoint', 'tags', 'position'] as const) {
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

/** YAMLのファイル参照を再帰的に展開し、ancestorsで循環参照を検知する。 */
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
 const parsed: unknown = parse(await response.text()) ?? {};
 if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('YAMLのルートはオブジェクトである必要があります: ' + canonical);
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
 // actors配列に記述された順番でActor定義と外部ファイルを展開する。
 for (const entry of data.actors ?? []) {
  if ('file' in entry) {
   const fragment = await readFragments(new URL(entry.file, url).href, nextAncestors);
   if (fragment.root || fragment.steps.length > 0) {
    throw new Error('actors内のfileにはActor定義のみを指定してください: ' + entry.file);
   }
   fragment.actors.forEach(addActor);
  } else {
   addActor(entry);
  }
 }
 // stepsの配列順に通常ステップとサブシナリオを展開する。
 for (const entry of data.steps ?? []) {
  if ('file' in entry) {
   const fragment = await readFragments(new URL(entry.file, url).href, nextAncestors);
   if (fragment.root) throw new Error('サブシナリオにmetadataは指定できません: ' + entry.file);
   fragment.actors.forEach(addActor);
   // ファイル境界の通信を明示した場合は、通常ステップとして挿入する。
   if (entry.handoff) {
    if (steps.length === 0) throw new Error('最初のサブシナリオにはhandoffを指定できません: ' + entry.file);
    steps.push({
     id: '__handoff__' + steps.length + '_' + steps[steps.length - 1].id,
     title: 'サブシナリオ間の通信',
     description: entry.file + ' への通信',
     actions: [{ type: 'transfer', ...entry.handoff }],
    });
   }
   steps.push(...fragment.steps);
  } else {
   steps.push(entry);
  }
 }
 return { actors, steps, root: isRoot ? data as ScenarioData : undefined };
}

/** YAMLの検証・参照展開・ノード配置を行い、描画用のScenarioを返す。 */
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
 // stepsの記述順を維持し、orderなどによる並び替えは行わない。
 const merged = { ...result.root, actors: result.actors, steps: result.steps };
 return { ...merged, actors: layoutActors(merged) };
}

export async function listScenarios(): Promise<string[]> {
 const response = await fetch('/scenarios/index.json', { cache: 'no-store' });
 if (!response.ok) throw new Error('Scenario index load failed');
 return z.array(z.string()).parse(await response.json());
}
