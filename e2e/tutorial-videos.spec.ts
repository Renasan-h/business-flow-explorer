import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// 各テストを独立したWebMとして録画し、Actionsで個別のGIFに変換する。
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, video: 'on', colorScheme: 'dark' });
test.describe.configure({ mode: 'serial' });

const yaml = `schemaVersion: "1.0"
metadata:
  id: tutorial
  title: 注文処理シナリオ
  description: 操作説明用の固定データ
  category: documentation
actors:
  - { id: web, name: Webクライアント, type: browser, position: { x: 1650, y: 850 } }
  - { id: api, name: APIサーバー, type: api, position: { x: 2050, y: 850 } }
steps:
  - id: request
    title: 注文リクエスト
    description: WebからAPIへ注文を送信
    actions:
      - { type: transfer, from: web, to: api, payload: "POST /orders", durationMs: 1000 }
`;

async function openScenario(page: Page) {
 await page.route('**/scenario-roots.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify([{ id: '0', label: '操作ガイド' }]),
 }));
 await page.route('**/scenarios/0/manifest.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify(['/scenarios/0/tutorial.yaml']),
 }));
 await page.route('**/scenarios/0/tutorial.yaml', route => route.fulfill({
  contentType: 'application/x-yaml', body: yaml,
 }));
 await page.route('**/scenarios/0/catalog.json', route => route.fulfill({
  contentType: 'application/json', body: '[]',
 }));
 await page.goto('/');
 await expect(page.getByRole('heading', { name: '注文処理シナリオ' })).toBeVisible();
}
async function openEditor(page: Page) {
 await openScenario(page);
 await page.getByRole('button', { name: '✎ フローを編集' }).click();
 await expect(page.getByRole('heading', { name: 'フローエディター' })).toBeVisible();
}
async function finish(page: Page, info: TestInfo, name: string) {
 await page.waitForTimeout(900);
 const video = page.video();
 await page.close();
 if (!video) throw new Error('Playwright video recording is disabled');
 const directory = join(process.cwd(), 'test-results', 'tutorial-videos');
 await mkdir(directory, { recursive: true });
 await video.saveAs(join(directory, name + '.webm'));
 await info.attach(name + '.webm', { path: join(directory, name + '.webm'), contentType: 'video/webm' });
}

test('01 新規シナリオ作成', async ({ page }, info) => {
 await openScenario(page);
 await page.waitForTimeout(700);
 await page.getByRole('button', { name: '＋ 新規フロー作成' }).click();
 await expect(page.getByRole('heading', { name: 'フローエディター' })).toBeVisible();
 await page.waitForTimeout(1000);
 await finish(page, info, '01-create-scenario');
});

test('02 Webクライアントノード追加', async ({ page }, info) => {
 await openEditor(page);
 await page.waitForTimeout(500);
 await page.getByRole('button', { name: '＋ ノード追加' }).click();
 await expect(page.getByText('新しいノード 3').first()).toBeVisible();
 await page.getByLabel('表示名').fill('Webクライアント（追加）');
 await expect(page.getByText('Webクライアント（追加）').first()).toBeVisible();
 await finish(page, info, '02-add-web-node');
});

test('03 APIサーバーノード追加', async ({ page }, info) => {
 await openEditor(page);
 await page.waitForTimeout(500);
 await page.getByRole('button', { name: '＋ ノード追加' }).click();
 await page.getByLabel('表示名').fill('APIサーバー（追加）');
 await page.getByRole('button', { name: 'API', exact: true }).click();
 await expect(page.getByText('APIサーバー（追加）').first()).toBeVisible();
 await finish(page, info, '03-add-api-node');
});

test('04 ノードをドラッグして配置', async ({ page }, info) => {
 await openEditor(page);
 const rect = page.locator('[data-actor-id="web"] rect').first();
 await rect.scrollIntoViewIfNeeded();
 const bounds = await rect.boundingBox();
 expect(bounds).not.toBeNull();
 if (!bounds) throw new Error('ノードが表示されていません');
 const x = bounds.x + 35, y = bounds.y + 55;
 const initial = Number(await rect.getAttribute('x'));
 await page.mouse.move(x, y);
 await page.mouse.down();
 await page.mouse.move(x + 100, y + 45, { steps: 15 });
 await page.mouse.up();
 await expect.poll(async () => Number(await rect.getAttribute('x'))).toBeGreaterThan(initial);
 await finish(page, info, '04-drag-node');
});

test('05 通信線を接続', async ({ page }, info) => {
 await openEditor(page);
 // 既存の接続線とは別に、接続操作を見せるためノードを追加する。
 await page.getByRole('button', { name: '＋ ノード追加' }).click();
 const added = page.locator('[data-actor-id]').last();
 await added.locator('rect').first().scrollIntoViewIfNeeded();
 await page.getByRole('button', { name: '通信線を追加' }).click();
 await page.locator('[data-actor-id="web"] rect').first().click({ position: { x: 35, y: 55 } });
 await added.locator('rect').first().click({ position: { x: 35, y: 55 } });
 await expect(page.locator('[data-step-id]')).toHaveCount(2);
 await finish(page, info, '05-connect-nodes');
});

test('06 通信内容を設定', async ({ page }, info) => {
 await openEditor(page);
 const edge = page.locator('[data-step-id="request"] path').first();
 await edge.scrollIntoViewIfNeeded();
 await edge.click({ force: true });
 await expect(page.getByText('通信設定').first()).toBeVisible();
 await page.getByLabel('処理名').fill('注文情報を送信');
 await page.getByLabel('説明').fill('WebクライアントからAPIサーバーに注文データを送信します');
 await expect(page.getByDisplayValue('注文情報を送信')).toBeVisible();
 await finish(page, info, '06-edit-connection');
});

test('07 プレビューで動作確認', async ({ page }, info) => {
 await openEditor(page);
 await page.getByRole('button', { name: '▶ プレビュー' }).click();
 await expect(page.getByRole('heading', { name: 'プレビュー：注文処理シナリオ' })).toBeVisible();
 await page.waitForTimeout(800);
 await page.getByRole('button', { name: '次へ' }).click().catch(() => {});
 await finish(page, info, '07-preview');
});
