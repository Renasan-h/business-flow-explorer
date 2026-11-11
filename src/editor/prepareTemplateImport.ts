import { parseTemplateYaml, type Scenario } from '../scenario';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
type Fragment = Pick<ReturnType<typeof parseTemplateYaml>, 'actors' | 'steps'>;
type ImportMode = 'inline' | 'reference';

/** インポート前にID衝突を解決し、通信の参照先を整合させる。 */
export function prepareTemplateImport(fragment: Fragment, mode: ImportMode, actors: Actor[], steps: Step[]): {
 newActors: Actor[];
 newSteps: Step[];
 renamed: number;
} {
 const actorIds = new Set(actors.map(item => item.id));
 const stepIds = new Set(steps.map(item => item.id));
 // 参照モードは元のIDを維持し、直接展開時のみ衝突IDを採番する。
 const uniqueId = (id: string, used: Set<string>) => {
  let result = id;
  let suffix = 2;
  while (used.has(result)) result = id + '-' + suffix++;
  used.add(result);
  return result;
 };
 const actorIdMap = new Map<string, string>();
 const stepIdMap = new Map<string, string>();
 for (const actor of fragment.actors) {
  if (actorIdMap.has(actor.id)) throw new Error('テンプレート内でノードIDが重複しています: ' + actor.id);
  actorIdMap.set(actor.id, mode === 'reference' ? actor.id : uniqueId(actor.id, actorIds));
 }
 for (const step of fragment.steps) {
  if (stepIdMap.has(step.id)) throw new Error('テンプレート内で通信IDが重複しています: ' + step.id);
  stepIdMap.set(step.id, mode === 'reference' ? step.id : uniqueId(step.id, stepIds));
 }
 if (mode === 'reference' && (fragment.actors.some(item => actorIds.has(item.id)) || fragment.steps.some(item => stepIds.has(item.id)))) {
  throw new Error('参照テンプレートのIDが既存フローと重複しています');
 }
 const newActors = fragment.actors.map((item, index) => ({
  ...item,
  id: actorIdMap.get(item.id)!,
  position: item.position ?? { x: 250 + (index % 10) * 240, y: 200 + Math.floor(index / 10) * 160 },
 }));
 const newSteps = fragment.steps.map(item => ({
  ...item,
  id: stepIdMap.get(item.id)!,
  actions: item.actions.map(action => ({
   ...action,
   from: actorIdMap.get(action.from) ?? action.from,
   to: actorIdMap.get(action.to) ?? action.to,
  })),
  ...(item.reverseFrom ? { reverseFrom: actorIdMap.get(item.reverseFrom) ?? item.reverseFrom } : {}),
  ...(item.reverseTo ? { reverseTo: actorIdMap.get(item.reverseTo) ?? item.reverseTo } : {}),
 }));
 const available = new Set([...actors.map(item => item.id), ...newActors.map(item => item.id)]);
 if (newSteps.some(item => item.actions.some(action => !available.has(action.from) || !available.has(action.to)))) {
  throw new Error('テンプレートの通信に存在しないノード参照があります');
 }
 return {
  newActors,
  newSteps,
  renamed: [...actorIdMap, ...stepIdMap].filter(([before, after]) => before !== after).length,
 };
}
