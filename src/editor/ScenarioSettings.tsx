import type { Scenario } from '../scenario';

/** シナリオのメタデータ編集フォーム。カテゴリの階層区切りはスラッシュ。 */
export default function ScenarioSettings({ metadata, onChange }: {
 metadata: Scenario['metadata'];
 onChange: (metadata: Scenario['metadata']) => void;
}) {
 const setMetadata = (update: (current: Scenario['metadata']) => Scenario['metadata']) => onChange(update(metadata));
 return <>
    <details className="editor-section"><summary>シナリオ設定</summary>
    <label>タイトル<input value={metadata.title} onChange={e => setMetadata(v => ({ ...v, title: e.target.value }))}/></label>
    <label>ID<input value={metadata.id} onChange={e => setMetadata(v => ({ ...v, id: e.target.value }))}/></label>
    <label>説明<textarea value={metadata.description} onChange={e => setMetadata(v => ({ ...v, description: e.target.value }))}/></label>
    <label>カテゴリ（/ 区切りで階層化）<input value={metadata.category} onChange={e => setMetadata(v => ({ ...v, category: e.target.value }))} placeholder="例: 業務/受注/決済"/></label>
    </details>
 </>;
}
