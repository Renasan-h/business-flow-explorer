import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { listScenarios, loadScenario, type Scenario } from './scenario';

type Mode = 'technical' | 'illustration';
const palette = { technical: { bg: 0x0a1427, node: 0x17375a, border: 0x38bdf8, line: 0x2b648a, text: 0xe2f2ff }, illustration: { bg: 0xf0f5fc, node: 0xffffff, border: 0x5b83d7, line: 0x9ab6d7, text: 0x263d62 } };
function Scene({ scenario, step, mode, playing, onFinished }: { scenario: Scenario; step: number; mode: Mode; playing: boolean; onFinished: () => void }) {
 const host = useRef<HTMLDivElement>(null);
 const done = useRef(onFinished);
 const playingRef = useRef(playing);
 // Keep PixiJS ticker callbacks in sync with the latest React playback state.
 playingRef.current = playing;
 useEffect(() => { done.current = onFinished; }, [onFinished]);
 useEffect(() => {
  const el = host.current;
  if (!el) return;
  let disposed = false;
  let app: Application | undefined;
  (async () => {
   const instance = new Application();
   await instance.init({ width: 720, height: 390, background: palette[mode].bg, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
   if (disposed) { instance.destroy(true); return; }
   app = instance;
   el.appendChild(instance.canvas);
   const colors = palette[mode];
   const layer = new Container();
   instance.stage.addChild(layer);
   const byId = new Map(scenario.actors.map(a => [a.id, a]));
   const current = scenario.steps[step];
   const action = current.actions[0];
   const start = byId.get(action.from)!;
   const end = byId.get(action.to)!;
   const label = (text: string, x: number, y: number, size = 15) => {
    const t = new Text({ text, style: new TextStyle({ fontFamily: 'sans-serif', fontSize: size, fill: colors.text, align: 'center' }) });
    t.anchor.set(0.5); t.position.set(x, y); layer.addChild(t);
   };
   const draw = (g: Graphics, x: number, y: number, active: boolean) => {
    g.roundRect(x - 55, y - 39, 110, 78, mode === 'illustration' ? 20 : 12)
     .fill(active ? (mode === 'technical' ? 0x205a83 : 0xdbeafe) : colors.node)
     .stroke({ width: active ? 3 : 1.5, color: colors.border });
   };
   for (const a of scenario.actors) {
    for (const b of scenario.actors) {
     if (a.id >= b.id) continue;
     const line = new Graphics().moveTo(a.position.x, a.position.y).lineTo(b.position.x, b.position.y).stroke({ color: colors.line, width: 1, alpha: 0.25 });
     layer.addChild(line);
    }
   }
   for (const a of scenario.actors) {
    const g = new Graphics();
    draw(g, a.position.x, a.position.y, a.id === action.from || a.id === action.to);
    layer.addChild(g);
    const symbols: Record<string, string> = mode === 'technical'
      ? { person: '◎', server: '▤', database: '◉', service: '◇' }
      : { person: '👤', server: '🖥', database: '🗄', service: '💳' };
    label(symbols[a.type], a.position.x, a.position.y - 9, 29);
    label(a.name, a.position.x, a.position.y + 21, 12);
   }
   const route = new Graphics().moveTo(start.position.x, start.position.y).lineTo(end.position.x, end.position.y).stroke({ color: mode === 'technical' ? 0x22d3ee : 0x4378e0, width: 4, alpha: 0.8 });
   layer.addChildAt(route, 0);
   const packet = new Graphics().circle(0, 0, mode === 'technical' ? 10 : 13).fill(mode === 'technical' ? 0x22d3ee : 0xf59e0b).stroke({ color: 0xffffff, width: 2 });
   layer.addChild(packet);
   label(action.payload, 360, 360, 14);
   let elapsed = 0;
   let completed = false;
   instance.ticker.add(ticker => {
    if (!playingRef.current || completed) return;
    elapsed += ticker.deltaMS;
    const progress = Math.min(elapsed / action.durationMs, 1);
    const eased = progress * progress * (3 - 2 * progress);
    packet.position.set(start.position.x + (end.position.x - start.position.x) * eased, start.position.y + (end.position.y - start.position.y) * eased);
    if (progress >= 1) { completed = true; done.current(); }
   });
   packet.position.set(start.position.x, start.position.y);
  })().catch(error => { if (!disposed) console.error(error); });
  return () => { disposed = true; if (app) { app.destroy(true, { children: true }); el.replaceChildren(); } };
 }, [scenario, step, mode]);
 return <div className="scene" ref={host} aria-label="グラフィックシミュレーション" />;
}
export default function App() {
 const [paths, setPaths] = useState<string[]>([]);
 const [selected, setSelected] = useState('');
 const [scenario, setScenario] = useState<Scenario | null>(null);
 const [error, setError] = useState('');
 const [mode, setMode] = useState<Mode>('technical');
 const [step, setStep] = useState(0);
 const [playing, setPlaying] = useState(false);
 useEffect(() => { listScenarios().then(p => { setPaths(p); setSelected(p[0] || ''); }).catch(e => setError(String(e))); }, []);
 useEffect(() => { if (!selected) return; setPlaying(false); setStep(0); loadScenario(selected).then(s => { setScenario(s); setError(''); }).catch(e => setError(String(e))); }, [selected]);
 // Continue to the next step automatically; stop only after the final step.
 const advance = () => {
  if (!scenario) return;
  if (step >= scenario.steps.length - 1) { setPlaying(false); return; }
  setStep(step + 1);
 };
 const current = scenario?.steps[step];
 return <div className="app">
  <header><strong>◈ Business Flow Explorer</strong><span>Scenario-driven visualization</span></header>
  <div className="layout">
   <aside><h3>シナリオ</h3>{paths.map(p => <button className={p === selected ? 'selected' : ''} key={p} onClick={() => setSelected(p)}>{p.split('/').pop()?.replace('.yaml','')}</button>)}<p className="hint">public/scenarios にYAMLを追加し、index.jsonへ登録してください。</p></aside>
   <main>
    <div className="top"><div><h1>{scenario?.metadata.title || '読み込み中...'}</h1><p>{scenario?.metadata.description}</p></div><div className="switch"><button className={mode === 'technical' ? 'selected' : ''} onClick={() => setMode('technical')}>Technical</button><button className={mode === 'illustration' ? 'selected' : ''} onClick={() => setMode('illustration')}>Illustration</button></div></div>
    {error && <p className="error">{error}</p>}
    {scenario && current && <><Scene scenario={scenario} step={step} mode={mode} playing={playing} onFinished={advance}/><div className="controls"><button onClick={() => { setPlaying(false); setStep(0); }}>↺</button><button disabled={step === 0} onClick={() => { setPlaying(false); setStep(i => i - 1); }}>◀ 前へ</button><button onClick={() => setPlaying(p => !p)}>{playing ? '⏸ 一時停止' : '▶ 再生'}</button><button disabled={step === scenario.steps.length - 1} onClick={() => { setPlaying(false); setStep(i => i + 1); }}>次へ ▶</button><span>STEP {step + 1} / {scenario.steps.length}</span></div><div className="steps">{scenario.steps.map((s, i) => <button key={s.id} className={i === step ? 'selected' : ''} onClick={() => { setPlaying(false); setStep(i); }}>{i + 1}. {s.title}</button>)}</div><section className="explanation"><h2>{current.title}</h2><p>{current.description}</p><code>{current.actions[0].payload}</code></section></>}
   </main>
  </div>
 </div>;
}
