/** ノード矩形を避ける直交配線。ノード移動時にも同じ経路計算を使う。 */
export type RouteNode = { id: string; position: { x: number; y: number } };
export type Point = { x: number; y: number };
const HALF_W = 75;
const HALF_H = 38;
const GAP = 18;

export function routeConnection(nodes: RouteNode[], fromId: string, toId: string, mode: 'straight' | 'orthogonal' = 'straight'): Point[] {
 const from = nodes.find(node => node.id === fromId);
 const to = nodes.find(node => node.id === toId);
 if (!from || !to || fromId === toId) return [];
 const a = from.position;
 const b = to.position;
 // 初期状態は矩形外周を結ぶ直線。折れ線は明示的に選択された場合だけ使用する。
 if (mode === 'straight') {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [];
  const ux = dx / length;
  const uy = dy / length;
  const trim = (vx: number, vy: number) => Math.min(
   Math.abs(vx) > 1e-8 ? HALF_W / Math.abs(vx) : Infinity,
   Math.abs(vy) > 1e-8 ? HALF_H / Math.abs(vy) : Infinity);
  const startTrim = trim(ux, uy);
  const endTrim = trim(-ux, -uy);
  return [
   { x: a.x + ux * Math.min(startTrim, length / 2), y: a.y + uy * Math.min(startTrim, length / 2) },
   { x: b.x - ux * Math.min(endTrim, length / 2), y: b.y - uy * Math.min(endTrim, length / 2) },
  ];
 }
 const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
 const sign = horizontal ? (b.x >= a.x ? 1 : -1) : (b.y >= a.y ? 1 : -1);
 const start = horizontal ? { x: a.x + sign * HALF_W, y: a.y } : { x: a.x, y: a.y + sign * HALF_H };
 const end = horizontal ? { x: b.x - sign * HALF_W, y: b.y } : { x: b.x, y: b.y - sign * HALF_H };
 const outerStart = horizontal ? { x: start.x + sign * GAP, y: start.y } : { x: start.x, y: start.y + sign * GAP };
 const outerEnd = horizontal ? { x: end.x - sign * GAP, y: end.y } : { x: end.x, y: end.y - sign * GAP };
 const obstacles = nodes.filter(node => node.id !== fromId && node.id !== toId).map(node => ({
  left: node.position.x - HALF_W - GAP, right: node.position.x + HALF_W + GAP,
  top: node.position.y - HALF_H - GAP, bottom: node.position.y + HALF_H + GAP,
 }));
 // 全ノードの外周を格子点にし、矩形を横切る線分を候補から除外する。
 const xs = [...new Set([outerStart.x, outerEnd.x, ...nodes.flatMap(n => [n.position.x - HALF_W - GAP, n.position.x + HALF_W + GAP])])].sort((x, y) => x - y);
 const ys = [...new Set([outerStart.y, outerEnd.y, ...nodes.flatMap(n => [n.position.y - HALF_H - GAP, n.position.y + HALF_H + GAP])])].sort((x, y) => x - y);
 const width = xs.length;
 const height = ys.length;
 const valid = (x: number, y: number) => obstacles.every(o => !(x > o.left && x < o.right && y > o.top && y < o.bottom));
 const clear = (p: Point, q: Point) => obstacles.every(o => p.x === q.x
  ? !(p.x > o.left && p.x < o.right && Math.max(p.y, q.y) > o.top && Math.min(p.y, q.y) < o.bottom)
  : !(p.y > o.top && p.y < o.bottom && Math.max(p.x, q.x) > o.left && Math.min(p.x, q.x) < o.right));
 const startIndex = ys.indexOf(outerStart.y) * width + xs.indexOf(outerStart.x);
 const endIndex = ys.indexOf(outerEnd.y) * width + xs.indexOf(outerEnd.x);
 const count = width * height;
 const distances = Array<number>(count).fill(Infinity);
 const previous = Array<number>(count).fill(-1);
 const visited = new Set<number>();
 distances[startIndex] = 0;
 for (let iteration = 0; iteration < count; iteration++) {
  let current = -1;
  for (let i = 0; i < count; i++) if (!visited.has(i) && (current < 0 || distances[i] < distances[current])) current = i;
  if (current < 0 || !Number.isFinite(distances[current])) break;
  if (current === endIndex) break;
  visited.add(current);
  const col = current % width;
  const row = Math.floor(current / width);
  const p = { x: xs[col], y: ys[row] };
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
   const c = col + dc;
   const r = row + dr;
   if (c < 0 || c >= width || r < 0 || r >= height) continue;
   const next = r * width + c;
   const q = { x: xs[c], y: ys[r] };
   if (!valid(q.x, q.y) || !clear(p, q)) continue;
   const distance = distances[current] + Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
   if (distance < distances[next]) { distances[next] = distance; previous[next] = current; }
  }
 }
 if (!Number.isFinite(distances[endIndex])) return [start, end];
 const middle: Point[] = [];
 for (let at = endIndex; at !== -1; at = previous[at]) middle.unshift({ x: xs[at % width], y: ys[Math.floor(at / width)] });
 const result = [start, ...middle, end];
 // 同一直線上の中継点は取り除く。
 return result.filter((point, index) => index === 0 || index === result.length - 1 ||
  (result[index - 1].x !== result[index + 1].x && result[index - 1].y !== result[index + 1].y));
}
export function routePath(points: Point[]): string {
 return points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y).join(' ');
}
export function pointOnRoute(points: Point[], progress: number): Point {
 if (!points.length) return { x: 0, y: 0 };
 const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
 const total = lengths.reduce((sum, length) => sum + length, 0);
 let remaining = total * Math.max(0, Math.min(1, progress));
 for (let i = 0; i < lengths.length; i++) {
  if (remaining <= lengths[i]) {
   const t = lengths[i] ? remaining / lengths[i] : 0;
   return { x: points[i].x + (points[i + 1].x - points[i].x) * t, y: points[i].y + (points[i + 1].y - points[i].y) * t };
  }
  remaining -= lengths[i];
 }
 return points[points.length - 1];
}

/** 通信方向ごとに線を平行移動し、送信・受信の2レーンを表現する。 */
export function offsetRoute(points: Point[], distance: number): Point[] {
 if (points.length < 2) return points;
 const segments = points.slice(1).map((point, index) => {
  const dx = point.x - points[index].x;
  const dy = point.y - points[index].y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length * distance, y: dx / length * distance };
 });
 return points.map((point, index) => {
  if (index === 0) return { x: point.x + segments[0].x, y: point.y + segments[0].y };
  if (index === points.length - 1) {
   const normal = segments[segments.length - 1];
   return { x: point.x + normal.x, y: point.y + normal.y };
  }
  const prev = segments[index - 1];
  const next = segments[index];
  return { x: point.x + (prev.x + next.x) / 2, y: point.y + (prev.y + next.y) / 2 };
 });
}
