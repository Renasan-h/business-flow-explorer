// 通信グラフをもとに、接続距離と交差が小さくなるノード配置を求める。
type Point = { x: number; y: number };
type Node = { id: string; position?: Point };
type Transfer = { from: string; to: string };
type Workflow = { actors: Node[]; steps: { actions: Transfer[] }[] };

function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
 const cross = (p: Point, q: Point, r: Point) =>
  (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
 const ab1 = cross(a, b, c);
 const ab2 = cross(a, b, d);
 const cd1 = cross(c, d, a);
 const cd2 = cross(c, d, b);
 return ab1 * ab2 < 0 && cd1 * cd2 < 0;
}

// 線分が第三者ノードの矩形（ラベル余白込み）を横切る場合に大きく減点する。
function crossesNode(a: Point, b: Point, node: Point): boolean {
 const halfWidth = 90;
 const halfHeight = 66;
 let enter = 0;
 let leave = 1;
 for (const [origin, delta, min, max] of [
  [a.x, b.x - a.x, node.x - halfWidth, node.x + halfWidth],
  [a.y, b.y - a.y, node.y - halfHeight, node.y + halfHeight],
 ]) {
  if (Math.abs(delta) < 0.00001) {
   if (origin < min || origin > max) return false;
   continue;
  }
  const first = (min - origin) / delta;
  const second = (max - origin) / delta;
  enter = Math.max(enter, Math.min(first, second));
  leave = Math.min(leave, Math.max(first, second));
  if (enter > leave) return false;
 }
 return enter < 1 && leave > 0;
}

/** ノード座標の自動配置。小規模は候補探索、大規模は局所改善で計算量を抑える。 */
export function layoutActors<T extends Node>(scenario: Workflow & { actors: T[] }): (T & { position: Point })[] {
 const actors = scenario.actors;
 const count = actors.length;
 // ノード数に応じてワールド領域を拡張する。16個以上でも上下の重なりを防ぐ。
 const columns = count <= 4 ? 2 : count <= 9 ? 3 : 4;
 const rows = Math.ceil(count / columns);
 const spacingX = 270;
 const spacingY = 185;
 const slots: Point[] = Array.from({length: count}, (_, index) => ({
  x: 160 + (index % columns) * spacingX,
  y: 135 + Math.floor(index / columns) * spacingY,
 }));
 const indexById = new Map(actors.map((actor, index) => [actor.id, index]));
 const edges = new Map<string, { a: number; b: number; weight: number }>();
 for (const step of scenario.steps) for (const action of step.actions) {
  const from = indexById.get(action.from);
  const to = indexById.get(action.to);
  if (from === undefined || to === undefined || from === to) continue;
  const [a, b] = from < to ? [from, to] : [to, from];
  const key = `${a}:${b}`;
  const edge = edges.get(key);
  if (edge) edge.weight += 1;
  else edges.set(key, { a, b, weight: 1 });
 }
 const links = [...edges.values()];
 const degree = actors.map((_, index) =>
  links.reduce((sum, edge) => sum + (edge.a === index || edge.b === index ? edge.weight : 0), 0));
 const neighborCount = actors.map((_, index) =>
  new Set(links.flatMap(edge => edge.a === index ? [edge.b] : edge.b === index ? [edge.a] : [])).size);
 const pinned = actors.map(actor => actor.position !== undefined);
 const positions = actors.map((actor, index) => actor.position ?? slots[index]);
 const free = actors.map((_, index) => index).filter(index => !pinned[index]);

 // 配置候補を採点する。短い通信線、少ない交差、中心に近いハブを優先する。
 const score = () => {
  let cost = 0;
  for (const edge of links) {
   const a = positions[edge.a];
   const b = positions[edge.b];
   const distance = Math.hypot(a.x - b.x, a.y - b.y);
   // 単一接続ノードは接続先の近くへ。通信回数ではなく接続先の種類数で判定する。
   const leaf = neighborCount[edge.a] === 1 || neighborCount[edge.b] === 1;
   cost += distance * (leaf ? 0.095 : 0.012) + edge.weight * distance / 220;
   for (let i = 0; i < count; i++) {
    if (i !== edge.a && i !== edge.b && crossesNode(a, b, positions[i])) {
     cost += 130;
    }
   }
  }
  for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) {
   const a = links[i];
   const b = links[j];
   if (a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b) continue;
   if (intersects(positions[a.a], positions[a.b], positions[b.a], positions[b.b])) cost += 24;
  }
  for (let i = 0; i < count; i++) {
   cost += degree[i] * Math.hypot(positions[i].x - (160 + (columns - 1) * spacingX / 2), positions[i].y - (135 + (rows - 1) * spacingY / 2)) / 1400;
  }
  return cost;
 };
 // ノード数が少ない業務フローでは全候補を比較し、局所最適への偏りを防ぐ。
 let best = score();
 let bestPositions = positions.map(p => ({ ...p }));
 const explore = (index: number) => {
  if (index === free.length) {
   const current = score();
   if (current < best - 0.00001) {
    best = current;
    bestPositions = positions.map(p => ({ ...p }));
   }
   return;
  }
  for (let j = index; j < free.length; j++) {
   const a = free[index];
   const b = free[j];
   [positions[a], positions[b]] = [positions[b], positions[a]];
   explore(index + 1);
   [positions[a], positions[b]] = [positions[b], positions[a]];
  }
 };
 if (free.length <= 8) explore(0);
 else {
  // 大規模なシナリオでは計算量を抑えるため、改善する交換だけを繰り返す。
  for (let pass = 0; pass < 30; pass++) {
   let improved = false;
   for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
    const a = free[i];
    const b = free[j];
    [positions[a], positions[b]] = [positions[b], positions[a]];
    const current = score();
    if (current < best - 0.00001) {
     best = current;
     bestPositions = positions.map(p => ({ ...p }));
     improved = true;
    } else [positions[a], positions[b]] = [positions[b], positions[a]];
   }
   if (!improved) break;
  }
 }
 return actors.map((actor, index) => ({ ...actor, position: bestPositions[index] }));
}
