import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];
type Group = NonNullable<Scenario['groups']>[number];
type Point = { x: number; y: number };

type DragStart = {
 id: number;
 actorId: string | null;
 resizeActor?: boolean;
 groupId?: string;
 resizeGroup?: boolean;
 initialMembers?: { id: string; x: number; y: number }[];
 initialSize?: { width: number; height: number };
 x: number;
 y: number;
 initial: Point;
 offset: Point;
};

/** ノードのサイズ変更開始時点の座標・寸法を保持する。 */
export function nodeResizeStart(actor: Actor, pointerId: number, cursor: Point, offset: Point, defaultSize: { width: number; height: number }): DragStart {
 return {
  id: pointerId,
  actorId: actor.id,
  resizeActor: true,
  initialSize: { width: actor.width ?? defaultSize.width, height: actor.height ?? defaultSize.height },
  x: cursor.x,
  y: cursor.y,
  initial: { ...actor.position },
  offset,
 };
}

/** 領域移動・サイズ変更開始時点の所属ノード座標を保存する。 */
export function groupDragStart(group: Group, actors: Actor[], resizeGroup: boolean, pointerId: number, cursor: Point, offset: Point): DragStart {
 return {
  id: pointerId,
  actorId: null,
  groupId: group.id,
  resizeGroup,
  initialMembers: actors.filter(actor => group.memberIds?.includes(actor.id)).map(actor => ({ id: actor.id, ...actor.position })),
  initialSize: { width: group.width, height: group.height },
  x: cursor.x,
  y: cursor.y,
  initial: { x: group.x, y: group.y },
  offset,
 };
}
