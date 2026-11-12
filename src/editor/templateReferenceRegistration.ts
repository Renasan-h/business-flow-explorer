import type { Scenario } from '../scenario';
import type { TemplateReference } from './serializeEditorScenario';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];

/** 参照テンプレートの登録情報を、読み込み時点の内容から生成する。 */
export function createTemplateReference(file: string, actors: Actor[], steps: Step[]): TemplateReference {
 return {
  file,
  actorIds: actors.map(item => item.id),
  stepIds: steps.map(item => item.id),
  original: JSON.stringify({ actors, steps }),
 };
}

/** 同じファイルを参照モードで重複登録しないよう検証する。 */
export function assertTemplateReferenceAvailable(file: string, references: TemplateReference[]): void {
 if (references.some(item => item.file === file)) {
  throw new Error('同じ参照テンプレートは複数回読み込めません');
 }
}
