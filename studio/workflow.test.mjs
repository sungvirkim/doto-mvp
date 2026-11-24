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
  const payload={ids:[p,other],description:'첫 방송용 아바타',quantity:{[p]:2},estimates:{[p]:240000,[other]:200000},deadline:'2027-05-01',budget:300000};
  await client('request',{...payload,estimates:{}},409);
  const {id}=await client('request',payload);
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
  for(const path of ['/','/studio','/studio.js','/studio.css']) assert.equal((await fetch(origin+path)).status,200);
});
