import { stringify } from 'yaml';
import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];

export type TemplateReference = {
 file: string;
 actorIds: string[];
 stepIds: string[];
 original: string;
};

type EditorScenarioData = {
 actors: Actor[];
 steps: Step[];
 metadata: Scenario['metadata'];
 groups: NonNullable<Scenario['groups']>;
 interfaces: NonNullable<Scenario['interfaces']>;
 templateReferences: TemplateReference[];
};

/** 参照テンプレートに属するデータが変更されていないことを検証する。 */
export function validateTemplateReferences({ actors, steps, templateReferences }: EditorScenarioData): string | null {
 for (const reference of templateReferences) {
  const current = JSON.stringify({
   actors: actors.filter(item => reference.actorIds.includes(item.id)),
   steps: steps.filter(item => reference.stepIds.includes(item.id)),
  });
  if (current !== reference.original) {
   return '参照テンプレートの内容が変更されています。変更を保持するには直接展開モードで再読込してください: ' + reference.file;
  }
 }
 return null;
}

/** エディターの状態を保存用の単一YAMLへ変換する。 */
export function serializeEditorScenario({ actors, steps, metadata, groups, interfaces, templateReferences }: EditorScenarioData): string {
 // アイコンはtypeから決まるため、保存時は重複させない。
 const normalizedActors = actors.map(({ icon: _icon, ...actor }) => actor);
 // 片方向通信に復路情報を残さない。
 const normalizedSteps = steps.map(step => {
  if (step.bidirectional) return step;
  const { reverseFrom: _from, reverseTo: _to, reverseIf: _if, reversePayload: _payload, bidirectional: _both, ...oneWay } = step;
  return oneWay;
 });
 const referencedActorIds = new Set(templateReferences.flatMap(item => item.actorIds));
 const yamlActors = normalizedActors.filter(item => !referencedActorIds.has(item.id));
 const yamlSteps: Array<Step | { file: string }> = [];
 const inserted = new Set<string>();
 for (const item of normalizedSteps) {
  const reference = templateReferences.find(entry => entry.stepIds.includes(item.id));
  if (!reference) { yamlSteps.push(item); continue; }
  if (!inserted.has(reference.file)) { yamlSteps.push({ file: reference.file }); inserted.add(reference.file); }
 }
 for (const reference of templateReferences) {
  if (!inserted.has(reference.file)) { yamlSteps.push({ file: reference.file }); inserted.add(reference.file); }
 }
 return stringify({ schemaVersion: '1.0', metadata, groups, interfaces, actors: yamlActors, steps: yamlSteps }, { lineWidth: 0 });
}
