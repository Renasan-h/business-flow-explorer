import type { Point } from '../connectionRouting';

/**
 * ノード間に経由点を追加する位置を求める。
 * 最初の点は両ノードの中点、以降は既存経由点を含む区間のうち
 * 最も長い区間の中点へ挿入し、同じ座標に点が重なるのを防ぐ。
 */
export function insertWaypointBetweenNodes(start: Point, end: Point, waypoints: readonly Point[]): Point[] {
 const route = [start, ...waypoints, end];
 let longestIndex = 0;
 let longestDistance = -1;
 for (let index = 0; index < route.length - 1; index++) {
  const dx = route[index + 1].x - route[index].x;
  const dy = route[index + 1].y - route[index].y;
  const distance = dx * dx + dy * dy;
  if (distance > longestDistance) {
   longestDistance = distance;
   longestIndex = index;
  }
 }
 if (longestDistance <= 0) return [...waypoints];
 const first = route[longestIndex];
 const second = route[longestIndex + 1];
 const point = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
 const result = [...waypoints];
 result.splice(longestIndex, 0, point);
 return result;
}
