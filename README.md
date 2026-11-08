# Business Flow Explorer

業務フローやシステム間のデータのやり取りを、**YAMLで定義してアニメーション表示**するWebアプリケーションです。業務処理の説明やシステム構成の学習、処理順序の確認などに利用できます。

> **開発について**  
> 本プロジェクトは **ChatGPT（OpenAI）を使用して設計・コード作成・修正を行ったプロジェクト**です。生成された内容については、利用目的に応じて動作・品質・安全性を確認してください。

## 主な機能

- シナリオを選択して、ノード間の通信をステップごとにアニメーション表示
- 再生・一時停止・前後のステップ移動・先頭へのリセット
- 再生速度の切り替え（0.5x / 1x / 1.5x / 2x）
- 最終ステップ終了時に自動停止し、再度再生すると最初から開始
- Technical / Illustration の表示スタイル切り替え
- ダーク / ライトテーマの切り替え（ブラウザに選択を保存）
- 通信関係を考慮したノードの自動配置（必要に応じて手動座標も指定可能）

## 起動方法

### 必要な環境

- Node.js と npm（使用するVite 7に対応するNode.jsバージョン）
- Webブラウザ

```bash
git clone https://github.com/Renasan-h/business-flow-explorer.git
cd business-flow-explorer
npm install
npm run dev
```

ターミナルに表示されたローカルURLをブラウザで開いてください。

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | 開発サーバーの起動 |
| `npm run build` | TypeScriptの型チェックと本番ビルド |
| `npm run preview` | ビルド済みアプリのプレビュー |

## 使い方

1. 左側の「シナリオ」から表示したい業務フローを選びます。
2. 「▶ 再生」を押すと、ノード間の通信が順番にアニメーション表示されます。
3. 必要に応じて一時停止、前後移動、ステップ一覧からの直接選択、速度変更を行います。
4. 最終ステップの再生が終わると停止します。「最初から再生」を押すとSTEP 1から再開します。
5. 画面上部から表示スタイル（Technical / Illustration）とテーマ（ダーク / ライト）を変更できます。

### 同梱シナリオ

- **ECサイトの注文処理**：注文受付、在庫照会、決済など
- **経費精算・承認ワークフロー**：申請、承認、経理確認、振込依頼など
- **勤怠管理（月次照会・MVC構成）**：Controller / Service / Repository / DB / View の処理

## 独自シナリオの追加

シナリオは `public/scenarios/` 内のYAMLファイルで管理します。次の例を `public/scenarios/sample.yaml` として保存できます。

```yaml
schemaVersion: "1.0"
metadata:
  id: sample
  title: サンプル注文処理
  description: 顧客からサーバーへ注文を送信する例
  category: sales

actors:
  - id: customer
    name: 顧客
    type: person
  - id: server
    name: 注文サーバー
    type: server
    ip: 10.0.1.10
    instanceName: order-api-01

steps:
  - id: receive-order
    title: 注文受付
    description: 顧客が注文データを送信します。
    actions:
      - type: transfer
        from: customer
        to: server
        payload: 注文データ
        durationMs: 1500
```

次に、`public/scenarios/index.json` にシナリオのパスを追加してください。

```json
[
  "/scenarios/order-processing.yaml",
  "/scenarios/expense-reimbursement.yaml",
  "/scenarios/mvc-attendance-search.yaml",
  "/scenarios/sample.yaml"
]
```

画面に表示するシナリオ名は **`metadata.title`** から取得します。ファイル名を日本語にする必要はありません。

### YAMLの主要項目

| 項目 | 内容 |
| --- | --- |
| `schemaVersion` | 現在は `"1.0"` |
| `metadata` | ID、表示名、説明、カテゴリ |
| `actors` | 登場するノードの定義（2件以上） |
| `actors[].id` | 通信元・通信先として参照する一意のID |
| `actors[].type` | `person` / `server` / `database` / `service` |
| `actors[].ip` / `instanceName` | 任意の補足情報 |
| `actors[].position` | 任意。省略すると自動配置。指定時は `{ x: 120, y: 190 }` の形式 |
| `steps` | 再生する処理の一覧（1件以上） |
| `steps[].actions` | 通信アクション。現状の描画・再生対象は各ステップの**最初のアクション** |
| `actions[].from` / `to` | `actors[].id` で定義した通信元・通信先 |
| `actions[].payload` | 通信時に表示する内容 |
| `actions[].durationMs` | アニメーション時間（ミリ秒、正の数） |

ノード配置は通信関係から自動計算しますが、すべての通信線の交差や重なりを解消することを保証するものではありません。複雑なシナリオでは `position` による調整も可能です。

## サブシナリオと共通Actorファイル

親シナリオの `steps` 配列内で、通常ステップとサブシナリオの参照を混在させられます。**再生順は `steps` の記述順そのもの**です。

```yaml
# public/scenarios/member-registration-modular.yaml
schemaVersion: "1.0"
metadata:
  id: member-registration-modular
  title: 会員登録（分割シナリオ例）
  description: 分割ファイルの読み込み例
  category: membership

actorFiles:
  - actors/member-actors.yaml

steps:
  - file: fragments/member-access.yaml
  - file: fragments/member-initial-data.yaml
  - file: fragments/member-confirm.yaml
```

### サブシナリオ間の通信とデータ引き継ぎ

`steps[].file` に任意の `handoff` を指定すると、**前のステップと読み込み先の間に通信ステップが追加**され、指定したActor間の通信線とアニメーションが表示されます。

```yaml
steps:
  - file: fragments/member-access.yaml
  - file: fragments/member-initial-data.yaml
    handoff:
      from: web
      to: api
      payload: "{{registrationRequest}}"
      durationMs: 1200
  - file: fragments/member-confirm.yaml
    handoff:
      from: db
      to: web
      payload: "{{initialData}}"
      durationMs: 1200
```

前のサブシナリオでは `outputs` に後続へ渡す値を定義します。

```yaml
steps:
  - id: member-access
    title: 会員登録ページへアクセス
    description: 顧客が登録画面を開きます。
    outputs:
      registrationRequest: GET /member/register
    actions:
      - type: transfer
        from: customer
        to: web
        payload: GET /member/register
        durationMs: 1500
```

- `outputs` は文字列のキーと値の組です。後続の `payload` や `outputs` から `{{変数名}}` で参照できます。
- 変数は親シナリオ全体で、先に実行されるステップから後続へ引き継ぎます。同じキーを出力すると後の値で更新します。
- 未定義の変数を参照すると読み込みエラーになります。
- `handoff` の `from` / `to` は明示的に指定します。ファイル間で通信するActorを推測して自動接続することはありません。
- `handoff` を省略した場合は、これまでどおり追加通信なしでステップが連続再生されます。
- これはYAMLの処理結果をシミュレーションする機能です。実際のAPI通信・DB更新や任意コードの実行は行いません。

サブシナリオの内容は通常の `steps` と同じ形式です。1ファイルに複数ステップを定義した場合も、そのファイル内の記述順に展開します。

```yaml
# public/scenarios/fragments/member-access.yaml
steps:
  - id: member-access
    title: 会員登録ページへアクセス
    description: 顧客が登録画面を開きます。
    actions:
      - type: transfer
        from: customer
        to: web
        payload: GET /member/register
        durationMs: 1500
```

共通Actor構成ファイルは `actorFiles` に指定できます。さらに、そのファイルの `actors` 配列から個別のActor定義ファイルを参照できます。

```yaml
# public/scenarios/actors/member-actors.yaml
actors:
  - file: customer.yaml
  - file: web.yaml
  - file: api.yaml
  - file: db.yaml
```

```yaml
# public/scenarios/actors/customer.yaml
actors:
  - id: customer
    name: 顧客
    type: person
```

- `actors` には直接定義と `- file: ...` を混在させられます。参照先からさらにActorファイルを参照することも可能です。
- Actor参照パスは記述元のファイルを基準に解決します。参照先はActor定義専用で、`steps` は含められません。
- シナリオごとに `actorFiles` で必要なActor構成を選べます。読み込んだActorはシナリオ全体で共有され、現時点ではステップごとのノード表示切り替えは行いません。

- `steps: - file: ...` の参照先は、指定元のYAMLファイルからの相対パスです。
- 通常のステップとサブシナリオを任意の順番で混在させられます。
- サブシナリオ内でも別のサブシナリオを参照できます。
- `order` を指定しても並び替えません。再生順は常に `steps` の記述順です。
- `actorFiles` はActor定義専用です。同じActor IDは統合し、矛盾する定義はエラーになります。
- 循環参照、重複したstep ID、未定義のActor参照はエラーになります。
- 親シナリオには `schemaVersion` と `metadata` が必要です。 `index.json` には親ファイルのみ登録します。
- 旧形式のファイル先頭に記述する `@ファイル名` はサポートしません。

## 技術構成

- React 19 / TypeScript
- Vite 7
- PixiJS 8（描画・アニメーション）
- YAML（シナリオ記述）
- Zod（シナリオの形式と参照先の検証）

## 現時点の注意事項

- シナリオは静的なYAMLファイル（単一ファイルまたは分割参照）から読み込みます。**画面からのAI自動生成やYAML編集機能は未実装**です。
- 1ステップに複数のアクションを定義できますが、現在の描画・再生は先頭のアクションを対象とします。
- 開発中のプロジェクトです。環境やシナリオによって表示・動作の確認が必要です。

## ChatGPTの利用について

本プロジェクトは、要件整理、設計案の検討、実装コードの生成、既存コードの修正、ドキュメント作成に **OpenAIのChatGPTを利用**しています。ChatGPTが生成したコードを含むため、導入・改変・運用時には利用者自身による検証を推奨します。
