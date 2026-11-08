import type { Scenario } from './scenario';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];

/** 同じ分岐ノードから出る経路を選択肢としてまとめる。 */
export function branchGroups(actors: Actor[], steps: Step[]) {
 return actors.filter(actor => actor.type === 'decision').map(actor => ({
  actor,
  options: steps.filter(step => step.actions.some(action => action.from === actor.id))
 })).filter(group => group.options.length > 1);
}

/**
 * 再生前に選択した分岐だけを辿り、到達できる通信ステップを再生順に返す。
 * ルート（入次数0）から探索するため、非選択側の後続通信も再生しない。
 * 合流先はどちらかの選択経路から到達可能であれば再生対象になる。
 */
export function playbackSteps(actors: Actor[], steps: Step[], choices: Record<string, string>): Step[] {
 const groups = branchGroups(actors, steps);
 if (!groups.length) return steps;
 const excluded = new Set<string>();
 for (const group of groups) {
  const chosen = choices[group.actor.id] ?? group.options[0].id;
  for (const option of group.options) if (option.id !== chosen) excluded.add(option.id);
 }
 const allowed = steps.filter(step => !excluded.has(step.id));
 const destinations = new Set(allowed.flatMap(step => step.actions.map(action => action.to)));
 const roots = actors.filter(actor => !destinations.has(actor.id)).map(actor => actor.id);
 // 全ノードが循環しているシナリオでは、元の先頭通信を起点にする。
 if (!roots.length && allowed[0]?.actions[0]) roots.push(allowed[0].actions[0].from);
 const reached = new Set(roots);
 let changed = true;
 while (changed) {
  changed = false;
  for (const step of allowed) {
   for (const action of step.actions) {
    if (reached.has(action.from) && !reached.has(action.to)) {
     reached.add(action.to);
     changed = true;
    }
   }
  }
 }
 return allowed.filter(step => step.actions.some(action => reached.has(action.from)));
}
