import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];

/** 再生画面では指定された業務情報だけを、入力されている場合に表示する。 */
export default function ActorDetailsDrawer({ actor, onClose }: { actor: Actor | null; onClose: () => void }) {
 if (!actor) return null;
 const fields = [
  ['関連資料', actor.documents?.join(', ')],
  ['説明', actor.description],
  ['環境', actor.environment],
  ['接続先・URL', actor.endpoint],
  ['インスタンス名', actor.instanceName],
  ['IPアドレス', actor.ip],
  ['タグ', actor.tags?.join(', ')],
 ] as const;
 return <div className="node-details-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
  <aside className="node-details-panel" role="dialog" aria-modal="true" aria-label={`${actor.name}の詳細`}>
   <div className="node-details-heading">
    <h2>{actor.name}</h2>
    <button type="button" className="icon-close-button" onClick={onClose} aria-label="閉じる">✕</button>
   </div>
   {fields.filter(([, value]) => Boolean(value?.trim())).map(([label, value]) =>
    <p key={label}><strong>{label}</strong>：{value}</p>
   )}
  </aside>
 </div>;
}
