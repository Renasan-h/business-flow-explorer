import { useEffect, useRef, useState } from 'react';
import { stringify } from 'yaml';
import type { Scenario } from './scenario';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
type Tool = 'move' | 'connect';
type FilePicker = { showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable: () => Promise<{ write: (content: string) => Promise<void>; close: () => Promise<void> }> }> };

const WIDTH = 1400;
const HEIGHT = 900;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 76;

/** 編集結果を単一ファイルのシナリオとして出力し、ファイル参照の解決を不要にする。 */
export default function FlowEditor({ initial, onClose }: { initial: Scenario; onClose: () => void }) {
 const [actors, setActors] = useState<Actor[]>(() => initial.actors.map(actor => ({ ...actor, position: { ...actor.position } })));
 const [steps, setSteps] = useState<Step[]>(() => initial.steps.map(step => ({ ...step, actions: step.actions.map(action => ({ ...action })) })));
 const [metadata, setMetadata] = useState({ ...initial.metadata });
 const [tool, setTool] = useState<Tool>('move');
 const [selectedActor, setSelectedActor] = useState<string | null>(null);
 const [selectedStep, setSelectedStep] = useState<string | null>(null);
 const [source, setSource] = useState<string | null>(null);
 const [wire, setWire] = useState<{ from: string; x: number; y: number } | null>(null);
 const wirePointer = useRef<number | null>(null);
 const [zoom, setZoom] = useState(1);
 const [offset, setOffset] = useState({ x: 0, y: 0 });
 const [message, setMessage] = useState('');
 const svgRef = useRef<SVGSVGElement>(null);
 // 削除後も番号を再利用せず、編集中の識別番号を維持する。
 const nextNodeNumber = useRef(initial.actors.length + 1);
 const [nodeNumbers, setNodeNumbers] = useState<Record<string, number>>(() =>
  Object.fromEntries(initial.actors.map((actor, index) => [actor.id, index + 1])));

 const drag = useRef<{ id: number; actorId: string | null; x: number; y: number; initial: { x: number; y: number }; offset: { x: number; y: number } } | null>(null);
 const activeActor = actors.find(actor => actor.id === selectedActor);
 const activeStep = steps.find(step => step.id === selectedStep);

 // ポインター座標を拡大率と移動量を考慮したワールド座標へ変換する。
 const toWorld = (x: number, y: number) => {
  const bounds = svgRef.current!.getBoundingClientRect();
  return { x: ((x - bounds.left) * WIDTH / bounds.width - offset.x) / zoom,
   y: ((y - bounds.top) * HEIGHT / bounds.height - offset.y) / zoom };
 };
 const changeActor = (id: string, patch: Partial<Actor>) => setActors(current => current.map(actor => actor.id === id ? { ...actor, ...patch } : actor));
 const changeStep = (id: string, patch: Partial<Step>) => setSteps(current => current.map(step => step.id === id ? { ...step, ...patch } : step));
 const addActor = () => {
  const id = 'actor-' + crypto.randomUUID().slice(0, 8);
  const number = nextNodeNumber.current++;
  setNodeNumbers(current => ({ ...current, [id]: number }));
  setActors(current => [...current, { id, name: '新しいノード ' + number, type: 'service', position: { x: 300 + current.length * 25, y: 220 + current.length * 20 } }]);
  setSelectedActor(id);
  setSelectedStep(null);
  setTool('move');
 };
 const addConnection = (from: string, to: string) => {
  if (from === to) { setMessage('同じノード同士は接続できません。'); return; }
  const id = 'connection-' + crypto.randomUUID().slice(0, 8);
  setSteps(current => [...current, { id, title: '新しい通信', description: '', actions: [{ type: 'transfer', from, to, payload: '通信内容', durationMs: 1200 }] }]);
  setSelectedStep(id);
  setSelectedActor(null);
  setSource(null);
  setTool('move');
  setMessage('通信線を追加しました。');
 };
 const clickActor = (id: string) => {
  if (tool === 'connect') {
   if (!source) setSource(id);
   else addConnection(source, id);
  } else {
   setSelectedActor(id);
   setSelectedStep(null);
  }
 };
 const save = async () => {
  setMessage('');
  if (actors.length < 2 || steps.length === 0) { setMessage('保存にはノード2件以上と通信1件以上が必要です。'); return; }
  const ids = new Set(actors.map(actor => actor.id));
  if (ids.size !== actors.length || actors.some(actor => !actor.id.trim() || !actor.name.trim())) { setMessage('ノードIDの重複または未入力があります。'); return; }
  if (new Set(steps.map(step => step.id)).size !== steps.length || steps.some(step => !step.id.trim() || step.actions.some(action => !ids.has(action.from) || !ids.has(action.to) || action.durationMs <= 0))) { setMessage('通信のID・参照先・所要時間を確認してください。'); return; }
  const yaml = stringify({ schemaVersion: '1.0', metadata, actors, steps }, { lineWidth: 0 });
  const filename = (metadata.id.replace(/[^a-zA-Z0-9_-]/g, '-') || 'scenario') + '.yaml';
  try {
   const picker = (window as Window & FilePicker).showSaveFilePicker;
   if (picker) {
    const handle = await picker({ suggestedName: filename, types: [{ description: 'YAML scenario', accept: { 'application/x-yaml': ['.yaml', '.yml'] } }] });
    const writable = await handle.createWritable();
    await writable.write(yaml);
    await writable.close();
    setMessage('指定した保存先にYAMLを保存しました。');
   } else {
    // 保存ダイアログ非対応ブラウザでは通常のダウンロードを利用する。
    const url = URL.createObjectURL(new Blob([yaml], { type: 'application/x-yaml' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('YAMLをダウンロードしました。保存先はブラウザの設定に従います。');
   }
  } catch (error) {
   if (error instanceof Error && error.name === 'AbortError') return;
   setMessage('保存できませんでした: ' + String(error));
  }
 };
 const [showLines, setShowLines] = useState(true);
 const isNew = initial.actors.length === 0 && initial.steps.length === 0;
 useEffect(() => { setMessage(''); }, [tool]);
 return <div className="flow-editor">
  <div className="editor-header"><div><h2>{isNew ? '新規フロー作成' : 'フローエディター'}</h2><p>{isNew ? 'ノードを2件以上追加し、通信線を1件以上作成してからYAMLを保存してください。' : 'ノードをドラッグして配置し、右端の＋から別のノードへドラッグして通信線を作成できます。'}</p></div><div className="editor-header-actions"><button onClick={onClose}>再生画面へ戻る</button><button className="selected" onClick={() => void save()}>YAMLを保存…</button></div></div>
  <div className="editor-toolbar">
   <button className={tool === 'move' ? 'selected' : ''} onClick={() => { setTool('move'); setSource(null); }}>移動・選択</button>
   <button className={tool === 'connect' ? 'selected' : ''} onClick={() => setTool('connect')}>通信線を追加</button>
   <button onClick={addActor}>＋ ノード追加</button>
   <button onClick={() => setZoom(z => Math.max(.3, +(z / 1.2).toFixed(2)))}>−</button>
   <span>{Math.round(zoom * 100)}%</span>
   <button onClick={() => setZoom(z => Math.min(2.5, +(z * 1.2).toFixed(2)))}>＋</button>
   <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>表示リセット</button>
   <label><input type="checkbox" checked={showLines} onChange={event => setShowLines(event.target.checked)}/> 通信線表示</label>
   {source && <span>接続元: {source} → 接続先を選択</span>}
  </div>
  <div className="editor-layout">
   <div className="editor-canvas">
    <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="編集可能なノード接続図"
     onPointerDown={event => {
      if (event.button !== 0) return;
      const target = event.target as Element;
      const handle = target.closest('[data-connection-handle]');
      if (handle) {
       const from = handle.getAttribute('data-connection-handle');
       if (!from) return;
       wirePointer.current = event.pointerId;
       setWire({ from, ...toWorld(event.clientX, event.clientY) });
       setSource(null);
       event.currentTarget.setPointerCapture(event.pointerId);
       event.preventDefault();
       return;
      }
      if (tool !== 'move') return;
      const node = target.closest('[data-actor-id]');
      const actorId = node?.getAttribute('data-actor-id') ?? null;
      // SVGのポインターキャプチャ後はclickがSVGへ再ターゲットされるため、選択を先に確定する。
      if (actorId) {
       setSelectedActor(actorId);
       setSelectedStep(null);
      } else {
       const edge = target.closest('[data-step-id]');
       if (edge) {
        setSelectedStep(edge.getAttribute('data-step-id'));
        setSelectedActor(null);
        return;
       }
      }
      const actor = actors.find(item => item.id === actorId);
      drag.current = { id: event.pointerId, actorId, x: event.clientX, y: event.clientY, initial: actor?.position ?? { x: 0, y: 0 }, offset };
      event.currentTarget.setPointerCapture(event.pointerId);
     }}
     onPointerMove={event => {
      if (wirePointer.current === event.pointerId) {
       setWire(current => current ? { ...current, ...toWorld(event.clientX, event.clientY) } : null);
       return;
      }
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const dx = (event.clientX - current.x) * WIDTH / bounds.width;
      const dy = (event.clientY - current.y) * HEIGHT / bounds.height;
      if (current.actorId) {
       const x = Math.max(NODE_WIDTH / 2, Math.min(WIDTH - NODE_WIDTH / 2, current.initial.x + dx / zoom));
       const y = Math.max(NODE_HEIGHT / 2, Math.min(HEIGHT - NODE_HEIGHT / 2, current.initial.y + dy / zoom));
       changeActor(current.actorId, { position: { x, y } });
      } else {
       setOffset({ x: current.offset.x + dx, y: current.offset.y + dy });
      }
     }}
     onPointerUp={event => {
      if (wirePointer.current === event.pointerId) {
       const point = toWorld(event.clientX, event.clientY);
       // キャプチャ後のevent.targetはSVGのため、接続先はワールド座標で判定する。
       const target = [...actors].reverse().find(actor =>
        Math.abs(point.x - actor.position.x) <= NODE_WIDTH / 2 &&
        Math.abs(point.y - actor.position.y) <= NODE_HEIGHT / 2);
       if (wire && target) addConnection(wire.from, target.id);
       else if (wire) setMessage('接続先ノードの上でドロップしてください。');
       setWire(null);
       wirePointer.current = null;
      }
      if (drag.current?.id === event.pointerId) drag.current = null;
     }}
     onPointerCancel={() => { drag.current = null; wirePointer.current = null; setWire(null); }}> 
     <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
      {showLines && steps.flatMap(step => step.actions.map((action, index) => {
       const from = actors.find(actor => actor.id === action.from);
       const to = actors.find(actor => actor.id === action.to);
       if (!from || !to) return null;
       const active = selectedStep === step.id;
       return <g key={step.id + '-' + index} data-step-id={step.id} className="editor-edge" onClick={event => { event.stopPropagation(); setSelectedStep(step.id); setSelectedActor(null); }}>
        <line x1={from.position.x} y1={from.position.y} x2={to.position.x} y2={to.position.y} stroke="transparent" strokeWidth="18"/>
        <line x1={from.position.x} y1={from.position.y} x2={to.position.x} y2={to.position.y} stroke={active ? '#22d3ee' : '#7b94b3'} strokeWidth={active ? 4 : 2} opacity={active ? 1 : .55}/>
        <circle cx={(from.position.x + to.position.x) / 2} cy={(from.position.y + to.position.y) / 2} r={active ? 8 : 5} fill={active ? '#22d3ee' : '#7b94b3'}/>
       </g>;
      }))}
      {wire && (() => {
       const from = actors.find(actor => actor.id === wire.from);
       return from ? <line x1={from.position.x} y1={from.position.y} x2={wire.x} y2={wire.y}
        stroke="#22d3ee" strokeWidth="3" strokeDasharray="9 6" pointerEvents="none"/> : null;
      })()}
      {actors.map(actor => <g key={actor.id} data-actor-id={actor.id} className="editor-node" onClick={() => clickActor(actor.id)}>
       <rect x={actor.position.x - NODE_WIDTH / 2} y={actor.position.y - NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT} rx="12" fill={source === actor.id ? '#165c73' : selectedActor === actor.id ? '#1e5a88' : '#20314a'} stroke={source === actor.id || selectedActor === actor.id ? '#22d3ee' : '#7398c9'} strokeWidth="2"/>
       <circle cx={actor.position.x - NODE_WIDTH / 2 + 13} cy={actor.position.y - NODE_HEIGHT / 2 + 13} r="15" fill="#22d3ee" />
       <text x={actor.position.x - NODE_WIDTH / 2 + 13} y={actor.position.y - NODE_HEIGHT / 2 + 18} textAnchor="middle" fill="#082238" fontSize="13" fontWeight="bold">{nodeNumbers[actor.id]}</text>
       <text x={actor.position.x} y={actor.position.y - 8} textAnchor="middle" fill="#f0f6ff" fontSize="15">{actor.type === 'database' ? '◉' : actor.type === 'person' ? '◎' : actor.type === 'server' ? '▤' : '◇'}</text>
       <text x={actor.position.x} y={actor.position.y + 15} textAnchor="middle" fill="#f0f6ff" fontSize="12">{actor.name.length > 12 ? actor.name.slice(0, 11) + '…' : actor.name}</text>
       {/* ノード端からドラッグする接続ハンドル。 */}
       <circle data-connection-handle={actor.id} cx={actor.position.x + NODE_WIDTH / 2} cy={actor.position.y}
        r="13" fill="#22d3ee" stroke="#082238" strokeWidth="2" className="editor-connection-handle"/>
       <text data-connection-handle={actor.id} x={actor.position.x + NODE_WIDTH / 2} y={actor.position.y + 5}
        textAnchor="middle" fill="#082238" fontSize="16" fontWeight="bold" className="editor-connection-handle">＋</text>
      </g>)}
     </g>
    </svg>
   </div>
   <aside className="editor-inspector">
    <h3>シナリオ設定</h3>
    <label>タイトル<input value={metadata.title} onChange={e => setMetadata(v => ({ ...v, title: e.target.value }))}/></label>
    <label>ID<input value={metadata.id} onChange={e => setMetadata(v => ({ ...v, id: e.target.value }))}/></label>
    <label>説明<textarea value={metadata.description} onChange={e => setMetadata(v => ({ ...v, description: e.target.value }))}/></label>
    {activeActor && <><h3>ノード設定（No. {nodeNumbers[activeActor.id]}）</h3>
     <label>Actor ID<input value={activeActor.id} onChange={e => { const next = e.target.value; const previous = activeActor.id; if (!next || (next !== previous && actors.some(actor => actor.id === next))) return; changeActor(previous, { id: next }); setNodeNumbers(current => { const updated = { ...current }; updated[next] = updated[previous]; delete updated[previous]; return updated; }); setSelectedActor(next); setSteps(current => current.map(step => ({ ...step, actions: step.actions.map(action => ({ ...action, from: action.from === previous ? next : action.from, to: action.to === previous ? next : action.to })) }))); }}/></label>
     <label>表示名<input value={activeActor.name} onChange={e => changeActor(activeActor.id, { name: e.target.value })}/></label>
     <label>種類<select value={activeActor.type} onChange={e => changeActor(activeActor.id, { type: e.target.value as Actor['type'] })}><option value="person">人物</option><option value="server">サーバー</option><option value="service">サービス</option><option value="database">DB</option></select></label>
     <div className="editor-coordinates"><label>X<input type="number" value={Math.round(activeActor.position.x)} onChange={e => changeActor(activeActor.id, { position: { ...activeActor.position, x: Number(e.target.value) } })}/></label><label>Y<input type="number" value={Math.round(activeActor.position.y)} onChange={e => changeActor(activeActor.id, { position: { ...activeActor.position, y: Number(e.target.value) } })}/></label></div>
     <button onClick={() => { setActors(v => v.filter(actor => actor.id !== activeActor.id)); setSteps(v => v.filter(step => step.actions.every(action => action.from !== activeActor.id && action.to !== activeActor.id))); setSelectedActor(null); }}>ノードと関連通信を削除</button>
    </>}
    {activeStep && <><h3>通信設定</h3>
     <label>処理名<input value={activeStep.title} onChange={e => changeStep(activeStep.id, { title: e.target.value })}/></label>
     <label>説明<textarea value={activeStep.description} onChange={e => changeStep(activeStep.id, { description: e.target.value })}/></label>
     {activeStep.actions.map((action, index) => <div key={index}>
      <label>送信元<select value={action.from} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, from: e.target.value } : a) })}>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
      <label>送信先<select value={action.to} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, to: e.target.value } : a) })}>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
      <label>通信内容<input value={action.payload} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, payload: e.target.value } : a) })}/></label>
      <label>通信時間 (ms)<input type="number" min="1" value={action.durationMs} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, durationMs: Number(e.target.value) } : a) })}/></label>
     </div>)}
     <button onClick={() => { setSteps(v => v.filter(step => step.id !== activeStep.id)); setSelectedStep(null); }}>通信を削除</button>
    </>}
    <h3>通信の再生順</h3><div className="editor-step-list">{steps.map((step, index) => <div key={step.id}><button className={selectedStep === step.id ? 'selected' : ''} onClick={() => { setSelectedStep(step.id); setSelectedActor(null); }}>{index + 1}. {step.title}</button><button disabled={index === 0} aria-label="上へ" onClick={() => setSteps(v => { const copy = [...v]; [copy[index-1], copy[index]] = [copy[index], copy[index-1]]; return copy; })}>↑</button><button disabled={index === steps.length-1} aria-label="下へ" onClick={() => setSteps(v => { const copy = [...v]; [copy[index+1], copy[index]] = [copy[index], copy[index+1]]; return copy; })}>↓</button></div>)}</div>
   </aside>
  </div>
  {message && <p className="editor-message" role="status">{message}</p>}
 </div>;
}
