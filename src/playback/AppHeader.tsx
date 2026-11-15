import type { Theme } from './types';

type ScenarioRoot = { id: string; label: string };

type AppHeaderProps = {
 roots: ScenarioRoot[];
 activeRoot: string;
 onRootChange: (rootId: string) => void;
 theme: Theme;
 onThemeChange: (theme: Theme) => void;
 onReload: () => void;
};

/** アプリ共通ヘッダー。選択状態の管理は親コンポーネントに委譲する。 */
export default function AppHeader({ roots, activeRoot, onRootChange, theme, onThemeChange, onReload }: AppHeaderProps) {
 return <header>
  <div className="header-brand">
   <strong>◈ Business Flow Explorer</strong>
   <label className="header-directory">
    <span>表示中ディレクトリ</span>
    <select aria-label="表示中ディレクトリ" title="シナリオのベースディレクトリを切り替え" value={activeRoot} onChange={event => onRootChange(event.target.value)} disabled={roots.length === 0}>
     {roots.map(root => <option key={root.id} value={root.id}>{root.label}</option>)}
    </select>
   </label>
  </div>
  <div className="header-actions">
   <button type="button" className="header-reload-button" onClick={onReload} title="シナリオ一覧と選択中のフローを再読み込み">↻ 再読み込み</button>
   <span>Scenario-driven visualization</span>
   <div className="theme-switch" role="group" aria-label="配色テーマ">
    <button type="button" className={theme === 'light' ? 'selected' : ''} aria-pressed={theme === 'light'} onClick={() => onThemeChange('light')}>☀ ライト</button>
    <button type="button" className={theme === 'dark' ? 'selected' : ''} aria-pressed={theme === 'dark'} onClick={() => onThemeChange('dark')}>☾ ダーク</button>
   </div>
  </div>
 </header>;
}
