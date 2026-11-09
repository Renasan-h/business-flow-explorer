import type { Scenario } from '../scenario';
import { NODE_TYPES } from '../nodeCatalog';
import { NodeIcon } from '../NodeIcon';

type Actor = Scenario['actors'][number];

/** ノードの属性編集。ID変更による通信参照の更新は親に委譲する。 */
export default function ActorSettings({ activeActor, actors, nodeNumber, changeActor, renameActor, duplicateActor, deleteActor }: {
 activeActor: Actor;
 actors: Actor[];
 nodeNumber?: number;
 changeActor: (id: string, update: Partial<Actor>) => void;
 renameActor: (previous: string, next: string) => void;
 duplicateActor: (id: string) => void;
 deleteActor: (id: string) => void;
}) {
 return <>
<details className="editor-section" key={`actor-${activeActor.id}`} open><summary>ノード設定（No. {nodeNumber}）</summary>
     <label>Actor ID<input value={activeActor.id} onChange={e => renameActor(activeActor.id, e.target.value)}/></label>
     <label>表示名<input value={activeActor.name} onChange={e => changeActor(activeActor.id, { name: e.target.value })}/></label>
     <label className="editor-color-field"><span>ノード色</span><input type="color" aria-label="ノード色を選択" value={activeActor.color ?? '#20314a'} onChange={e => changeActor(activeActor.id, { color: e.target.value })}/><span className="editor-color-value">{activeActor.color ?? '#20314a'}</span></label>
     <label>関連資料（カンマ区切り）<input value={(activeActor.documents ?? []).join(', ')} onChange={e => changeActor(activeActor.id, { documents: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })} placeholder="設計書A, IF資料A"/></label>
     {/* 種類を選ぶだけで対応するアイコンが決まる。アイコンの個別設定は不要。 */}
     <div className="editor-icon-field">
      <span>ノードの種類</span>
      <div className="editor-icon-grid" role="group" aria-label="ノードの種類を選択">
       {NODE_TYPES.map(item => <button type="button" key={item.value}
        className={item.value === activeActor.type ? 'selected' : ''}
        title={item.label} aria-label={item.label} aria-pressed={item.value === activeActor.type}
        onClick={() => changeActor(activeActor.id, { type: item.value, icon: undefined })}>
        <svg viewBox="0 0 32 32" aria-hidden="true"><NodeIcon type={item.value} x={16} y={16} size={25}/></svg>
        <small>{item.label}</small>
       </button>)}
      </div>
     </div>
     <label>説明<textarea value={activeActor.description ?? ''} onChange={e => changeActor(activeActor.id, { description: e.target.value })} placeholder="ノードの役割や処理内容"/></label>
     <label>環境<input value={activeActor.environment ?? ''} onChange={e => changeActor(activeActor.id, { environment: e.target.value })} placeholder="例: 開発 / 検証 / 本番"/></label>
     <label>接続先・URL<input value={activeActor.endpoint ?? ''} onChange={e => changeActor(activeActor.id, { endpoint: e.target.value })} placeholder="例: https://api.example.com"/></label>
     <label>インスタンス名<input value={activeActor.instanceName ?? ''} onChange={e => changeActor(activeActor.id, { instanceName: e.target.value })}/></label>
     <label>IPアドレス<input value={activeActor.ip ?? ''} onChange={e => changeActor(activeActor.id, { ip: e.target.value })}/></label>
     <label>タグ（カンマ区切り）<input value={(activeActor.tags ?? []).join(', ')} onChange={e => changeActor(activeActor.id, { tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })} placeholder="例: 認証, 社内"/></label>
     <div className="editor-coordinates"><label>X<input type="number" value={Math.round(activeActor.position.x)} onChange={e => changeActor(activeActor.id, { position: { ...activeActor.position, x: Number(e.target.value) } })}/></label><label>Y<input type="number" value={Math.round(activeActor.position.y)} onChange={e => changeActor(activeActor.id, { position: { ...activeActor.position, y: Number(e.target.value) } })}/></label></div>
     <button type="button" className="editor-duplicate-node" onClick={() => duplicateActor(activeActor.id)}>ノードを複製</button>
     <button onClick={() => deleteActor(activeActor.id)}>ノードと関連通信を削除</button>
    </details>
 </>;
}
