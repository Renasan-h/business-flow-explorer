/** エディター上の選択対象。空白を選んだ場合は必ずすべて解除する。 */
export type EditorSelection = { actorId: string | null; stepId: string | null; groupId: string | null };
export const EMPTY_SELECTION: EditorSelection = { actorId: null, stepId: null, groupId: null };

/** SVGイベントの実際のターゲットから選択対象を一意に決定する。
 * SVGの背景やラベルの余白は空選択として扱う。
 */
export function resolveEditorSelection(target: Element): EditorSelection {
 const actorId = target.closest('[data-actor-id]')?.getAttribute('data-actor-id') ?? null;
 if (actorId) return { actorId, stepId: null, groupId: null };
 const groupId = target.closest('[data-group-id]')?.getAttribute('data-group-id') ?? null;
 if (groupId) return { actorId: null, stepId: null, groupId };
 const stepId = target.closest('[data-step-id]')?.getAttribute('data-step-id') ?? null;
 return { actorId: null, stepId, groupId: null };
}
