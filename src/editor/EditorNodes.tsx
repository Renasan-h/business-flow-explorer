import type { Scenario } from '../scenario';
import { NodeIcon } from '../NodeIcon';

type Actor = Scenario['actors'][number];

/** SVGノードの見た目と操作ハンドル。ノード状態は親が管理する。 */
export default function EditorNodes({ actors, selectedActors, tool, source, selectedActor, nodeNumbers, onClickActor, onDeleteActor }: {
 actors: Actor[];
 selectedActors: string[];
 tool: 'move' | 'connect' | 'multi';
 source: string | null;
 selectedActor: string | null;
 nodeNumbers: Record<string, number>;
 onClickActor: (id: string) => void;
 onDeleteActor: (id: string) => void;
}) {
 const NODE_WIDTH = 150;
 const NODE_HEIGHT = 76;
 return <>
      {actors.map(actor => <g key={actor.id} data-actor-id={actor.id} className={`editor-node${selectedActors.includes(actor.id) && tool === "multi" ? " editor-node-multiselected" : ""}`} onClick={() => { if (tool !== "multi") onClickActor(actor.id); }}>
       <rect x={actor.position.x - NODE_WIDTH / 2} y={actor.position.y - NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT} rx="12" fill={actor.color ?? (source === actor.id ? '#165c73' : selectedActor === actor.id ? '#1e5a88' : '#20314a')} stroke={source === actor.id || selectedActor === actor.id ? '#22d3ee' : '#7398c9'} strokeWidth="2"/>
       <circle cx={actor.position.x - NODE_WIDTH / 2 + 13} cy={actor.position.y - NODE_HEIGHT / 2 + 13} r="15" fill="#22d3ee" />
       <text x={actor.position.x - NODE_WIDTH / 2 + 13} y={actor.position.y - NODE_HEIGHT / 2 + 18} textAnchor="middle" fill="#082238" fontSize="13" fontWeight="bold">{nodeNumbers[actor.id]}</text>
       <NodeIcon type={actor.type} x={actor.position.x} y={actor.position.y - 10} size={29} color="#f0f6ff"/>
       <text x={actor.position.x} y={actor.position.y + 15} textAnchor="middle" fill="#f0f6ff" fontSize="12">{actor.name.length > 12 ? actor.name.slice(0, 11) + '…' : actor.name}</text>
       {/* ノード右上の削除ボタン。pointerdownを止め、ノード移動が始まらないようにする。 */}
       <g className="editor-node-delete" role="button" aria-label={actor.name + 'を削除'} tabIndex={0}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); onDeleteActor(actor.id); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onDeleteActor(actor.id); } }}>
        <circle cx={actor.position.x + NODE_WIDTH / 2 - 9} cy={actor.position.y - NODE_HEIGHT / 2 + 9} r="8" fill="#9f2538" stroke="#fecdd3" strokeWidth="1.5"/>
        <path d={`M ${actor.position.x + NODE_WIDTH / 2 - 12} ${actor.position.y - NODE_HEIGHT / 2 + 6} l 6 6 m 0 -6 l -6 6`} stroke="#fff" strokeWidth="2" strokeLinecap="round" pointerEvents="none"/>
       </g>
       {/* ノード端からドラッグする接続ハンドル。 */}
       <circle data-connection-handle={actor.id} cx={actor.position.x + NODE_WIDTH / 2} cy={actor.position.y}
        r="13" fill="#22d3ee" stroke="#082238" strokeWidth="2" className="editor-connection-handle"/>
       <text data-connection-handle={actor.id} x={actor.position.x + NODE_WIDTH / 2} y={actor.position.y + 5}
        textAnchor="middle" fill="#082238" fontSize="16" fontWeight="bold" className="editor-connection-handle">＋</text>
      </g>)}
     </g>
    </svg>
    {contextMenu && <div className="editor-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}
      onPointerDown={event => event.stopPropagation()}>
      {contextMenu.actorId ? <>
       <button type="button" role="menuitem" onClick={() => { setSelectedActor(contextMenu.actorId); setSelectedStep(null); setSelectedGroup(null); setContextMenu(null); }}>ノードを編集</button>
       <button type="button" role="menuitem" onClick={() => { duplicateActor(contextMenu.actorId!); setContextMenu(null); }}>ノードを複製</button>
       <button type="button" role="menuitem" className="danger" onClick={() => deleteActor(contextMenu.actorId!)}>ノードを削除</button>
      </> : contextMenu.groupId ? <>
       <button type="button" role="menuitem" onClick={() => { setSelectedGroup(contextMenu.groupId); setContextMenu(null); }}>領域を編集</button>
       <button type="button" role="menuitem" className="danger" onClick={() => { setGroups(items => items.filter(item => item.id !== contextMenu.groupId)); setSelectedGroup(null); setContextMenu(null); }}>領域を削除</button>
      </> : contextMenu.stepId ? <>
       <button type="button" role="menuitem" onClick={() => { setSelectedStep(contextMenu.stepId); setSelectedActor(null); setSelectedGroup(null); setContextMenu(null); }}>通信を編集</button>
       <button type="button" role="menuitem" className="danger" onClick={() => { deleteStep(contextMenu.stepId!); setContextMenu(null); }}>通信を削除</button>
      </> : <>
       <button type="button" role="menuitem" onClick={() => { addActor(); setContextMenu(null); }}>ノードを追加</button>
       <button type="button" role="menuitem" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); setContextMenu(null); }}>表示をリセット</button>
      </>}
     </div>}
   </EditorCanvas>
   <EditorPanel title="設定" className="editor-inspector" collapsed={inspectorCollapsed} onToggle={() => setInspectorCollapsed(value => !value)}>
    <>
    {!activeActor && !activeStep && !selectedGroup && <p className="editor-inspector-hint">ノード・通信・領域を選択すると、対応する設定が表示されます。</p>}
    {!activeActor && !activeStep && selectedGroup && groups.filter(group => group.id === selectedGroup).map(group => <GroupSettings key={group.id} group={group} actors={actors} setGroups={setGroups} onDelete={id => { setGroups(items => items.filter(item => item.id !== id)); setSelectedGroup(null); }}/>)}
    {!activeActor && !activeStep && !selectedGroup && <>
    <details className="editor-section"><summary>IF定義一覧（{interfaces.length}件）</summary>{interfaces.map(item => <button key={item.id} onClick={() => setInterfacePanel(item.id)}>{item.name}</button>)}<button onClick={addInterface}>＋ IF定義を追加</button></details>
    <ScenarioSettings metadata={metadata} onChange={setMetadata}/>
    </>}
    {activeActor && <ActorSettings activeActor={activeActor} actors={actors} nodeNumber={nodeNumbers[activeActor.id]} changeActor={changeActor} renameActor={(previous: string, next: string) => {
     if (!next || (next !== previous && actors.some(actor => actor.id === next))) return;
     changeActor(previous, { id: next });
     setNodeNumbers(current => { const updated = { ...current }; updated[next] = updated[previous]; delete updated[previous]; return updated; });
     setSelectedActor(next);
     setSteps(current => current.map(step => ({
      ...step, reverseFrom: step.reverseFrom === previous ? next : step.reverseFrom,
      reverseTo: step.reverseTo === previous ? next : step.reverseTo,
      actions: step.actions.map(action => ({ ...action, from: action.from === previous ? next : action.from, to: action.to === previous ? next : action.to }))
     })));
    }} duplicateActor={duplicateActor} deleteActor={deleteActor}/>} 
    {activeStep && <StepSettings activeStep={activeStep} actors={actors} interfaces={interfaces} changeStep={changeStep} changeDirection={changeDirection} openInterface={setInterfacePanel} deleteStep={deleteStep}/>} 

    </>
   </EditorPanel>
   {/* 再生順は設定フォームと独立した列に置き、長い設定欄のスクロールを不要にする。 */}
   <EditorPanel title="再生順" className="editor-order-panel" collapsed={orderCollapsed} onToggle={() => setOrderCollapsed(value => !value)}>
    <>
    <PlaybackOrderPanel steps={steps} selectedStep={selectedStep} onChange={setSteps} onSelect={id => { setSelectedStep(id); setSelectedActor(null); setSelectedGroup(null); }} onDelete={deleteStep}/>
    </>
   </EditorPanel>
  </div>
  {message && <p className="editor-message" role="status">{message}</p>}
 </div>;
}       <EditorNodes actors={actors} selectedActors={selectedActors} tool={tool} source={source} selectedActor={selectedActor} nodeNumbers={nodeNumbers} onClickActor={clickActor} onDeleteActor={deleteActor}/>
 </>;
}
