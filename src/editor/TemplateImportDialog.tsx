import { useRef } from 'react';

/** テンプレート読込モーダル。入力と読込実行は親が所有する。 */
export default function TemplateImportDialog({ path, file, error, onPathChange, onFileChange, onClose, onImport }: {
 path: string;
 file: File | null;
 error: string | null;
 onPathChange: (value: string) => void;
 onFileChange: (file: File | null) => void;
 onClose: () => void;
 onImport: (mode: 'inline' | 'reference') => void;
}) {
 const templateFileRef = useRef<HTMLInputElement>(null);
 return <>
  {<div className="template-import-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
       <section className="template-import-dialog" role="dialog" aria-modal="true" aria-labelledby="template-import-title">
    <button type="button" className="template-import-close" aria-label="閉じる" onClick={() => onClose()}>×</button>
    <div className="template-import-source">
     <label id="template-import-title" className="template-import-title">テンプレートの読み込み</label>
     <div className="template-import-file">
      <input aria-label="テンプレートの相対パス" value={path} onChange={e => onPathChange(e.target.value)} placeholder="scenarios内の相対パス（例: fragments/common.yaml）"/>
      <input ref={templateFileRef} type="file" accept=".yaml,.yml" className="template-import-hidden" aria-label="ローカルYAMLを選択" onChange={event => onFileChange(event.target.files?.[0] ?? null)}/>
      <button type="button" className="template-import-browse" onClick={() => templateFileRef.current?.click()}>ファイルを選択…</button>
     </div>
     {file && <span className="template-import-selected" title={file.name}>{file.name}<button type="button" aria-label="選択ファイルを解除" onClick={() => { onFileChange(null); if (templateFileRef.current) templateFileRef.current.value = ''; }}>×</button></span>}
    </div>
    <div className="template-import-actions">
     <button type="button" onClick={() => onImport('inline')}>直接読み込む</button>
     <button type="button" onClick={() => onImport('reference')}>サブシナリオとして読み込む</button>
    </div>
    {error && <p className="template-import-error" role="alert">{error}</p>}
   </section>
   </div>}
 </>;
}
