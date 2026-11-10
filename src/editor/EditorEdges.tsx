import type { Scenario } from '../scenario';
import { routeConnection, routeViaWaypoints, routePath, offsetRoute, pointOnRoute } from '../connectionRouting';
type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];

/** 通信線と折れ線経由点を描画。選択状態の更新は親に通知する。 */
export default function EditorEdges({ actors, steps, showLines, selectedStep, tool, onSelect }: {
 actors: Actor[];
 steps: Step[];
 showLines: boolean;
 selectedStep: string | null;
 tool: 'move' | 'connect' | 'multi';
 onSelect: (id: string) => void;
}) {
 return <>
      {showLines && steps.flatMap(step => step.actions.map((action, index) => {
       const from = actors.find(actor => actor.id === action.from);
       const to = actors.find(actor => actor.id === action.to);
       if (!from || !to) return null;
       const active = selectedStep === step.id;
       const points = step.routing === 'orthogonal' && step.waypoints?.length
        ? routeViaWaypoints(actors, action.from, action.to, step.waypoints)
        : routeConnection(actors, action.from, action.to, step.routing ?? 'straight');
       // 逆方向も接続されている場合だけ線をずらす。片方向は中央の1本。
       const bidirectional = Boolean(step.bidirectional) || steps.some(other => other.actions.some(otherAction =>
        otherAction.from === action.to && otherAction.to === action.from));
       const forward = bidirectional ? offsetRoute(points, -12) : points;
       const path = routePath(forward);
       // 復路は送信先→送信元で経路を再計算する。逆方向の法線で別レーンに配置する。
       const reversePoints = step.bidirectional && step.reverseFrom && step.reverseTo
        ? routeConnection(actors, step.reverseFrom, step.reverseTo, step.routing ?? 'straight') : [];
       const reversePath = routePath(offsetRoute(reversePoints, -12));
       const middle = pointOnRoute(forward, .5);
       return <g key={step.id + '-' + index} data-step-id={step.id} className="editor-edge" onClick={event => { event.stopPropagation(); if (tool === 'multi') return; onSelect(step.id); }}>
        <path d={path} fill="none" stroke="transparent" strokeWidth="18"/>
        {step.bidirectional && <path d={reversePath} fill="none" stroke="transparent" strokeWidth="18"/>}
        <path d={path} fill="none" stroke={active ? '#22d3ee' : '#7b94b3'} strokeWidth={active ? 4 : 2} opacity={active ? 1 : .55}/>
        {step.bidirectional && <path d={reversePath} fill="none" stroke={active ? '#a78bfa' : '#7b94b3'} strokeWidth={active ? 4 : 2} opacity={active ? 1 : .55}/>}
        {active && step.routing === 'orthogonal' && step.waypoints?.map((point, waypointIndex) =>
         <circle key={waypointIndex} data-waypoint-step={step.id} data-waypoint-index={waypointIndex}
          cx={point.x} cy={point.y} r="10" fill="#f97316" stroke="#fff" strokeWidth="2"
          className="editor-waypoint" aria-label={`経由点 ${waypointIndex + 1}`}/>)}
        {step.branchLabel && <g pointerEvents="none">
         <rect x={middle.x - Math.max(32, step.branchLabel.length * 7 / 2 + 8)} y={middle.y - 32} width={Math.max(64, step.branchLabel.length * 7 + 16)} height="22" rx="5" fill="#102c48" stroke="#38bdf8"/>
         <text x={middle.x} y={middle.y - 17} textAnchor="middle" fill="#f0f9ff" fontSize="12">{step.branchLabel}</text>
        </g>}
       </g>;
      }))}
 </>;
}
