import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];
type Point = { x: number; y: number };

/** ノードごとの幅と高さを取得する。既存YAMLのサイズ未指定にも対応する。 */
export function nodeSize(actor: Actor): { width: number; height: number } {
 return { width: actor.width ?? 150, height: actor.height ?? 76 };
}

/** ノードの全体がキャンバス内に収まるよう中心座標を補正する。 */
export function clampNodePosition(actor: Actor, position: Point, bounds: { width: number; height: number }): Point {
 const size = nodeSize(actor);
 const halfWidth = size.width / 2;
 const halfHeight = size.height / 2;
 return {
  x: Math.max(halfWidth, Math.min(bounds.width - halfWidth, position.x)),
  y: Math.max(halfHeight, Math.min(bounds.height - halfHeight, position.y)),
 };
}

/** 通信線のドロップ位置がノード矩形内にあるかを判定する。 */
export function containsNodePoint(actor: Actor, point: Point): boolean {
 const size = nodeSize(actor);
 return Math.abs(point.x - actor.position.x) <= size.width / 2 &&
  Math.abs(point.y - actor.position.y) <= size.height / 2;
}
