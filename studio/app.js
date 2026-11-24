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
const aiTools=()=>state.ai?`<details class="line"><summary>Gemini로 초안 정리</summary>${check('approved','Google 무료 API로 전송할 수 있는 공개용 예시 자료입니다.')}<button type="button" class="sub" data-ai>초안 생성</button></details>`:'<p class="mini">현재 직접 작성 모드 · Gemini 연결 후 AI 초안을 사용할 수 있어요.</p>';
function toast(s){notice.textContent=s;clearTimeout(timer);timer=setTimeout(()=>notice.textContent='',6500)}
async function api(path,data){const r=await fetch('/api/'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const v=await r.json();if(!r.ok)throw Error(v.error||'잠시 후 다시 시도해 주세요.');return v}
async function load(){state=await api('state');render()}
const route=()=>location.hash.slice(1).split('/');
const go=h=>{if(location.hash==='#'+h)render();else location.hash=h};
function login(){return `<a class="btn" target="_top" href="/signin-with-chatgpt?return_to=${encodeURIComponent('/studio'+location.hash)}">로그인하고 계속</a>`}
const cta=(s)=>state.signedIn?`<button>${s}</button>`:login();
const productOptions=p=>p.options??(p.option?[{name:p.option,price:p.extra}]:[]);
const countsFor=p=>productOptions(p).map((_,index)=>quantity[p.id]?.[index]||0);
function price(p){return productOptions(p).reduce((total,row,i)=>total+row.price*countsFor(p)[i],p.base)}
function optionEditor(row={}){return '<div class="fields" data-option-row>'+input('optionName','옵션명',row.name||'','text','maxlength="60"')+input('optionPrice','단가 (원)',row.price??'','number','min="0" max="100000000"')+'<button class="sub small" type="button" data-remove>삭제</button></div>'}
function optionPicker(p){return productOptions(p).map((row,i)=>input('qty','선택 옵션 · '+esc(row.name)+' ('+won(row.price)+'/개)',countsFor(p)[i],'number','min="0" max="20" data-qty="'+esc(p.id)+'" data-index="'+i+'"')).join('')}
function market(){const others=state.products.filter(p=>!p.sample&&!p.mine);if(!others.length)return '<p class="mini">다른 작가의 실제 등록 상품이 쌓이면 기본가 범위를 표시해요.</p>';const prices=others.map(p=>p.base);return '<p class="mini">다른 작가가 공개한 상품 '+prices.length+'개의 기본가 '+won(Math.min(...prices))+' ~ '+won(Math.max(...prices))+' · 작업 범위에 따라 달라요.</p>'}
function delivery(p){if(!p.start)return '';const today=new Date().toISOString().slice(0,10);const d=new Date((p.start>today?p.start:today)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+p.days);return d.toISOString().slice(0,10)}
function fit(p){
  const eta=delivery(p);
  const late=brief.deadline && eta && eta>brief.deadline;
  const over=brief.budget!=='' && price(p)>Number(brief.budget);
  return (late?(brief.deadlineFirm?8:2):0)+(over?4:0)+(brief.deadline&&!eta?1:0);
}
function quoteCard(p){const over=brief.budget!==''&&price(p)>Number(brief.budget);return `<article>${tag(p)}${pic(p.img)}<h3><a href="#product/${esc(p.id)}">${esc(p.artist)}</a> · ${esc(p.title)}</h3><p>${esc(p.desc)}</p>${optionPicker(p)}<div class="num">${won(price(p))}</div><p class="mini">${over?'예산 상한 초과 · ':''}${p.start?'착수 가능 '+esc(p.start):'착수일 확인 필요'} · 작업 ${p.days}일${delivery(p)?' · 예상 납품 '+delivery(p):''}${brief.deadline&&delivery(p)>brief.deadline?' · 희망일 이후':''}</p><label class="check"><input type="checkbox" data-select="${esc(p.id)}" ${selected.has(p.id)?'checked':''}>이 작가에게 요청</label></article>`}
function briefScreen(id){if(target!==id){selected.clear();quantity={};target=id||''}const p=state.products.find(p=>p.id===id);return hero(p?'작가에게 제작 의뢰':'어떤 캐릭터를 만들고 싶나요?',p?`${esc(p.artist)} 작가의 상품을 기준으로 예상 견적을 확인해요.`:'그림과 원하는 결과를 알려주세요. 예산과 일정에 맞는 작가를 비교할 수 있어요.')+`<div class="grid"><form class="card" data-form="brief"><h2>나의 제작 요청</h2>${memo('description','만들고 싶은 모습',brief.description,'required maxlength="4000" placeholder="원화 속 눈매를 살린 첫 방송용 3D 아바타를 만들고 싶어요."')}${upload()}${pic(brief.img)}<div class="fields">${input('budget','예산 상한 (원) · 협의 시 비워두기',brief.budget,'number','min="0" max="100000000"')}${input('deadline','희망 납품일',brief.deadline,'date')}</div>${check('deadlineFirm','이 날짜까지 꼭 필요해요',brief.deadlineFirm)}${aiTools()}<div class="acts"><button>예상 견적 비교</button></div></form><aside class="card"><h2>첫 방송 의뢰 예시</h2><p>얼굴 정면과 상반신 원화가 있어요. 얼굴 느낌을 살려서 일주일 뒤 첫 방송에서 쓰고 싶어요.</p><p class="mini">예산 30만 원 · 프로그램 미정</p><button class="sub" data-example>예시로 시작</button></aside></div>`}
function compare(){let products=state.products.filter(p=>!p.mine&&(target?p.id===target&&p.direct:p.recommend)).sort((a,b)=>fit(a)-fit(b)||price(a)-price(b));return hero('작가별 예상 견적','작업 범위와 예상 일정을 비교한 뒤 요청할 작가를 선택하세요.')+`<div class="grid"><div>${products.map(quoteCard).join('')||'<p>현재 이 조건으로 접수하는 작가가 없어요.</p>'}</div><aside class="card"><h2>의뢰 요약</h2><p class="block">${esc(brief.description)}</p><p>${brief.budget===''?'적정가 제안 희망':won(brief.budget)} · ${esc(brief.deadline)||'일정 협의'} ${brief.deadlineFirm?'(필수)':''}</p>${pic(brief.img)}<div class="acts"><a href="#brief/${esc(target)}" class="btn sub">수정</a>${state.signedIn?'<button data-send>선택한 작가에게 요청</button>':login()}</div></aside></div>`}
function productForm(id){const p=state.products.find(p=>p.id===id&&p.mine)||{};productPhoto=p.img||'';return hero(id?'상품 수정':'포트폴리오로 상품 만들기','내가 맡은 작업과 기본 포함 범위를 적고 가격표를 발행하세요.')+`<form class="card" data-form="product" data-id="${esc(p.id)}">${upload()}${pic(p.img)}<div class="fields">${input('artist','작가명',p.artist,'text','required maxlength="60"')}${input('title','상품명',p.title,'text','required maxlength="100"')}</div>${memo('desc','작업 설명 · 기본 포함 범위',p.desc,'required maxlength="1200"')}${aiTools()}<div class="fields">${input('base','기본 금액 (원)',p.base??'','number','min="0" max="100000000" required')}${input('days','예상 작업 일수',p.days||7,'number','min="1" max="730" required')}${input('start','다음 착수 가능일',p.start,'date')}</div>${market()}<section class="line"><h3>선택 옵션</h3><div data-rows>${productOptions(p).map(optionEditor).join('')}</div><button type="button" class="sub" data-add>옵션 추가</button></section>${check('recommend','조건에 맞는 의뢰인에게 추천',p.recommend??true)}${check('direct','공유 링크에서 직접 의뢰 받기',p.direct??true)}<div class="acts">${cta('상품 발행')}</div></form>`}
function productPage(id){const p=state.products.find(p=>p.id===id);if(!p)return '<p>상품을 찾을 수 없어요.</p>';return hero(esc(p.title),esc(p.artist))+`<div class="grid"><article>${tag(p)}${pic(p.img)}<h2>작업 범위</h2><p class="block">${esc(p.desc)}</p></article><article><h2>견적 안내</h2><div class="num">${won(p.base)}</div><p>${productOptions(p).map(row=>esc(row.name)+' · '+won(row.price)+'/개').join('<br>')}</p><p>예상 ${p.days}일 · ${esc(p.start)||'착수일 협의'}</p><div class="acts">${p.mine?`<a class="btn" href="#edit/${esc(id)}">상품 수정</a>`:p.direct?`<a class="btn" href="#brief/${esc(id)}">이 작가에게 견적 받기</a>`:'직접 문의 접수 중지'}<button data-copy class="sub">링크 복사</button></div></article></div>`}
function projectCard(p,seller){const quotes=seller?p.quotes.filter(q=>q.canRespond):p.quotes;return `<article><div class="mini">${esc(p.created.slice(0,10))} · ${p.budget===null?'예산 협의':won(p.budget)} · ${esc(p.deadline)||'일정 협의'} ${p.deadlineFirm?'(필수)':''}</div><h3 class="block">${esc(p.description)}</h3>${pic(p.img)}${quotes.map(q=>`<section class="line"><div class="row"><b>${esc(q.artist)}</b><span class="tag">${esc(q.status)}</span>${tag(q)}</div><div>${esc(q.title)} · 기본 ${won(q.base)}${(q.lines??(q.count?[{name:q.option,count:q.count,price:q.extra}]:[])).map(row=>' + '+esc(row.name)+' '+row.count+'개 ('+won(row.count*row.price)+')').join('')}</div><div class="num">${won(q.amount)}</div>${q.delivery?'납품 예정 '+esc(q.delivery):''}${q.messages.map(m=>`<p class="block"><b>${esc(m.by)}</b>　${esc(m.note)}</p>`).join('')}${actionForm(p,q,seller)}</section>`).join('')}</article>`}
function actionForm(p,q,seller){let options=seller?({'요청됨':['quote','question','decline'],'답변 도착':['quote','question','decline'],'추가 질문':['decline']}[q.status]):({'추가 질문':['reply'],'견적 도착':['accept']}[q.status]);if(!options)return '';const labels={quote:'견적 보내기',question:'추가 질문',decline:'진행 어려움',reply:'답변 보내기',accept:'이 견적 확정'};return `<form data-form="action" data-id="${esc(p.id)}" data-product="${esc(q.product)}">${options.includes('quote')?`<div class="fields">${input('amount','제안 금액 (원)',q.amount,'number','min="0" max="100000000"')}${input('delivery','제안 납품일','','date')}</div>`:''}${options.includes('accept')?'':input('note','메시지')}<div class="acts">${options.map((v,i)=>`<button name="action" value="${v}" class="${i?'sub':''}">${labels[v]}</button>`).join('')}</div></form>`}
function dashboard(seller){const projects=state.projects.filter(p=>seller?p.quotes.some(q=>q.canRespond):p.mine);return hero(seller?'작가 작업실':'내 프로젝트',seller?'상품과 추천 상태를 관리하고 도착한 의뢰에 답하세요.':'요청한 작가의 질문과 견적을 한곳에서 확인하세요.')+`<div class="grid"><section><h2>${seller?'받은 의뢰':'보낸 의뢰'} · ${projects.length}</h2>${projects.map(p=>projectCard(p,seller)).join('')||'<article class="empty">아직 의뢰가 없어요.</article>'}</section><aside class="card"><h2>${seller?'내 상품':'새 의뢰'}</h2>${seller?state.products.filter(p=>p.mine).map(p=>`<p><a href="#product/${esc(p.id)}">${esc(p.title)}</a><br><small>추천 ${p.recommend?'켜짐':'꺼짐'} · 직접 문의 ${p.direct?'켜짐':'꺼짐'}</small></p>`).join(''):''}<a class="btn" href="${seller?'#edit':'#brief'}">${seller?'상품 등록':'제작 의뢰하기'}</a><button class="sub" data-refresh>새로고침</button></aside></div>`}
function render(){const [r,id]=route();const html=r==='edit'?productForm(id):r==='product'?productPage(id):r==='seller'||r==='projects'?dashboard(r==='seller'):r==='compare'&&brief.description?compare():briefScreen(id||'');main.innerHTML=html;document.querySelectorAll('nav a').forEach(a=>a.toggleAttribute('aria-current',a.hash==='#'+(r==='edit'?'seller':r||'brief')))}
async function fileData(form,current){const file=form.image?.files[0];if(!file)return current;if(file.size>1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('1MB 이하 PNG, JPEG, WebP 이미지를 선택해 주세요.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('파일을 읽지 못했어요.'));reader.readAsDataURL(file)})}
async function run(button,fn){if(button)button.disabled=true;try{await fn()}catch(e){toast(e.message)}finally{if(button)button.disabled=false}}
main.addEventListener('change',e=>{const el=e.target;if(el.dataset.qty){(quantity[el.dataset.qty]??=[])[Number(el.dataset.index)]=Math.max(0,Math.min(20,Math.trunc(+el.value)||0));render()}if(el.dataset.select){if(el.checked)selected.add(el.dataset.select);else selected.delete(el.dataset.select)}if(el.dataset.select||el.dataset.qty)saveBrief()});
main.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;run(button.matches('[data-ai],[data-send],[data-refresh],[data-copy],[data-example]')?button:null,async()=>{
  if(button.hasAttribute('data-add')){const rows=button.form.querySelector('[data-rows]');if(rows.children.length>=12)throw Error('옵션은 최대 12개예요.');rows.insertAdjacentHTML('beforeend',optionEditor());rows.lastElementChild.querySelector('input').focus()}
  if(button.hasAttribute('data-remove'))button.closest('[data-option-row]').remove();
  if(button.hasAttribute('data-refresh'))await load();
  if(button.hasAttribute('data-copy')){await navigator.clipboard.writeText(location.href);toast('상품 링크를 복사했어요.')}
  if(button.hasAttribute('data-example')){const form=button.closest('main').querySelector('form');form.description.value='얼굴 정면과 상반신 원화가 있어요. 원화 속 눈매를 살린 첫 방송용 3D 아바타를 만들고 싶어요. 사용 프로그램은 미정이에요.';form.budget.value=300000;const date=new Date();date.setDate(date.getDate()+7);form.deadline.value=date.toISOString().slice(0,10);form.deadlineFirm.checked=true;form.description.focus()}
  if(button.hasAttribute('data-ai')){
    const form=button.form, mode=form.dataset.form==='brief'?'request':'portfolio';
    if(!form.approved.checked)throw Error('공개용 자료 전송에 동의해 주세요.');
    const field=form.elements[mode==='request'?'description':'desc'];
    const img=await fileData(form,mode==='request'?brief.img:productPhoto);
    if(!field.value.trim()&&!(mode==='portfolio'&&img))throw Error('초안에 담을 내용이나 작업 자료를 넣어 주세요.');
    const context=mode==='request'?[field.value,'예산 상한 '+(form.budget.value?won(form.budget.value):'미정'),'희망 납품일 '+(form.deadline.value||'미정')].join('\n'):field.value;
    const result=await api('draft',{description:context,mode,approved:true,image:img?{mimeType:img.split(';')[0].slice(5),data:img.split(',')[1]}:null});
    field.value=result.draft;
    if(mode==='portfolio'){
      if(!form.elements.title.value)form.elements.title.value=result.title;
      const rows=form.querySelector('[data-rows]'),names=new Set([...rows.querySelectorAll('[name=optionName]')].map(el=>el.value));
      for(const name of result.options){if(!names.has(name)&&rows.children.length<12){rows.insertAdjacentHTML('beforeend',optionEditor({name}));names.add(name)}}
    }
    toast('초안을 넣었어요. 제안된 내용과 옵션을 확인해 주세요.');
  }
  if(button.hasAttribute('data-send')){if(!selected.size)throw Error('요청할 작가를 선택해 주세요.');const ids=[...selected];await api('request',{...brief,ids,budget:brief.budget===''?null:Number(brief.budget),selections:Object.fromEntries(ids.map(id=>[id,countsFor(state.products.find(p=>p.id===id))])),direct:!!target,estimates:Object.fromEntries(ids.map(id=>[id,price(state.products.find(p=>p.id===id))]))});selected.clear();quantity={};brief={description:'',budget:'',deadline:'',img:'',deadlineFirm:false};saveBrief();await load();go('projects');toast('의뢰를 보냈어요.')}
})});
main.addEventListener('submit',e=>{e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f));run(e.submitter,async()=>{switch(f.dataset.form){
case 'brief':brief={description:d.description.trim(),budget:d.budget,deadline:d.deadline,deadlineFirm:!!d.deadlineFirm,img:await fileData(f,brief.img)};if(!brief.description)throw Error('의뢰 내용을 적어 주세요.');if(brief.deadlineFirm&&!brief.deadline)throw Error('필수 납품일을 입력해 주세요.');saveBrief();go('compare');break;
case 'product':{const options=[...f.querySelectorAll('[data-option-row]')].map(row=>({name:row.querySelector('[name=optionName]').value.trim(),price:row.querySelector('[name=optionPrice]').value}));if(options.some(row=>!row.name||row.price===''))throw Error('각 옵션의 이름과 단가를 입력해 주세요.');const result=await api('product',{...d,id:f.dataset.id,base:+d.base,options:options.map(row=>({...row,price:Number(row.price)})),extra:0,days:+d.days,img:await fileData(f,productPhoto),direct:!!d.direct,recommend:!!d.recommend});await load();go('product/'+result.id);toast('상품을 발행했어요.');break}
case 'action':await api('action',{...d,action:e.submitter.value,amount:Number(d.amount),id:f.dataset.id,product:f.dataset.product});await load();toast('진행 상태를 저장했어요.');break;
}})});
window.addEventListener('hashchange',()=>{if(state)render();window.scrollTo(0,0)});
try{await load()}catch(e){main.textContent=e.message;}
})();
