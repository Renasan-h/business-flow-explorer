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

サブシナリオは `@相対パス.yaml` で読み込みます。**記載した順番で再生**され、別ファイルの `order` は全体の順番を変更しません。

```yaml
# public/scenarios/member-registration-modular.yaml
@fragments/member-access.yaml
@fragments/member-initial-data.yaml
@fragments/member-confirm.yaml

schemaVersion: "1.0"
metadata:
  id: member-registration-modular
  title: 会員登録（分割シナリオ例）
  description: 分割ファイルの読み込み例
  category: membership
actorFiles:
  - actors/member-actors.yaml
```

共通Actor定義は `actorFiles` にファイルパスを列挙します。各ファイルは次の形式です。

```yaml
# public/scenarios/actors/member-actors.yaml
actors:
  - id: customer
    name: 顧客
    type: person
  - id: web
    name: Webサーバー
    type: server
```

サブシナリオは `steps` のみでも記述できます。

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

- `@...` は行頭に単独で記述し、参照元ファイルを基準に相対解決します。入れ子のサブシナリオも利用できます。
- `actorFiles` も参照元ファイルからの相対パスです。指定先にはActor定義のみを記述します。
- `actor.id` が重複する場合は統合し、定義が矛盾する場合はエラーになります。
- **サブシナリオ間は参照の記述順**です。同じファイル内で `order` を指定した場合のみ昇順に並び替え、未指定のステップはその後に記述順で配置します。
- 親ファイル自身に `steps` がある場合は、参照したサブシナリオの後に再生されます。
- 循環参照、重複したstep ID、未定義のActor参照はエラーになります。
- 親ファイルには `schemaVersion` と `metadata` が必要です。 `index.json` に登録するのは親ファイルのみです。

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
