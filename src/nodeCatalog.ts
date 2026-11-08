/** ノード種別とアイコンを画面間で共通化する。絵文字ではなく文字記号を使い、追加ライブラリを不要にする。 */
export const NODE_TYPES = [
 { value: 'person', label: '人物', icon: '◎' },
 { value: 'server', label: 'サーバー', icon: '▤' },
 { value: 'database', label: 'データベース', icon: '◉' },
 { value: 'service', label: 'サービス', icon: '⚙' },
 { value: 'browser', label: 'ブラウザ', icon: '▣' },
 { value: 'api', label: 'API', icon: '⇄' },
 { value: 'cloud', label: 'クラウド', icon: '☁' },
 { value: 'network', label: 'ネットワーク', icon: '⌘' },
 { value: 'storage', label: 'ストレージ', icon: '▥' },
 { value: 'queue', label: 'キュー', icon: '≋' },
 { value: 'batch', label: 'バッチ', icon: '⟳' },
 { value: 'external', label: '外部システム', icon: '↗' },
 { value: 'device', label: '端末・機器', icon: '▧' },
 { value: 'document', label: 'ファイル・文書', icon: '▤' },
 { value: 'decision', label: '条件分岐', icon: '◇' },
 { value: 'other', label: 'その他', icon: '●' },
] as const;
export type NodeType = typeof NODE_TYPES[number]['value'];
export const NODE_ICONS = [
 { value: 'person', label: '人物', glyph: '◎' },
 { value: 'server', label: 'サーバー', glyph: '▤' },
 { value: 'database', label: 'DB', glyph: '◉' },
 { value: 'service', label: 'サービス', glyph: '⚙' },
 { value: 'browser', label: 'ブラウザ', glyph: '▣' },
 { value: 'api', label: 'API', glyph: '⇄' },
 { value: 'cloud', label: 'クラウド', glyph: '☁' },
 { value: 'network', label: 'ネットワーク', glyph: '⌘' },
 { value: 'storage', label: 'ストレージ', glyph: '▥' },
 { value: 'queue', label: 'キュー', glyph: '≋' },
 { value: 'batch', label: 'バッチ', glyph: '⟳' },
 { value: 'external', label: '外部システム', glyph: '↗' },
 { value: 'device', label: '端末', glyph: '▧' },
 { value: 'document', label: '文書', glyph: '▤' },
 { value: 'decision', label: '分岐', glyph: '◇' },
 { value: 'other', label: 'その他', glyph: '●' },
] as const;
export type NodeIcon = typeof NODE_ICONS[number]['value'];
/** icon未指定の既存YAMLでは種別から表示アイコンを決定する。 */
export function nodeGlyph(type: string, icon?: string): string {
 return NODE_ICONS.find(item => item.value === (icon ?? type))?.glyph ?? '●';
}
