import type { Scenario } from '../scenario';

type Step = Scenario['steps'][number];

/** 双方向切替時の復路初期値を補完し、片方向へ戻す際は復路情報を取り除く。 */
export function withConnectionDirection(step: Step, both: boolean): Step {
 if (!both) {
  const { reverseFrom: _from, reverseTo: _to, reverseIf: _if, reversePayload: _payload, bidirectional: _both, ...oneWay } = step;
  return oneWay;
 }
 const action = step.actions[0];
 return {
  ...step,
  bidirectional: true,
  reverseFrom: step.reverseFrom || action?.to || '',
  reverseTo: step.reverseTo || action?.from || '',
 };
}
