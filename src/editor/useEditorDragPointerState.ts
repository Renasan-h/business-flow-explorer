import { useRef } from 'react';
import type { DragStart } from './dragStartState';

/** 単一ノード・領域・キャンバスのドラッグ状態をポインターID単位で管理する。 */
export function useEditorDragPointerState() {
 const drag = useRef<DragStart | null>(null);

 /** 操作を開始したポインターの情報を記録する。 */
 const start = (state: DragStart) => {
  drag.current = state;
 };

 /** 対象ポインターの操作だけを終了する。 */
 const finish = (pointerId: number) => {
  if (drag.current?.id === pointerId) drag.current = null;
 };

 /** ポインターキャンセル時に状態を破棄する。 */
 const reset = () => {
  drag.current = null;
 };

 return { drag, start, finish, reset };
}
