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


test('C-D01 C-B01 編集: テンプレートダイアログの表示・キャンセル', async ({ page }) => {
 await openEditor(page);
 await page.getByRole('button', { name: 'テンプレートの読み込み…' }).click();
 const dialog = page.getByRole('dialog', { name: 'テンプレートエクスプローラー' });
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('group', { name: 'テンプレートファイル一覧' })).toBeVisible();
 await expect(dialog.getByRole('button', { name: '直接読込' })).toBeDisabled();
 await expect(dialog.getByRole('button', { name: 'サブシナリオ参照' })).toBeDisabled();
 await dialog.getByRole('button', { name: 'キャンセル' }).click();
 await expect(dialog).toHaveCount(0);
});

test('C-D01 C-B01 編集: IF定義ダイアログの項目追加と閉じる操作', async ({ page }) => {
 await openEditor(page);
 await page.getByRole('button', { name: '＋ IF定義', exact: true }).click();
 const dialog = page.getByRole('dialog', { name: 'IF定義の編集' });
 await expect(dialog).toBeVisible();
 await dialog.getByRole('button', { name: '＋ 項目追加' }).click();
 await expect(dialog.getByLabel('項目名')).toHaveCount(1);
 await dialog.getByRole('button', { name: 'IF定義画面を閉じる' }).click();
 await expect(dialog).toHaveCount(0);
});


/** SVG通信線はスクロール外になる場合があるため、再生順パネルで選択する。 */
async function selectEditorStep(page: Page, title: string) {
 await page.getByRole('complementary', { name: '再生順' }).getByRole('button', { name: '1. ' + title }).click();
 await expect(page.getByText('通信設定', { exact: true })).toBeVisible();
}

/** 保存したYAMLをテスト用サーバーに差し替え、実際のローダーで再読込する。 */
test('E-I04 編集: 双方向通信・経由点・再生順のYAML保存と再読込', async ({ page }) => {
 test.setTimeout(90000);
 const { parse } = await import('yaml');
 let currentYaml = fixture();
 await page.route('**/scenario-roots.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify([{ id: '0', label: '検証ディレクトリ' }]),
 }));
 await page.route('**/scenarios/0/manifest.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify(['/scenarios/0/screen.yaml']),
 }));
 await page.route('**/scenarios/0/screen.yaml', route => route.fulfill({
  contentType: 'application/x-yaml', body: currentYaml,
 }));
 await page.route('**/scenarios/0/catalog.json', route => route.fulfill({
  contentType: 'application/json', body: '[]',
 }));
 await test.step('シナリオを読み込む', async () => {
 await page.goto('/');
 await expect(page.getByRole('heading', { name: '画面検証フロー' })).toBeVisible();
 await page.getByRole('button', { name: '✎ フローを編集' }).click();
 await selectEditorStep(page, 'リクエスト');
 });
 await test.step('双方向通信と折れ線を編集する', async () => {
 await expect(page.getByText('通信設定', { exact: true })).toBeVisible();
 await page.getByLabel('接続方向').selectOption('both');
 await page.getByLabel('接続線の形状').selectOption('orthogonal');
 await page.getByLabel('復路送信元').selectOption('api');
 await page.getByLabel('復路送信先').selectOption('web');
 await page.getByLabel('復路通信内容').fill('200 /items');
 });
 await test.step('経由点を追加する', async () => {
 // 経由点は編集UIの右クリックメニューから追加する。
 // SVGの直下にある経由線を右クリックし、親EditorCanvasまでイベントを伝播させる。
 // g要素を直接dispatchEventすると、経路判定がブラウザーのターゲットと異なる場合がある。
 const edge = page.locator('[data-step-id="request"]').first();
 // スクロールコンテナーの外にあるSVGでもメニューの表示位置はブラウザー内に固定する。
 // テスト座標は画面内の固定点を用い、画面外に配置した要素へのクリック待機を避ける。
 await edge.locator('path').first().dispatchEvent('contextmenu', {
  bubbles: true, cancelable: true, clientX: 100, clientY: 100, button: 2,
 });
 const menu = page.getByRole('menu');
 await expect(menu).toBeVisible();
 await expect(menu.getByRole('menuitem', { name: '往路の経由点を追加' })).toBeVisible();
 // 遠方にスクロールしたSVGから開いたメニューでは自動クリックの座標が安定しないため、
 // クリックイベントはメニュー項目自身へ送出してアプリ側の処理を検証する。
 await menu.getByRole('menuitem', { name: '往路の経由点を追加' }).dispatchEvent('click');
 await expect(page.locator('[data-waypoint-step="request"]')).toHaveCount(1);
 });
 await test.step('保存YAMLを検証する', async () => {
 await page.evaluate(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
 const downloadPromise = page.waitForEvent('download');
 await page.getByRole('button', { name: 'YAMLを保存…' }).click();
 const download = await downloadPromise;
 const stream = await download.createReadStream();
 const chunks: Buffer[] = [];
 for await (const chunk of stream) chunks.push(Buffer.from(chunk));
 currentYaml = Buffer.concat(chunks).toString('utf8');
 const saved = parse(currentYaml);
 const request = saved.steps.find((step: { id: string }) => step.id === 'request');
 expect(request.bidirectional).toBe(true);
 expect(request.routing).toBe('orthogonal');
 expect(request.reverseFrom).toBe('api');
 expect(request.reverseTo).toBe('web');
 expect(request.reversePayload).toBe('200 /items');
 expect(request.waypoints.length).toBeGreaterThan(0);
 expect(saved.steps.map((step: { id: string }) => step.id)).toEqual(['request', 'response']);
 });
 await test.step('保存YAMLを再読込して編集値を検証する', async () => {
 await page.getByRole('button', { name: '再生画面へ戻る' }).click();
 await page.getByRole('button', { name: /再読み込み/ }).click();
 await expect(page.getByRole('heading', { name: '画面検証フロー' })).toBeVisible();
 await page.getByRole('button', { name: '✎ フローを編集' }).click();
 await selectEditorStep(page, 'リクエスト');
 await expect(page.getByLabel('接続方向')).toHaveValue('both');
 await expect(page.getByLabel('接続線の形状')).toHaveValue('orthogonal');
 await expect(page.getByLabel('復路通信内容')).toHaveValue('200 /items');
 });
});

test('V-I02 プレビュー: 表示操作で編集元の通信定義を変更しない', async ({ page }) => {
 await openPreview(page);
 await page.getByRole('button', { name: '次へ', exact: true }).click();
 await page.getByRole('button', { name: '2x' }).click();
 await page.getByRole('button', { name: '編集画面に戻る' }).click();
 await selectEditorStep(page, 'リクエスト');
 await expect(page.getByLabel('通信内容')).toHaveValue('GET /items');
 await expect(page.getByLabel('接続方向')).toHaveValue('one');
 await page.getByRole('button', { name: '▶ プレビュー' }).click();
 await expect(page.locator('.preview-step-info')).toContainText('GET /items');
});

test('P-I04 再生: 接続先が存在しないYAMLはエラー表示する', async ({ page }) => {
 await page.route('**/scenario-roots.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify([{ id: '0', label: '検証ディレクトリ' }]),
 }));
 await page.route('**/scenarios/0/manifest.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify(['/scenarios/0/screen.yaml']),
 }));
 await page.route('**/scenarios/0/screen.yaml', route => route.fulfill({
  contentType: 'application/x-yaml', body: fixture().replace('to: api, payload:', 'to: missing, payload:'),
 }));
 await page.route('**/scenarios/0/catalog.json', route => route.fulfill({
  contentType: 'application/json', body: '[]',
 }));
 await page.goto('/');
 await expect(page.getByText(/参照先actorが存在しません/)).toBeVisible();
});


/** 不正なYAML構文が画面のエラー表示へ伝播することを実ブラウザで検証する。 */
test('P-I04 再生: YAML構文不正を画面に表示する', async ({ page }) => {
 await page.route('**/scenario-roots.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify([{ id: '0', label: '検証ディレクトリ' }]),
 }));
 await page.route('**/scenarios/0/manifest.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify(['/scenarios/0/screen.yaml']),
 }));
 await page.route('**/scenarios/0/screen.yaml', route => route.fulfill({
  contentType: 'application/x-yaml', body: 'schemaVersion: "1.0"\nmetadata: [broken\n',
 }));
 await page.route('**/scenarios/0/catalog.json', route => route.fulfill({
  contentType: 'application/json', body: '[]',
 }));
 await page.goto('/');
 await expect(page.getByText(/Flow collection must end|flow collection|YAMLParseError|unexpected end|YAML/i).first()).toBeVisible();
});

/** 参照ファイルからシナリオルート外への移動を禁止する。 */
test('C-I01 再生: サブシナリオの範囲外参照を拒否する', async ({ page }) => {
 await page.route('**/scenario-roots.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify([{ id: '0', label: '検証ディレクトリ' }]),
 }));
 await page.route('**/scenarios/0/manifest.json', route => route.fulfill({
  contentType: 'application/json', body: JSON.stringify(['/scenarios/0/screen.yaml']),
 }));
 const malicious = fixture().replace('  - id: response\n', '  - file: ../../../outside.yaml\n  - id: response\n');
 await page.route('**/scenarios/0/screen.yaml', route => route.fulfill({
  contentType: 'application/x-yaml', body: malicious,
 }));
 await page.route('**/scenarios/0/catalog.json', route => route.fulfill({
  contentType: 'application/json', body: '[]',
 }));
 await page.goto('/');
 await expect(page.getByText(/参照先は \/scenarios\/ 内のファイルに限定されます/)).toBeVisible();
});
