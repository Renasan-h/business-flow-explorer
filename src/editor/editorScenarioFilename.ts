/** 編集対象のファイル名を優先し、新規作成時はメタデータIDからYAML名を生成する。 */
export function editorScenarioFilename(scenarioPath: string | undefined, metadataId: string): string {
 return scenarioPath
  ? (decodeURIComponent(scenarioPath.split('/').pop() ?? '') || 'scenario.yaml')
  : (metadataId.replace(/[^a-zA-Z0-9_-]/g, '-') || 'scenario') + '.yaml';
}
