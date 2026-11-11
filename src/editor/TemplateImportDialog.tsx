import { useRef } from 'react';

/** テンプレート読込モーダル。入力と読込実行は親が所有する。 */
export default function TemplateImportDialog({ path, file, error, onPathChange, onFileChange, onClose, onImport, catalog = [], catalogStatus = '' }: {
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
 const templateFileRef = useRef<HTMLInputElement>(null);
 return <>
  {<div className="template-import-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
       <section className="template-import-dialog" role="dialog" aria-modal="true" aria-labelledby="template-import-title">
    <button type="button" className="template-import-close icon-close-button" aria-label="閉じる" onClick={() => onClose()}>×</button>
    <div className="template-import-source">
     <label id="template-import-title" className="template-import-title">テンプレートの読み込み</label>
     <div className="template-import-file">
      <input aria-label="テンプレートの相対パス" value={path} onChange={e => onPathChange(e.target.value)} placeholder="参照元からの相対パス（例: ../sub/auth.yaml）"/>
      <input ref={templateFileRef} type="file" accept=".yaml,.yml" className="template-import-hidden" aria-label="ローカルYAMLを選択" onChange={event => { onFileChange(event.target.files?.[0] ?? null); if (event.target.files?.[0]) onPathChange(""); }}/>
      <button type="button" className="template-import-browse" onClick={() => templateFileRef.current?.click()}>ファイルを選択…</button>
     </div>
     <label className="template-import-catalog">登録済みYAMLから選択
      <select aria-label="参照するYAMLを選択" disabled={catalog.length === 0} value={catalog.some(item => item.path === path) ? path : ""} onChange={event => { if (event.target.value) { onPathChange(event.target.value); onFileChange(null); if (templateFileRef.current) templateFileRef.current.value = ""; } }}>
       <option value="">選択してください</option>
       {catalog.map(item => <option key={item.path} value={item.path}>{item.label}</option>)}
      </select>
     </label>
     {catalogStatus && <p className="hint" role="status">{catalogStatus}</p>}
     {file && <span className="template-import-selected" title={file.name}>{file.name}<button type="button" aria-label="選択ファイルを解除" onClick={() => { onFileChange(null); if (templateFileRef.current) templateFileRef.current.value = ''; }}>×</button></span>}
    </div>
    <p className="hint">「ファイルを選択…」は直接読込用です。サブシナリオ参照は上の「登録済みYAMLから選択」を利用してください。</p>
    <div className="template-import-actions">
     <button type="button" onClick={() => onImport('inline')}>直接読み込む</button>
     <button type="button" onClick={() => onImport('reference')}>サブシナリオとして読み込む</button>
    </div>
    {error && <p className="template-import-error" role="alert">{error}</p>}
   </section>
   </div>}
 </>;
}
