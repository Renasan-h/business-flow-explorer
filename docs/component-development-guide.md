# コンポーネント開発・保守ガイド

## 目的と設計原則
- 画面表示、ユーザー操作、ドメインデータ変換、YAML入出力、描画計算を別責務として扱う。
- Reactコンポーネントは原則propsでデータを受け取り、データ変更はコールバックで親へ通知する。データ所有者を増やさない。
- 保存対象（actors、steps、metadata、groups、interfaces）とUI一時状態（選択、ドラッグ、モーダル、ズーム、パネル最小化）を混同しない。
- JSX内の長いイベント処理や条件分岐は純粋関数または専用コンポーネントに分割する。過剰な抽象化や共通化は避ける。
- 機能変更時は型・保存形式・エディター・プレビュー・再生画面・テスト・文書の影響を確認する。

## 現在の主要コンポーネントと責務
| ファイル | 責務 | 変更時の注意 |
| --- | --- | --- |
| `src/playback/PlaybackScene.tsx` | PixiJSの描画、再生アニメーション、パン・ズーム、ノードクリック | 再生状態は親からpropsで受け取り、Pixiアプリの破棄とイベント解除を確認 |
| `src/playback/CategoryTree.tsx` | カテゴリの再帰表示とツリー生成 | /区切りの階層、カテゴリごとの件数、未分類を維持 |
| `src/playback/types.ts` | 再生モード、テーマ、速度の共有型 | UIとPixiJSの型の整合を維持 |
| `src/editor/PlaybackOrderMarkers.tsx` | 再生順序の線・番号マーカーのSVG表示とキーボード操作 | DnDの状態と並び替えは親が管理。SVGポインターキャプチャを維持 |
| `src/editor/EditorNodes.tsx` | ノードのSVG表示、番号、削除・接続ハンドル | data-actor-idとdata-connection-handleを維持し、操作イベントは親へ委譲 |
| `src/editor/EditorGroups.tsx` | 領域枠、ラベルタブ、リサイズハンドル | data-group-idとdata-group-resizeを維持 |
| `src/editor/EditorEdges.tsx` | 通信線、双方向レーン、経由点、分岐ラベルのSVG表示 | 経路計算はconnectionRoutingを利用。data-step-idとdata-waypoint-indexを維持 |
| `src/editor/EditorCanvas.tsx` | SVG編集領域のスクロールビューポート | refとスクロール座標を維持。SVG本体の描画・イベントはまだ親に残る |
| `src/App.tsx` | シナリオ選択、カテゴリツリー、PixiJS再生画面、編集画面の切替 | 表示ツリーと再生処理は今後さらに分割する。カテゴリは `/` 区切りの再帰階層 |
| `src/FlowEditor.tsx` | エディターのデータ所有、保存、操作の統合、SVGキャンバスと設定フォーム | 現状は責務が多い移行対象。新機能はできるだけ `src/editor/` へ抽出 |
| `src/editor/EditorToolbar.tsx` | 操作モード切替、ノード/領域/IF追加、表示倍率、再生順変更モード | 親が状態を所有。選択解除や表示リセットは親コールバック経由 |
| `src/editor/ActorSettings.tsx` | ノード属性・種類・色・関連資料・座標の編集 | ID変更時は親のrenameActorで通信のfrom/toとreverseFrom/reverseTo、番号・選択を同期更新 |
| `src/editor/StepSettings.tsx` | 通信方向・IF・ペイロード・折れ線の経由点設定 | 手動経由点はワールド座標。経路計算はconnectionRoutingへ委譲 |
| `src/editor/GroupSettings.tsx` | 領域名・色・所属ノード・削除の編集フォーム | 所属ノードIDを維持し、削除は親コールバックに委譲 |
| `src/editor/PlaybackOrderPanel.tsx` | 再生順のDnD・上下移動・選択と削除の操作UI | ステップ配列は親から受け取り、並び替え後はonChangeで親へ通知。表示順と保存順の一致を確認 |
| `src/editor/TemplateImportDialog.tsx` | テンプレートのパス入力・ファイル選択・直接/参照読み込みの操作UI | YAML解析と参照解決は親で実施。モーダル閉鎖時の選択ファイル・エラー状態に注意 |
| `src/editor/InterfaceDefinitionDialog.tsx` | IF定義の名称・説明・項目の編集とファイル選択 | インポート時の構造検証は親のonImportFields。IDの不整合・重複を検査 |
| `src/editor/ScenarioSettings.tsx` | タイトル・ID・説明・階層カテゴリのフォーム | metadata全体を親へ通知。スラッシュ区切りカテゴリを維持 |
| `src/editor/EditorPanel.tsx` | Eclipse風の右側ドック、最小化ボタン、表示内容の切替 | 最小化状態は親が所有。パネル自体は業務データを変更しない |
| `src/editor/selection.ts` | SVGイベントターゲットからノード・通信・領域・空白を判定 | 優先順位はノード→領域→通信→空白。空白は全てnull。純粋関数として維持 |
| `src/FlowPreview.tsx` | エディター内のSVG再生プレビュー | ステップの経由点・双方向・IFの表示と整合させる |
| `src/scenario.ts` | YAML/Zod検証、シナリオ読込、テンプレート参照解決、型定義 | スキーマ変更時は旧YAML互換性、参照の循環、ID重複を確認 |
| `src/connectionRouting.ts` | 通信線の経路計算、経由点、自動配線 | 描画コンポーネントに座標計算を複製しない |
| `src/nodeCatalog.ts` | ノード種別の定義 | 型・アイコンと追加可能なノード種別の整合を維持 |
| `src/NodeIcon.tsx` | ノードアイコン表示 | 既存のノード種別・色との互換性を確認 |
| `src/style.css` | 全体レイアウト、ドック、キャンバス、モーダル等のスタイル | 末尾の上書きが増えているため、今後はコンポーネント単位のCSS分離を優先 |
| `scripts/generate-scenario-manifest.mjs` | シナリオ一覧マニフェスト生成 | ディレクトリ階層とカテゴリの扱いを混同しない |

## 選択状態の仕様（重要）
- `move` モードでノードを選択したら通信・領域を解除する。
- 通信を選択したらノード・領域を解除する。
- 領域を選択したらノード・通信を解除する。
- **キャンバスの空白を押したらノード・通信・領域・複数選択をすべて解除する。** 空白ドラッグのパンは維持する。
- `multi` モードは選択集合 `selectedActors` を使い、範囲選択・Shift追加・一括移動を行う。
- SVGの `data-actor-id`、`data-group-id`、`data-step-id` は選択判定の契約。属性変更時は `resolveEditorSelection` を更新する。
- 右クリックメニューは同じ選択判定を使用する。空白右クリックは編集対象を選ばずキャンバスメニューを表示する。
- ポインターキャプチャにより `click` が別要素へ再ターゲットされるため、選択確定は原則 `pointerdown` で行う。

## 開発手順
1. 変更する責務の所有者を確認し、既存コンポーネントのpropsと状態を把握する。
2. 純粋ロジックを先に分離し、入力・出力・例外を明確化する。
3. 表示だけの共通UIはコンポーネントに分離し、データ変更を親コールバックへ集約する。
4. `npm ci` → `npm run build` を実行する（`tsc --noEmit` とVite buildを含む）。
5. `npm run dev` でマウス操作、最小化、ズーム、保存・再読込、再生表示を確認する。
6. 機能変更に対応するテストと本書を更新する。実行していない確認は未検証と記載する。

## 回帰確認の重点
- ノード選択→空白クリックで右側設定が初期状態へ戻る。
- 通信・領域選択→空白クリックでも解除される。
- ノード・領域・通信のクリックで別種類の設定が混在しない。
- 複数選択の範囲ドラッグ、Shift追加、相対位置を保った一括移動。
- 設定と再生順を独立して最小化・展開でき、右端にドック表示される。
- 色入力が1行で表示され、スウォッチが潰れない。
- 手動折れ線の経由点が保存後も再現される。
- カテゴリの複数階層、テンプレートの直接・参照読み込み。
- 未保存変更の離脱確認、YAML保存、再生画面への切替。

## 今後の段階的な分離候補
- `EditorCanvas`: SVG描画、選択、ドラッグ・パン・ズーム。操作は専用フックへ。
- `EditorInspector`: ノード・通信・領域・シナリオの設定フォーム。
- `PlaybackOrderPanel`: 並べ替えと順序表示（抽出済み）。
- `TemplateImportDialog`、`InterfaceDefinitionDialog`: モーダルUIは抽出済み。YAML検証は親側に残し、サービス化を次段階で行う。
- `ScenarioBrowser`、`PlaybackCanvas`: Appのカテゴリ選択とPixiJS描画。
- 保存処理・参照IDの検証・経路生成はUIから独立したサービス/純粋関数へ。

**移行方針:** 一括で巨大ファイルを分割せず、動作確認可能な責務ごとに段階的に移す。既存YAMLの互換性を優先する。

## 現時点の検証状態
GitHubへの反映のみ。TypeScriptビルド、ブラウザ動作、回帰テストは未実施。

## 2026-11-10 第2段階の実施状況
- 抽出済み: PlaybackOrderPanel、TemplateImportDialog、InterfaceDefinitionDialog、ScenarioSettings。
- 親コンポーネントは保存データ・選択状態・ダイアログ開閉状態を保持する。子コンポーネントは表示とユーザー入力を受け持つ。
- **未抽出**: SVG描画/ポインター操作のEditorCanvas、ノード/通信/領域設定のEditorInspector、ツールバー、AppのPixiJS再生画面。巨大なJSXの機械的移動は操作の回帰リスクがあるため、型チェック・ブラウザ確認を伴う段階に分ける。
- **検証状況**: GitHub上の変更反映のみ。npm run buildおよびブラウザ回帰テストは未実施。

## 2026-11-10 第3段階
- `EditorToolbar` を独立させ、表示リセット・選択解除・テンプレートモーダル開閉を親コールバックに集約。
- `GroupSettings` を独立させ、領域編集の更新を親のsetGroupsへ集約。
- 残作業: `ActorSettings`、`StepSettings`、`EditorCanvas`、Appの再生描画、スタイルのファイル分割。これらはSVGイベント・参照データの相互依存があるため段階的に移行する。
- GitHubコミットのみ。型チェック・ブラウザ操作検証は未実施。

## 2026-11-10 第4段階
- `ActorSettings` と `StepSettings` を分離。Actor ID変更に伴う関連通信・番号・選択の更新は親に保持。
- JSXの条件付きコンポーネントを閉じる `}` が不足していた問題を修正。JSX分割後は必ず構文・型チェックを実施すること。
- 未分離の主要部分: `EditorCanvas`（SVG描画とポインターイベント）、`App.tsx`（PixiJS再生画面）、CSSのコンポーネント別整理。
- 検証: コミットは反映済み。ビルド・ブラウザ動作テストは未実施。

## 2026-11-10 第5段階の実施状況
- PixiJS再生シーンを `src/playback/PlaybackScene.tsx` へ移動。
- シナリオカテゴリツリーを `src/playback/CategoryTree.tsx` へ移動し、共有型を `src/playback/types.ts` に分離。
- SVG編集キャンバスのスクロールコンテナーを `src/editor/EditorCanvas.tsx` へ移動。**SVG描画とポインター操作の移行は未完了**。コンテナーの分離のみで完全分割とはみなさない。
- CSSは依然として `src/style.css` に集中しており、コンポーネント別の整理は未完了。
- 保存/テンプレート参照解決/イベント処理のサービス化、UIの回帰テスト追加も未完了。
- ビルド、ブラウザ操作、GitHub Actionsの成功確認は実施できていない。ローカルで `npm ci && npm run build` を実行し、エラーがあれば修正する。

## 2026-11-10 第6段階: SVG描画の責務分離
- `EditorNodes`、`EditorGroups`、`EditorEdges` にノード・領域・通信線のSVG描画を分離した。
- `FlowEditor` はデータ更新・選択・ドラッグ・パン・再生順マーカー・コンテキストメニュー・保存を引き続き担当する。
- **未完了**: ポインター操作を専用フックに分割、再生順マーカーのコンポーネント化、保存サービスの分離、CSS分割、単体テスト・E2Eテスト追加。
- **ビルド・動作確認未実施**。GitHubへの反映は動作保証を意味しない。特にノード選択、接続線、経由点ドラッグ、グループ移動、右クリック、YAML保存を確認すること。

## 2026-11-10 第7段階
- `PlaybackOrderMarkers` にSVG上の再生順線・番号マーカーを分離。順序変更の状態とポインターの移動/解放は引き続き `FlowEditor` が所有。
- 複数選択モードの空白クリックで `selectedActor`・`selectedStep`・`selectedGroup` も解除するよう修正。
- **残作業**: キャンバスポインター操作のフック化、コンテキストメニュー分離、YAML保存と参照解決のサービス化、CSS整理、単体/E2Eテスト。
- **検証未実施**: npm run build・ブラウザ操作の成功は確認できていない。コミット反映と動作保証は別である。
