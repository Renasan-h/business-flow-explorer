import { serializeEditorScenario, validateTemplateReferences } from './serializeEditorScenario';
import { validateEditorScenario } from './validateEditorScenario';
import { editorScenarioFilename } from './editorScenarioFilename';

type EditorScenarioData = Parameters<typeof serializeEditorScenario>[0];

/** 保存前の整合性確認とYAML生成をまとめ、ファイル操作から分離する。 */
export function prepareEditorYamlSave(data: EditorScenarioData, scenarioPath?: string | null):
 { ok: true; yaml: string; filename: string } | { ok: false; error: string } {
 const validationError = validateEditorScenario(data.actors, data.steps, data.groups);
 if (validationError) return { ok: false, error: validationError };

 const referenceError = validateTemplateReferences(data);
 if (referenceError) return { ok: false, error: referenceError };

 return {
  ok: true,
  yaml: serializeEditorScenario(data),
  filename: editorScenarioFilename(scenarioPath, data.metadata.id),
 };
}
