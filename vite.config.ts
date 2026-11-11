import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';

type Settings = { scenarioBaseDirectory: string | string[] };
const settingsPath = resolve(process.cwd(), 'setting.config');
const defaultSettings: Settings = { scenarioBaseDirectory: ['./public/scenarios'] };

function readSettings(): Settings {
 if (!existsSync(settingsPath)) {
  writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2) + '\n');
  console.log('setting.config を初期値で作成しました。');
 }
 const value: unknown = JSON.parse(readFileSync(settingsPath, 'utf8'));
 if (!value || typeof value !== 'object' || !('scenarioBaseDirectory' in value) ||
     !(typeof value.scenarioBaseDirectory === 'string' && value.scenarioBaseDirectory.trim() || Array.isArray(value.scenarioBaseDirectory) && value.scenarioBaseDirectory.length > 0 && value.scenarioBaseDirectory.every((item: unknown) => typeof item === 'string' && item.trim()))) {
  throw new Error('setting.config の scenarioBaseDirectory にディレクトリを指定してください');
 }
 return { scenarioBaseDirectory: value.scenarioBaseDirectory };
}

function scenarioFiles(root: string, includeFragments = false): string[] {
 const found: string[] = [];
 const visit = (dir: string) => {
  if (!existsSync(dir)) return;
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
 const configured = typeof settings.scenarioBaseDirectory === 'string' ? [settings.scenarioBaseDirectory] : settings.scenarioBaseDirectory;
 const roots = configured.map(directory => {
  const requested = isAbsolute(directory) ? directory : resolve(process.cwd(), directory);
  if (!existsSync(requested)) throw new Error('シナリオディレクトリが存在しません: ' + directory);
  return realpathSync(requested);
 });
 const handle = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => {
  const pathname = (req.url ?? '').split('?')[0];
  if (!pathname.startsWith('/scenarios/') && pathname !== '/scenario-roots.json') return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  let path: string;
  try { path = decodeURIComponent(pathname.slice('/scenarios/'.length)); }
  catch { res.writeHead(400).end(); return; }
  if (pathname === '/scenario-roots.json') {
   res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
   res.end(JSON.stringify(configured.map((directory, index) => ({ id: String(index), label: directory }))));
   return;
  }
  const match = /^(\\d+)\\/(.*)$/.exec(path);
  if (!match || !roots[Number(match[1])]) { res.writeHead(404).end(); return; }
  const root = roots[Number(match[1])];
  path = match[2];
  if (path === 'catalog.json' || path === 'manifest.json') {
   const data = JSON.stringify(path === 'catalog.json' ? scenarioFiles(join(root, 'template'), true).map(item => '/scenarios/' + match[1] + '/template/' + item.slice('/scenarios/'.length)) : scenarioFiles(root).filter(item => !item.startsWith('/scenarios/template/')).map(item => '/scenarios/' + match[1] + '/' + item.slice('/scenarios/'.length)));
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
