import type { Scenario } from '../scenario';
type Step = Scenario['steps'][number];
type Point = { x: number; y: number };

/** 再生順マーカーの描画と入力。ドラッグ状態の管理は親が担当する。 */
export default function PlaybackOrderMarkers({ orderMode, steps, orderCursor, orderDragSource, orderSource, orderPoint, orderRadius, onStartDrag, onChooseOrder }: {
 orderMode: boolean;
 steps: Step[];
 orderCursor: Point | null;
 orderDragSource: string | null;
 orderSource: string | null;
 orderPoint: (step: Step) => Point | null;
 orderRadius: (step: Step) => number;
 onStartDrag: (stepId: string, pointerId: number, x: number, y: number) => void;
 onChooseOrder: (stepId: string) => void;
}) {
 return <>
      {orderMode && <g className="editor-playback-order" aria-label="再生順序線">
       {steps.slice(0, -1).map((step, index) => {
        const from = orderPoint(step);
        const to = orderPoint(steps[index + 1]);
        return from && to ? <line key={step.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#fbbf24" strokeWidth="3" strokeDasharray="9 5" pointerEvents="none"/> : null;
       })}
       {orderCursor && orderDragSource && (() => { const sourcePoint = orderPoint(steps.find(step => step.id === orderDragSource)!); return sourcePoint ? <line x1={sourcePoint.x} y1={sourcePoint.y} x2={orderCursor.x} y2={orderCursor.y} stroke="#f97316" strokeWidth="4" strokeDasharray="8 4" pointerEvents="none"/> : null; })()}
       {steps.map((step, index) => {
        const point = orderPoint(step);
        return point && <g key={step.id} className="editor-order-marker" role="button" tabIndex={0} aria-label={`再生順序 ${index + 1}: ${step.title}。ドラッグして順序変更`} onPointerDown={event => { event.stopPropagation(); onStartDrag(step.id, event.pointerId, event.clientX, event.clientY); event.currentTarget.closest('svg')?.setPointerCapture(event.pointerId); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onChooseOrder(step.id); } }}>
         <circle cx={point.x} cy={point.y} r={orderRadius(step)} fill={orderSource === step.id ? '#ea580c' : '#92400e'} stroke="#fde68a" strokeWidth={orderSource === step.id ? "4" : "2"}/>
         <title>{`${index + 1}番: ${step.title} — ドラッグして順序を変更`}</title>
         <text x={point.x} y={point.y + 5} fontSize={Math.max(11, Math.min(14, orderRadius(step) * .75))} fill="white" textAnchor="middle" pointerEvents="none">{index + 1}</text>
        </g>;
       })}
      </g>}
 </>;
}
