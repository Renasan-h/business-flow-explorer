// index.json は探索対象のディレクトリだけを指定する。
// 静的ホスティングではブラウザからディレクトリ一覧を取得できないため、
// 開発・ビルド前に直下の親シナリオだけをマニフェストへ展開する。
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';
import { parse } from 'yaml';

const root = resolve('public/scenarios');
const indexPath = join(root, 'index.json');
const outputPath = join(root, 'manifest.json');
const config = JSON.parse(await readFile(indexPath, 'utf8'));
if (!config || !Array.isArray(config.directories)) {
 throw new Error('index.json は {"directories":[".","subdir"]} 形式にしてください');
}
const found = new Set();
for (const directory of config.directories) {
 if (typeof directory !== 'string' || !directory.trim()) throw new Error('不正なディレクトリ名です');
 const full = resolve(root, directory);
 if (full !== root && !full.startsWith(root + sep)) throw new Error('scenarios外のパスは指定できません: ' + directory);
 const entries = await readdir(full, { withFileTypes: true });
 for (const entry of entries) {
  // 第2階層以降のファイルや、親定義を持たない断片YAMLは一覧に載せない。
  if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
  const path = join(full, entry.name);
  const parsed = parse(await readFile(path, 'utf8'));
  if (!parsed || parsed.schemaVersion !== '1.0' || !parsed.metadata) continue;
  const urlPath = relative(root, path).split(sep).map(encodeURIComponent).join('/');
  found.add('/scenarios/' + urlPath);
 }
}
await writeFile(outputPath, JSON.stringify([...found].sort(), null, 2) + '\n');
console.log('シナリオマニフェストを生成:', found.size, '件');
