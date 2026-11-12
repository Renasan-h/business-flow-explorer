import { test, expect } from '@playwright/test';

// README・保守ガイド用の固定シナリオ。実ユーザーのファイルは読み込まない。
const yaml = `schemaVersion: "1.0"
metadata:
  id: docs-demo
  title: 注文処理・在庫確認フロー
  description: ドキュメント撮影専用のサンプル
  category: documentation
actors:
  - { id: customer, name: 注文画面, type: browser, position: { x: 180, y: 240 } }
  - { id: api, name: 注文API, type: api, position: { x: 500, y: 240 } }
  - { id: db, name: 注文DB, type: database, position: { x: 820, y: 240 } }
steps:
  - id: order
    title: 注文リクエスト
    description: 注文画面から注文APIへ送信
    actions:
      - { type: transfer, from: customer, to: api, payload: "POST /orders", durationMs: 1200 }
  - id: inventory
    title: 在庫照会
    description: 注文APIが注文DBを照会
    actions:
      - { type: transfer, from: api, to: db, payload: "SELECT stock", durationMs: 1200 }
`;

test.use({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'dark' });

test('README・保守ガイド用スクリーンショットを生成', async ({ page }) => {
 await page.route('**/scenario-roots.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify([{ id: '0', label: 'ドキュメント用' }]),
 }));
 await page.route('**/scenarios/0/manifest.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify(['/scenarios/0/docs-demo.yaml']),
 }));
 await page.route('**/scenarios/0/docs-demo.yaml', route => route.fulfill({
  contentType: 'application/x-yaml', body: yaml,
 }));
 await page.route('**/scenarios/0/catalog.json', route => route.fulfill({
  contentType: 'application/json', body: '[]',
 }));
 await page.goto('/');
 await expect(page.getByRole('heading', { name: '注文処理・在庫確認フロー' })).toBeVisible();
 await expect(page.getByRole('heading', { name: '注文リクエスト' })).toBeVisible();
 await page.screenshot({ path: 'docs/images/overview.png', animations: 'disabled' });

 await page.getByRole('button', { name: '✎ フローを編集' }).click();
 await expect(page.getByRole('heading', { name: 'フローエディター' })).toBeVisible();
 await expect(page.locator('[data-actor-id="customer"]')).toBeVisible();
 await page.screenshot({ path: 'docs/images/editor-current.png', animations: 'disabled' });

 await page.getByRole('button', { name: '複数ノード選択・移動' }).click();
 await page.getByRole('button', { name: 'すべて選択' }).click();
 await expect(page.getByText('3件選択中')).toBeVisible();
 await page.screenshot({ path: 'docs/images/editor-multiselect.png', animations: 'disabled' });

 await page.getByRole('button', { name: '選択解除' }).click();
 await page.getByRole('button', { name: '移動・選択' }).click();
 await page.getByRole('button', { name: '▶ プレビュー' }).click();
 await expect(page.getByRole('heading', { name: 'プレビュー：注文処理・在庫確認フロー' })).toBeVisible();
 await page.screenshot({ path: 'docs/images/preview-current.png', animations: 'disabled' });
});
