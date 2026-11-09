import type { Scenario } from '../scenario';

type InterfaceDefinition = NonNullable<Scenario['interfaces']>[number];

/** 再生画面・編集プレビューで共有するIF定義の左側ドロワー。 */
export default function InterfaceDefinitionDrawer({ interfaceId, interfaces, onClose }: {
 interfaceId: string | null;
 interfaces?: InterfaceDefinition[];
 onClose: () => void;
}) {
 if (!interfaceId) return null;
 const definition = interfaces?.find(item => item.id === interfaceId);
 return <div className="node-details-backdrop if-definition-backdrop"
  onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
  <aside className="node-details-panel if-definition-drawer" role="dialog" aria-modal="true" aria-label="IF定義">
   <div className="node-details-heading"><h2>IF定義</h2><button type="button" className="icon-close-button" aria-label="IF定義を閉じる" onClick={onClose}>×</button></div>
   {definition ? <section>
    <h3>{definition.name}</h3>
    <p>{definition.description}</p>
    <p>ID: {definition.id}</p>
    {definition.fields?.map((field, index) => <p key={index}>
     <strong>{field.name}</strong>（{field.type}）{field.required ? '・必須' : ''} {field.description}
    </p>)}
   </section> : <p>IF定義がありません: {interfaceId}</p>}
  </aside>
 </div>;
}
