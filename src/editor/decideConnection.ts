import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];

type ConnectionDecision =
 | { kind: 'invalid'; message: string }
 | { kind: 'reverse'; stepId: string; message: string }
 | { kind: 'existing'; stepId: string; message: string }
 | { kind: 'create'; step: Step; message: string };

/** 既存の往復通信を確認し、新規追加か既存通信の更新かを決定する。 */
export function decideConnection(from: string, to: string, actors: Actor[], steps: Step[], newId: string): ConnectionDecision {
 if (from === to) return { kind: 'invalid', message: '同じノード同士は接続できません。' };
 const reverse = steps.find(step => step.actions.length === 1 &&
  step.actions[0].from === to && step.actions[0].to === from);
 if (reverse) return { kind: 'reverse', stepId: reverse.id, message: '既存の接続を双方向に変更しました。' };
 const existing = steps.find(step => step.actions.length === 1 &&
  step.actions[0].from === from && step.actions[0].to === to);
 if (existing) return { kind: 'existing', stepId: existing.id, message: 'この接続は登録済みです。通信設定から双方向に変更できます。' };
 const fromActor = actors.find(actor => actor.id === from);
 const branchLabel = fromActor?.type === 'decision' ? '条件を入力' : undefined;
 return {
  kind: 'create',
  step: { id: newId, title: '新しい通信', description: '', ...(branchLabel ? { branchLabel } : {}),
   actions: [{ type: 'transfer', from, to, payload: '通信内容', durationMs: 1200 }] },
  message: '通信線を追加しました。',
 };
}
