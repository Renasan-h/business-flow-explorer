import { branchGroups, playbackSteps } from './branchPlayback';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Scenario } from './scenario';
import { NodeIcon } from './NodeIcon';
import { routeConnection, routePath, pointOnRoute, offsetRoute } from './connectionRouting';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
const W = 150;
const H = 76;

/** 親エディターのデータを描画するプレビュー。再生状態のみ内部管理し、削除は親へ通知する。 */
export default function FlowPreview({ actors, steps: allSteps, title, onClose, onDeleteStep, onExit }: {
 actors: Actor[]; steps: Step[]; title: string; onClose: () => void; onDeleteStep: (id: string) => void; onExit: () => void;
}) {
 const [index, setIndex] = useState(0);
 const [playing, setPlaying] = useState(false);
 const [progress, setProgress] = useState(0);
 const [speed, setSpeed] = useState(1);
 const [allLines, setAllLines] = useState(true);
 const [scale, setScale] = useState(1);
 const canvasRef = useRef<SVGSVGElement>(null);
 const [pan, setPan] = useState({ x: 0, y: 0 });
 const [drag, setDrag] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
 // プレビューでも通常再生と同じ選択経路だけを再生する。
 const [branchChoices, setBranchChoices] = useState<Record<string, string>>({});
 const steps = useMemo(() => playbackSteps(actors, allSteps, branchChoices), [actors, allSteps, branchChoices]);
 // 現状は1ステップ内の先頭actionのみを再生する。
 const step = steps[index];
 const action = step?.actions[0];
 const byId = useMemo(() => new Map(actors.map(actor => [actor.id, actor])), [actors]);
 const start = action ? byId.get(action.from) : undefined;
 const end = action ? byId.get(action.to) : undefined;
 const activeRoute = action ? offsetRoute(routeConnection(actors, action.from, action.to, step?.routing ?? 'straight'), -12) : [];
 const bounds = useMemo(() => {
  const xs = actors.map(actor => actor.position.x);
  const ys = actors.map(actor => actor.position.y);
  const minX = Math.min(0, ...xs) - W;
  const minY = Math.min(0, ...ys) - H;
  const maxX = Math.max(1100, ...xs) + W;
  const maxY = Math.max(650, ...ys) + H;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
 }, [actors]);
 // 同じ送受信ノード間の接続は重複描画しない。
 // Ctrl+ホイール時はSVG内のマウス位置を固定して拡縮する。
 useEffect(() => {
  const element = canvasRef.current;
  if (!element) return;
  const wheel = (event: WheelEvent) => {
   if (!event.ctrlKey) return;
   event.preventDefault();
   const rect = element.getBoundingClientRect();
   const cx = bounds.x + (event.clientX - rect.left) * bounds.w / rect.width;
   const cy = bounds.y + (event.clientY - rect.top) * bounds.h / rect.height;
   const next = Math.max(.3, Math.min(3, +(scale * Math.exp(-event.deltaY * .002)).toFixed(3)));
   if (next === scale) return;
   setPan(current => ({ x: cx - (cx - current.x) * next / scale, y: cy - (cy - current.y) * next / scale }));
   setScale(next);
  };
  element.addEventListener('wheel', wheel, { passive: false });
  return () => element.removeEventListener('wheel', wheel);
 }, [scale, bounds]);
 const edges = useMemo(() => {
  const found = new Map<string, { from: string; to: string; routing: 'straight' | 'orthogonal'; branchLabel?: string }>();
  steps.forEach(item => item.actions.forEach(a => found.set(a.from + '→' + a.to, { from: a.from, to: a.to, routing: item.routing ?? 'straight', branchLabel: item.branchLabel })));
  return [...found.values()];
 }, [steps]);

 // 再生中は編集側のデータを変更せず、通信パケットの進捗だけを更新する。
 useEffect(() => {
  if (!playing || !action) return;
  let frame = 0;
  let last = 0;
  const tick = (now: number) => {
   if (!last) last = now;
   const delta = Math.min(now - last, 100);
   last = now;
   setProgress(current => Math.min(1, current + delta * speed / Math.max(1, action.durationMs)));
   frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
 }, [playing, action, speed, index]);
 useEffect(() => {
  if (!playing || progress < 1) return;
  if (index >= steps.length - 1) { setPlaying(false); return; }
  setIndex(i => i + 1);
  setProgress(0);
 }, [progress, playing, index, steps.length]);
 // 手動選択時は再生を止め、通信パケットを始点へ戻す。
 const choose = (next: number) => { setIndex(next); setProgress(0); setPlaying(false); };
 const play = () => {
  if (index === steps.length - 1 && progress >= 1) { setIndex(0); setProgress(0); }
  setPlaying(value => !value);
 };
 const removeStep = (id: string) => {
  // 削除後に選択位置が範囲外にならないように補正する。
  setPlaying(false);
  setProgress(0);
  setIndex(current => Math.min(current, Math.max(0, steps.length - 2)));
  onDeleteStep(id);
 };
 const invalid = steps.filter(item => item.actions.some(a => !byId.has(a.from) || !byId.has(a.to)));
 return <div className="preview-screen">
  <div className="preview-header">
   <div><h2>プレビュー：{title}</h2><p>編集中のフローを保存せずに再生確認できます。</p></div>
   <div className="preview-header-actions"><button type="button" onClick={onClose}>編集画面に戻る</button><button type="button" onClick={onExit}>元のフロー画面へ戻る</button></div>
  </div>
  {branchGroups(actors, allSteps).length > 0 && <div className="branch-selector">
   <strong>再生する分岐を選択</strong>
   {branchGroups(actors, allSteps).map(group => <label key={group.actor.id}>{group.actor.name}
    <select value={branchChoices[group.actor.id] ?? group.options[0].id} onChange={event => {
     setBranchChoices(current => ({ ...current, [group.actor.id]: event.target.value }));
     setPlaying(false); setProgress(0); setIndex(0);
    }}>
     {group.options.map(option => <option key={option.id} value={option.id}>{option.branchLabel || option.title}</option>)}
    </select>
   </label>)}
  </div>}
  {invalid.length > 0 && <p role="alert">接続先が存在しない通信が {invalid.length} 件あります。編集画面で修正してください。</p>}
  <div className="preview-toolbar">
   <button disabled={!steps.length} onClick={() => choose(Math.max(0, index - 1))}>前へ</button>
   <button disabled={!steps.length} className="selected" onClick={play}>{playing ? '一時停止' : '▶ 再生'}</button>
   <button disabled={!steps.length} onClick={() => choose(Math.min(steps.length - 1, index + 1))}>次へ</button>
   <label>速度 <select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="0.5">0.5倍</option><option value="1">1倍</option><option value="1.5">1.5倍</option><option value="2">2倍</option></select></label>
   <label><input type="checkbox" checked={allLines} onChange={e => setAllLines(e.target.checked)}/> 全体の接続</label>
   <button onClick={() => setScale(v => Math.max(.3, v / 1.2))}>−</button><span>{Math.round(scale * 100)}%</span>
   <button onClick={() => setScale(v => Math.min(3, v * 1.2))}>＋</button>
   <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>表示リセット</button><span className="viewport-hint">Ctrl + ホイールで拡大・縮小</span>
  </div>
  <div className="preview-layout">
   <div>
    <svg ref={canvasRef} className="preview-canvas" viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
     onPointerDown={e => { if (e.button !== 0) return; setDrag({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }); e.currentTarget.setPointerCapture(e.pointerId); }}
     onPointerMove={e => { if (!drag) return; const rect = e.currentTarget.getBoundingClientRect(); setPan({ x: drag.px + (e.clientX - drag.x) * bounds.w / rect.width, y: drag.py + (e.clientY - drag.y) * bounds.h / rect.height }); }}
     onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
     <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
      {edges.map(edge => {
       const from = byId.get(edge.from);
       const to = byId.get(edge.to);
       if (!from || !to) return null;
       const active = edge.from === action?.from && edge.to === action?.to;
       if (!active && !allLines) return null;
       const route = routeConnection(actors, edge.from, edge.to, edge.routing);
       const midpoint = pointOnRoute(route, .5);
       return <g key={edge.from + edge.to}>
        <path d={routePath(offsetRoute(route, -12))} fill="none" stroke={active ? '#22d3ee' : '#71839d'} strokeWidth={active ? 4 : 1.5} opacity={active ? 1 : .3}/>
        <path d={routePath(offsetRoute([...route].reverse(), -12))} fill="none" stroke={active ? '#a78bfa' : '#71839d'} strokeWidth={active ? 4 : 1.5} opacity={active ? 1 : .3}/>
        {edge.branchLabel && <g pointerEvents="none">
         <rect x={midpoint.x - Math.max(32, edge.branchLabel.length * 7 / 2 + 8)} y={midpoint.y - 32} width={Math.max(64, edge.branchLabel.length * 7 + 16)} height="22" rx="5" fill="#102c48" stroke="#38bdf8"/>
         <text x={midpoint.x} y={midpoint.y - 17} textAnchor="middle" fill="#f0f9ff" fontSize="12">{edge.branchLabel}</text>
        </g>}
       </g>;
      })}
      {actors.map(actor => {
       const active = actor.id === action?.from || actor.id === action?.to;
       return <g key={actor.id} opacity={active || allLines || !action ? 1 : .35}>
        <rect x={actor.position.x - W / 2} y={actor.position.y - H / 2} width={W} height={H} rx="12"
         fill={active ? '#205a83' : '#20314a'} stroke={active ? '#22d3ee' : '#7398c9'} strokeWidth={active ? 3 : 1.5}/>
        <NodeIcon type={actor.type} x={actor.position.x} y={actor.position.y - 9} size={30} color="#f0f6ff"/>
        <text x={actor.position.x} y={actor.position.y + 19} fill="#f0f6ff" textAnchor="middle" fontSize="12">{actor.name.length > 13 ? actor.name.slice(0, 12) + '…' : actor.name}</text>
       </g>;
      })}
      {start && end && <circle cx={pointOnRoute(activeRoute, progress).x}
       cy={pointOnRoute(activeRoute, progress).y} r="10" fill="#22d3ee" stroke="#fff" strokeWidth="2"/>}
     </g>
    </svg>
    <div className="preview-step-info"><strong>{step ? `${index + 1} / ${steps.length}　${step.title}` : '通信ステップがありません'}</strong><p>{step?.description}</p><p>{action?.payload}</p></div>
   </div>
   <aside className="preview-steps"><h3>再生ステップ</h3>{steps.map((item, i) =>
    <div key={item.id} className="preview-step-row">
     <button className={i === index ? 'selected' : ''} onClick={() => choose(i)}>{i + 1}. {item.title}</button>
     <button type="button" className="preview-step-delete" aria-label={item.title + 'を削除'} onClick={() => removeStep(item.id)}>削除</button>
    </div>)}</aside>
  </div>
 </div>;
}
