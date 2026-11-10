/** 右クリックした対象ごとの操作メニュー。データの変更と確認は親に委譲する。 */
export type EditorContextMenuState = {
 x: number;
 y: number;
 actorId: string | null;
 stepId: string | null;
 groupId: string | null;
};

export default function EditorContextMenu({ menu, onEditActor, onDuplicateActor, onDeleteActor, onEditGroup, onDeleteGroup, onEditStep, onDeleteStep, onAddWaypoint, onRemoveWaypoints, onAddActor, onResetView, waypointDirections }: {
 menu: EditorContextMenuState | null;
 onEditActor: (id: string) => void;
 onDuplicateActor: (id: string) => void;
 onDeleteActor: (id: string) => void;
 onEditGroup: (id: string) => void;
 onDeleteGroup: (id: string) => void;
 onEditStep: (id: string) => void;
 onDeleteStep: (id: string) => void;
 onAddWaypoint: (id: string, direction: 'forward' | 'reverse') => void;
 onRemoveWaypoints: (id: string, direction: 'forward' | 'reverse') => void;
 waypointDirections: { reverse: boolean; forwardCount: number; reverseCount: number };
 onAddActor: () => void;
 onResetView: () => void;
}) {
 if (!menu) return null;
 return <div className="editor-context-menu" role="menu" style={{ left: menu.x, top: menu.y }} onPointerDown={event => event.stopPropagation()}>
  {menu.actorId ? <>
   <button type="button" role="menuitem" onClick={() => onEditActor(menu.actorId!)}>ノードを編集</button>
   <button type="button" role="menuitem" onClick={() => onDuplicateActor(menu.actorId!)}>ノードを複製</button>
   <button type="button" role="menuitem" className="danger" onClick={() => onDeleteActor(menu.actorId!)}>ノードを削除</button>
  </> : menu.groupId ? <>
   <button type="button" role="menuitem" onClick={() => onEditGroup(menu.groupId!)}>領域を編集</button>
   <button type="button" role="menuitem" className="danger" onClick={() => onDeleteGroup(menu.groupId!)}>領域を削除</button>
  </> : menu.stepId ? <>
   <button type="button" role="menuitem" onClick={() => onEditStep(menu.stepId!)}>通信を編集</button>
   <button type="button" role="menuitem" onClick={() => onAddWaypoint(menu.stepId!, 'forward')}>往路の経由点を追加</button>
   {waypointDirections.forwardCount > 0 && <button type="button" role="menuitem" onClick={() => onRemoveWaypoints(menu.stepId!, 'forward')}>往路の経由点を解除</button>}
   {waypointDirections.reverse && <button type="button" role="menuitem" onClick={() => onAddWaypoint(menu.stepId!, 'reverse')}>復路の経由点を追加</button>}
   {waypointDirections.reverseCount > 0 && <button type="button" role="menuitem" onClick={() => onRemoveWaypoints(menu.stepId!, 'reverse')}>復路の経由点を解除</button>}
   <button type="button" role="menuitem" className="danger" onClick={() => onDeleteStep(menu.stepId!)}>通信を削除</button>
  </> : <>
   <button type="button" role="menuitem" onClick={onAddActor}>ノードを追加</button>
   <button type="button" role="menuitem" onClick={onResetView}>表示をリセット</button>
  </>}
 </div>;
}
