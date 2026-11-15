import { useState } from 'react';
import type { Scenario } from '../scenario';

type Step = Scenario['steps'][number];

/** 再生順の表示・並べ替え専用。編集データの所有権はFlowEditorに残す。 */
export default function PlaybackOrderPanel({ steps, selectedStep, onChange, onSelect, onDelete }: {
 steps: Step[];
 selectedStep: string | null;
 onChange: (steps: Step[]) => void;
 onSelect: (id: string) => void;
 onDelete: (id: string) => void;
}) {
 const [draggedStep, setDraggedStep] = useState<string | null>(null);
 const [dropTarget, setDropTarget] = useState<string | null>(null);
 const setSteps = (updater: (current: Step[]) => Step[]) => onChange(updater(steps));
 return <>
    <details className="editor-section" open><summary>通信の再生順（{steps.length}件）</summary>
    <p className="editor-reorder-hint">左の「⠿」をドラッグして再生順を入れ替えられます。</p>
    <div className="editor-step-list">{steps.map((step, index) =>
     <div key={step.id} className={dropTarget === step.id && draggedStep !== step.id ? 'editor-step-drop-target' : '' }
      onDragOver={event => { if (!draggedStep || draggedStep === step.id) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(step.id); }}
      onDrop={event => {
       event.preventDefault();
       const fromId = draggedStep;
       if (fromId && fromId !== step.id) {
        // IDで移動元と移動先を検索し、移動元を抜いてから挿入する。
        setSteps(current => {
         const from = current.findIndex(item => item.id === fromId);
         const to = current.findIndex(item => item.id === step.id);
         if (from < 0 || to < 0) return current;
         const reordered = [...current];
         const [moved] = reordered.splice(from, 1);
         reordered.splice(to, 0, moved);
         return reordered;
        });
       }
       setDraggedStep(null);
       setDropTarget(null);
      }}>
      <span className="editor-step-drag-handle" draggable
       role="button" tabIndex={0} aria-label={step.title + 'をドラッグして並び替え'}
       title="ドラッグして並び替え"
       onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', step.id); setDraggedStep(step.id); }}
       onDragEnd={() => { setDraggedStep(null); setDropTarget(null); }}>⠿</span>
      <button className={selectedStep === step.id ? 'selected' : ''} onClick={() => { onSelect(step.id); }}>{index + 1}. {step.title}</button>
      <button disabled={index === 0} aria-label="上へ" onClick={() => setSteps(v => { const copy = [...v]; [copy[index-1], copy[index]] = [copy[index], copy[index-1]]; return copy; })}>↑</button>
      <button disabled={index === steps.length-1} aria-label="下へ" onClick={() => setSteps(v => { const copy = [...v]; [copy[index+1], copy[index]] = [copy[index], copy[index+1]]; return copy; })}>↓</button>
      <button type="button" className="editor-step-delete" aria-label={`${step.title}を削除`} title="このステップを削除" onClick={() => onDelete(step.id)}>削除</button>
     </div>)}</div>
    </details>
 </>;
}
