import type { Scenario } from '../scenario';
import { loadEditorTemplate } from './loadEditorTemplate';
import { prepareTemplateImport } from './prepareTemplateImport';
import { assertTemplateReferenceAvailable, createTemplateReference } from './templateReferenceRegistration';
import type { TemplateReference } from './serializeEditorScenario';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
type ImportMode = 'inline' | 'reference';

/** テンプレートの取得・ID調整・参照情報作成を行い、画面反映用の結果を返す。 */
export async function prepareEditorTemplateImport(
 mode: ImportMode,
 path: string,
 file: File | null,
 scenarioPath: string | undefined,
 actors: Actor[],
 steps: Step[],
 references: TemplateReference[],
) {
 const normalizedPath = path.trim();
 if (mode === 'reference') assertTemplateReferenceAvailable(normalizedPath, references);
 const fragment = await loadEditorTemplate(mode, normalizedPath, file, scenarioPath);
 const prepared = prepareTemplateImport(fragment, mode, actors, steps);
 return {
  ...prepared,
  reference: mode === 'reference'
   ? createTemplateReference(normalizedPath, prepared.newActors, prepared.newSteps)
   : null,
  message: mode === 'reference'
   ? 'サブシナリオ参照を追加しました。'
   : '直接読み込みが完了しました。' + (prepared.renamed ? ' 重複IDを' + prepared.renamed + '件変更しました。' : ''),
 };
}
