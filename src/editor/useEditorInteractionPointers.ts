import { useRef } from 'react';

type WaypointPointer = {
 pointerId: number;
 stepId: string;
 index: number;
 direction: 'forward' | 'reverse';
};

type OrderPointer = {
 pointerId: number;
 source: string;
 x: number;
 y: number;
 moved: boolean;
};

/** 接続線・経由点・再生順の一時的なポインター情報を保持する。 */
export function useEditorInteractionPointers() {
 const wirePointer = useRef<number | null>(null);
 const waypointDrag = useRef<WaypointPointer | null>(null);
 const orderDrag = useRef<OrderPointer | null>(null);

 /** キャンセル時に通信・経由点・再生順のドラッグ状態を解除する。 */
 const reset = () => {
  wirePointer.current = null;
  waypointDrag.current = null;
  orderDrag.current = null;
 };

 return { wirePointer, waypointDrag, orderDrag, reset };
}
