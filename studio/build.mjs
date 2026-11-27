import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { sampleProducts } from './samples.mjs';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const landing = await read('request-v3.html');
const mascot = landing.match(/<symbol id="doto"([^>]*)>([\s\S]*?)<\/symbol>/);
if(!mascot) throw Error('Doto mascot missing');
const youtube = await read('api/youtube.mjs');
const assets = {
  '/video-analysis.js': ['text/javascript; charset=utf-8', await read('studio/video-analysis.js')],
  '/youtube.mjs': ['text/javascript; charset=utf-8', youtube],
  '/doto.svg': ['image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"'+mascot[1]+'>'+mascot[2]+'</svg>'],
  '/consult.js': ['text/javascript; charset=utf-8', await read('studio/consult.js')],
  '/': ['text/html; charset=utf-8', landing],
  '/request-v3.html': ['text/html; charset=utf-8', landing],
  '/studio': ['text/html; charset=utf-8', await read('studio/index.html')],
  '/studio.css': ['text/css; charset=utf-8', (await Promise.all(['studio/style.css','studio/consult.css','studio/portfolio.css'].map(read))).join('\n')],
  '/studio.js': ['text/javascript; charset=utf-8', await read('studio/app.js')]
};
for (const sample of sampleProducts()) {
  const content=await readFile(new URL('studio'+sample.img,root));
  assets[sample.img]=['image/webp',content.toString('base64')];
}
const draft = (await read('api/draft.mjs'))
  .replace("import { showcaseVideo } from './youtube.mjs';", () => youtube)
  .replace(/export default async function draft[\s\S]*?(?=export const geminiModelUrl)/, '')
  .replaceAll('export ', '');
const samples=(await read('studio/samples.mjs')).replace('export function sampleProducts','function sampleProducts');
const worker = (await read('studio/worker.mjs'))
  .replace("import { showcaseVideo } from '../api/youtube.mjs';", '')
  .replace("import { assets } from './assets.mjs';", () => 'const assets = ' + JSON.stringify(assets) + ';')
  .replace("import { generateDraft, verifyGeminiKey } from '../api/draft.mjs';", () => draft)
  .replace("import { sampleProducts } from './samples.mjs';", () => samples);
await mkdir(new URL('dist/server/', root), { recursive: true });
await writeFile(new URL('dist/server/index.js', root), worker, 'utf8');
