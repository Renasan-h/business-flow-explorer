/**
 * 単一選択時のクリック対象から、各種インスペクターの選択状態を決定する。
 * 通信線選択時はドラッグを開始しない。
 */
export function resolveCanvasSelection(actorId: string | null, stepId: string | null):
 { kind: 'actor'; selectedActor: string; selectedStep: null; selectedGroup: null }
 | { kind: 'step'; selectedActor: null; selectedStep: string; selectedGroup: null }
 | { kind: 'empty'; selectedActor: null; selectedStep: null; selectedGroup: null } {
 if (actorId) return { kind: 'actor', selectedActor: actorId, selectedStep: null, selectedGroup: null };
 if (stepId) return { kind: 'step', selectedActor: null, selectedStep: stepId, selectedGroup: null };
 return { kind: 'empty', selectedActor: null, selectedStep: null, selectedGroup: null };
}
