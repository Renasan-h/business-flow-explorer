import { useRef } from 'react';
import type { Scenario } from '../scenario';

type EditorData = {
 actors: Scenario['actors'];
 steps: Scenario['steps'];
 metadata: Scenario['metadata'];
 groups: NonNullable<Scenario['groups']>;
 interfaces: NonNullable<Scenario['interfaces']>;
 templateReferences: { file: string; actorIds: string[]; stepIds: string[]; original: string }[];
};

/**
 * 保存対象のデータだけを追跡する。
 * 選択状態・ズーム・表示パネルなどのUI状態は未保存判定に含めない。
 */
export function useEditorDirtySnapshot(data: EditorData) {
 const savedSnapshot = useRef<string | null>(null);
 const snapshot = () => JSON.stringify(data);

 // 初回レンダー時の編集データを保存済み状態の基準とする。
 if (savedSnapshot.current === null) savedSnapshot.current = snapshot();

 const isDirty = () => snapshot() !== savedSnapshot.current;

 /**
  * 保存開始時の内容を確定する。
  * 保存中にユーザーが変更したデータを誤って保存済み扱いしないため、
  * 呼び出し元で保存開始前に取得したスナップショットを渡す。
  */
 const markSaved = (snapshotAtSave: string) => {
  savedSnapshot.current = snapshotAtSave;
 };

 return { snapshot, isDirty, markSaved };
}
