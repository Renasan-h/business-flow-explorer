/** 経由点ハンドルの属性を検証し、ドラッグ対象を取得する。 */
export function resolveWaypointHandle(target: Element): { stepId: string; index: number; direction: 'forward' | 'reverse' } | null {
 const handle = target.closest('[data-waypoint-index]');
 if (!handle) return null;
 const stepId = handle.getAttribute('data-waypoint-step');
 const rawIndex = handle.getAttribute('data-waypoint-index');
 if (!stepId || rawIndex === null || rawIndex.trim() === '') return null;
 const index = Number(rawIndex);
 return Number.isInteger(index) && index >= 0 ? { stepId, index, direction: handle.getAttribute('data-waypoint-direction') === 'reverse' ? 'reverse' : 'forward' } : null;
}
