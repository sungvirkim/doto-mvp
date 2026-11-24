export const examples = [
  '방송용 3D 캐릭터를 만들고 싶어요.',
  '지금 쓰는 캐릭터를 다른 프로그램으로 옮기고 싶어요.',
  '하트눈이나 눈물 같은 특수표정을 추가하고 싶어요.',
  '계속 함께 일할 작업자님을 구해요.'
];

export const methods = [
  ['아바타 커스텀', '기존 아바타의 얼굴을 살리고 헤어와 의상을 바꿔요. 원화 없이 예산에 맞춰 작가에게 맡길 수도 있어요.'],
  ['얼굴 성형', '기존 아바타를 바탕으로 눈매나 얼굴형을 더 세밀하게 바꿔요.'],
  ['오리지널 얼굴 제작', '기존 몸을 활용하고 얼굴은 내 캐릭터에 맞춰 새로 만들어요.'],
  ['오리지널 전신 제작', '얼굴부터 몸까지 내 캐릭터를 새로 만들어요.'],
  ['작가와 상의할게요', '준비한 자료와 예산으로 가능한 방식을 제안받아요.']
];
const material = ['원화 이미지가 있어요.', '참고 이미지만 있어요.', '아직 준비한 이미지가 없어요.'];
const intents = ['캐릭터 제작', '프로그램 이전', '특수표정 추가', '장기 협업'];
const programs = ['아직 잘 모르겠어요', 'Warudo', 'VSeeFace', 'VRChat', '기타'];
const facial = ['작가와 상의할게요', '눈 깜박임과 입 움직임', '눈썹·볼·입술까지 세밀하게 (ARKit)'];
const specials = ['하트눈', '눈물', '별눈'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function intentOf(text) {
  if (/장기|계속 함께|정기적/.test(text)) return intents[3];
  if (/옮기|이전|포팅|변환/.test(text)) return intents[1];
  if (/표정.{0,10}추가/.test(text) && !/캐릭터.{0,12}(만들|제작)/.test(text)) return intents[2];
  return intents[0];
}
export function briefDetails(b) {
  const a=b.answers||{};
  const rows=[['의뢰 유형',a.intent],['디자인 자료',a.material]];
  if(a.intent===intents[0]) rows.push(['제작 방식',a.method]);
  if(a.intent===intents[1]) rows.push(['현재 프로그램',a.from]);
  if(a.intent===intents[3]) rows.push(['협업 주기와 작업',a.recurring]);
  rows.push(['사용할 프로그램',a.program],['표정 추적',a.intent===intents[0]?a.face:''],['특수표정',a.expressions?.join(', ')],['추가 요청',a.note]);
  return rows.filter(([,v])=>v).map(([k,v])=>k+' · '+v).join('\n');
}
function pathFor(b) {
  const a=b.answers||{}, steps=['start'];
  if(a.guide) steps.push('guide');
  if(!a.initialArt) steps.push('art');
  if(a.intent===intents[0]) steps.push('method');
  return [...steps,'tech','review'];
}
function titles(h, accent, note='') {
  return '<h1>'+h+' <em>'+accent+'</em></h1>'+(note?'<p class="intro-note">'+note+'</p>':'');
}
function option(key,value,current,detail='') {
  const selected=Array.isArray(current)?current.includes(value):current===value;
  return '<button type="button" class="answer" data-key="'+key+'" data-value="'+esc(value)+'" aria-pressed="'+selected+'"><span class="marker" aria-hidden="true">'+(selected?'✓':'○')+'</span><span>'+esc(value)+(detail?'<small>'+esc(detail)+'</small>':'')+'</span></button>';
}
function select(key,label,list,current) {
  return '<label>'+label+'<select name="'+key+'"><option value="">선택해 주세요</option>'+list.map(x=>'<option '+(current===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>';
}
function extra(key,label,val) {
  return '<label>'+label+'<input name="'+key+'" maxlength="240" value="'+esc(val)+'"></label>';
}
function buttons(text, disabled=false) {
  return '<div class="consult-actions"><button type="button" class="text-button" data-nav="back">← 이전</button><button class="primary" '+(disabled?'disabled':'')+'>'+text+' →</button></div>';
}
export function allImages(b) {
  return [...(b.img?[b.img]:[]),...(b.moreImages||[])];
}
function uploads(b, opening) {
  const images=allImages(b);
  const list=images.map((img,i)=>'<li><img alt="첨부한 이미지 '+(i+1)+'" src="'+esc(img)+'"><button type="button" class="text-button" data-delete-img="'+i+'" aria-label="'+(i+1)+'번째 이미지 삭제">삭제</button></li>').join('');
  return '<div class="upload-zone" data-drop><label class="pick-file"><input type="file" multiple accept="image/png,image/jpeg,image/webp" name="intakeFiles"><span>＋ '+(images.length?'이미지 더하기':opening?'원화 첨부':'이미지 첨부')+'</span></label>'+(!opening?'<small>여기로 끌어놓거나 눌러서 올려주세요. 최대 3장 · 한 장당 1MB</small>':'')+(list?'<ul class="attached">'+list+'</ul>':'')+'</div>';
}
function recognize(b) {
  const a=b.answers;
  const int=intentOf(b.description);
  if(a.intent && a.intent!==int){delete a.method;delete a.face;delete a.from;delete a.recurring;}
  a.intent=int;
  a.initialArt=Boolean(b.img);
  if(b.img)a.material=material[0];
  else if(/원화.{0,6}(있|준비했)/.test(b.description))a.material=material[0];
  else if(/원화.{0,5}(없|없이)/.test(b.description))a.material=material[2];
}
function referenceStep(b) {
  const a=b.answers;
  const known=a.material===material[0] && /원화.{0,6}(있|준비했)/.test(b.description);
  const heading=known?titles('준비한 원화를','첨부해 주세요.'):titles('캐릭터','원화가 있나요?', '지금 가지고 있는 자료를 골라주세요.');
  return heading+material.map((m,i)=>option('material',m,a.material)+(a.material===m && i<2?uploads(b,false):'')).join('')+buttons(a.intent===intents[0]?'제작 방식 고르기':'작업 조건 정하기',!a.material);
}
function techStep(b) {
  const a=b.answers;
  let detail='';
  if(a.intent===intents[1])detail+=extra('from','지금 캐릭터를 쓰는 프로그램',a.from);
  if(a.intent===intents[3])detail+=extra('recurring','어떤 작업을 얼마나 자주 맡길 예정인가요?',a.recurring);
  detail+=select('program','사용할 프로그램',programs,a.program);
  if(a.intent===intents[0]) detail+=select('face','내 얼굴을 어느 정도 따라 움직이면 좋을까요?',facial,a.face);
  if(a.intent===intents[0]||a.intent===intents[2]) detail+='<fieldset><legend>버튼으로 켜고 싶은 특수표정 · 선택</legend><div class="inline-answers">'+specials.map(x=>option('expressions',x,a.expressions||[])).join('')+'</div></fieldset>';
  return titles('어떻게','사용할 예정인가요?', '방송에서 쓸 기능을 골라주세요. 아직 정하지 않은 항목은 넘어가도 돼요.')+detail+extra('note','추가로 작가에게 전할 내용 · 선택',a.note)+buttons('의뢰서 확인');
}
export function createIntake({getBrief,save,render,go,toast,aiTools,getTarget}) {
  let pending=false;
  function screen() {
    const b=getBrief();const a=b.answers??={};const step=b.step||'start';
    let body='';
    if(step==='start') {
      body=titles('어떤 작업을','의뢰하고 싶어요?','만들고 싶은 걸 편하게 적어주세요.')+'<div class="writing"><textarea aria-label="만들고 싶은 작업" name="description" maxlength="4000" placeholder="예) 첫 방송에 쓸 3D 캐릭터를 만들고 싶어요.">'+esc(b.description)+'</textarea>'+uploads(b,true)+'</div><div class="examples">'+examples.map((s,i)=>'<button type="button" data-example-index="'+i+'" aria-pressed="'+(s===b.description)+'"><span aria-hidden="true">'+(s===b.description?'✓':'↗')+'</span>'+s+'</button>').join('')+'</div><div class="consult-actions"><button type="button" class="text-button" data-guide>아직 잘 모르겠어요.</button><button class="primary" '+(b.description.trim()?'':'disabled')+'>상담 시작하기 →</button></div>';
    }else if(step==='guide'){
      body=titles('어디서부터','시작할까요?', '가까운 상황을 골라주세요. 다음 질문부터 도토가 도와줄게요.')+examples.map((s,i)=>option('guidedIntent',s,b.description,['처음 사용할 버추얼 캐릭터가 필요해요.','이미 가지고 있는 모델 파일이 있어요.','기존 캐릭터에 기능을 더하고 싶어요.','여러 작업을 이어서 맡길 작가가 필요해요.'][i])).join('')+buttons('다음',!b.description.trim());
    }else if(step==='art')body=referenceStep(b);
    else if(step==='method')body=titles('캐릭터를 어디까지','새로 만들까요?','원화 유무와 예산을 생각하면서 가까운 방식을 골라주세요.')+methods.map(([v,n])=>option('method',v,a.method,n)).join('')+buttons('작업 조건 정하기',!a.method);
    else if(step==='tech')body=techStep(b);
    else{
      body=titles('작가에게 보낼','의뢰서예요.')+'<label>처음 적은 의뢰 내용<textarea name="description" required maxlength="4000">'+esc(b.description)+'</textarea></label><p class="details">'+esc(briefDetails(b))+'</p>'+uploads(b,false)+'<div class="fields"><label>예산 상한 · 원<input type="number" min="0" max="100000000" name="budget" placeholder="협의 가능" value="'+esc(b.budget)+'"></label><label>희망 납품일<input type="date" name="deadline" value="'+esc(b.deadline)+'"></label></div><label class="check"><input type="checkbox" name="deadlineFirm" '+(b.deadlineFirm?'checked':'')+'>이 날짜까지 꼭 필요해요.</label>'+aiTools()+buttons('작가별 견적 비교');
    }
    const target=getTarget();
    return '<form class="consult" data-form="consult" data-step="'+esc(step)+'">'+(target?'<p class="artist-target">'+esc(target.artist)+' 작가에게 문의</p>':'')+body+'</form>';
  }
  function jump(step) {getBrief().step=step;save();render();const h=document.querySelector('.consult h1');h?.setAttribute('tabindex','-1');h?.focus({preventScroll:true});window.scrollTo(0,0);}
  function capture(form) {
    const b=getBrief(),a=b.answers??={};
    for(const key of ['description','budget','deadline'])if(form.elements[key]) b[key]=form.elements[key].value;
    if(form.elements.deadlineFirm)b.deadlineFirm=form.elements.deadlineFirm.checked;
    for(const key of ['program','face','from','recurring','note'])if(form.elements[key])a[key]=form.elements[key].value;
    save();
  }
  function input(form) {
    capture(form);
    if(form.dataset.step==='start'){
      const v=getBrief().description;
      form.querySelector('.primary').disabled=!v.trim();
      form.querySelectorAll('[data-example-index]').forEach(btn=>{const on=examples[+btn.dataset.exampleIndex]===v;btn.setAttribute('aria-pressed',on);btn.firstElementChild.textContent=on?'✓':'↗';});
    }
  }
  function submit(form) {
    if(pending){toast('이미지를 읽는 중이에요.');return;}
    capture(form);const b=getBrief(),a=b.answers;const step=form.dataset.step;
    if(step==='start'||step==='guide'){
      if(!b.description.trim())return;
      if(step==='start')a.guide=false;
      recognize(b);
    }
    if(step==='art'&&a.material!==material[2]&&!b.img){toast('이미지를 첨부하거나 준비한 이미지가 없다는 항목을 골라주세요.');return;}
    if(step==='review'){
      if(!b.description.trim()){toast('의뢰 내용을 적어주세요.');return;}
      if(b.deadlineFirm&&!b.deadline){toast('필수 납품일을 입력해 주세요.');return;}
      save();go('compare');return;
    }
    const flow=pathFor(b);
    jump(flow[flow.indexOf(step)+1]||'review');
  }
  function click(button,form) {
    const b=getBrief(),a=b.answers;const d=button.dataset;
    if(pending)return;
    if(d.exampleIndex!==undefined){const field=form.elements.description;field.value=examples[Number(d.exampleIndex)];field.focus();field.setSelectionRange(field.value.length,field.value.length);input(form);return;}
    if('guide' in d){capture(form);a.guide=true;jump('guide');return;}
    if(d.nav==='back'){capture(form);const flow=pathFor(b);jump(flow[Math.max(0,flow.indexOf(form.dataset.step)-1)]);return;}
    if('deleteImg' in d){const images=allImages(b);images.splice(Number(d.deleteImg),1);[b.img='',...b.moreImages]=images;if(!b.img)a.initialArt=false;save();render();return;}
    if(!d.key)return;
    capture(form);
    if(d.key==='guidedIntent'){b.description=d.value;recognize(b);}
    else if(d.key==='expressions'){const set=new Set(a.expressions||[]);if(set.has(d.value))set.delete(d.value);else set.add(d.value);a.expressions=[...set];}
    else {a[d.key]=d.value;if(d.key==='material'&&d.value===material[2]){b.img='';b.moreImages=[];}}
    save();render();document.querySelector('.consult [data-key="'+d.key+'"][data-value="'+CSS.escape(d.value)+'"]')?.focus();
  }
  async function files(inputFiles,form) {
    if(pending||!inputFiles.length)return;
    const b=getBrief();const previous=allImages(b);const files=[...inputFiles];
    pending=true;
    try{
      if(previous.length+files.length>3)throw Error('이미지는 3장까지 첨부할 수 있어요.');
      if(files.some(f=>f.size>1024*1024||!['image/png','image/jpeg','image/webp'].includes(f.type)))throw Error('한 장당 1MB 이하 PNG, JPG, WebP를 골라주세요.');
      const data=await Promise.all(files.map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('파일을 읽지 못했어요.'));reader.readAsDataURL(file);})));
      if(!form.isConnected)return;
      capture(form);[b.img,...b.moreImages]=[...previous,...data];
      if(form.dataset.step==='start')b.answers.material=material[0];
      save();render();
    }catch(err){toast(err.message);}finally{pending=false;}
  }
  return {screen,input,submit,click,files};
}

