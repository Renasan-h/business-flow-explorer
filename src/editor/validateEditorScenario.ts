import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
type Group = NonNullable<Scenario['groups']>[number];

/** 保存前のデータ整合性を検証し、問題があれば画面表示用のメッセージを返す。 */
export function validateEditorScenario(actors: Actor[], steps: Step[], groups: Group[]): string | null {
 if (actors.length < 2 || steps.length === 0) return '保存にはノード2件以上と通信1件以上が必要です。';
 const ids = new Set(actors.map(actor => actor.id));
 if (ids.size !== actors.length || actors.some(actor => !actor.id.trim() || !actor.name.trim())) {
  return 'ノードIDの重複または未入力があります。';
 }
 if (new Set(steps.map(step => step.id)).size !== steps.length ||
  steps.some(step => !step.id.trim() ||
   step.actions.some(action => !ids.has(action.from) || !ids.has(action.to) || action.durationMs <= 0) ||
   (step.bidirectional && (!step.reverseFrom || !step.reverseTo || !ids.has(step.reverseFrom) || !ids.has(step.reverseTo))))) {
  return '通信のID・参照先・所要時間を確認してください。';
 }
 // グループに削除済みノードが残ると、再読込時に不正な参照が残る。
 if (groups.some(group => (group.memberIds ?? []).some(id => !ids.has(id)))) {
  return '領域コンテナに存在しないノードが含まれています。所属ノードを見直してください。';
 }
 return null;
}
