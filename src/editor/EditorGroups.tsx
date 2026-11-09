import type { Scenario } from '../scenario';
type Group = NonNullable<Scenario['groups']>[number];

/** 領域の枠、タブ、サイズ変更ハンドルを描画する。 */
export default function EditorGroups({ groups, selectedGroup, tool, onSelect }: {
 groups: Group[];
 selectedGroup: string | null;
 tool: 'move' | 'connect' | 'multi';
 onSelect: (id: string) => void;
}) {
 return <>
      {groups.map(group => <g key={group.id} data-group-id={group.id} className="editor-group" onClick={event => { event.stopPropagation(); if (tool === 'multi') return; onSelect(group.id); }}><rect x={group.x} y={group.y} width={group.width} height={group.height} rx="8" fill={group.color ?? '#2563eb'} fillOpacity=".045" stroke={group.color ?? '#2563eb'} strokeWidth={selectedGroup === group.id ? 2 : 1}/><rect x={group.x + 10} y={group.y - 30} width={Math.min(group.width - 20, Math.max(120, group.name.length * 13 + 36))} height="31" rx="8" fill={group.color ?? '#2563eb'} stroke={group.color ?? '#2563eb'} strokeWidth="1"/><rect x={group.x + 10} y={group.y - 9} width={Math.min(group.width - 20, Math.max(120, group.name.length * 13 + 36))} height="10" fill={group.color ?? '#2563eb'}/><text x={group.x + 24} y={group.y - 9} fill="#ffffff" fontWeight="600" fontSize="15">{group.name}</text><rect data-group-resize={group.id} x={group.x + group.width - 22} y={group.y + group.height - 22} width="22" height="22" rx="4" fill={group.color ?? '#2563eb'} className="editor-group-resize"/></g>)}
 </>;
}
