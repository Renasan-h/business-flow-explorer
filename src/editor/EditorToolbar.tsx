import type { Scenario } from '../scenario';

export type EditorTool = 'move' | 'connect' | 'multi';

/** 編集操作のツールバー。状態の所有とデータ変更は親に委譲する。 */
export default function EditorToolbar({ tool, setTool, source, setSource, actors, selectedActors, setSelectedActors, clearSelection, addActor, addGroup, addInterface, openTemplate, zoom, setZoom, resetView, showLines, setShowLines, orderMode, setOrderMode, setOrderSource }: {
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
 showLines: boolean;
 setShowLines: (value: boolean) => void;
 orderMode: boolean;
 setOrderMode: (update: (value: boolean) => boolean) => void;
 setOrderSource: (value: string | null) => void;
}) {
 return <>
  <div className="editor-toolbar">
   <button className={tool === 'move' ? 'selected' : ''} onClick={() => { setTool('move'); setSource(null); }}>移動・選択</button>
   <span className="editor-tool-tooltip-anchor"><button className={tool === 'multi' ? 'selected' : ''} aria-pressed={tool === 'multi'} aria-describedby="multi-tool-help" onClick={() => { setTool('multi'); setSource(null); clearSelection(); }}>複数ノード選択・移動</button><span id="multi-tool-help" className="editor-tool-tooltip" role="tooltip">空白をドラッグして範囲選択、Shift＋クリックで追加・解除、選択ノードをドラッグして一括移動</span></span>
   {tool === 'multi' && <><button type="button" onClick={() => setSelectedActors(actors.map(actor => actor.id))}>すべて選択</button><button type="button" onClick={() => setSelectedActors([])}>選択解除</button><span>{selectedActors.length}件選択中</span></>}
   <button className={tool === 'connect' ? 'selected' : ''} onClick={() => setTool('connect')}>通信線を追加</button>
   <button onClick={addActor}>＋ ノード追加</button>
   <button onClick={addGroup}>＋ 領域追加</button>
   <button onClick={addInterface}>＋ IF定義</button>
   <button type="button" onClick={() => { openTemplate(); }}>テンプレートの読み込み…</button>
   <button onClick={() => setZoom(z => Math.max(.3, +(z / 1.2).toFixed(2)))}>−</button>
   <span>{Math.round(zoom * 100)}%</span>
   <button onClick={() => setZoom(z => Math.min(2.5, +(z * 1.2).toFixed(2)))}>＋</button>
   <button onClick={() => { setZoom(1); resetView(); }}>表示リセット</button>
   <label><input type="checkbox" checked={showLines} onChange={event => setShowLines(event.target.checked)}/> 通信線表示</label>
   <button type="button" className={orderMode ? 'selected' : ''} aria-pressed={orderMode} onClick={() => { setOrderMode(value => !value); setOrderSource(null); }}>再生順を並べ替え</button>
   {orderMode && <span className="viewport-hint">通信線の上にある番号をドラッグして、挿入したい位置の番号に重ねて離してください。番号を2回クリックしても移動できます。右側の「再生順」一覧からも並べ替えられます。</span>}
   {source && <span>接続元: {source} → 接続先を選択</span>}
  </div>
 </>;
}
