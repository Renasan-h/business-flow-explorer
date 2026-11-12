import type { Scenario } from '../scenario';
import { clampNodePosition, nodeSize } from './nodeGeometry';

type Actor = Scenario['actors'][number];

/** 通信や配列の参照を共有せず、元ノードをキャンバス内の近傍に複製する。 */
export function duplicateEditorActor(
 original: Actor,
 id: string,
 bounds: { width: number; height: number },
): Actor {
 const size = nodeSize(original);
 const offsetX = original.position.x + size.width / 2 + 40 <= bounds.width ? 40 : -40;
 const offsetY = original.position.y + size.height / 2 + 40 <= bounds.height ? 40 : -40;
 return {
  ...original,
  id,
  name: original.name + ' (コピー)',
  position: clampNodePosition(original, {
   x: original.position.x + offsetX,
   y: original.position.y + offsetY,
  }, bounds),
  ...(original.tags ? { tags: [...original.tags] } : {}),
 };
}
