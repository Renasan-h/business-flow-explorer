import type { ReactNode } from 'react';

/** Eclipse風の右側ドック。展開状態と内容の管理は呼び出し元が担当する。 */
export default function EditorPanel({ title, collapsed, onToggle, className, children }: {
 title: string;
 collapsed: boolean;
 onToggle: () => void;
 className: string;
 children: ReactNode;
}) {
 return <aside className={`${className}${collapsed ? ' is-collapsed' : ''}`} aria-label={title}>
  <div className="editor-panel-heading">
   <strong>{title}</strong>
   <button type="button" className="editor-panel-toggle"
    aria-label={`${title}パネルを${collapsed ? '展開' : '最小化'}`}
    title={`${title}パネルを${collapsed ? '展開' : '最小化'}`}
    aria-expanded={!collapsed} onClick={onToggle}>{collapsed ? '◀' : '▶'}</button>
  </div>
  {!collapsed && children}
 </aside>;
}
