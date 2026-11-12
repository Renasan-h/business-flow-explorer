import { useState } from 'react';

type Point = { x: number; y: number };
type WirePreview = Point & { from: string };

/** 接続線ドラッグ中だけ表示する仮接続線の状態を管理する。 */
export function useConnectionWirePreview() {
 const [wire, setWire] = useState<WirePreview | null>(null);

 /** 接続元と開始位置を記録する。 */
 const start = (from: string, point: Point) => {
  setWire({ from, ...point });
 };

 /** 接続元を維持したまま、仮接続線の終点だけを移動する。 */
 const move = (point: Point) => {
  setWire(current => current ? { ...current, ...point } : null);
 };

 /** ドロップ・キャンセル時に仮接続線を消去する。 */
 const clear = () => setWire(null);

 return { wire, start, move, clear };
}
