import { test, expect, type Page } from '@playwright/test';

/** 外部ファイル・ネットワークに依存しない、画面ごとの検証用シナリオ。 */
const fixture = (title = '画面検証フロー') => `schemaVersion: "1.0"
metadata:
  id: screen-e2e
  title: ${title}
  description: 画面検証用
  category: 品質/画面
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
    description: WebからAPI
    actions:
      - { type: transfer, from: web, to: api, payload: "GET /items", durationMs: 12000 }
  - id: response
    title: レスポンス
    description: APIからWeb
    actions:
      - { type: transfer, from: api, to: web, payload: "200 OK", durationMs: 12000 }
`;

/** HTTPレスポンスをテスト内で保持し、再読み込みの更新も再現する。 */
async function openFixture(page: Page) {
 let title = '画面検証フロー';
 await page.route('**/scenario-roots.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify([{ id: '0', label: '検証ディレクトリ' }]),
 }));
 await page.route('**/scenarios/0/manifest.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify(['/scenarios/0/screen.yaml']),
 }));
 await page.route('**/scenarios/0/screen.yaml', route => route.fulfill({
  contentType: 'application/x-yaml', body: fixture(title),
 }));
 await page.route('**/scenarios/0/catalog.json', route => route.fulfill({
  contentType: 'application/json', body: '[]',
 }));
 await page.goto('/');
 await expect(page.getByRole('heading', { name: title })).toBeVisible();
 return { changeTitle: (value: string) => { title = value; } };
}

async function openEditor(page: Page) {
 await openFixture(page);
 await page.getByRole('button', { name: '✎ フローを編集' }).click();
 await expect(page.getByRole('heading', { name: 'フローエディター' })).toBeVisible();
}

async function openPreview(page: Page) {
 await openEditor(page);
 await page.getByRole('button', { name: '▶ プレビュー' }).click();
 await expect(page.getByRole('heading', { name: 'プレビュー：画面検証フロー' })).toBeVisible();
}

test('P-D01 再生: 基本表示', async ({ page }) => {
 await openFixture(page);
 await expect(page.getByRole('combobox', { name: '表示中ディレクトリ' })).toHaveValue('0');
 await expect(page.getByRole('complementary', { name: 'シナリオ一覧' })).toBeVisible();
 await expect(page.getByRole('button', { name: '1. リクエスト' })).toBeVisible();
 await expect(page.locator('.scene canvas')).toBeVisible();
 await expect(page.getByText('STEP 1 / 2')).toBeVisible();
});

test('P-D02 再生: デスクトップではシナリオ一覧の閉じるボタンを非表示', async ({ page }) => {
 await page.setViewportSize({ width: 1440, height: 900 });
 await openFixture(page);
 await expect(page.locator('.scenario-menu-close')).toBeHidden();
});

test('P-D03 再生: モバイルの一覧を開閉', async ({ page }) => {
 await page.setViewportSize({ width: 600, height: 850 });
 await openFixture(page);
 await page.getByRole('button', { name: 'シナリオ一覧を開く' }).click();
 await expect(page.locator('.scenario-sidebar')).toHaveClass(/is-open/);
 await expect(page.locator('.scenario-menu-close')).toBeVisible();
 await page.locator('.scenario-menu-close').click();
 await expect(page.locator('.scenario-sidebar')).not.toHaveClass(/is-open/);
});

test('P-D05 P-I01 再生: 配色テーマの表示と永続化', async ({ page }) => {
 await openFixture(page);
 await page.getByRole('button', { name: '☀ ライト' }).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
 expect(await page.evaluate(() => localStorage.getItem('business-flow-theme'))).toBe('light');
 await page.getByRole('button', { name: '☾ ダーク' }).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
 expect(await page.evaluate(() => localStorage.getItem('business-flow-theme'))).toBe('dark');
});

test('P-B02 再生: 再生・停止・速度・先頭へ戻る', async ({ page }) => {
 await openFixture(page);
 await page.getByRole('button', { name: '2x' }).click();
 await expect(page.getByRole('button', { name: '2x' })).toHaveAttribute('aria-pressed', 'true');
 await page.getByRole('button', { name: '▶ 再生' }).click();
 await expect(page.getByRole('button', { name: '⏸ 一時停止' })).toBeVisible();
 await page.getByRole('button', { name: '⏸ 一時停止' }).click();
 await expect(page.getByRole('button', { name: '▶ 再生' })).toBeVisible();
 await page.getByRole('button', { name: '次へ ▶' }).click();
 await expect(page.getByText('STEP 2 / 2')).toBeVisible();
 await page.getByRole('button', { name: '↺', exact: true }).click();
 await expect(page.getByText('STEP 1 / 2')).toBeVisible();
});

test('P-B03 再生: 拡大縮小・等倍', async ({ page }) => {
 await openFixture(page);
 const controls = page.getByRole('group', { name: '表示倍率と移動' });
 await controls.getByRole('button', { name: '拡大' }).click();
 await expect(controls.getByText('120%')).toBeVisible();
 await controls.getByRole('button', { name: '縮小' }).click();
 await expect(controls.getByText('100%')).toBeVisible();
 await controls.getByRole('button', { name: '等倍' }).click();
 await expect(controls.getByText('100%')).toBeVisible();
});

test('P-I02 再生: 再読み込みで更新されたYAMLを取得', async ({ page }) => {
 const server = await openFixture(page);
 server.changeTitle('更新後フロー');
 await page.getByRole('button', { name: /再読み込み/ }).click();
 await expect(page.getByRole('heading', { name: '更新後フロー' })).toBeVisible();
});

test('N-D01 N-B01 新規作成: 空のキャンバスとノード追加', async ({ page }) => {
 await openFixture(page);
 await page.getByRole('button', { name: '＋ 新規フロー作成' }).click();
 await expect(page.getByRole('heading', { name: '新規フロー作成' })).toBeVisible();
 await expect(page.getByRole('img', { name: '編集可能なノード接続図' })).toBeVisible();
 await expect(page.locator('[data-actor-id]')).toHaveCount(0);
 await expect(page.getByRole('complementary', { name: '設定' })).toBeVisible();
 await expect(page.getByRole('complementary', { name: '再生順' })).toBeVisible();
 await page.getByRole('button', { name: '＋ ノード追加' }).click();
 await expect(page.locator('[data-actor-id]')).toHaveCount(1);
});

test('N-I01 新規作成: 必須情報が不足したYAML保存を拒否', async ({ page }) => {
 await openFixture(page);
 await page.getByRole('button', { name: '＋ 新規フロー作成' }).click();
 const downloads: string[] = [];
 page.on('download', download => downloads.push(download.suggestedFilename()));
 await page.getByRole('button', { name: 'YAMLを保存…' }).click();
 await expect(page.getByRole('status')).toBeVisible();
 expect(downloads).toHaveLength(0);
});

test('E-D01 編集: SVG・設定・再生順が表示される', async ({ page }) => {
 await openEditor(page);
 await expect(page.getByRole('img', { name: '編集可能なノード接続図' })).toBeVisible();
 await expect(page.getByRole('complementary', { name: '設定' })).toBeVisible();
 await expect(page.getByRole('complementary', { name: '再生順' })).toBeVisible();
 await expect(page.locator('[data-step-id="request"]')).toHaveCount(1);
});

test('E-D02 編集: 設定と再生順の最小化・展開', async ({ page }) => {
 await openEditor(page);
 for (const name of ['設定', '再生順']) {
  const panel = page.getByRole('complementary', { name });
  await panel.getByRole('button', { name: name + 'パネルを最小化' }).click();
  await expect(panel).toHaveClass(/is-collapsed/);
  await panel.getByRole('button', { name: name + 'パネルを展開' }).click();
  await expect(panel).not.toHaveClass(/is-collapsed/);
 }
});

test('E-B05 編集: 通信線非表示でも通信ステップは残る', async ({ page }) => {
 await openEditor(page);
 await page.getByRole('checkbox', { name: '通信線表示' }).uncheck();
 await expect(page.locator('[data-step-id="request"]')).toHaveCount(0);
 await expect(page.getByRole('complementary', { name: '再生順' })).toContainText('リクエスト');
 await page.getByRole('checkbox', { name: '通信線表示' }).check();
 await expect(page.locator('[data-step-id="request"]')).toHaveCount(1);
});

test('E-B06 E-I01 編集: シナリオタイトルの変更が保存YAMLに含まれる', async ({ page }) => {
 await openEditor(page);
 await page.getByText('シナリオ設定', { exact: true }).click();
 await page.getByLabel('タイトル', { exact: true }).fill('変更後のタイトル');
 await page.evaluate(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
 const downloadPromise = page.waitForEvent('download');
 await page.getByRole('button', { name: 'YAMLを保存…' }).click();
 const download = await downloadPromise;
 const stream = await download.createReadStream();
 const chunks: Buffer[] = [];
 for await (const chunk of stream) chunks.push(Buffer.from(chunk));
 const yaml = Buffer.concat(chunks).toString('utf8');
 expect(yaml).toContain('変更後のタイトル');
 expect(yaml).toContain('GET /items');
 expect(yaml).toContain('web');
});

test('E-I03 編集: 未保存変更を破棄する際の確認', async ({ page }) => {
 await openEditor(page);
 await page.getByRole('button', { name: '＋ ノード追加' }).click();
 page.once('dialog', async dialog => {
  expect(dialog.type()).toBe('confirm');
  await dialog.dismiss();
 });
 await page.getByRole('button', { name: '再生画面へ戻る' }).click();
 await expect(page.getByRole('heading', { name: 'フローエディター' })).toBeVisible();
});

test('V-D01 V-I01 プレビュー: SVG・一覧・詳細がステップに同期する', async ({ page }) => {
 await openPreview(page);
 await expect(page.locator('.preview-canvas')).toBeVisible();
 await expect(page.locator('.preview-steps')).toContainText('リクエスト');
 await expect(page.locator('.preview-step-info')).toContainText('GET /items');
 await page.getByRole('button', { name: '次へ', exact: true }).click();
 await expect(page.locator('.preview-step-info')).toContainText('200 OK');
 await expect(page.locator('.preview-step-info')).toContainText('2 / 2');
});

test('V-B01 プレビュー: 前後・速度・通信線切替・編集へ戻る', async ({ page }) => {
 await openPreview(page);
 await page.getByRole('button', { name: '2x' }).click();
 await expect(page.getByRole('button', { name: '2x' })).toHaveAttribute('aria-pressed', 'true');
 await page.getByRole('checkbox', { name: '全体の接続' }).uncheck();
 await expect(page.getByRole('checkbox', { name: '全体の接続' })).not.toBeChecked();
 await page.getByRole('button', { name: '次へ', exact: true }).click();
 await page.getByRole('button', { name: '前へ', exact: true }).click();
 await expect(page.locator('.preview-step-info')).toContainText('1 / 2');
 await page.getByRole('button', { name: '編集画面に戻る' }).click();
 await expect(page.getByRole('heading', { name: 'フローエディター' })).toBeVisible();
});

test('V-B02 プレビュー: 再生停止と表示倍率変更', async ({ page }) => {
 await openPreview(page);
 await page.getByRole('button', { name: '▶ 再生' }).click();
 await expect(page.getByRole('button', { name: '一時停止' })).toBeVisible();
 await page.getByRole('button', { name: '一時停止' }).click();
 await expect(page.getByRole('button', { name: '▶ 再生' })).toBeVisible();
 await page.locator('.preview-toolbar').getByRole('button', { name: '＋' }).click();
 await expect(page.locator('.preview-toolbar')).toContainText('120%');
 await page.getByRole('button', { name: '表示リセット' }).click();
 await expect(page.locator('.preview-toolbar')).toContainText('100%');
});
