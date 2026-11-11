/** テンプレートの公開URLを編集中シナリオからの相対パスに変換する。 */
export function templateCatalogItems(paths: string[], scenarioPath?: string): { path: string; label: string }[] {
 const rootId = (scenarioPath ?? '').split('/')[2] || '0';
 const base = scenarioPath
  ? new URL(scenarioPath, window.location.origin)
  : new URL('/scenarios/' + rootId + '/new-flow.yaml', window.location.origin);
 return paths.map(path => {
  const url = new URL(path, window.location.origin);
  const baseParts = base.pathname.split('/').slice(0, -1).filter(Boolean);
  const targetParts = url.pathname.split('/').filter(Boolean);
  while (baseParts.length && targetParts.length && baseParts[0] === targetParts[0]) {
   baseParts.shift();
   targetParts.shift();
  }
  return {
   path: [...baseParts.map(() => '..'), ...targetParts].join('/'),
   label: decodeURIComponent(url.pathname.split('/template/')[1] ?? url.pathname),
  };
 });
}
