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

 /** 経由点のドラッグを開始する。 */
 const startWaypoint = (pointerId: number, waypoint: Omit<WaypointPointer, 'pointerId'>) => {
  waypointDrag.current = { pointerId, ...waypoint };
 };

 /** 指定ポインターの経由点ドラッグを終了する。 */
 const finishWaypoint = (pointerId: number) => {
  if (waypointDrag.current?.pointerId === pointerId) waypointDrag.current = null;
 };

 /** 接続線のドラッグを開始・終了する。 */
 const startWire = (pointerId: number) => {
  wirePointer.current = pointerId;
 };
 const finishWire = (pointerId: number): boolean => {
  if (wirePointer.current !== pointerId) return false;
  wirePointer.current = null;
  return true;
 };

 /** 再生順のドラッグを開始する。 */
 const startOrder = (source: string, pointerId: number, x: number, y: number) => {
  orderDrag.current = { pointerId, source, x, y, moved: false };
 };

 /** 指定ポインターの再生順ドラッグを終了し、確定対象を返す。 */
 const finishOrder = (pointerId: number): OrderPointer | null => {
  const active = orderDrag.current;
  if (!active || active.pointerId !== pointerId) return null;
  orderDrag.current = null;
  return active;
 };

 /** 移動距離がしきい値を超えたら再生順ドラッグを確定状態にする。 */
 const moveOrder = (pointerId: number, x: number, y: number): boolean | null => {
  const active = orderDrag.current;
  if (!active || active.pointerId !== pointerId) return null;
  if (Math.hypot(x - active.x, y - active.y) > 5) active.moved = true;
  return active.moved;
 };

 /** 接続線のドラッグ中かを判定する。 */
 const isWirePointer = (pointerId: number): boolean => wirePointer.current === pointerId;

 /** 指定ポインターの経由点ドラッグ情報を取得する。 */
 const activeWaypoint = (pointerId: number): WaypointPointer | null => {
  const active = waypointDrag.current;
  return active?.pointerId === pointerId ? active : null;
 };

 /** 指定ポインターの再生順ドラッグが進行中か判定する。 */
 const isOrderPointer = (pointerId: number): boolean => orderDrag.current?.pointerId === pointerId;

 /** キャンセル時に通信・経由点・再生順のドラッグ状態を解除する。 */
 const reset = () => {
  wirePointer.current = null;
  waypointDrag.current = null;
  orderDrag.current = null;
 };

 return { wirePointer, waypointDrag, orderDrag, startWaypoint, finishWaypoint, startWire, finishWire, startOrder, finishOrder, moveOrder, isWirePointer, activeWaypoint, isOrderPointer, reset };
}
