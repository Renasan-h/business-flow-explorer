import { branchGroups, playbackActors, playbackSteps } from './branchPlayback';
import { useEffect, useState } from 'react';
import FlowEditor from './FlowEditor';
import { listScenarios, loadScenario, playbackValidationError, type Scenario } from './scenario';

import Scene from './playback/PlaybackScene';
import InterfaceDefinitionDrawer from './playback/InterfaceDefinitionDrawer';
import ScenarioSidebar from './playback/ScenarioSidebar';
import AppHeader from './playback/AppHeader';
import PlaybackControls from './playback/PlaybackControls';
import ActorDetailsDrawer from './playback/ActorDetailsDrawer';
import type { Mode, Theme, PlaybackSpeed } from './playback/types';

// 再生画面の論理サイズとノード寸法。PixiJS描画側と一致させる。
const VIEW_WIDTH = 1100;
const VIEW_HEIGHT = 620;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 90;
const clampZoom = (value: number) => Math.max(0.35, Math.min(2.5, Math.round(value * 100) / 100));

export default function App() {
 // none:通常再生、edit:既存編集、new:新規作成。編集内容は保存まで通常画面へ反映されない。
 const [editorMode, setEditorMode] = useState<'none' | 'edit' | 'new'>('none');
 const [paths, setPaths] = useState<string[]>([]);
 const [scenarioReload, setScenarioReload] = useState(0);
 const [scenarioRoots, setScenarioRoots] = useState<{ id: string; label: string }[]>([]);
 const [activeRoot, setActiveRoot] = useState('0');
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
  Promise.all([fetch('/scenario-roots.json').then(response => { if (!response.ok) throw new Error('ベースディレクトリの取得に失敗しました'); return response.json() as Promise<{ id: string; label: string }[]>; }), listScenarios(activeRoot)])
   .then(async ([roots, paths]) => {
    setScenarioRoots(roots);
    const scenarios = await Promise.all(paths.map(path => loadScenario(path)));
    if (cancelled) return;
    setPaths(paths);
    setScenarioTitles(Object.fromEntries(paths.map((path, index) => [path, scenarios[index].metadata.title])));
    setScenarioCategories(Object.fromEntries(paths.map((path, index) => [path, scenarios[index].metadata.category || '未分類'])));
    setSelected(current => paths.includes(current) ? current : paths[0] || '');
   })
   .catch(error => { if (!cancelled) setError(String(error)); });
  return () => { cancelled = true; };
 }, [scenarioReload, activeRoot]);
 useEffect(() => { if (!selected) return; setSelectedActorId(null); setSelectedInterfaceId(null); setPlaying(false); setFinished(false); setStep(0); setBranchChoices({}); loadScenario(selected).then(s => { setScenario(s); setError(''); }).catch(e => setError(String(e))); }, [selected, scenarioReload]);
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
  return <FlowEditor key={"new-flow-" + activeRoot} initial={blank} scenarioPath={"/scenarios/" + activeRoot + "/new-flow.yaml"} onClose={() => setEditorMode('none')} />;
 }
 if (editorMode === 'edit' && scenario) return <FlowEditor key={selected} initial={scenario} scenarioPath={selected} onClose={() => setEditorMode('none')} />;
 return <div className="app">
  <AppHeader roots={scenarioRoots} activeRoot={activeRoot} onRootChange={value => { setActiveRoot(value); setScenario(null); setPaths([]); setSelected(''); setError(''); setPlaying(false); }} theme={theme} onThemeChange={setTheme} onReload={() => { setPlaying(false); setScenarioReload(value => value + 1); }}/>
  <div className="layout">
   <ScenarioSidebar open={scenarioMenuOpen} paths={paths} titles={scenarioTitles} categories={scenarioCategories} selected={selected}
    onClose={() => setScenarioMenuOpen(false)}
    onSelect={path => { setSelected(path); setScenarioMenuOpen(false); }}
    onCreate={() => { setScenarioMenuOpen(false); setPlaying(false); setEditorMode('new'); }}/>
   <main>
    <button type="button" className="scenario-menu-toggle" aria-label="シナリオ一覧を開く" aria-controls="scenario-navigation" aria-expanded={scenarioMenuOpen} onClick={() => setScenarioMenuOpen(true)}>☰ <span>シナリオ一覧</span></button>
    <div className="top"><div><h1>{scenario?.metadata.title || '読み込み中...'}</h1><p>{scenario?.metadata.description}</p></div>{scenario && !error && <div className="switch"><button type="button" onClick={() => { setPlaying(false); setEditorMode('edit'); }}>✎ フローを編集</button><button className={mode === 'technical' ? 'selected' : ''} onClick={() => setMode('technical')}>Technical</button><button className={mode === 'illustration' ? 'selected' : ''} onClick={() => setMode('illustration')}>Illustration</button></div>}</div>
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
     </div>}<PlaybackControls zoom={zoom} step={step} stepCount={routes.length} playing={playing} finished={finished} speed={speed}
     onZoomOut={() => setZoom(v => clampZoom(v / 1.2))}
     onZoomIn={() => setZoom(v => clampZoom(v * 1.2))}
     onResetViewport={resetViewport}
     onRestart={() => { setPlaying(false); setFinished(false); setStep(0); }}
     onPrevious={() => { setPlaying(false); setFinished(false); setStep(i => i - 1); }}
     onTogglePlayback={togglePlayback}
     onNext={() => { setPlaying(false); setFinished(false); setStep(i => i + 1); }}
     onSpeedChange={setSpeed}/>
    <div className="scene-size-wrapper" aria-label="右下をドラッグして表示領域の幅と高さを変更できます"><Scene scenario={visibleScenario} step={step} mode={mode} theme={theme} playing={playing} speed={speed} focus={focus} zoom={zoom} pan={pan} onPan={setPan} onZoom={setZoom} onFinished={advance} onSelectActor={setSelectedActorId}/></div><ActorDetailsDrawer actor={scenario.actors.find(item => item.id === selectedActorId) ?? null} onClose={() => setSelectedActorId(null)}/>
      <InterfaceDefinitionDrawer interfaceId={selectedInterfaceId} interfaces={scenario.interfaces} onClose={() => setSelectedInterfaceId(null)}/>
       <div className="steps">{routes.map((s, i) => <button key={s.id} className={i === step ? 'selected' : ''} onClick={() => { setPlaying(false); setFinished(false); setStep(i); }}>{i + 1}. {s.title}</button>)}</div><section className="explanation"><h2>{current.title}</h2><p>{current.description}</p><code>{current.actions[0].payload}</code><div className="if-playback-links">{current.forwardIf && <button type="button" className="if-definition-link" onClick={() => setSelectedInterfaceId(current.forwardIf!)}>往路IF: {scenario.interfaces?.find(item => item.id === current.forwardIf)?.name ?? current.forwardIf}</button>}{current.reverseIf && <button type="button" className="if-definition-link" onClick={() => setSelectedInterfaceId(current.reverseIf!)}>復路IF: {scenario.interfaces?.find(item => item.id === current.reverseIf)?.name ?? current.reverseIf}</button>}{current.reversePayload && <p>復路通信内容: {current.reversePayload}</p>}</div></section></>}
   </main>
  </div>
 </div>;
}
