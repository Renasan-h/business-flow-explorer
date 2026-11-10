import type { Scenario } from '../scenario';
import { routeConnection, pointOnRoute } from '../connectionRouting';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
type InterfaceDefinition = NonNullable<Scenario['interfaces']>[number];

/** 通信の属性と手動経由点を編集するフォーム。通信経路の描画は行わない。 */
export default function StepSettings({ activeStep, actors, interfaces, changeStep, changeDirection, openInterface, deleteStep }: {
 activeStep: Step;
 actors: Actor[];
 interfaces: InterfaceDefinition[];
 changeStep: (id: string, update: Partial<Step>) => void;
 changeDirection: (id: string, bidirectional: boolean) => void;
 openInterface: (id: string) => void;
 deleteStep: (id: string) => void;
}) {
 return <>
<details className="editor-section" key={`step-${activeStep.id}`} open><summary>通信設定</summary>
     <label>接続方向<select value={activeStep.bidirectional ? 'both' : 'one'} onChange={e => changeDirection(activeStep.id, e.target.value === 'both')}><option value="one">片方向（1本）</option><option value="both">双方向（2本・1件で管理）</option></select></label>
     <label>接続線の形状<select value={activeStep.routing ?? 'straight'} onChange={e => changeStep(activeStep.id, { routing: e.target.value as 'straight' | 'orthogonal' })}><option value="straight">直線（標準）</option><option value="orthogonal">折れ線（ノードを迂回）</option></select></label>
      <div className="editor-waypoint-settings">
       <strong>往路の経由点（手動）</strong>
       <p>経由点を追加すると折れ線に切り替わります。通信線を選択するとオレンジ色の点をドラッグできます。</p>
       {(activeStep.waypoints ?? []).map((point, index) => <div key={index} className="editor-waypoint-row">
        <span>経由点 {index + 1}（{Math.round(point.x)}, {Math.round(point.y)}）</span>
        <button type="button" onClick={() => changeStep(activeStep.id, { waypoints: (activeStep.waypoints ?? []).filter((_, i) => i !== index) })}>削除</button>
       </div>)}
       <button type="button" disabled={(activeStep.waypoints?.length ?? 0) >= 100} onClick={() => {
        const action = activeStep.actions[0];
        if (!action) return;
        const points = routeConnection(actors, action.from, action.to, 'orthogonal');
        const point = pointOnRoute(points, .5);
        changeStep(activeStep.id, { routing: 'orthogonal', waypoints: [...(activeStep.waypoints ?? []), point] });
       }}>＋ 経由点を追加</button>
       {Boolean(activeStep.waypoints?.length) && <button type="button" onClick={() => changeStep(activeStep.id, { waypoints: [] })}>自動配線に戻す</button>}
      </div>
     {activeStep.bidirectional && <div className="editor-waypoint-settings">
      <strong>復路の折れ線経由点（手動）</strong>
      <p>紫色の点をドラッグして復路の経由点を調整できます。往路とは独立して保存されます。</p>
      {(activeStep.reverseWaypoints ?? []).map((point, index) => <div key={index} className="editor-waypoint-row">
       <span>復路経由点 {index + 1}（{Math.round(point.x)}, {Math.round(point.y)}）</span>
       <button type="button" onClick={() => changeStep(activeStep.id, { reverseWaypoints: (activeStep.reverseWaypoints ?? []).filter((_, i) => i !== index) })}>削除</button>
      </div>)}
      <button type="button" disabled={(activeStep.reverseWaypoints?.length ?? 0) >= 100} onClick={() => {
       if (!activeStep.reverseFrom || !activeStep.reverseTo) return;
       const points = routeConnection(actors, activeStep.reverseFrom, activeStep.reverseTo, 'orthogonal');
       const point = pointOnRoute(points, .5);
       changeStep(activeStep.id, { routing: 'orthogonal', reverseWaypoints: [...(activeStep.reverseWaypoints ?? []), point] });
      }}>＋ 復路経由点を追加</button>
      {Boolean(activeStep.reverseWaypoints?.length) && <button type="button" onClick={() => changeStep(activeStep.id, { reverseWaypoints: [] })}>復路を自動配線に戻す</button>}
     </div>}
     {actors.some(actor => actor.type === 'decision' && activeStep.actions.some(action => action.from === actor.id)) && <label>分岐条件（例: Yes / No、成功 / 失敗）
      <input value={activeStep.branchLabel ?? ''} onChange={e => changeStep(activeStep.id, { branchLabel: e.target.value || undefined })} placeholder="この経路を通る条件"/>
     </label>}
     <label>処理名<input value={activeStep.title} onChange={e => changeStep(activeStep.id, { title: e.target.value })}/></label>
     <label>説明<textarea value={activeStep.description} onChange={e => changeStep(activeStep.id, { description: e.target.value })}/></label>
     <label>往路IF資料<input value={activeStep.forwardIf ?? ''} onChange={e => changeStep(activeStep.id, { forwardIf: e.target.value || undefined })} placeholder="例: IF-ORDER-001"/></label>
     <select value={interfaces.some(item => item.id === activeStep.forwardIf) ? activeStep.forwardIf : ''} onChange={e => changeStep(activeStep.id, { forwardIf: e.target.value || undefined })}><option value="">IF定義から選択</option>{interfaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{activeStep.forwardIf && <button type="button" onClick={() => openInterface(activeStep.forwardIf!)}>往路IFを表示</button>}
     {activeStep.bidirectional && <>
      <label>復路IF資料<input value={activeStep.reverseIf ?? ''} onChange={e => changeStep(activeStep.id, { reverseIf: e.target.value || undefined })} placeholder="例: IF-ORDER-002"/></label>
      <select value={interfaces.some(item => item.id === activeStep.reverseIf) ? activeStep.reverseIf : ''} onChange={e => changeStep(activeStep.id, { reverseIf: e.target.value || undefined })}><option value="">IF定義から選択</option>{interfaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{activeStep.reverseIf && <button type="button" onClick={() => openInterface(activeStep.reverseIf!)}>復路IFを表示</button>}
      <label>復路通信内容<textarea value={activeStep.reversePayload ?? ''} onChange={e => changeStep(activeStep.id, { reversePayload: e.target.value || undefined })} placeholder="例: 処理結果・応答データ"/></label>
     </>}
     {activeStep.actions.map((action, index) => <div key={index}>
      <label>往路送信元<select value={action.from} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, from: e.target.value } : a) })}>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
      <label>往路送信先<select value={action.to} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, to: e.target.value } : a) })}>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
      {activeStep.bidirectional && <>
       <label>復路送信元<select value={activeStep.reverseFrom ?? ''} onChange={e => changeStep(activeStep.id, { reverseFrom: e.target.value })}><option value="">選択してください</option>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
       <label>復路送信先<select value={activeStep.reverseTo ?? ''} onChange={e => changeStep(activeStep.id, { reverseTo: e.target.value })}><option value="">選択してください</option>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
      </>}
      <label>通信内容<input value={action.payload} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, payload: e.target.value } : a) })}/></label>
      <label>通信時間 (ms)<input type="number" min="1" value={action.durationMs} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, durationMs: Number(e.target.value) } : a) })}/></label>
     </div>)}
     <button onClick={() => deleteStep(activeStep.id)}>通信を削除</button>
    </details>
 </>;
}
