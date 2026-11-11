import type { Scenario } from '../scenario';

type Actor = Scenario['actors'][number];

const fieldLabels: Record<string, string> = {
 id: 'Actor ID', name: '表示名', type: '種類', icon: 'アイコン',
 description: '説明', environment: '環境', endpoint: '接続先・URL',
 instanceName: 'インスタンス名', ip: 'IPアドレス', tags: 'タグ',
 documents: '関連資料', color: 'ノード色', position: '配置座標',
 width: '幅', height: '高さ',
};

/** ノードに定義された属性を省略せず、右側の最前面に表示する。 */
export default function ActorDetailsDrawer({ actor, onClose }: { actor: Actor | null; onClose: () => void }) {
 if (!actor) return null;
 const fields = Object.entries(actor).filter(([key, value]) =>
  key !== 'name' && value !== undefined && value !== null && value !== '' &&
  (!Array.isArray(value) || value.length > 0)
 );
 const display = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
 };
 return <div className="node-details-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
  <aside className="node-details-panel" role="dialog" aria-modal="true" aria-label={`${actor.name}の詳細`}>
   <div className="node-details-heading">
    <h2>{actor.name}</h2>
    <button type="button" className="icon-close-button" onClick={onClose} aria-label="閉じる">✕</button>
   </div>
   {fields.map(([key, value]) => <p key={key}>
    <strong>{fieldLabels[key] ?? key}</strong>：
    {key === 'color' && <span className="node-details-swatch" style={{ backgroundColor: String(value) }}/>}
    {display(value)}
   </p>)}
  </aside>
 </div>;
}
