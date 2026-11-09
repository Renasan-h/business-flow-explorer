import type { Scenario } from '../scenario';

export type EditorTool = 'move' | 'connect' | 'multi';

/** 編集操作のツールバー。状態の所有とデータ変更は親に委譲する。 */
export default function EditorToolbar({ tool, setTool, source, setSource, actors, selectedActors, setSelectedActors, clearSelection, addActor, addGroup, addInterface, openTemplate, zoom, setZoom, resetView, scenarioPath, showLines, setShowLines, orderMode, setOrderMode, setOrderSource }: {
 tool: EditorTool;
 setTool: (tool: EditorTool) => void;
 source: string | null;
 setSource: (source: string | null) => void;
 actors: Scenario['actors'];
 selectedActors: string[];
 setSelectedActors: (ids: string[]) => void;
 clearSelection: () => void;
 addActor: () => void;
 addGroup: () => void;
 addInterface: () => void;
 openTemplate: () => void;
 zoom: number;
 setZoom: (update: (value: number) => number) => void;
 resetView: () => void;
 scenarioPath?: string;
 showLines: boolean;
 setShowLines: (value: boolean) => void;
 orderMode: boolean;
 setOrderMode: (update: (value: boolean) => boolean) => void;
 setOrderSource: (value: string | null) => void;
}) {
 return <>
  <div className="editor-toolbar">
   <button className={tool === 'move' ? 'selected' : ''} onClick={() => { setTool('move'); setSource(null); }}>移動・選択</button>
   <button className={tool === 'multi' ? 'selected' : ''} aria-pressed={tool === 'multi'} onClick={() => { setTool('multi'); setSource(null); clearSelection(); }}>複数ノード選択・移動</button>
   {tool === 'multi' && <><span className="viewport-hint">空白をドラッグして範囲選択、Shift＋クリックで追加・解除、選択ノードをドラッグして一括移動</span><button type="button" onClick={() => setSelectedActors(actors.map(actor => actor.id))}>すべて選択</button><button type="button" onClick={() => setSelectedActors([])}>選択解除</button><span>{selectedActors.length}件選択中</span></>}
   <button className={tool === 'connect' ? 'selected' : ''} onClick={() => setTool('connect')}>通信線を追加</button>
   <button onClick={addActor}>＋ ノード追加</button>
   <button onClick={addGroup}>＋ 領域追加</button>
   <button onClick={addInterface}>＋ IF定義</button>
   <button type="button" onClick={() => { openTemplate(); }}>テンプレートの読み込み…</button>
   <button onClick={() => setZoom(z => Math.max(.3, +(z / 1.2).toFixed(2)))}>−</button>
   <span>{Math.round(zoom * 100)}%</span>
   <button onClick={() => setZoom(z => Math.min(2.5, +(z * 1.2).toFixed(2)))}>＋</button>
   <button onClick={() => { setZoom(1); resetView(); }}>表示リセット</button>
   <span className="viewport-hint">Ctrl + ホイールで拡大・縮小</span>
   {scenarioPath && <span className="viewport-hint">編集対象: {scenarioPath}</span>}
   <label><input type="checkbox" checked={showLines} onChange={event => setShowLines(event.target.checked)}/> 通信線表示</label>
   <button type="button" className={orderMode ? 'selected' : ''} aria-pressed={orderMode} onClick={() => { setOrderMode(value => !value); setOrderSource(null); }}>再生順序変更モード</button>
   {orderMode && <span className="viewport-hint">番号をドラッグして移動先の番号で離すか、番号を2つクリックして並べ替えます。</span>}
   {source && <span>接続元: {source} → 接続先を選択</span>}
  </div>
 </>;
}
