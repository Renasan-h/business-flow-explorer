import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];

/**
 * 表示中のキャンバス中心にノードを生成する。
 * 生成位置はノードの外枠がキャンバス境界を越えないよう制限する。
 */
export function createEditorActor(
 id: string,
 number: number,
 center: { x: number; y: number },
 bounds: { width: number; height: number },
 nodeSize: { width: number; height: number },
): Actor {
 const halfWidth = nodeSize.width / 2;
 const halfHeight = nodeSize.height / 2;
 return {
  id,
  name: '新しいノード ' + number,
  type: 'service',
  position: {
   x: Math.max(halfWidth, Math.min(bounds.width - halfWidth, center.x)),
   y: Math.max(halfHeight, Math.min(bounds.height - halfHeight, center.y)),
  },
 };
}
