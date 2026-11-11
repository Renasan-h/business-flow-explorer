import { useState } from 'react';

/** 設定されたベースディレクトリ内のtemplateフォルダ専用エクスプローラー。 */
export default function TemplateImportDialog({ path, error, onPathChange, onClose, onImport, catalog = [], catalogStatus = '' }: {
 path: string;
 file: File | null;
 error: string | null;
 onPathChange: (value: string) => void;
 onFileChange: (file: File | null) => void;
 onClose: () => void;
 onImport: (mode: 'inline' | 'reference') => void;
 catalog?: { path: string; label: string }[];
 catalogStatus?: string;
}) {
 const [directory, setDirectory] = useState('');
 const segments = directory ? directory.split('/') : [];
 const folders = [...new Set(catalog.map(item => item.label).filter(label => label.startsWith(directory ? directory + '/' : '')).map(label => label.slice(directory ? directory.length + 1 : 0).split('/')).filter(parts => parts.length > 1).map(parts => parts[0]))].sort();
 const files = catalog.filter(item => {
  const parts = item.label.split('/');
  return parts.slice(0, -1).join('/') === directory;
 });
 const selected = catalog.some(item => item.path === path);
 return <div className="template-import-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
  <section className="template-import-dialog" role="dialog" aria-modal="true" aria-labelledby="template-import-title">
   <button type="button" className="template-import-close icon-close-button" aria-label="閉じる" onClick={onClose}>×</button>
   <h2 id="template-import-title">テンプレートエクスプローラー</h2>
   <p className="hint">現在のベースディレクトリ / template {directory ? '/ ' + directory : ''}</p>
   <div className="template-import-explorer" role="group" aria-label="テンプレートファイル一覧" style={{ minHeight: 180, maxHeight: 340, overflowY: 'auto' }}>
    {directory && <button type="button" onClick={() => { setDirectory(segments.slice(0, -1).join('/')); onPathChange(''); }}>📁 ..（上のフォルダ）</button>}
    {folders.map(folder => <button type="button" key={folder} onClick={() => { setDirectory(directory ? directory + '/' + folder : folder); onPathChange(''); }}>📁 {folder}</button>)}
    {files.map(item => <button type="button" key={item.path} aria-pressed={path === item.path} className={path === item.path ? 'selected' : ''} onClick={() => onPathChange(item.path)}>📄 {item.label.split('/').pop()}</button>)}
    {catalogStatus && <p className="hint" role="status">{catalogStatus}</p>}
    {!catalogStatus && folders.length === 0 && files.length === 0 && <p className="hint">このフォルダにYAMLはありません。</p>}
   </div>
   {selected && <p className="hint">選択中: {catalog.find(item => item.path === path)?.label}</p>}
   {error && <p className="template-import-error" role="alert">{error}</p>}
   <div className="template-import-actions">
    <button type="button" onClick={onClose}>キャンセル</button>
    <button type="button" disabled={!selected} onClick={() => onImport('inline')}>直接読込</button>
    <button type="button" disabled={!selected} onClick={() => onImport('reference')}>サブシナリオ参照</button>
   </div>
  </section>
 </div>;
}
