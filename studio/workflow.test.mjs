import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startLocal} from './local.mjs';

test('a client requests two estimates, answers a question and selects one artist',async t=>{
  const dbDir=await mkdtemp(join(tmpdir(),'doto-test-'));
  const server=await startLocal({port:0,dbDir});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dbDir,{recursive:true});});
  const origin='http://127.0.0.1:'+server.address().port;
  function visitor(){
    let cookie='';
    return async(path,data,expected=200)=>{
      const res=await fetch(origin+'/api/'+path,{method:data?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:data&&JSON.stringify(data)});
      if(res.headers.has('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
      const body=await res.json();
      assert.equal(res.status,expected,JSON.stringify(body));
      return body;
    };
  }
  const a=visitor(), b=visitor(), client=visitor(), stranger=visitor();
  const product={artist:'테스트 작가',title:'버추얼 얼굴 커스텀',desc:'기존 모델 얼굴 커스텀과 VRM 세팅',base:200000,option:'표정',extra:20000,days:5,start:'',recommend:true,direct:true};
  const p=(await a('product',product)).id, other=(await b('product',product)).id;
  const short='https://youtu.be/9hE5-98ZeCg?si=share';
  await a('product',{...product,id:p,showcaseUrl:short});
  assert.equal((await client('state')).products.find(item=>item.id===p).showcaseUrl,'https://www.youtube.com/watch?v=9hE5-98ZeCg');
  await a('product',{...product,id:p,showcaseUrl:'https://youtube.com/@artist'},400);
  await a('product',{...product,id:p,showcaseUrl:''});
  assert.equal((await a('state')).products.find(item=>item.id===p).showcaseUrl,'');
  const image='data:image/png;base64,iVBORw0KGgo=';
  const payload={ids:[p,other],description:'첫 방송용 아바타',details:'제작 방식 · 얼굴 성형',img:image,moreImages:[image],quantity:{[p]:2},estimates:{[p]:240000,[other]:200000},deadline:'2027-05-01',budget:300000};
  await client('request',{...payload,estimates:{}},409);
  const {id}=await client('request',payload);
  const received=(await a('state')).projects[0];
  assert.equal(received.details,payload.details);
  assert.deepEqual(received.moreImages,[image]);
  await client('request',{...payload,moreImages:[image,image,image]},400);
  const act=(action,extra={})=>({id,product:p,action,...extra});
  assert.equal((await a('state')).projects[0].quotes.length,1);
  assert.equal((await stranger('state')).projects.length,0);
  await stranger('action',act('question',{note:'확인'}),409);
  await a('action',act('question',{note:'방송 프로그램은 무엇인가요?'}));
  await client('action',act('reply',{note:'VSeeFace'}));
  await a('action',act('quote',{amount:235000,delivery:'2027-04-29'}));
  await client('action',act('accept'));
  const quotes=(await client('state')).projects[0].quotes;
  assert.deepEqual(quotes.map(q=>q.status),['확정','마감']);
  assert.equal(quotes[0].amount,235000);
  assert.equal(quotes[0].messages.length,2);
  await a('product',{...product,id:p,recommend:false});
  await client('request',payload,409);
  await client('request',{...payload,ids:[p],direct:true});
  const multi=await a('product',{...product,options:[{name:'특수 표정',price:10000},{name:'프로그램 세팅',price:30000}]});
  const m=await client('request',{...payload,ids:[multi.id],selections:{[multi.id]:[2,1]},estimates:{[multi.id]:250000}});
  const saved=(await a('state')).projects.find(row=>row.id===m.id).quotes[0];
  assert.equal(saved.amount,250000);
  assert.deepEqual(saved.lines.map(line=>line.count),[2,1]);
  await client('draft',{mode:'request',description:'테스트',approved:true},503);
  const samples=(await client('state')).products.filter(p=>p.sample);
  assert.equal(samples.length,9);
  assert.equal(new Set(samples.map(p=>p.img)).size,9);
  assert.ok(samples.filter(p=>p.methods.includes('오리지널 전신 제작')).length>=3);
  for(const p of samples){
    const res=await fetch(origin+p.img);
    assert.equal(res.headers.get('content-type'),'image/webp');
    const bytes=Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.subarray(0,4).toString(),'RIFF');
    assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  }
  await client('gemini-check',{},400);
  for(const path of ['/','/studio','/studio.js','/studio.css','/consult.js','/youtube.mjs','/doto.svg']) assert.equal((await fetch(origin+path)).status,200);
});

test('a personal Gemini key is checked against the draft model without inviting a generation', async t=>{
  const {verifyGeminiKey,geminiModelUrl}=await import('../api/draft.mjs');
  const mockKey='key-for-automated-test';
  const provider=t.mock.method(globalThis,'fetch',async (url,options)=>{
    assert.equal(url,geminiModelUrl);
    assert.equal(options.headers['x-goog-api-key'],mockKey);
    assert.equal(options.body,undefined);
    return Response.json({supportedGenerationMethods:['generateContent']});
  });
  assert.deepEqual(await verifyGeminiKey(mockKey),{status:200,body:{connected:true}});
  provider.mock.mockImplementation(async()=>new Response('',{status:403}));
  assert.equal((await verifyGeminiKey(mockKey)).status,400);
});

test('public showcase links are canonical video inputs and work without a description',async t=>{
  const {showcaseVideo}=await import('../api/youtube.mjs');
  const {generateDraft}=await import('../api/draft.mjs');
  const id='9hE5-98ZeCg',url='https://www.youtube.com/watch?v='+id;
  for(const link of [url,'youtu.be/'+id+'?t=15','https://m.youtube.com/shorts/'+id,'https://www.youtube.com/live/'+id]){
    assert.deepEqual(showcaseVideo(link),{id,url});
  }
  for(const link of ['https://www.youtube.com/@artist','https://youtu.be.example/'+id,'https://user@youtube.com/watch?v='+id,'https://www.youtube.com/playlist?list=123']){
    assert.equal(showcaseVideo(link),null);
  }
  const google=t.mock.method(globalThis,'fetch',async(_,request)=>{
    const parts=JSON.parse(request.body).contents[0].parts;
    assert.deepEqual(parts[0],{fileData:{fileUri:url,mimeType:'video/mp4'}});
    const text=JSON.stringify({title:'표정 제작',draft:'눈물 표정',options:['하트눈'],scenes:[{seconds:8,observation:'눈동자가 하트로 바뀐다.'}]});
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]});
  });
  const input={mode:'portfolio',description:'',approved:true,showcaseUrl:'https://youtu.be/'+id};
  assert.equal((await generateDraft({...input,approved:false},'test')).status,400);
  assert.equal((await generateDraft({...input,mode:'request'},'test')).status,400);
  assert.equal((await generateDraft({...input,showcaseUrl:'invalid'},'test')).status,400);
  assert.equal(google.mock.callCount(),0);
  const {body}=await generateDraft(input,'test');
  assert.deepEqual(body.options,['하트눈']);
  assert.equal(body.scenes[0].seconds,8);
  google.mock.mockImplementation(async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({title:'추정',draft:'추정',options:['추정'],scenes:[]})}]}}]}));
  assert.equal((await generateDraft(input,'test')).status,422);
  google.mock.mockImplementation(async()=>new Response('',{status:400}));
  assert.match((await generateDraft(input,'test')).body.error,/전체 공개/);
});

test('pasting a showcase starts analysis and connecting a key resumes a waiting clip once',async()=>{
  const {videoAnalysis}=await import('./video-analysis.js');
  let connected=false;
  const jobs=[],reports=[];
  const controller=videoAnalysis({connected:()=>connected,
    analyze:(clip,signal)=>new Promise((resolve,reject)=>jobs.push({clip,signal,resolve,reject})),
    report:(stage,value)=>reports.push([stage,value])});
  const clip={id:'first'},next={id:'next'};
  controller.select(clip);
  assert.equal(reports.at(-1)[0],'connect');
  assert.equal(jobs.length,0);
  connected=true;
  controller.connectionChanged();
  controller.select(clip);
  void controller.start();
  assert.equal(jobs.length,1);
  controller.select(next);
  assert.equal(jobs[0].signal.aborted,true);
  jobs[0].resolve('old');
  jobs[1].resolve('new');
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(reports.filter(([stage])=>stage==='done'),[['done','new']]);
  controller.enable(false);
  controller.select(clip);
  assert.equal(jobs.length,2);
  controller.enable(true);
  jobs[2].reject(Error('공개 설정 확인'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(reports.at(-1),['error','공개 설정 확인']);
  const retry=controller.start();
  jobs[3].resolve('retried');
  await retry;
  assert.deepEqual(reports.at(-1),['done','retried']);
});
