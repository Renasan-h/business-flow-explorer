import { branchGroups, playbackActors, playbackSteps } from './branchPlayback';
import { useEffect, useState } from 'react';
import FlowEditor from './FlowEditor';
import { listScenarios, loadScenario, playbackValidationError, type Scenario } from './scenario';

import Scene from './playback/PlaybackScene';
import CategoryTree, { buildCategoryTree } from './playback/CategoryTree';
import type { Mode, Theme, PlaybackSpeed } from './playback/types';

// 再生画面の論理サイズとノード寸法。PixiJS描画側と一致させる。
const VIEW_WIDTH = 1100;
const VIEW_HEIGHT = 620;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 90;
const clampZoom = (value: number) => Math.max(0.35, Math.min(2.5, Math.round(value * 100) / 100));
const playbackSpeeds: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

export default function App() {
 // none:通常再生、edit:既存編集、new:新規作成。編集内容は保存まで通常画面へ反映されない。
 const [editorMode, setEditorMode] = useState<'none' | 'edit' | 'new'>('none');
 const [paths, setPaths] = useState<string[]>([]);
 // 狭い描画領域ではシナリオ一覧を左側のオーバーレイとして開く。
 const [scenarioMenuOpen, setScenarioMenuOpen] = useState(false);
 const [scenarioTitles, setScenarioTitles] = useState<Record<string, string>>({});
 const [scenarioCategories, setScenarioCategories] = useState<Record<string, string>>({});
 const [selected, setSelected] = useState('');
 const [scenario, setScenario] = useState<Scenario | null>(null);
 const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
 const [selectedInterfaceId, setSelectedInterfaceId] = useState<string | null>(null);
 // 再生開始前に決定する分岐の選択。変更時は再生位置を先頭へ戻す。
 const [branchChoices, setBranchChoices] = useState<Record<string, string>>({});
 const [error, setError] = useState('');
 const [mode, setMode] = useState<Mode>('technical');
 // 初期状態は全通信線を表示する。
 const [focus, setFocus] = useState(false);
 // ノード数に合わせて表示キャンバスの横幅を縮小できる（ズーム倍率とは独立）。
 const [zoom, setZoom] = useState(1);
 const [pan, setPan] = useState({x:0,y:0});
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
 // 配列の順番が再生順。内部のステップ番号は0始まり。
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
    setScenarioCategories(Object.fromEntries(paths.map((path, index) => [path, scenarios[index].metadata.category || '未分類'])));
    setSelected(paths[0] || '');
   })
   .catch(error => { if (!cancelled) setError(String(error)); });
  return () => { cancelled = true; };
 }, []);
 useEffect(() => { if (!selected) return; setSelectedActorId(null); setSelectedInterfaceId(null); setPlaying(false); setFinished(false); setStep(0); setBranchChoices({}); loadScenario(selected).then(s => { setScenario(s); setError(''); }).catch(e => setError(String(e))); }, [selected]);
 // 最終ステップの完了時は停止し、再生ボタンを押すまで先頭へ戻さない。
 const [finished, setFinished] = useState(false);
 const routes = scenario ? playbackSteps(scenario.actors, scenario.steps, branchChoices) : [];
 // PixiJSへ渡すノードも選択経路に限定し、非選択側の描画を行わない。
 const visibleScenario = scenario ? {
  ...scenario,
  actors: playbackActors(scenario.actors, scenario.steps, branchChoices),
  steps: routes,
 } : null;
 const advance = () => {
  if (!scenario) return;
  setStep(currentStep => {
   if (currentStep >= routes.length - 1) {
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
  if (scenario) {
   const playbackError = playbackValidationError({ actors: scenario.actors, steps: routes });
   if (playbackError) { setError(playbackError); setPlaying(false); return; }
  }
  setError('');
  if (finished) {
   setFinished(false);
   setStep(0);
  }
  setPlaying(true);
 };
 // 等倍表示では座標原点ではなくノード群の中心を画面中央へ合わせる。
 // リサイズ後もPixiJSの論理座標(VIEW_WIDTH/HEIGHT)を基準にする。
 const resetViewport = () => {
  if (!scenario || scenario.actors.length === 0) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
  const xs = scenario.actors.map(actor => actor.position.x);
  const ys = scenario.actors.map(actor => actor.position.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  setZoom(1);
  setPan({ x: VIEW_WIDTH / 2 - centerX, y: VIEW_HEIGHT / 2 - centerY });
 };
 // シナリオ切替時には、全Actorが画面に収まる初期表示へ戻す。
 useEffect(() => {
  if (!scenario) return;
  const xs = scenario.actors.map(actor => actor.position.x);
  const ys = scenario.actors.map(actor => actor.position.y);
  const minX = Math.min(...xs) - NODE_WIDTH / 2 - 40;
  const maxX = Math.max(...xs) + NODE_WIDTH / 2 + 40;
  const minY = Math.min(...ys) - NODE_HEIGHT / 2 - 40;
  const maxY = Math.max(...ys) + NODE_HEIGHT / 2 + 40;
  const fit = clampZoom(Math.min(1, VIEW_WIDTH / (maxX - minX), VIEW_HEIGHT / (maxY - minY)));
  setZoom(fit);
  setPan({x: (VIEW_WIDTH - (minX + maxX) * fit) / 2, y: (VIEW_HEIGHT - (minY + maxY) * fit) / 2});
 }, [scenario]);
 const current = routes[step];
 // 新規作成は既存シナリオに依存しない空の編集データから開始する。
 if (editorMode === 'new') {
  const blank: Scenario = {
   schemaVersion: '1.0',
   metadata: { id: 'new-flow', title: '新規業務フロー', description: '', category: 'custom' },
   actors: [],
   steps: [],
  };
  return <FlowEditor key="new-flow" initial={blank} onClose={() => setEditorMode('none')} />;
 }
 if (editorMode === 'edit' && scenario) return <FlowEditor key={selected} initial={scenario} scenarioPath={selected} onClose={() => setEditorMode('none')} />;
 return <div className="app">
  <header><strong>◈ Business Flow Explorer</strong><div className="header-actions"><span>Scenario-driven visualization</span><div className="theme-switch" role="group" aria-label="配色テーマ"><button type="button" className={theme === 'light' ? 'selected' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>☀ ライト</button><button type="button" className={theme === 'dark' ? 'selected' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>☾ ダーク</button></div></div></header>
  <div className="layout">
   {scenarioMenuOpen && <button type="button" className="scenario-menu-backdrop" aria-label="シナリオ一覧を閉じる" onClick={() => setScenarioMenuOpen(false)}/>}
   <aside id="scenario-navigation" className={`scenario-sidebar${scenarioMenuOpen ? ' is-open' : ''}`} aria-label="シナリオ一覧">
    <div className="scenario-sidebar-heading"><h3>シナリオ</h3><button type="button" className="scenario-menu-close" aria-label="シナリオ一覧を閉じる" onClick={() => setScenarioMenuOpen(false)}>✕</button></div>
    <button type="button" className="new-flow-button" onClick={() => { setScenarioMenuOpen(false); setPlaying(false); setEditorMode('new'); }}>＋ 新規フロー作成</button>
    <CategoryTree node={buildCategoryTree(paths, scenarioCategories)} selected={selected} onSelect={path => { setSelected(path); setScenarioMenuOpen(false); }} titles={scenarioTitles}/>
    <p className="hint">public/scenarios のindex.jsonで対象ディレクトリを指定してください。</p>
   </aside>
   <main>
    <button type="button" className="scenario-menu-toggle" aria-label="シナリオ一覧を開く" aria-controls="scenario-navigation" aria-expanded={scenarioMenuOpen} onClick={() => setScenarioMenuOpen(true)}>☰ <span>シナリオ一覧</span></button>
    <div className="top"><div><h1>{scenario?.metadata.title || '読み込み中...'}</h1><p>{scenario?.metadata.description}</p></div><div className="switch">{scenario && <button type="button" onClick={() => { setPlaying(false); setEditorMode('edit'); }}>✎ フローを編集</button>}<button className={mode === 'technical' ? 'selected' : ''} onClick={() => setMode('technical')}>Technical</button><button className={mode === 'illustration' ? 'selected' : ''} onClick={() => setMode('illustration')}>Illustration</button></div></div>
    {error && <p className="error">{error}</p>}
    {scenario && visibleScenario && current && <><div className="scene-toolbar"><span>通信経路の表示</span><div className="switch"><button type="button" className={focus ? 'selected' : ''} aria-pressed={focus} onClick={() => setFocus(true)}>現在の通信</button><button type="button" className={!focus ? 'selected' : ''} aria-pressed={!focus} onClick={() => setFocus(false)}>全体の接続</button></div></div>{branchGroups(scenario.actors, scenario.steps).length > 0 && <div className="branch-selector">
      <strong>再生する分岐を選択</strong>
      {branchGroups(scenario.actors, scenario.steps).map(group => <label key={group.actor.id}>{group.actor.name}
       <select value={branchChoices[group.actor.id] ?? group.options[0].id} onChange={event => {
        setBranchChoices(current => ({ ...current, [group.actor.id]: event.target.value }));
        setPlaying(false); setFinished(false); setStep(0);
       }}>
        {group.options.map(option => <option key={option.id} value={option.id}>{option.branchLabel || option.title}</option>)}
       </select>
      </label>)}
     </div>}<div className="scene-action-bar"><div className="viewport-controls" role="group" aria-label="表示倍率と移動"><button type="button" onClick={() => setZoom(v => clampZoom(v / 1.2))} aria-label="縮小">−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom(v => clampZoom(v * 1.2))} aria-label="拡大">＋</button><button type="button" onClick={resetViewport}>等倍</button><span className="viewport-hint">ドラッグで移動 / Ctrl + ホイールで拡大・縮小</span></div><div className="controls"><button onClick={() => { setPlaying(false); setFinished(false); setStep(0); }}>↺</button><button disabled={step === 0} onClick={() => { setPlaying(false); setFinished(false); setStep(i => i - 1); }}>◀ 前へ</button><button onClick={togglePlayback}>{playing ? '⏸ 一時停止' : finished ? '↺ 最初から再生' : '▶ 再生'}</button><button disabled={step === routes.length - 1} onClick={() => { setPlaying(false); setFinished(false); setStep(i => i + 1); }}>次へ ▶</button><div className="playback-speed" role="group" aria-label="再生速度"><span className="playback-speed-label">再生速度</span><div className="speed-options">{playbackSpeeds.map(value => <button type="button" key={value} className={speed === value ? "selected" : ""} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}x</button>)}</div></div><span>STEP {step + 1} / {routes.length}</span></div></div><div className="scene-size-wrapper" aria-label="右下をドラッグして表示領域の幅と高さを変更できます"><Scene scenario={visibleScenario} step={step} mode={mode} theme={theme} playing={playing} speed={speed} focus={focus} zoom={zoom} pan={pan} onPan={setPan} onZoom={setZoom} onFinished={advance} onSelectActor={setSelectedActorId}/></div>{selectedActorId && scenario.actors.some(actor => actor.id === selectedActorId) && (() => {
       const actor = scenario.actors.find(item => item.id === selectedActorId)!;
       const fields: [string, string | undefined][] = [['種類', actor.type], ['説明', actor.description], ['環境', actor.environment], ['接続先・URL', actor.endpoint], ['インスタンス名', actor.instanceName], ['IPアドレス', actor.ip], ['タグ', actor.tags?.join(', ')], ['関連資料', actor.documents?.join(', ')]];
       return <div className="node-details-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedActorId(null); }}><aside className="node-details-panel" role="dialog" aria-modal="true" aria-label={`${actor.name}の詳細`}>
        <div className="node-details-heading"><h2>{actor.name}</h2><button type="button" onClick={() => setSelectedActorId(null)} aria-label="閉じる">✕</button></div>
        <p><strong>Actor ID</strong>：{actor.id}</p>
        {actor.color && <p><strong>ノード色</strong>：<span className="node-details-swatch" style={{backgroundColor: actor.color}}/> {actor.color}</p>}
        {fields.filter(([,value]) => Boolean(value)).map(([label,value]) => <p key={label}><strong>{label}</strong>：{value}</p>)}
       </aside></div>;
      })()}
      {selectedInterfaceId && <div className="node-details-backdrop if-definition-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedInterfaceId(null); }}><aside className="node-details-panel if-definition-drawer" role="dialog" aria-modal="true" aria-label="IF仕様"><div className="node-details-heading"><h2>IF仕様</h2><button onClick={() => setSelectedInterfaceId(null)}>✕</button></div>{scenario.interfaces?.filter(item => item.id === selectedInterfaceId).map(item => <section key={item.id}><h3>{item.name}</h3><p>{item.description}</p><p>ID: {item.id}</p>{item.fields?.map((field, index) => <p key={index}><strong>{field.name}</strong>（{field.type}）{field.required ? '・必須' : ''} {field.description}</p>)}</section>)}{!scenario.interfaces?.some(item => item.id === selectedInterfaceId) && <p>IF定義がありません: {selectedInterfaceId}</p>}</aside></div>}
       <div className="steps">{routes.map((s, i) => <button key={s.id} className={i === step ? 'selected' : ''} onClick={() => { setPlaying(false); setFinished(false); setStep(i); }}>{i + 1}. {s.title}</button>)}</div><section className="explanation"><h2>{current.title}</h2><p>{current.description}</p><code>{current.actions[0].payload}</code><div className="if-playback-links">{current.forwardIf && <button type="button" className="if-definition-link" onClick={() => setSelectedInterfaceId(current.forwardIf!)}>往路IF: {scenario.interfaces?.find(item => item.id === current.forwardIf)?.name ?? current.forwardIf}</button>}{current.reverseIf && <button type="button" className="if-definition-link" onClick={() => setSelectedInterfaceId(current.reverseIf!)}>復路IF: {scenario.interfaces?.find(item => item.id === current.reverseIf)?.name ?? current.reverseIf}</button>}{current.reversePayload && <p>復路通信内容: {current.reversePayload}</p>}</div></section></>}
   </main>
  </div>
 </div>;
}
