import { useEffect, useState } from 'react';
import { loadTemplateCatalog } from './loadTemplateCatalog';

/**
 * テンプレート選択ダイアログのカタログ読込を管理する。
 * ダイアログを閉じた後の非同期応答は破棄し、別のシナリオへの結果混入を防ぐ。
 */
export function useTemplateCatalog(open: boolean, scenarioPath?: string) {
 const [catalog, setCatalog] = useState<{ path: string; label: string }[]>([]);
 const [status, setStatus] = useState('');

 useEffect(() => {
  if (!open) {
   setCatalog([]);
   setStatus('');
   return;
  }
  let cancelled = false;
  setCatalog([]);
  setStatus('templateフォルダを読み込み中…');
  loadTemplateCatalog(scenarioPath)
   .then(items => {
    if (cancelled) return;
    setCatalog(items);
    setStatus(items.length ? '' : '現在のベースディレクトリのtemplateフォルダにYAMLがありません。');
   })
   .catch(error => {
    if (cancelled) return;
    setCatalog([]);
    setStatus(error instanceof Error ? error.message : String(error));
   });
  return () => { cancelled = true; };
 }, [open, scenarioPath]);

 return { catalog, status };
}
