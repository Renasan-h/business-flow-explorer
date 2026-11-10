import { useRef, useState } from 'react';
import type { DragOrigin, EditorPoint } from './multiSelection';

/** 範囲選択中のポインター情報。Shiftキーで既存選択へ追加する。 */
type MarqueePointer = {
 pointerId: number;
 start: EditorPoint;
 additive: boolean;
};

/** 複数ノード移動の開始座標と移動前のノード座標を保持する。 */
type MultiDragPointer = {
 pointerId: number;
 x: number;
 y: number;
 initial: DragOrigin[];
};

/**
 * 複数選択操作中だけ必要な一時状態を管理する。
 * ノードデータ自体は保持せず、編集画面側で更新する。
 */
export function useMultiSelectionPointerState() {
 const marquee = useRef<MarqueePointer | null>(null);
 const [marqueeEnd, setMarqueeEnd] = useState<EditorPoint | null>(null);
 const multiDrag = useRef<MultiDragPointer | null>(null);
 /** ポインターキャンセル時に範囲選択と複数ドラッグの一時状態を破棄する。 */
 const reset = () => {
  marquee.current = null;
  setMarqueeEnd(null);
  multiDrag.current = null;
 };
 return { marquee, marqueeEnd, setMarqueeEnd, multiDrag, reset };
}
