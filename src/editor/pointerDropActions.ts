import type { Scenario } from '../scenario';
import { findConnectionDropTarget, findPlaybackOrderDropTarget } from './pointerDropTargets';

type Point = { x: number; y: number };
type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];

/** キャプチャ中のポインター位置から接続先を決定する。 */
export function connectionDropTarget(actors: Actor[], point: Point): string | null {
 return findConnectionDropTarget(actors, point)?.id ?? null;
}

/** 再生順のドラッグ終了時に実行する操作を判定する。 */
export function playbackOrderDropAction(
 steps: Step[],
 point: Point,
 source: string,
 moved: boolean,
 orderPoint: (step: Step, index: number) => Point,
): { kind: 'reorder'; from: string; to: string } | { kind: 'choose'; source: string } | null {
 if (!moved) return { kind: 'choose', source };
 const destination = findPlaybackOrderDropTarget(steps, point, orderPoint);
 return destination ? { kind: 'reorder', from: source, to: destination } : null;
}
