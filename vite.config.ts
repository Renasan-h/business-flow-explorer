import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';

type Settings = { scenarioBaseDirectory: string };
const settingsPath = resolve(process.cwd(), 'setting.config');
const defaultSettings: Settings = { scenarioBaseDirectory: './public/scenarios' };

function readSettings(): Settings {
 if (!existsSync(settingsPath)) {
  writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2) + '\n');
  console.log('setting.config を初期値で作成しました。');
 }
 const value: unknown = JSON.parse(readFileSync(settingsPath, 'utf8'));
 if (!value || typeof value !== 'object' || !('scenarioBaseDirectory' in value) ||
     typeof value.scenarioBaseDirectory !== 'string' || !value.scenarioBaseDirectory.trim()) {
  throw new Error('setting.config の scenarioBaseDirectory にディレクトリを指定してください');
 }
 return { scenarioBaseDirectory: value.scenarioBaseDirectory };
}

function scenarioFiles(root: string, includeFragments = false): string[] {
 const found: string[] = [];
 const visit = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
   if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
   const path = join(dir, entry.name);
   if (entry.isDirectory()) visit(path);
   else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
    try {
     const data = parse(readFileSync(path, 'utf8'));
     if (includeFragments || (data?.schemaVersion === '1.0' && data?.metadata)) {
      found.push('/scenarios/' + relative(root, path).split(sep).map(encodeURIComponent).join('/'));
     }
    } catch (error) {
     console.warn('シナリオ一覧から除外:', path, error);
    }
   }
  }
 };
 visit(root);
 return found.sort();
}

function scenarioDirectoryPlugin(): Plugin {
 const settings = readSettings();
 const configured = settings.scenarioBaseDirectory;
 const requestedRoot = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
 if (!existsSync(requestedRoot)) throw new Error('シナリオディレクトリが存在しません: ' + configured);
 const root = realpathSync(requestedRoot);
 const handle = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => {
  const pathname = (req.url ?? '').split('?')[0];
  if (!pathname.startsWith('/scenarios/')) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  let path: string;
  try { path = decodeURIComponent(pathname.slice('/scenarios/'.length)); }
  catch { res.writeHead(400).end(); return; }
  if (path === 'catalog.json' || path === 'manifest.json') {
   const data = JSON.stringify(scenarioFiles(root, path === 'catalog.json'));
   res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
   res.end(req.method === 'HEAD' ? undefined : data);
   return;
  }
  if (!/\.ya?ml$/i.test(path) || path.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) || path.includes('\\')) {
   res.writeHead(404).end(); return;
  }
  const full = resolve(root, path);
  if (!full.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
   const actual = realpathSync(full);
   if (!actual.startsWith(root + sep) || !/\.ya?ml$/i.test(extname(actual))) { res.writeHead(403).end(); return; }
   const content = readFileSync(actual);
   res.writeHead(200, { 'Content-Type': 'text/yaml; charset=utf-8', 'Cache-Control': 'no-store' });
   res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404).end(); }
 };
 return {
  name: 'scenario-directory',
  configureServer(server) { server.middlewares.use(handle); },
  configurePreviewServer(server) { server.middlewares.use(handle); },
 };
}

export default defineConfig({ plugins: [react(), scenarioDirectoryPlugin()] });
