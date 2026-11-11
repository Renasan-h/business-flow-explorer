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
 return <>
      {actors.map(actor => { const NODE_WIDTH = actor.width ?? 150; const NODE_HEIGHT = actor.height ?? 76; return <g key={actor.id} data-actor-id={actor.id} className={`editor-node${selectedActors.includes(actor.id) && tool === "multi" ? " editor-node-multiselected" : ""}`} onClick={() => { if (tool !== "multi") onClickActor(actor.id); }}>
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
       {selectedActor === actor.id && tool === 'move' && <g data-node-resize={actor.id} className="editor-node-resize" aria-label="ノードサイズをドラッグして変更">
        <rect x={actor.position.x + NODE_WIDTH / 2 - 9} y={actor.position.y + NODE_HEIGHT / 2 - 9} width="18" height="18" rx="3" fill="#fbbf24" stroke="#172033" strokeWidth="2"/>
        <path d={`M ${actor.position.x + NODE_WIDTH / 2 - 4} ${actor.position.y + NODE_HEIGHT / 2 + 5} l 9 -9`} stroke="#172033" strokeWidth="2" pointerEvents="none"/>
       </g>}
      </g>; })}
 </>;
}
