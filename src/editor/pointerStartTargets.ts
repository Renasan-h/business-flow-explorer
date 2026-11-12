import { resolveEditorSelection } from './selection';
import { resolveWaypointHandle } from './resolveWaypointHandle';

/** SVG上で操作を開始した対象を、操作の優先順位に従って判定する。 */
export function resolvePointerStartTarget(target: Element) {
 if (target.closest('[data-waypoint-index]')) {
  return { kind: 'waypoint' as const, waypoint: resolveWaypointHandle(target) };
 }
 const connectionHandle = target.closest('[data-connection-handle]');
 if (connectionHandle) {
  return { kind: 'connection' as const, from: connectionHandle.getAttribute('data-connection-handle') };
 }
 const resizeActorId = target.closest('[data-node-resize]')?.getAttribute('data-node-resize') ?? null;
 const resizeHandle = target.closest('[data-group-resize]');
 const groupId = (resizeHandle ?? target.closest('[data-group-id]'))?.getAttribute(resizeHandle ? 'data-group-resize' : 'data-group-id') ?? null;
 const selection = resolveEditorSelection(target);
 return { kind: 'selection' as const, resizeActorId, groupId, resizeGroup: Boolean(resizeHandle), ...selection };
}
