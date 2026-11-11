import CategoryTree, { buildCategoryTree } from './CategoryTree';

/** 再生画面のシナリオナビゲーション。狭い画面では左側のドロワーとして表示する。 */
export default function ScenarioSidebar({
 open, paths, titles, categories, selected, onClose, onSelect, onCreate, onReload,
}: {
 open: boolean;
 paths: string[];
 titles: Record<string, string>;
 categories: Record<string, string>;
 selected: string;
 onClose: () => void;
 onSelect: (path: string) => void;
 onCreate: () => void;
 onReload: () => void;
}) {
 return <>
  {open && <button type="button" className="scenario-menu-backdrop" aria-label="シナリオ一覧を閉じる" onClick={onClose}/>}
  <aside id="scenario-navigation" className={`scenario-sidebar${open ? ' is-open' : ''}`} aria-label="シナリオ一覧">
   <div className="scenario-sidebar-heading">
    <h3>シナリオ</h3>
    <button type="button" className="scenario-reload-button" title="設定フォルダのシナリオ一覧を再取得" onClick={onReload}>↻ 更新</button>
    {/* デスクトップ表示ではCSSで非表示。モバイルのドロワーでのみ使用する。 */}
    <button type="button" className="scenario-menu-close icon-close-button" aria-label="シナリオ一覧を閉じる" onClick={onClose}>✕</button>
   </div>
   <button type="button" className="new-flow-button" onClick={onCreate}>＋ 新規フロー作成</button>
   <CategoryTree node={buildCategoryTree(paths, categories)} selected={selected} onSelect={onSelect} titles={titles}/>
   <p className="hint">フォルダ変更はプロジェクト直下の setting.config を編集し、アプリを再起動してください。</p>
  </aside>
 </>;
}
