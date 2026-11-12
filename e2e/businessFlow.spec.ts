import { test, expect, type Page } from '@playwright/test';

const yaml = `schemaVersion: "1.0"
metadata:
  id: e2e
  title: E2E業務フロー
  description: ブラウザ操作検証
  category: test
actors:
  - id: web
    name: Web
    type: browser
    position: { x: 250, y: 250 }
  - id: api
    name: API
    type: api
    position: { x: 650, y: 250 }
steps:
  - id: request
    title: リクエスト
    description: WebからAPIへ
    actions:
      - { type: transfer, from: web, to: api, payload: "GET /items", durationMs: 1200 }
  - id: response
    title: レスポンス
    description: APIからWebへ
    actions:
      - { type: transfer, from: api, to: web, payload: "200 OK", durationMs: 1200 }
`;

/** CIのテストをローカルファイルや既存シナリオに依存させない。 */
async function openFixture(page: Page) {
 await page.route('**/scenario-roots.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify([{ id: '0', label: 'E2E' }]),
 }));
 await page.route('**/scenarios/0/manifest.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify(['/scenarios/0/e2e.yaml']),
 }));
 await page.route('**/scenarios/0/e2e.yaml', route => route.fulfill({
  contentType: 'application/x-yaml', body: yaml,
 }));
 await page.route('**/scenarios/0/catalog.json', route => route.fulfill({
  contentType: 'application/json', body: '[]',
 }));
 await page.goto('/');
 await expect(page.getByRole('heading', { name: 'E2E業務フロー' })).toBeVisible();
}

test('通常再生: ステップ選択・前後移動・表示切替', async ({ page }) => {
 await openFixture(page);
 await expect(page.getByRole('heading', { name: 'リクエスト' })).toBeVisible();
 await page.getByRole('button', { name: '2. レスポンス' }).click();
 await expect(page.getByRole('heading', { name: 'レスポンス' })).toBeVisible();
 await page.getByRole('button', { name: '現在の通信' }).click();
 await expect(page.getByRole('button', { name: '現在の通信' })).toHaveAttribute('aria-pressed', 'true');
 await page.getByRole('button', { name: '全体の接続' }).click();
 await expect(page.getByRole('button', { name: '全体の接続' })).toHaveAttribute('aria-pressed', 'true');
});

test('編集画面: 複数選択・ノード追加・プレビュー往復', async ({ page }) => {
 await openFixture(page);
 await page.getByRole('button', { name: '✎ フローを編集' }).click();
 await expect(page.getByRole('heading', { name: 'フローエディター' })).toBeVisible();
 await expect(page.getByRole('img', { name: '編集可能なノード接続図' })).toBeVisible();
 await page.getByRole('button', { name: '複数ノード選択・移動' }).click();
 await page.getByRole('button', { name: 'すべて選択' }).click();
 await expect(page.getByText('2件選択中')).toBeVisible();
 await page.getByRole('button', { name: '選択解除' }).click();
 await expect(page.getByText('0件選択中')).toBeVisible();
 await page.getByRole('button', { name: '＋ ノード追加' }).click();
 await expect(page.getByText('新しいノード 3').first()).toBeVisible();
 await page.getByRole('button', { name: '▶ プレビュー' }).click();
 await expect(page.getByRole('heading', { name: 'プレビュー：E2E業務フロー' })).toBeVisible();
 await page.getByRole('button', { name: '次へ' }).click();
 await expect(page.locator('.preview-step-info')).toContainText('2 / 2');
 await page.getByRole('button', { name: '編集画面に戻る' }).click();
 await expect(page.getByRole('heading', { name: 'フローエディター' })).toBeVisible();
});

test('YAML保存: ダウンロード内容を検証する', async ({ page }) => {
 await openFixture(page);
 await page.getByRole('button', { name: '✎ フローを編集' }).click();
 // ChromiumはFile System Access APIに対応するため、ダウンロード経路を明示的に検証する。
 // ブラウザ依存の保存先選択ダイアログを開かず、非対応環境のフォールバックを再現する。
 await page.evaluate(() => {
  Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
 });
 const downloadPromise = page.waitForEvent('download');
 await page.getByRole('button', { name: 'YAMLを保存…' }).click();
 const download = await downloadPromise;
 expect(download.suggestedFilename()).toBe('e2e.yaml');
 const stream = await download.createReadStream();
 const chunks: Buffer[] = [];
 for await (const chunk of stream) chunks.push(Buffer.from(chunk));
 const text = Buffer.concat(chunks).toString('utf8');
 expect(text).toContain('schemaVersion: "1.0"');
 expect(text).toContain('リクエスト');
 expect(text).toContain('Web');
 await expect(page.getByRole('status')).toContainText('ダウンロードしました');
});


test('編集画面: ノードを実際にドラッグして位置を変更する', async ({ page }) => {
 await openFixture(page);
 await page.getByRole('button', { name: '✎ フローを編集' }).click();
 const node = page.locator('[data-actor-id="web"]');
 const rect = node.locator('rect').first();
 const initialX = Number(await rect.getAttribute('x'));
 const initialY = Number(await rect.getAttribute('y'));
 const bounds = await rect.boundingBox();
 expect(bounds).not.toBeNull();
 if (!bounds) return;
 // 中央のアイコン・テキストではなくノード背景を掴む。
 const startX = bounds.x + 35;
 const startY = bounds.y + 55;
 await page.mouse.move(startX, startY);
 await page.mouse.down();
 await page.mouse.move(startX + 85, startY + 40, { steps: 8 });
 await page.mouse.up();
 await expect.poll(async () => Number(await rect.getAttribute('x'))).toBeGreaterThan(initialX + 1);
 await expect.poll(async () => Number(await rect.getAttribute('y'))).toBeGreaterThan(initialY + 1);
 // ドラッグ後も通信線はノードIDを保持し、編集画面で操作できる。
 await expect(page.locator('[data-step-id="request"]')).toHaveCount(1);
});

test('編集画面: ノードの選択後にリサイズハンドルで幅を変更する', async ({ page }) => {
 await openFixture(page);
 await page.getByRole('button', { name: '✎ フローを編集' }).click();
 const node = page.locator('[data-actor-id="web"]');
 const rect = node.locator('rect').first();
 await rect.click({ position: { x: 40, y: 40 } });
 const handle = node.locator('[data-node-resize="web"]');
 await expect(handle).toBeVisible();
 const initialWidth = Number(await rect.getAttribute('width'));
 const bounds = await handle.boundingBox();
 expect(bounds).not.toBeNull();
 if (!bounds) return;
 const x = bounds.x + bounds.width / 2;
 const y = bounds.y + bounds.height / 2;
 await page.mouse.move(x, y);
 await page.mouse.down();
 await page.mouse.move(x + 65, y + 25, { steps: 8 });
 await page.mouse.up();
 await expect.poll(async () => Number(await rect.getAttribute('width'))).toBeGreaterThan(initialWidth);
});
