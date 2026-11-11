import { loadTemplateFragment, parseTemplateYaml } from '../scenario';

type ImportMode = 'inline' | 'reference';

/** 選択ファイルまたはシナリオルート内の相対パスからテンプレートを読み込む。 */
export async function loadEditorTemplate(mode: ImportMode, path: string, file: File | null, scenarioPath?: string) {
 if (!file && !path) throw new Error('YAMLファイルを選択するか、ファイルパスを指定してください');
 if (mode === 'reference' && !path) throw new Error('templateフォルダ内のYAMLを選択してください。');
 let content: string;
 let sourceUrl: string | null = null;
 // ローカルファイルはブラウザの制約上、参照先の相対パスを解決できない。
 if (mode === 'inline' && file) {
  if (!/\.ya?ml$/i.test(file.name) || file.size > 2_000_000) throw new Error('2MB以下のYAMLファイルを選択してください');
  content = await file.text();
 } else {
  if (!/^[^?#\\\\]+\.ya?ml$/i.test(path) || path.startsWith('/') || path.split('/').includes('') || path.split('/').includes('.')) {
   throw new Error('シナリオルート内の相対YAMLパスを指定してください');
  }
  const base = scenarioPath ? new URL(scenarioPath, window.location.origin) : new URL('/scenarios/new-flow.yaml', window.location.origin);
  const url = new URL(path, base);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/scenarios/')) throw new Error('scenarios外のファイルは読み込めません');
  const response = await fetch(url.pathname);
  if (!response.ok) throw new Error('テンプレートを取得できません: ' + response.status);
  content = await response.text();
  sourceUrl = url.href;
 }
 const parsed = parseTemplateYaml(content);
 if (parsed.hasReferences && !sourceUrl) throw new Error('参照付きYAMLは公開ディレクトリの相対パスから読み込んでください');
 return parsed.hasReferences ? loadTemplateFragment(sourceUrl!) : parsed;
}
