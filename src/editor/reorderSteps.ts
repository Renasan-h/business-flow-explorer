import type { Scenario } from '../scenario';

type Step = Scenario['steps'][number];

/** 指定ステップを移動先の直前に挿入し、再生順を振り直す。 */
export function reorderSteps(steps: Step[], fromId: string, toId: string): Step[] {
 if (fromId === toId) return steps;
 const from = steps.findIndex(step => step.id === fromId);
 const to = steps.findIndex(step => step.id === toId);
 if (from < 0 || to < 0) return steps;
 const next = [...steps];
 const [moved] = next.splice(from, 1);
 next.splice(next.findIndex(step => step.id === toId), 0, moved);
 return next.map((step, index) => ({ ...step, order: index + 1 }));
}
