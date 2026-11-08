# 開発・保守ガイド（新人エンジニア向け）

この資料は「どのファイルを変更すればよいか」「データがどこから来てどこへ流れるか」を理解するための入口です。最初に `src/scenario.ts` の型、次に `src/App.tsx` の画面切替、最後に編集・描画処理を読むと追いやすくなります。

## 1. 画面とファイルの役割

| ファイル | 主な責務 | 変更するとき |
| --- | --- | --- |
| `src/App.tsx` | シナリオ選択、再生状態、PixiJSによる通常再生画面、編集画面への遷移 | 通常再生の操作や画面切替を変更するとき |
| `src/FlowEditor.tsx` | ノード・通信の追加/編集/削除、ドラッグ、再生順の並び替え、YAML保存 | 編集操作や入力項目を変更するとき |
| `src/FlowPreview.tsx` | 保存前データのSVG表示、再生確認、ステップ一覧 | プレビューの表示・操作を変更するとき |
| `src/scenario.ts` | YAMLのZod検証、外部ファイルの再帰展開、Scenario型 | YAMLの項目や読み込み規則を変更するとき |
| `src/connectionRouting.ts` | 直線/折れ線の座標計算、送受信2レーン、パケット位置 | エディターとプレビューの配線を変更するとき |
| `src/layout.ts` | 座標未指定ノードの自動配置 | ノードの初期配置を変更するとき |
| `src/style.css` | 各画面の見た目、レスポンシブ対応 | ボタン・パネル・表示崩れを修正するとき |

**注意:** 通常再生画面はPixiJS、エディターとプレビューはSVGで描画しています。現時点では描画方式が共通化されていないため、配線仕様を変える場合は両方を確認してください。

## 2. データの流れ

```text
public/scenarios/index.json
  ↓ シナリオの一覧
public/scenarios/*.yaml
  ↓ scenario.ts: 読込 → Zod検証 → ファイル参照展開 → 自動配置
Scenario { metadata, actors[], steps[] }
  ├─ App.tsx → PixiJSのScene → 通常再生
  └─ FlowEditor.tsx → actors/stepsをコピーして編集
       ├─ FlowPreview.tsx → 保存前データを再生確認
       └─ YAML保存 → ユーザーの端末に出力
```

編集画面での変更は通常再生画面のScenarioを直接更新しません。YAML保存もブラウザからのファイル出力であり、GitHubや`index.json`への自動登録ではありません。

## 3. 主なデータ

- **Actor（ノード）**: `id`（参照キー）、`name`（表示名）、`type`（種類）、`position`（座標）。
- **Step（再生ステップ）**: `id`、`title`、`description`、`actions`、`routing`（任意）。
- **Action（通信）**: `from`、`to` はActorのID、`payload` は通信内容、`durationMs` は再生時間。
- **再生順**: `steps`配列の順番がそのまま再生順です。並び替えでは配列を変更します。
- **配線形状**: `routing`未指定は直線、`orthogonal`は折れ線。エディターとプレビューは同じ経路計算を使います。

## 4. よくある変更の追い方

### 接続線を追加するとき

1. `FlowEditor.tsx` の接続ハンドル操作で送信元と送信先を決定します。
2. `addConnection` が新しい通信Stepを`steps`へ追加します。
3. `connectionRouting.ts` がノード外周間の経路を求め、`offsetRoute`で送受信2レーンを作ります。
4. `FlowPreview.tsx` は同じ編集データを受け取り、経路に沿ってパケットを移動します。

### ステップを並び替え・削除するとき

`FlowEditor.tsx` の`setSteps`で配列を更新します。削除は`deleteStep`を経由させ、選択中IDなどの表示状態も整理します。プレビューからの削除は親の`onDeleteStep`を呼び出します。

### YAMLの項目を追加するとき

1. `scenario.ts` のZodスキーマと型に項目を追加します。
2. エディターの入力欄・保存内容を更新します。
3. プレビューと通常再生画面の両方で必要な表示を更新します。
4. 既存のYAMLが読み込めるかを確認します。互換性が必要な項目は原則optionalにします。

## 5. ReactとPixiJSの役割

Reactの`useState`は、選択中のノード、再生ステップ、再生/停止など画面の状態を保持します。更新には`setState`を使用し、配列やオブジェクトを直接変更しません。

通常再生の`Scene`では、PixiJSのTickerが毎フレーム実行されます。Reactの再描画ごとにTickerを作り直さないよう、`useRef`に最新の再生状態を同期しています。パケットの現在位置は経過時間と通信時間から計算します。

SVGの編集画面では、マウスの画面座標とノードのワールド座標が異なります。ドラッグ操作ではズームとパンを考慮した座標変換が必要です。ノードを選択できない場合は、SVGのpointer captureによるイベントの再ターゲットにも注意してください。

## 6. 変更時の確認項目

- ノードを追加・移動・削除しても通信線と選択状態が破綻しないか
- 接続線が標準で直線、任意設定で折れ線になるか
- 送信/受信の2本線が編集・プレビュー・通常再生で意図どおりか
- 再生ステップの並び替え・削除後も番号とプレビュー再生順が一致するか
- 編集画面・プレビューから元の画面へ戻れるか
- 保存したYAMLが再度読み込めるか
- `npm run build` が成功するか（現時点ではこの資料作成に伴うビルドは未実施）

## 7. 現在の制約と改善候補

- 通常再生画面（PixiJS）と編集・プレビュー（SVG）の描画実装は別々です。表示仕様を共通化する設計改善の余地があります。
- プレビューは各ステップの先頭Actionのみをアニメーションします。
- 直線は途中の別ノードを自動迂回しません。折れ線は手動で選択します。
- YAML保存はファイル出力のみです。シナリオ一覧への自動反映はありません。
- このガイドとコメントは処理の理解を助けるものであり、ビルドやブラウザの動作検証の代わりにはなりません。

## 8. ノードの汎用属性とアイコン

`src/nodeCatalog.ts`にノード種別をまとめています。表示アイコンは種類から自動決定されるため、個別のアイコン選択は不要です。

ノードのYAML例:

```yaml
- id: api-gateway
  name: API Gateway
  type: api
  description: 外部リクエストの認証とルーティング
  environment: production
  endpoint: https://api.example.com
  instanceName: gateway-01
  ip: 192.0.2.10
  tags: [認証, 外部公開]
  position: { x: 300, y: 200 }
```

`description`、`environment`、`endpoint`、`tags`、`instanceName`、`ip`は任意項目です。既存YAMLに`icon`が残っていても読み込み可能ですが、表示には`type`の標準アイコンを使用し、編集後の保存時には`icon`を出力しません。

新しい種類を増やす場合は`nodeCatalog.ts`を、対応する線画を追加する場合は`nodeIconShapes.ts`を編集してください。YAMLの検証は`scenario.ts`、編集UIは`FlowEditor.tsx`、表示は`App.tsx`と`FlowPreview.tsx`で共通の`nodeGlyph`を利用します。
