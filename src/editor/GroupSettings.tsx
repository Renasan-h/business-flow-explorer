import type { Dispatch, SetStateAction } from 'react';
import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];
type Group = NonNullable<Scenario['groups']>[number];

/** 領域のプロパティと所属ノードを編集するフォーム。 */
export default function GroupSettings({ group, actors, setGroups, onDelete }: {
 group: Group;
 actors: Actor[];
 setGroups: Dispatch<SetStateAction<Group[]>>;
 onDelete: (id: string) => void;
}) {
 return <>
<details className="editor-section" open><summary>領域設定</summary><label>領域名<input value={group.name} onChange={e => setGroups(items => items.map(item => item.id === group.id ? { ...item, name: e.target.value } : item))}/></label><label>色<input type="color" value={group.color ?? '#2563eb'} onChange={e => setGroups(items => items.map(item => item.id === group.id ? { ...item, color: e.target.value } : item))}/></label><fieldset className="group-members"><legend>所属ノード</legend>{actors.map(actor => <label key={actor.id}><input type="checkbox" checked={Boolean(group.memberIds?.includes(actor.id))} onChange={event => setGroups(items => items.map(item => item.id !== group.id ? item : { ...item, memberIds: event.target.checked ? [...(item.memberIds ?? []), actor.id] : (item.memberIds ?? []).filter(id => id !== actor.id) }))}/>{actor.name}</label>)}</fieldset><button onClick={() => { onDelete(group.id); }}>領域を削除</button></details>
 </>;
}
