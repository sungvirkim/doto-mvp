import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import './build.mjs';
const {default: app} = await import('../dist/server/index.js');

export async function startLocal({port=4173, dbDir=fileURLToPath(new URL('../.doto-local',import.meta.url)), key=''}={}) {
  await mkdir(dbDir,{recursive:true});
  const db=new DatabaseSync(join(dbDir,'pilot.sqlite'));
  db.exec('CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, body TEXT NOT NULL, etag TEXT NOT NULL)');
  const get=db.prepare('SELECT body, etag FROM documents WHERE key=?');
  const list=db.prepare('SELECT key FROM documents WHERE key LIKE ? ORDER BY key');
  const put=db.prepare('INSERT OR REPLACE INTO documents (key, body, etag) VALUES (?,?,?)');
  const update=db.prepare('UPDATE documents SET body=?, etag=? WHERE key=? AND etag=?');
  const bucket={
    get(key) {const row=get.get(key); return row && {etag:row.etag,json:()=>JSON.parse(row.body)};},
    list({prefix}) {return {objects:list.all(prefix+'%'),truncated:false};},
    put(key,body,options={}) {
      const etag=randomUUID();
      if(options.onlyIf) return update.run(body,etag,key,options.onlyIf.etagMatches).changes ? {etag} : null;
      put.run(key,body,etag);
      return {etag};
    }
  };
  const server=createServer(async (incoming,outgoing)=>{
    try {
      const host=incoming.headers.host;
      const listenPort=server.address().port;
      if(!['localhost:'+listenPort,'127.0.0.1:'+listenPort].includes(host)) {outgoing.writeHead(403);outgoing.end();return;}
      const origin='http://'+host;
      const tokens=(incoming.headers.cookie||'').match(/(?:^|;\s*)doto_session=([a-f0-9-]{36})(?:;|$)/);
      const uid=tokens?.[1]||randomUUID();
      const headers=new Headers({'oai-authenticated-user-id':uid});
      for(const name of ['content-type','origin']) if(incoming.headers[name])headers.set(name,incoming.headers[name]);
      let chunks=[],size=0;
      for await(const chunk of incoming){size+=chunk.length;if(size>1650000){outgoing.writeHead(413);outgoing.end();return;}chunks.push(chunk);}
      const req=new Request(origin+incoming.url,{method:incoming.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});
      const result=await app.fetch(req,{BUCKET:bucket,GEMINI_API_KEY:key});
      const responseHeaders=Object.fromEntries(result.headers);
      if(!tokens)responseHeaders['Set-Cookie']='doto_session='+uid+'; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict';
      outgoing.writeHead(result.status,responseHeaders);
      outgoing.end(Buffer.from(await result.arrayBuffer()));
    } catch {outgoing.writeHead(500);outgoing.end('Local server error');}
  });
  server.on('close',()=>db.close());
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return server;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  const server=await startLocal({port:Number(process.env.PORT||4173),key:process.env.GEMINI_API_KEY});
  console.log('Doto preview: http://127.0.0.1:'+server.address().port+'/studio');
}
