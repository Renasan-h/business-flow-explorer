import type { Scenario } from '../scenario';

type Step = Scenario['steps'][number];
type Group = NonNullable<Scenario['groups']>[number];

/** 削除ノードを参照する往路・復路通信を取り除く。 */
export function removeActorConnections(steps: Step[], actorId: string): Step[] {
 return steps.filter(step =>
  step.actions.every(action => action.from !== actorId && action.to !== actorId) &&
  step.reverseFrom !== actorId && step.reverseTo !== actorId
 );
}

/** 削除ノードを領域の所属一覧からも取り除き、保存時の不正参照を防ぐ。 */
export function removeActorFromGroups(groups: Group[], actorId: string): Group[] {
 return groups.map(group => {
  if (!group.memberIds?.includes(actorId)) return group;
  return { ...group, memberIds: group.memberIds.filter(id => id !== actorId) };
 });
}
