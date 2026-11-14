import type { Scenario } from '../scenario';
import { connectionDropTarget } from './pointerDropActions';

type Actor = Scenario['actors'][number];
type Point = { x: number; y: number };

/**
 * 接続ハンドルのドロップ結果を確定する。
 * ドラッグ元が失われた場合は何もせず、ノード外へのドロップはエラーを返す。
 */
export function resolveWireDrop(
 actors: Actor[],
 from: string | null,
 point: Point,
): { kind: 'connect'; from: string; to: string }
 | { kind: 'invalid'; message: string }
 | { kind: 'none' } {
 if (!from) return { kind: 'none' };
 const to = connectionDropTarget(actors, point);
 if (!to) return { kind: 'invalid', message: '接続先ノードの上でドロップしてください。' };
 return { kind: 'connect', from, to };
}
