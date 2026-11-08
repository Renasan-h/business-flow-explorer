import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { listScenarios, loadScenario, type Scenario } from './scenario';

type Mode = 'technical' | 'illustration';
type Theme = 'dark' | 'light';
type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;
const playbackSpeeds: PlaybackSpeed[] = [0.5, 1, 1.5, 2];
const palette = { technical: { bg: 0x0a1427, node: 0x17375a, border: 0x38bdf8, line: 0x2b648a, text: 0xe2f2ff }, illustration: { bg: 0xf0f5fc, node: 0xffffff, border: 0x5b83d7, line: 0x9ab6d7, text: 0x263d62 } };
function Scene({ scenario, step, mode, theme, playing, speed, focus, onFinished }: { scenario: Scenario; step: number; mode: Mode; theme: Theme; playing: boolean; speed: PlaybackSpeed; focus: boolean; onFinished: () => void }) {
 const host = useRef<HTMLDivElement>(null);
 const appRef = useRef<Application | null>(null);
 const layerRef = useRef<Container | null>(null);
 const packetRef = useRef<Graphics | null>(null);
 const routeRef = useRef<{ start: { x: number; y: number }; end: { x: number; y: number }; duration: number } | null>(null);
 const elapsedRef = useRef(0);
 const lastStepRef = useRef(step);
 const stateRef = useRef({ playing, speed, onFinished });
 const [ready, setReady] = useState(false);

 // Tickerは初回のみ登録するため、再生状態と完了処理をRefで同期する。
 stateRef.current = { playing, speed, onFinished };

 useEffect(() => {
  const hostElement = host.current;
  if (!hostElement) return;
  let cancelled = false;
  const app = new Application();
  void app.init({
   width: 1100, height: 620, background: palette.technical.bg,
   antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
  }).then(() => {
   if (cancelled) { app.destroy(true); return; }
   hostElement.appendChild(app.canvas);
   const layer = new Container();
   app.stage.addChild(layer);
   appRef.current = app;
   layerRef.current = layer;
   app.ticker.add(ticker => {
    const route = routeRef.current;
    const packet = packetRef.current;
    if (!route || !packet || !stateRef.current.playing) return;
    // 速度変更時も現在位置を維持し、次のフレームから倍率を反映する。
    elapsedRef.current = Math.min(elapsedRef.current + ticker.deltaMS * stateRef.current.speed, route.duration);
    const progress = elapsedRef.current / route.duration;
    const eased = progress * progress * (3 - 2 * progress);
    packet.position.set(
     route.start.x + (route.end.x - route.start.x) * eased,
     route.start.y + (route.end.y - route.start.y) * eased,
    );
    if (progress >= 1) {
     // 完了通知が連続して発火しないよう、次の描画更新まで停止する。
     routeRef.current = null;
     stateRef.current.onFinished();
    }
   });
   setReady(true);
  }).catch(error => console.error('PixiJS初期化エラー', error));
  return () => {
   cancelled = true;
   setReady(false);
   routeRef.current = null;
   packetRef.current = null;
   layerRef.current = null;
   appRef.current = null;
   if (app.renderer) app.destroy(true, { children: true });
  };
 }, []);

 useEffect(() => {
  const app = appRef.current;
  const layer = layerRef.current;
  if (!ready || !app || !layer) return;

  // ステップが変わったときだけ再生位置を初期化し、表示モード変更では維持する。
  if (lastStepRef.current !== step) {
   elapsedRef.current = 0;
   lastStepRef.current = step;
  }
  // 表示モードと配色テーマを独立させ、どちらの組み合わせでも視認性を保つ。
  const colors = theme === 'dark' ? palette.technical : palette.illustration;
  app.renderer.background.color = colors.bg;
  layer.removeChildren().forEach(child => child.destroy({ children: true }));
  // 既存シナリオの座標を維持しながら描画領域を広げ、Actor間隔を確保する。
  const actors = scenario.actors.map(actor => ({
   ...actor,
   position: { x: 90 + (actor.position.x - 90) * 1.65, y: 90 + (actor.position.y - 90) * 1.7 },
  }));
  const byId = new Map(actors.map(actor => [actor.id, actor]));
  const action = scenario.steps[step].actions[0];
  const start = byId.get(action.from);
  const end = byId.get(action.to);
  if (!start || !end) return;

  const label = (value: string, x: number, y: number, size = 14) => {
   const text = new Text({ text: value, style: new TextStyle({
    fontFamily: 'sans-serif', fontSize: size, fill: colors.text, align: 'center',
   }) });
   text.anchor.set(0.5);
   text.position.set(x, y);
   layer.addChild(text);
  };

  // 送信と受信の経路を平行に配置し、矢印で通信方向を明示する。
  const drawLane = (from: { x: number; y: number }, to: { x: number; y: number }, offset: number, color: number, alpha: number) => {
   const dx = to.x - from.x;
   const dy = to.y - from.y;
   const length = Math.hypot(dx, dy) || 1;
   const nx = -dy / length;
   const ny = dx / length;
   // ノードの矩形境界からさらに玉の半径分を空け、線上だけを移動させる。
   const radius = 12;
   const halfWidth = 55 + radius;
   const halfHeight = 39 + radius;
   const trim = Math.min(
    length / 2,
    Math.min(
     Math.abs(dx) > 0.0001 ? halfWidth / Math.abs(dx / length) : Infinity,
     Math.abs(dy) > 0.0001 ? halfHeight / Math.abs(dy / length) : Infinity,
    ),
   );
   const sx = from.x + nx * offset + (dx / length) * trim;
   const sy = from.y + ny * offset + (dy / length) * trim;
   const ex = to.x + nx * offset - (dx / length) * trim;
   const ey = to.y + ny * offset - (dy / length) * trim;
   const line = new Graphics()
    .moveTo(sx, sy).lineTo(ex, ey)
    .stroke({ color, width: 3, alpha });
   const ux = dx / length;
   const uy = dy / length;
   const arrowX = sx + (ex - sx) * 0.65;
   const arrowY = sy + (ey - sy) * 0.65;
   line.moveTo(arrowX - ux * 9 - uy * 6, arrowY - uy * 9 + ux * 6)
    .lineTo(arrowX, arrowY)
    .lineTo(arrowX - ux * 9 + uy * 6, arrowY - uy * 9 - ux * 6)
    .stroke({ color, width: 3, alpha });
   layer.addChild(line);
   return { start: { x: sx, y: sy }, end: { x: ex, y: ey } };
  };
  const sendColor = theme === 'dark' ? 0x22d3ee : 0x2563eb;
  const receiveColor = theme === 'dark' ? 0xa78bfa : 0xf59e0b;
  const inactiveColor = theme === 'dark' ? 0x64748b : 0x9ca3af;

  // シナリオ全体から通信経路を収集し、未使用中の経路もグレーで表示する。
  const connections = new Map<string, [string, string]>();
  for (const scenarioStep of scenario.steps) {
   for (const transfer of scenarioStep.actions) {
    const pair = [transfer.from, transfer.to].sort() as [string, string];
    connections.set(pair.join(':'), pair);
   }
  }
  let sendRoute = { start: start.position, end: end.position };
  for (const [firstId, secondId] of connections.values()) {
   const first = byId.get(firstId);
   const second = byId.get(secondId);
   if (!first || !second) continue;
   const active = (firstId === action.from && secondId === action.to)
    || (firstId === action.to && secondId === action.from);
   // 現在の接続は送受信をカラー表示し、それ以外は両方向ともグレーにする。
   if (active) {
    sendRoute = drawLane(start.position, end.position, -13, sendColor, 0.95);
    drawLane(end.position, start.position, -13, receiveColor, 0.85);
   } else if (!focus) {
    // 全体表示時のみ、現在の通信に無関係な経路を控えめに描画する。
    drawLane(first.position, second.position, -13, inactiveColor, 0.24);
    drawLane(second.position, first.position, -13, inactiveColor, 0.24);
   }
  }

  for (const actor of actors) {
   const active = actor.id === action.from || actor.id === action.to;
   const g = new Graphics()
    .roundRect(actor.position.x - 55, actor.position.y - 39, 110, 78, mode === 'illustration' ? 20 : 12)
    .fill(active ? (theme === 'dark' ? 0x205a83 : 0xdbeafe) : colors.node)
    .stroke({ color: colors.border, width: active ? 3 : 1.5 });
   if (focus && !active) g.alpha = 0.38;
   layer.addChild(g);
   const symbol: Record<string, string> = mode === 'technical'
    ? { person: '◎', server: '▤', database: '◉', service: '◇' }
    : { person: '👤', server: '🖥', database: '🗄', service: '💳' };
   label(symbol[actor.type], actor.position.x, actor.position.y - 9, 28);
   label(actor.name, actor.position.x, actor.position.y + 21, 12);
   // 指定されたインスタンス名とIPアドレスをノード上部に表示する。
   const details = [actor.instanceName, actor.ip].filter(Boolean);
   if (details.length > 0) {
    label(details.join('  /  '), actor.position.x, actor.position.y - 58, 11);
   }
  }
  const packet = new Graphics().circle(0, 0, 10).fill(sendColor).stroke({ color: 0xffffff, width: 2 });
  layer.addChild(packet);
  packetRef.current = packet;
  const from = sendRoute.start;
  const to = sendRoute.end;
  routeRef.current = { start: from, end: to, duration: action.durationMs };
  const progress = Math.min(elapsedRef.current / action.durationMs, 1);
  const eased = progress * progress * (3 - 2 * progress);
  packet.position.set(from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased);
  label(action.payload, 550, 585);
 }, [scenario, step, mode, theme, focus, ready]);

 return <div className="scene" ref={host} aria-label="グラフィックシミュレーション" />;
}
export default function App() {
 const [paths, setPaths] = useState<string[]>([]);
 const [scenarioTitles, setScenarioTitles] = useState<Record<string, string>>({});
 const [selected, setSelected] = useState('');
 const [scenario, setScenario] = useState<Scenario | null>(null);
 const [error, setError] = useState('');
 const [mode, setMode] = useState<Mode>('technical');
 const [focus, setFocus] = useState(true);
 // 保存済みの選択を優先し、初回はOSの配色設定を使用する。
 const [theme, setTheme] = useState<Theme>(() => {
  try {
   const saved = localStorage.getItem('business-flow-theme');
   if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* ストレージを利用できない環境ではOS設定を優先する。 */ }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
 });
 useEffect(() => {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('business-flow-theme', theme); }
  catch { /* 保存できない場合も現在の画面では切り替えを維持する。 */ }
 }, [theme]);
 const [step, setStep] = useState(0);
 const [playing, setPlaying] = useState(false);
 const [speed, setSpeed] = useState<PlaybackSpeed>(1);
 // シナリオ一覧の表示名はファイル名ではなく、各YAMLの必須項目metadata.titleから取得する。
 useEffect(() => {
  let cancelled = false;
  listScenarios()
   .then(async paths => {
    const scenarios = await Promise.all(paths.map(path => loadScenario(path)));
    if (cancelled) return;
    setPaths(paths);
    setScenarioTitles(Object.fromEntries(paths.map((path, index) => [path, scenarios[index].metadata.title])));
    setSelected(paths[0] || '');
   })
   .catch(error => { if (!cancelled) setError(String(error)); });
  return () => { cancelled = true; };
 }, []);
 useEffect(() => { if (!selected) return; setPlaying(false); setFinished(false); setStep(0); loadScenario(selected).then(s => { setScenario(s); setError(''); }).catch(e => setError(String(e))); }, [selected]);
 // 最終ステップの完了時は停止し、再生ボタンを押すまで先頭へ戻さない。
 const [finished, setFinished] = useState(false);
 const advance = () => {
  if (!scenario) return;
  setStep(currentStep => {
   if (currentStep >= scenario.steps.length - 1) {
    setPlaying(false);
    setFinished(true);
    return currentStep;
   }
   return currentStep + 1;
  });
 };
 // 終了後の再生は先頭から開始し、通常の一時停止からは現在位置で再開する。
 const togglePlayback = () => {
  if (playing) { setPlaying(false); return; }
  if (finished) {
   setFinished(false);
   setStep(0);
  }
  setPlaying(true);
 };
 const current = scenario?.steps[step];
 return <div className="app">
  <header><strong>◈ Business Flow Explorer</strong><div className="header-actions"><span>Scenario-driven visualization</span><div className="theme-switch" role="group" aria-label="配色テーマ"><button type="button" className={theme === 'light' ? 'selected' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>☀ ライト</button><button type="button" className={theme === 'dark' ? 'selected' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>☾ ダーク</button></div></div></header>
  <div className="layout">
   <aside><h3>シナリオ</h3>{paths.map(p => <button className={p === selected ? 'selected' : ''} key={p} onClick={() => setSelected(p)}>{scenarioTitles[p]}</button>)}<p className="hint">public/scenarios にYAMLを追加し、index.jsonへ登録してください。</p></aside>
   <main>
    <div className="top"><div><h1>{scenario?.metadata.title || '読み込み中...'}</h1><p>{scenario?.metadata.description}</p></div><div className="switch"><button className={mode === 'technical' ? 'selected' : ''} onClick={() => setMode('technical')}>Technical</button><button className={mode === 'illustration' ? 'selected' : ''} onClick={() => setMode('illustration')}>Illustration</button></div></div>
    {error && <p className="error">{error}</p>}
    {scenario && current && <><div className="scene-toolbar"><span>通信経路の表示</span><div className="switch"><button type="button" className={focus ? 'selected' : ''} aria-pressed={focus} onClick={() => setFocus(true)}>現在の通信</button><button type="button" className={!focus ? 'selected' : ''} aria-pressed={!focus} onClick={() => setFocus(false)}>全体の接続</button></div></div><Scene scenario={scenario} step={step} mode={mode} theme={theme} playing={playing} speed={speed} focus={focus} onFinished={advance}/><div className="controls"><button onClick={() => { setPlaying(false); setFinished(false); setStep(0); }}>↺</button><button disabled={step === 0} onClick={() => { setPlaying(false); setFinished(false); setStep(i => i - 1); }}>◀ 前へ</button><button onClick={togglePlayback}>{playing ? '⏸ 一時停止' : finished ? '↺ 最初から再生' : '▶ 再生'}</button><button disabled={step === scenario.steps.length - 1} onClick={() => { setPlaying(false); setFinished(false); setStep(i => i + 1); }}>次へ ▶</button><div className="playback-speed" role="group" aria-label="再生速度"><span className="playback-speed-label">再生速度</span><div className="speed-options">{playbackSpeeds.map(value => <button type="button" key={value} className={speed === value ? "selected" : ""} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}x</button>)}</div></div><span>STEP {step + 1} / {scenario.steps.length}</span></div><div className="steps">{scenario.steps.map((s, i) => <button key={s.id} className={i === step ? 'selected' : ''} onClick={() => { setPlaying(false); setFinished(false); setStep(i); }}>{i + 1}. {s.title}</button>)}</div><section className="explanation"><h2>{current.title}</h2><p>{current.description}</p><code>{current.actions[0].payload}</code></section></>}
   </main>
  </div>
 </div>;
}
