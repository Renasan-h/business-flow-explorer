import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];

/** ノードの詳細を左側のドロワーに表示する。 */
export default function ActorDetailsDrawer({ actor, onClose }: { actor: Actor | null; onClose: () => void }) {
 if (!actor) return null;
 const fields: [string, string | undefined][] = [
  ['種類', actor.type],
  ['説明', actor.description],
  ['環境', actor.environment],
  ['接続先・URL', actor.endpoint],
  ['インスタンス名', actor.instanceName],
  ['IPアドレス', actor.ip],
  ['タグ', actor.tags?.join(', ')],
  ['関連資料', actor.documents?.join(', ')],
 ];
 return <div className="node-details-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
  <aside className="node-details-panel" role="dialog" aria-modal="true" aria-label={`${actor.name}の詳細`}>
   <div className="node-details-heading">
    <h2>{actor.name}</h2>
    <button type="button" className="icon-close-button" onClick={onClose} aria-label="閉じる">✕</button>
   </div>
   <p><strong>Actor ID</strong>：{actor.id}</p>
   {actor.color && <p><strong>ノード色</strong>：<span className="node-details-swatch" style={{backgroundColor: actor.color}}/> {actor.color}</p>}
   {fields.filter(([, value]) => Boolean(value)).map(([label, value]) => <p key={label}><strong>{label}</strong>：{value}</p>)}
  </aside>
 </div>;
}
