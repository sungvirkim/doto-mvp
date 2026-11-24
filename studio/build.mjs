import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const landing = await read('request-v3.html');
const mascot = landing.match(/<symbol id="doto"([^>]*)>([\s\S]*?)<\/symbol>/);
if(!mascot) throw Error('Doto mascot missing');
const assets = {
  '/doto.svg': ['image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"'+mascot[1]+'>'+mascot[2]+'</svg>'],
  '/consult.js': ['text/javascript; charset=utf-8', await read('studio/consult.js')],
  '/': ['text/html; charset=utf-8', landing],
  '/request-v3.html': ['text/html; charset=utf-8', landing],
  '/studio': ['text/html; charset=utf-8', await read('studio/index.html')],
  '/studio.css': ['text/css; charset=utf-8', (await read('studio/style.css'))+'\n'+(await read('studio/consult.css'))],
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
