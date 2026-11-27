import { videoAnalysis } from './video-analysis.js';
import { showcaseVideo } from './youtube.mjs';
import { createIntake, briefDetails, allImages, methods } from './consult.js';
(async function app(){
const main=document.querySelector('#app'), notice=document.querySelector('#notice');
let state,brief={description:'',budget:'',deadline:'',img:'',deadlineFirm:false},timer,selected=new Set(),quantity={},target='',productPhoto='';
try {
  const cached=JSON.parse(sessionStorage.getItem('doto-brief')||'null');
  if(cached && typeof cached.brief?.description==='string'){
    brief=cached.brief;target=cached.target||'';quantity=cached.quantity||{};selected=new Set(cached.selected||[]);
  }
} catch {}
function saveBrief(){try{sessionStorage.setItem('doto-brief',JSON.stringify({brief,target,quantity,selected:[...selected]}))}catch{}}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won=n=>Number(n).toLocaleString('ko-KR')+'원';
const input=(key,label,value='',type='text',attributes='')=>`<label>${label}<input name="${key}" type="${type}" value="${esc(value)}" ${attributes}></label>`;
const check=(key,label,on=false)=>`<label class="check"><input type="checkbox" name="${key}" ${on?'checked':''}>${label}</label>`;
const memo=(key,label,value='',req='')=>`<label>${label}<textarea name="${key}" ${req}>${esc(value)}</textarea></label>`;
const upload=()=>'<label>참고 이미지 <span class="mini">선택 · PNG, JPG, WebP · 1MB 이하</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label>';
const pic=v=>v?`<img class="thumb" src="${esc(v)}" alt="등록된 작업 참고 이미지">`:'';
const hero=(h,p)=>`<div class="hero"><h1>${h}</h1><p>${p}</p></div>`;
const tag=p=>p.sample?'<span class="tag sample">체험용 가상 작가</span>':'';
let personalGeminiKey='';
let videoEditor;
function aiTools(product=false){
  if(state.ai||personalGeminiKey){
    return '<div class="gemini-box"><strong>Gemini 초안</strong><span class="mini"> · '+(state.ai?'도토 공용 연결':'이 탭에서 연결됨')+'</span>' + '<div '+(product?'data-image-controls':'')+'>'+check('approved',product?'이미지와 작업 설명을 Google에 보내 초안을 만들게요.':'선택한 작업 자료와 설명을 Google에 보내 초안을 만들게요.')+'<button type="button" data-ai>'+ (product?'이미지·설명으로 초안 생성':'초안 생성')+'</button></div>'+(!state.ai?'<button type="button" class="text-button" data-unlink>연결 해제</button>':'')+'</div>';
  }
  return '<div class="gemini-box"><label>Gemini API 키<input type="password" data-secret autocomplete="off" spellcheck="false" placeholder="발급받은 API 키를 붙여넣으세요"></label><button type="button" data-connect>연결 확인</button><p role="status" class="mini" data-connection-message></p><p class="mini"><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio에서 키 발급 ↗</a> · 새로고침하면 다시 연결해야 해요.</p></div>';
}
function showcasePlayer(video) {
  if(!video) return '';
  return `<div class="showcase-player"><iframe title="유튜브 쇼케이스 영상" src="https://www.youtube-nocookie.com/embed/${video.id}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><a href="${video.url}" target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a></div>`;
}
function showcaseField(value) {
  const video=showcaseVideo(value);
  return `<div class="showcase-field">${check('autoVideo','공개 영상 링크를 Gemini에 보내 자동 분석',true)}<label>쇼케이스 영상 · 유튜브 링크<input name="showcaseUrl" type="text" inputmode="url" placeholder="유튜브에서 복사한 영상 링크" value="${esc(video?.url)}" maxlength="2048" aria-describedby="showcase-hint"></label><small id="showcase-hint">전체 공개 쇼케이스 주소를 붙여넣으면 표정과 움직임을 분석해요. 자동 분석을 끄면 링크만 등록해요.</small><p class="mini" data-video-error role="status"></p><div data-analysis ${video?'':'hidden'}><p role="status" data-analysis-status>등록된 영상이에요. 다시 분석할 수 있어요.</p><button type="button" data-analyze>영상 분석하기</button><div data-findings></div></div><div data-player data-id="${video?.id||''}">${showcasePlayer(video)}</div></div>`;
}
function updateShowcase(field) {
  const video=showcaseVideo(field.value), wrapper=field.closest('.showcase-field');
  const message=field.value.trim()&&!video?'채널 링크 대신 개별 영상의 공유 링크를 넣어 주세요.':'';
  field.setCustomValidity(message);
  wrapper.querySelector('[data-video-error]').textContent=message;
  const player=wrapper.querySelector('[data-player]');
  if(player.dataset.id!==(video?.id||'')){
    player.innerHTML=showcasePlayer(video);
    player.dataset.id=video?.id||'';
  }
  videoEditor?.select(video);
  syncImageControls(field.form);
}
function syncImageControls(form) {
  const controls = form.querySelector('[data-image-controls]');
  if (controls) controls.hidden = Boolean(showcaseVideo(form.elements.showcaseUrl.value) && form.elements.autoVideo.checked);
}
function attachVideoEditor(form) {
  const panel = form.querySelector('[data-analysis]');
  const status = panel.querySelector('[data-analysis-status]');
  const action = panel.querySelector('[data-analyze]');
  const findings = panel.querySelector('[data-findings]');
  const field = form.elements.showcaseUrl;
  let previous, priorVideoId;
  function clearPrevious() {
    if (!previous) return;
    for (const [key,value] of Object.entries(previous.fields)) {
      if (form.elements[key].value===value) form.elements[key].value='';
    }
    for (const {name,row} of previous.options) {
      if(row.isConnected && row.querySelector('[name=optionName]').value===name && !row.querySelector('[name=optionPrice]').value) row.remove();
    }
    previous=undefined;
  }
  const editor = videoAnalysis({
    initialVideo:showcaseVideo(field.value),
    connected:()=>Boolean(state.ai || personalGeminiKey),
    analyze:(video,signal)=>api('draft',{mode:'portfolio',approved:true,showcaseUrl:video.url,description:''},personalGeminiKey,signal),
    report(stage,payload,video) {
      if (!form.isConnected) return;
      if (priorVideoId!==video?.id) clearPrevious();
      priorVideoId=video?.id;
      const enabled=form.elements.autoVideo.checked;
      panel.hidden=!video || !enabled;
      status.textContent={
        ready:'영상이 준비됐어요.',
        connect:'이 탭에서 Gemini를 먼저 연결해 주세요. 연결되면 이 영상을 바로 분석해요.',
        loading:'Gemini가 영상을 읽고 있어요. 표정과 움직임이 바뀌는 장면을 찾는 중이에요.',
        error:payload,
        done:'영상 분석 완료'
      }[stage];
      action.hidden=stage==='loading'||stage==='done';
      action.textContent=stage==='connect'?'Gemini 연결하기':stage==='error'?'분석 다시 시도':'영상 분석하기';
      findings.replaceChildren();
      if(stage!=='done')return;
      const result=payload;
      const scenes=result.scenes.map(s=>{
        const clock=Math.floor(s.seconds/60)+':'+String(s.seconds%60).padStart(2,'0');
        return '<li><a href="'+video.url+'&amp;t='+s.seconds+'s" target="_blank" rel="noopener noreferrer">'+clock+'</a> '+esc(s.observation)+'</li>';
      }).join('');
      const rows=form.querySelector('[data-rows]');
      const names=new Set([...rows.querySelectorAll('[name=optionName]')].map(el=>el.value.trim()));
      const added=[];
      previous={fields:{},options:[]};
      for(const [key,value] of [['title',result.title],['desc',result.draft]]){
        if(!form.elements[key].value.trim()){
          form.elements[key].value=value;
          previous.fields[key]=value;
        }
      }
      for(const name of result.options){
        if(names.has(name))continue;
        const blank=[...rows.querySelectorAll('[data-option-row]')].find(row=>
          !row.querySelector('[name=optionName]').value.trim()&&!row.querySelector('[name=optionPrice]').value);
        if(blank)blank.querySelector('[name=optionName]').value=name;
        else if(rows.children.length<12)rows.insertAdjacentHTML('beforeend',optionEditor({name}));
        else continue;
        previous.options.push({name,row:blank||rows.lastElementChild});
        names.add(name);added.push(name);
      }
      findings.innerHTML='<strong>영상에서 확인한 장면</strong><ul>'+scenes+'</ul><strong>작업 설명 초안</strong><p>'+esc(result.draft)+'</p>'+
        (result.options.length?'<strong>옵션 후보</strong><p>'+result.options.map(esc).join(' · ')+'</p>':'')+
        (added.length?'<small>옵션에 추가했어요. 발행 전에 단가를 입력해 주세요.</small>':'');
    }
  });
  action.addEventListener('click',()=>{
    const key=form.querySelector('[data-secret]');
    if(key){void editor.start();key.focus();return;}
    void editor.start();
  });
  form.elements.autoVideo.addEventListener('change',()=>{
    editor.enable(form.elements.autoVideo.checked);
    syncImageControls(form);
  });
  syncImageControls(form);
  return editor;
}
function portfolioPhoto(p){
  return p.img?'<img class="portfolio-art" src="'+esc(p.img)+'" alt="'+esc(p.look||p.title)+' 포트폴리오" loading="lazy" decoding="async">':'';
}
function gallery(){
  const products=state.products.filter(p=>p.sample||p.recommend||p.mine);
  return hero('작가 포트폴리오','작업 스타일과 기본가, 착수 가능일을 함께 살펴보세요.')+'<p class="mini gallery-caption">체험 작가의 작품은 AI로 생성한 포트폴리오 예시예요.</p><div class="artist-gallery">'+products.map(p=>'<a class="artist-tile" href="#product/'+esc(p.id)+'">'+portfolioPhoto(p)+'<div class="artist-meta"><span>'+esc(p.artist)+'</span>'+(p.sample?'<small>체험 작가</small>':'')+'</div><h2>'+esc(p.work||p.title)+'</h2><p>'+esc(p.methods?.join(' · ')||p.title)+' · '+won(p.base)+'부터</p><p>착수 '+esc(p.start||'협의')+'</p></a>').join('')+'</div>';
}
function portfolioExamples(){
  const samples=state.products.filter(p=>p.sample);
  const tile=p=>'<figure>'+portfolioPhoto(p)+'<figcaption><b>'+esc(p.work)+'</b><span>'+esc(p.title)+'</span><small>기본 '+won(p.base)+' · '+esc(productOptions(p)[0]?.name||'개별 상담')+'</small></figcaption></figure>';
  return '<aside class="form-examples"><h2>포트폴리오 예시</h2><p class="mini">AI 생성 작품 · 작가별 기본 작업과 옵션</p><div class="example-strip">'+samples.slice(0,3).map(tile).join('')+'</div><details><summary>예시 '+(samples.length-3)+'개 더 보기</summary><div class="example-strip">'+samples.slice(3).map(tile).join('')+'</div></details></aside>';
}
function toast(s){notice.textContent=s;clearTimeout(timer);timer=setTimeout(()=>notice.textContent='',6500)}
async function api(path,data,key='',signal){const r=await fetch('/api/'+path,data?{method:'POST',signal,headers:{'Content-Type':'application/json',...(key?{'x-doto-gemini-key':key}:{})},body:JSON.stringify(data)}:{});const v=await r.json();if(!r.ok)throw Error(v.error||'잠시 후 다시 시도해 주세요.');return v}
async function load(){state=await api('state');render()}
const route=()=>location.hash.slice(1).split('/');
const go=h=>{if(location.hash==='#'+h)render();else location.hash=h};
function login(){return `<a class="btn" target="_top" href="/signin-with-chatgpt?return_to=${encodeURIComponent('/studio'+location.hash)}">로그인하고 계속</a>`}
const cta=(s)=>state.signedIn?`<button>${s}</button>`:login();
const productOptions=p=>p.options??(p.option?[{name:p.option,price:p.extra}]:[]);
function countsFor(p){
  const a=brief.answers||{};
  return productOptions(p).map((row,index)=>{
    if(quantity[p.id]?.[index]!=null)return quantity[p.id][index];
    if(/(특수|추가)\s*표정/.test(row.name))return a.expressions?.length||0;
    if(/arkit/i.test(row.name)&&a.face?.includes('ARKit'))return 1;
    return 0;
  });
}
function price(p){return productOptions(p).reduce((total,row,i)=>total+row.price*countsFor(p)[i],p.base)}
function optionEditor(row={}){return '<div class="fields" data-option-row>'+input('optionName','옵션명',row.name||'','text','maxlength="60"')+input('optionPrice','단가 (원)',row.price??'','number','min="0" max="100000000"')+'<button class="sub small" type="button" data-remove>삭제</button></div>'}
function optionPicker(p){return productOptions(p).map((row,i)=>input('qty','선택 옵션 · '+esc(row.name)+' ('+won(row.price)+'/개)',countsFor(p)[i],'number','min="0" max="20" data-qty="'+esc(p.id)+'" data-index="'+i+'"')).join('')}
function market(){const others=state.products.filter(p=>!p.sample&&!p.mine);if(!others.length)return '<p class="mini">다른 작가의 실제 등록 상품이 쌓이면 기본가 범위를 표시해요.</p>';const prices=others.map(p=>p.base);return '<p class="mini">다른 작가가 공개한 상품 '+prices.length+'개의 기본가 '+won(Math.min(...prices))+' ~ '+won(Math.max(...prices))+' · 작업 범위에 따라 달라요.</p>'}
function delivery(p){if(!p.start)return '';const today=new Date().toISOString().slice(0,10);const d=new Date((p.start>today?p.start:today)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+p.days);return d.toISOString().slice(0,10)}
function fit(p){
  const eta=delivery(p);
  const late=brief.deadline && eta && eta>brief.deadline;
  const over=brief.budget!=='' && price(p)>Number(brief.budget);
  const method=brief.answers?.method;
  const unknown=method && methods.slice(0,4).some(([v])=>v===method) && !p.methods?.includes(method);
  return (unknown?12:0)+(late?(brief.deadlineFirm?8:2):0)+(over?4:0)+(brief.deadline&&!eta?1:0);
}
function quoteCard(p){const over=brief.budget!==''&&price(p)>Number(brief.budget);return `<article>${tag(p)}<a href="#product/${esc(p.id)}" aria-label="${esc(p.artist)} 포트폴리오 보기">${portfolioPhoto(p)}</a><h3><a href="#product/${esc(p.id)}">${esc(p.artist)}</a> · ${esc(p.title)}</h3><p>${esc(p.desc)}</p>${brief.answers?.method && p.methods?.includes(brief.answers.method)?'<p class="mini">제작 방식 일치 · '+esc(brief.answers.method)+'</p>':'<p class="mini">세부 작업 범위는 작가 확인 후 확정돼요.</p>'}${optionPicker(p)}<div class="num">${won(price(p))}</div><p class="mini">${over?'예산 상한 초과 · ':''}${p.start?'착수 가능 '+esc(p.start):'착수일 확인 필요'} · 작업 ${p.days}일${delivery(p)?' · 예상 납품 '+delivery(p):''}${brief.deadline&&delivery(p)>brief.deadline?' · 희망일 이후':''}</p><label class="check"><input type="checkbox" data-select="${esc(p.id)}" ${selected.has(p.id)?'checked':''}>이 작가에게 요청</label></article>`}
const intake=createIntake({getBrief:()=>brief,save:saveBrief,render,go,toast,aiTools,getTarget:()=>state.products.find(p=>p.id===target)});
function briefScreen(id){
  if(target!==id){selected.clear();quantity={};target=id||'';saveBrief();}
  return intake.screen();
}
function compare(){const method=brief.answers?.method;
  const specific=brief.answers?.intent==='캐릭터 제작'&&methods.slice(0,4).some(([v])=>v===method);
  const today=new Date().toLocaleDateString('sv-SE');
  const products=state.products.filter(p=>!p.mine&&(target?p.id===target&&p.direct:p.recommend)&&(!specific||target||!p.methods?.length||p.methods.includes(method))&&(!brief.readyNow||p.start&&p.start<=today)).sort((a,b)=>fit(a)-fit(b)||price(a)-price(b));
  const visible=new Set(products.map(p=>p.id));
  for(const id of selected)if(!visible.has(id))selected.delete(id);
  return hero('작가별 예상 견적','작업 범위와 예상 일정을 비교한 뒤 요청할 작가를 선택하세요.')+`<label class="check match-filter"><input type="checkbox" data-ready ${brief.readyNow?'checked':''}>오늘 착수 가능한 작가만 보기</label><div class="grid"><div>${products.map(quoteCard).join('')||'<p>현재 이 조건으로 접수하는 작가가 없어요.</p>'}</div><aside class="card"><h2>의뢰 요약</h2><p class="block">${esc(brief.description)}</p><p class="block">${esc(briefDetails(brief))}</p><p>${brief.budget===''?'적정가 제안 희망':won(brief.budget)} · ${esc(brief.deadline)||'일정 협의'} ${brief.deadlineFirm?'(필수)':''}</p>${allImages(brief).map(pic).join('')}<div class="acts"><a href="#brief/${esc(target)}" class="btn sub">수정</a>${state.signedIn?'<button data-send>선택한 작가에게 요청</button>':login()}</div></aside></div>`}
function productForm(id){const p=state.products.find(p=>p.id===id&&p.mine)||{};productPhoto=p.img||'';return hero(id?'상품 수정':'포트폴리오로 상품 만들기','내가 맡은 작업과 기본 포함 범위를 적고 가격표를 발행하세요.')+`<div class="product-layout"><form class="card" data-form="product" data-id="${esc(p.id)}">${aiTools(true)}${showcaseField(p.showcaseUrl)}${upload()}${pic(p.img)}<div class="fields">${input('artist','작가명',p.artist,'text','required maxlength="60"')}${input('title','상품명',p.title,'text','required maxlength="100"')}</div>${memo('desc','작업 설명 · 기본 포함 범위',p.desc,'required maxlength="1200"')}<div class="fields">${input('base','기본 금액 (원)',p.base??'','number','min="0" max="100000000" required')}${input('days','예상 작업 일수',p.days||7,'number','min="1" max="730" required')}${input('start','다음 착수 가능일',p.start,'date')}</div><fieldset><legend>제공하는 제작 방식</legend>${methods.slice(0,4).map(([m])=>'<label class="check"><input type="checkbox" name="offered" value="'+esc(m)+'" '+(p.methods?.includes(m)?'checked':'')+'>'+esc(m)+'</label>').join('')}</fieldset>${market()}<section class="line"><h3>선택 옵션</h3><div data-rows>${productOptions(p).map(optionEditor).join('')}</div><button type="button" class="sub" data-add>옵션 추가</button></section>${check('recommend','조건에 맞는 의뢰인에게 추천',p.recommend??true)}${check('direct','공유 링크에서 직접 의뢰 받기',p.direct??true)}<div class="acts">${cta('상품 발행')}</div></form>${portfolioExamples()}</div>`}
function productPage(id){const p=state.products.find(p=>p.id===id);if(!p)return '<p>상품을 찾을 수 없어요.</p>';return hero(esc(p.title),esc(p.artist))+`<div class="grid"><article>${tag(p)}${p.showcaseUrl?showcasePlayer(showcaseVideo(p.showcaseUrl)):''}${portfolioPhoto(p)}${p.sample?'<p class="mini">'+esc(p.work)+' · AI 생성 포트폴리오 예시</p>':''}<h2>작업 범위</h2><p class="block">${esc(p.desc)}</p></article><article><h2>견적 안내</h2><div class="num">${won(p.base)}</div><p>${productOptions(p).map(row=>esc(row.name)+' · '+won(row.price)+'/개').join('<br>')}</p><p>예상 ${p.days}일 · ${esc(p.start)||'착수일 협의'}</p><div class="acts">${p.mine?`<a class="btn" href="#edit/${esc(id)}">상품 수정</a>`:p.direct?`<a class="btn" href="#brief/${esc(id)}">이 작가에게 견적 받기</a>`:'직접 문의 접수 중지'}<button data-copy class="sub">링크 복사</button></div></article></div>`}
function projectCard(p,seller){const quotes=seller?p.quotes.filter(q=>q.canRespond):p.quotes;return `<article><div class="mini">${esc(p.created.slice(0,10))} · ${p.budget===null?'예산 협의':won(p.budget)} · ${esc(p.deadline)||'일정 협의'} ${p.deadlineFirm?'(필수)':''}</div><h3 class="block">${esc(p.description)}</h3><p class="block">${esc(p.details||'')}</p>${allImages(p).map(pic).join('')}${quotes.map(q=>`<section class="line"><div class="row"><b>${esc(q.artist)}</b><span class="tag">${esc(q.status)}</span>${tag(q)}</div><div>${esc(q.title)} · 기본 ${won(q.base)}${(q.lines??(q.count?[{name:q.option,count:q.count,price:q.extra}]:[])).map(row=>' + '+esc(row.name)+' '+row.count+'개 ('+won(row.count*row.price)+')').join('')}</div><div class="num">${won(q.amount)}</div>${q.delivery?'납품 예정 '+esc(q.delivery):''}${q.messages.map(m=>`<p class="block"><b>${esc(m.by)}</b>　${esc(m.note)}</p>`).join('')}${actionForm(p,q,seller)}</section>`).join('')}</article>`}
function actionForm(p,q,seller){let options=seller?({'요청됨':['quote','question','decline'],'답변 도착':['quote','question','decline'],'추가 질문':['decline']}[q.status]):({'추가 질문':['reply'],'견적 도착':['accept']}[q.status]);if(!options)return '';const labels={quote:'견적 보내기',question:'추가 질문',decline:'진행 어려움',reply:'답변 보내기',accept:'이 견적 확정'};return `<form data-form="action" data-id="${esc(p.id)}" data-product="${esc(q.product)}">${options.includes('quote')?`<div class="fields">${input('amount','제안 금액 (원)',q.amount,'number','min="0" max="100000000"')}${input('delivery','제안 납품일','','date')}</div>`:''}${options.includes('accept')?'':input('note','메시지')}<div class="acts">${options.map((v,i)=>`<button name="action" value="${v}" class="${i?'sub':''}">${labels[v]}</button>`).join('')}</div></form>`}
function dashboard(seller){const projects=state.projects.filter(p=>seller?p.quotes.some(q=>q.canRespond):p.mine);return hero(seller?'작가 작업실':'내 프로젝트',seller?'상품과 추천 상태를 관리하고 도착한 의뢰에 답하세요.':'요청한 작가의 질문과 견적을 한곳에서 확인하세요.')+`<div class="grid"><section><h2>${seller?'받은 의뢰':'보낸 의뢰'} · ${projects.length}</h2>${projects.map(p=>projectCard(p,seller)).join('')||'<article class="empty">아직 의뢰가 없어요.</article>'}</section><aside class="card"><h2>${seller?'내 상품':'새 의뢰'}</h2>${seller?state.products.filter(p=>p.mine).map(p=>`<p><a href="#product/${esc(p.id)}">${esc(p.title)}</a><br><small>추천 ${p.recommend?'켜짐':'꺼짐'} · 직접 문의 ${p.direct?'켜짐':'꺼짐'}</small></p>`).join(''):''}<a class="btn" href="${seller?'#edit':'#brief'}">${seller?'상품 등록':'제작 의뢰하기'}</a><button class="sub" data-refresh>새로고침</button></aside></div>`}
function render(){const [r,id]=route();const html=r==='artists'?gallery():r==='edit'?productForm(id):r==='product'?productPage(id):r==='seller'||r==='projects'?dashboard(r==='seller'):r==='compare'&&brief.description?compare():briefScreen(id||'');videoEditor?.cancel();main.innerHTML=html;const productEditor=main.querySelector('form[data-form="product"]');videoEditor=productEditor?attachVideoEditor(productEditor):undefined;main.classList.toggle('is-consult',!!main.querySelector('.consult'));document.querySelectorAll('nav a').forEach(a=>a.toggleAttribute('aria-current',a.hash==='#'+(r==='edit'?'seller':r||'brief')))}
async function fileData(form,current){const file=form.image?.files[0];if(!file)return current;if(file.size>1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('1MB 이하 PNG, JPEG, WebP 이미지를 선택해 주세요.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('파일을 읽지 못했어요.'));reader.readAsDataURL(file)})}
async function run(button,fn){if(button)button.disabled=true;try{await fn()}catch(e){toast(e.message)}finally{if(button)button.disabled=false}}
main.addEventListener('change',e=>{const el=e.target;if(el.hasAttribute('data-ready')){brief.readyNow=el.checked;render();saveBrief();return;}if(el.dataset.qty){(quantity[el.dataset.qty]??=countsFor(state.products.find(p=>p.id===el.dataset.qty)))[Number(el.dataset.index)]=Math.max(0,Math.min(20,Math.trunc(+el.value)||0));render()}if(el.dataset.select){if(el.checked)selected.add(el.dataset.select);else selected.delete(el.dataset.select)}if(el.dataset.select||el.dataset.qty)saveBrief()});
main.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;
  if(button.form?.dataset.form==='consult' && button.type==='button' && !button.matches('[data-ai],[data-connect],[data-unlink]')){intake.click(button,button.form);return;}
  run(button.matches('[data-ai],[data-send],[data-refresh],[data-copy],[data-example],[data-connect]')?button:null,async()=>{
  if(button.hasAttribute('data-connect')){
    const box=button.closest('.gemini-box'),field=box.querySelector('[data-secret]'),message=box.querySelector('[data-connection-message]');
    const candidate=field.value.trim();if(!candidate){message.textContent='API 키를 입력해 주세요.';field.focus();return;}
    message.textContent='Google에서 키를 확인하고 있어요.';
    try{await api('gemini-check',{},candidate);if(!box.isConnected)return;const form=box.closest('form');personalGeminiKey=candidate;field.value='';box.outerHTML=aiTools(form.dataset.form==='product');videoEditor?.connectionChanged();syncImageControls(form);toast('Gemini가 연결됐어요.');}
    catch(e){message.textContent=e.message;}
    return;
  }
  if(button.hasAttribute('data-unlink')){const form=button.form;personalGeminiKey='';button.closest('.gemini-box').outerHTML=aiTools(form.dataset.form==='product');videoEditor?.connectionChanged();return;}
  if(button.hasAttribute('data-add')){const rows=button.form.querySelector('[data-rows]');if(rows.children.length>=12)throw Error('옵션은 최대 12개예요.');rows.insertAdjacentHTML('beforeend',optionEditor());rows.lastElementChild.querySelector('input').focus()}
  if(button.hasAttribute('data-remove'))button.closest('[data-option-row]').remove();
  if(button.hasAttribute('data-refresh'))await load();
  if(button.hasAttribute('data-copy')){await navigator.clipboard.writeText(location.href);toast('상품 링크를 복사했어요.')}
  if(button.hasAttribute('data-ai')){
    const form=button.form, mode=form.dataset.form==='product'?'portfolio':'request';
    if(!form.approved.checked)throw Error('공개용 자료 전송에 동의해 주세요.');
    const field=form.elements[mode==='request'?'description':'desc'];
    const img=await fileData(form,mode==='request'?brief.img:productPhoto);
    if(!field.value.trim()&&!(mode==='portfolio'&&img))throw Error('초안에 담을 내용이나 작업 자료를 넣어 주세요.');
    const context=mode==='request'?[field.value,briefDetails(brief),'예산 상한 '+(form.budget.value?won(form.budget.value):'미정'),'희망 납품일 '+(form.deadline.value||'미정')].join('\n'):field.value;
    const label=button.textContent;
    button.textContent='초안 작성 중…';
    let result;
    try {result=await api('draft',{description:context,mode,approved:true,image:img?{mimeType:img.split(';')[0].slice(5),data:img.split(',')[1]}:null},personalGeminiKey);} finally {button.textContent=label;}
    field.value=result.draft;
    if(mode==='request')intake.input(form);
    if(mode==='portfolio'){
      if(!form.elements.title.value)form.elements.title.value=result.title;
      const rows=form.querySelector('[data-rows]'),names=new Set([...rows.querySelectorAll('[name=optionName]')].map(el=>el.value));
      for(const name of result.options){if(!names.has(name)&&rows.children.length<12){rows.insertAdjacentHTML('beforeend',optionEditor({name}));names.add(name)}}
    }
    toast('초안을 넣었어요. 제안된 내용과 옵션을 확인해 주세요.');
  }
  if(button.hasAttribute('data-send')){if(!selected.size)throw Error('요청할 작가를 선택해 주세요.');const ids=[...selected];await api('request',{description:brief.description,details:briefDetails(brief),img:brief.img,moreImages:brief.moreImages||[],deadline:brief.deadline,deadlineFirm:brief.deadlineFirm,ids,budget:brief.budget===''?null:Number(brief.budget),selections:Object.fromEntries(ids.map(id=>[id,countsFor(state.products.find(p=>p.id===id))])),direct:!!target,estimates:Object.fromEntries(ids.map(id=>[id,price(state.products.find(p=>p.id===id))]))});selected.clear();quantity={};target='';brief={description:'',budget:'',deadline:'',img:'',deadlineFirm:false};saveBrief();await load();go('projects');toast('의뢰를 보냈어요.')}
})});
main.addEventListener('submit',e=>{e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f));run(e.submitter,async()=>{switch(f.dataset.form){
case 'consult':intake.submit(f);break;
case 'product':{const options=[...f.querySelectorAll('[data-option-row]')].map(row=>({name:row.querySelector('[name=optionName]').value.trim(),price:row.querySelector('[name=optionPrice]').value}));if(options.some(row=>!row.name||row.price===''))throw Error('각 옵션의 이름과 단가를 입력해 주세요.');const result=await api('product',{...d,showcaseUrl:d.showcaseUrl.trim(),methods:new FormData(f).getAll('offered'),id:f.dataset.id,base:+d.base,options:options.map(row=>({...row,price:Number(row.price)})),extra:0,days:+d.days,img:await fileData(f,productPhoto),direct:!!d.direct,recommend:!!d.recommend});await load();go('product/'+result.id);toast('상품을 발행했어요.');break}
case 'action':await api('action',{...d,action:e.submitter.value,amount:Number(d.amount),id:f.dataset.id,product:f.dataset.product});await load();toast('진행 상태를 저장했어요.');break;
}})});
main.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.matches('[data-secret]')){e.preventDefault();e.target.closest('.gemini-box').querySelector('[data-connect]').click();}
});
main.addEventListener('input',e=>{if(e.target.name==='showcaseUrl')updateShowcase(e.target);const f=e.target.form;if(f?.dataset.form==='consult' && e.target.type!=='file')intake.input(f);});
main.addEventListener('change',e=>{if(e.target.name==='intakeFiles')intake.files(e.target.files,e.target.form);});
main.addEventListener('dragover',e=>{if(e.target.closest('[data-drop]'))e.preventDefault();});
main.addEventListener('drop',e=>{const zone=e.target.closest('[data-drop]');if(zone){e.preventDefault();intake.files(e.dataTransfer.files,zone.closest('form'));}});
window.addEventListener('hashchange',()=>{if(state)render();window.scrollTo(0,0)});
try{await load()}catch(e){main.textContent=e.message;}
})();
