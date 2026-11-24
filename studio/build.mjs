import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const landing = await read('request-v3.html');
const assets = {
  '/': ['text/html; charset=utf-8', landing],
  '/request-v3.html': ['text/html; charset=utf-8', landing],
  '/studio': ['text/html; charset=utf-8', await read('studio/index.html')],
  '/studio.css': ['text/css; charset=utf-8', await read('studio/style.css')],
  '/studio.js': ['text/javascript; charset=utf-8', await read('studio/app.js')]
};
const draft = (await read('api/draft.mjs'))
  .replace(/export default async function draft[\s\S]*?(?=export async function generateDraft)/, '')
  .replace('export async function generateDraft', 'async function generateDraft');
const worker = (await read('studio/worker.mjs'))
  .replace("import { assets } from './assets.mjs';", () => 'const assets = ' + JSON.stringify(assets) + ';')
  .replace("import { generateDraft } from '../api/draft.mjs';", () => draft);
await mkdir(new URL('dist/server/', root), { recursive: true });
await writeFile(new URL('dist/server/index.js', root), worker, 'utf8');
