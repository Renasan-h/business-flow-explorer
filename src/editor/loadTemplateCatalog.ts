import { templateCatalogItems } from './templateCatalog';

/** 編集対象と同じシナリオルートからテンプレート一覧を取得する。 */
export async function loadTemplateCatalog(scenarioPath?: string): Promise<{ path: string; label: string }[]> {
 const rootId = (scenarioPath ?? '').split('/')[2] || '0';
 const response = await fetch('/scenarios/' + rootId + '/catalog.json', { cache: 'no-store' });
 if (!response.ok) throw new Error('テンプレート一覧の取得に失敗しました');
 const paths: unknown = await response.json();
 if (!Array.isArray(paths) || !paths.every(path => typeof path === 'string')) {
  throw new Error('テンプレート一覧の形式が不正です');
 }
 return templateCatalogItems(paths, scenarioPath);
}
