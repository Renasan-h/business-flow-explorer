import type { Scenario } from '../scenario';
import type { DragOrigin, EditorPoint } from './multiSelection';

type Actor = Scenario['actors'][number];

export type MultiSelectionStart =
 | { kind: 'toggle'; selectedActors: string[] }
 | { kind: 'drag'; selectedActors: string[]; initial: DragOrigin[] }
 | { kind: 'marquee'; selectedActors: string[]; start: EditorPoint; additive: boolean; clearSingleSelection: boolean };

/**
 * 複数選択の開始操作を判定する。Shiftクリックは選択を反転し、
 * ノード上のドラッグと空白範囲選択を区別する。
 */
export function resolveMultiSelectionStart(
 actorId: string | null,
 shiftKey: boolean,
 selectedActors: readonly string[],
 actors: Actor[],
 worldPoint: EditorPoint,
): MultiSelectionStart {
 if (actorId) {
  if (shiftKey) return {
   kind: 'toggle',
   selectedActors: selectedActors.includes(actorId)
    ? selectedActors.filter(id => id !== actorId)
    : [...selectedActors, actorId],
  };
  const ids = selectedActors.includes(actorId) ? [...selectedActors] : [actorId];
  return {
   kind: 'drag',
   selectedActors: ids,
   initial: actors.filter(actor => ids.includes(actor.id)).map(actor => ({ id: actor.id, ...actor.position })),
  };
 }
 return {
  kind: 'marquee',
  selectedActors: shiftKey ? [...selectedActors] : [],
  start: worldPoint,
  additive: shiftKey,
  clearSingleSelection: !shiftKey,
 };
}
