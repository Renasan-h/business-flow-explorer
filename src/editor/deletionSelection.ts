/**
 * 削除後の選択・接続開始状態を計算する。
 * データ削除そのものとUI状態の整合性維持を分離する。
 */
export function selectionAfterActorDeletion(
 id: string,
 selection: { selectedActor: string | null; selectedActors: string[]; source: string | null },
) {
 return {
  selectedActor: selection.selectedActor === id ? null : selection.selectedActor,
  selectedActors: selection.selectedActors.filter(actorId => actorId !== id),
  source: selection.source === id ? null : selection.source,
 };
}

/** 通信ステップ削除時、他のステップの選択・再生順指定は維持する。 */
export function selectionAfterStepDeletion(
 id: string,
 selection: { selectedStep: string | null; orderSource: string | null },
) {
 return {
  selectedStep: selection.selectedStep === id ? null : selection.selectedStep,
  orderSource: selection.orderSource === id ? null : selection.orderSource,
 };
}
