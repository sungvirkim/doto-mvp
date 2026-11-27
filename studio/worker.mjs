import { showcaseVideo } from '../api/youtube.mjs';
import { assets } from './assets.mjs';
import { generateDraft, verifyGeminiKey } from '../api/draft.mjs';
import { sampleProducts } from './samples.mjs';

const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const json = (body, status=200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
const str = (v, max=1200) => typeof v === 'string' ? v.trim().slice(0,max) : '';
function money(v) {
  if (!Number.isSafeInteger(v) || v < 0 || v > 100000000) fail(400,'금액을 확인해 주세요.');
  return v;
}
function photo(v) {
  if (!v) return '';
  if (typeof v !== 'string' || v.length > 1400000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v)) fail(400,'1MB 이하의 이미지를 사용해 주세요.');
  return v;
}
function date(v) {
  if (!v) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10)!==v) fail(400,'날짜를 확인해 주세요.');
  return v;
}
function optionsFor(product) {
  return product.options ?? (product.option ? [{name:product.option,price:product.extra}] : []);
}
function readOptions(data) {
  const rows=optionsFor(data);
  if(!Array.isArray(rows)||rows.length>12)fail(400,'옵션은 최대 12개까지 등록할 수 있어요.');
  return rows.map(row=>{
    const name=str(row?.name,60);
    if(!name)fail(400,'옵션명을 입력해 주세요.');
    return {name,price:money(row.price)};
  });
}
async function records(bucket,prefix) {
  const values=[]; let cursor;
  do {const page=await bucket.list({prefix,cursor});
    for (const obj of page.objects) {const item=await bucket.get(obj.key); if(item)values.push(await item.json());}
    cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
  return values;
}
function quoteView(project,user) {
  if(project.client===user)return project;
  const quotes=project.quotes.filter(q=>q.owner===user);
  return quotes.length?{...project,quotes}:null;
}
async function handle(req,env) {
  const path=new URL(req.url).pathname;
  if(Object.hasOwn(assets,path) && req.method==='GET'){
    const [type,content]=assets[path];
    const binary=type==='image/webp';
    const body=binary?Uint8Array.from(atob(content),c=>c.charCodeAt(0)):content;
    return new Response(body,{headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':binary?'private, max-age=86400':'no-cache'}});
  }
  if(!path.startsWith('/api/'))return new Response('Not found',{status:404});
  const user=req.headers.get('oai-authenticated-user-id');
  const bucket=env.BUCKET;
  if (!bucket) fail(503,'저장소 연결이 필요해요.');
  const examples=sampleProducts();
  const readProduct=async id=>examples.find(p=>p.id===id) || await (await bucket.get('products/'+id))?.json();
  if(req.method==='GET' && path==='/api/state') {
    const products=[...examples,...await records(bucket,'products/')];
    const projects=user?(await records(bucket,'projects/')).map(p=>quoteView(p,user)).filter(Boolean).sort((a,b)=>b.created.localeCompare(a.created)):[];
    return json({signedIn:!!user, ai:!!env.GEMINI_API_KEY,products:products.map(({owner,...p})=>({...p,mine:!!owner&&owner===user})),projects:projects.map(({client,...p})=>({...p,mine:client===user,quotes:p.quotes.map(({owner,...q})=>({...q,canRespond:owner===user}))}))});
  }
  if(req.method!=='POST')fail(405,'허용되지 않은 요청이에요.');
  if(!user)fail(401,'로그인 후 이용해 주세요.');
  if(req.headers.get('origin') && req.headers.get('origin')!==new URL(req.url).origin)fail(403,'요청 출처를 확인해 주세요.');
  if(!req.headers.get('content-type')?.includes('application/json'))fail(415,'JSON 요청이 필요해요.');
  const raw=await req.text(); if(raw.length>4300000)fail(413,'첨부 용량을 줄여 주세요.');
  let d;try{d=JSON.parse(raw)}catch{fail(400,'내용을 확인해 주세요.')}
  if(!d||typeof d!=='object')fail(400,'내용을 확인해 주세요.');
  if(path==='/api/gemini-check'||path==='/api/draft') {
    const personal=req.headers.get('x-doto-gemini-key')||'';
    if(personal&&!/^[A-Za-z0-9._-]{12,512}$/.test(personal))fail(400,'복사한 API 키를 확인해 주세요.');
    const {status,body}=path==='/api/gemini-check'?await verifyGeminiKey(personal):await generateDraft(d,env.GEMINI_API_KEY||personal);
    return json(body,status);
  }
  if(path==='/api/product'){
    const id=d.id||crypto.randomUUID();
    const old=d.id?await bucket.get('products/'+id):null;
    if(d.id&&(!old||(await old.json()).owner!==user))fail(403,'내 상품만 수정할 수 있어요.');
    const offered=d.methods??[];
    if(!Array.isArray(offered)||offered.length>4||offered.some(m=>!['아바타 커스텀','얼굴 성형','오리지널 얼굴 제작','오리지널 전신 제작'].includes(m)))fail(400,'제공하는 제작 방식을 확인해 주세요.');
    const video=showcaseVideo(d.showcaseUrl);
    if(d.showcaseUrl && !video)fail(400,'유튜브 영상의 공유 링크를 확인해 주세요.');
    const p={showcaseUrl:video?.url||'',methods:[...new Set(offered)],id,owner:user,artist:str(d.artist,60),title:str(d.title,100),desc:str(d.desc),base:money(d.base),option:str(d.option,60),extra:money(d.extra??0),options:readOptions(d),days:Number(d.days),start:date(d.start),recommend:d.recommend===true,direct:d.direct===true,img:photo(d.img)};
    if(!p.artist||!p.title||!p.desc||!Number.isInteger(p.days)||p.days<1||p.days>730)fail(400,'작가명·상품명·작업 설명·기간을 확인해 주세요.');
    if(!await bucket.put('products/'+id,JSON.stringify(p),old?{onlyIf:{etagMatches:old.etag}}:{}))fail(409,'상품이 변경됐어요. 다시 열어주세요.');
    return json({id});
  }
  if(path==='/api/request'){
    if(d.deadlineFirm&&!d.deadline)fail(400,'필수 납품일을 입력해 주세요.');
    if(!str(d.description)||!Array.isArray(d.ids)||!d.ids.length||d.ids.length>10)fail(400,'의뢰 내용과 작가를 선택해 주세요.');
    const quotes=[];
    for(const id of new Set(d.ids)){
      const p=await readProduct(id);
      if(!p||!(d.direct?p.direct:p.recommend)||p.owner===user)fail(409,'선택한 상품의 접수 상태를 다시 확인해 주세요.');
      const options=optionsFor(p);
      const counts=d.selections?.[id] ?? options.map((_,i)=>i===0 ? d.quantity?.[id]??0 : 0);
      if(!Array.isArray(counts)||counts.length!==options.length||counts.some(n=>!Number.isInteger(n)||n<0||n>20))fail(400,'옵션 수량을 확인해 주세요.');
      const lines=options.map((option,i)=>({...option,count:counts[i]})).filter(row=>row.count>0);
      const count=counts[0]||0;

      const expected=money(lines.reduce((sum,row)=>sum+row.count*row.price,p.base));
      if(d.estimates?.[id]!==expected)fail(409,'가격이 갱신됐어요. 목록에서 다시 확인해 주세요.');
      quotes.push({product:id,owner:p.sample?user:p.owner,sample:!!p.sample,artist:p.artist,title:p.title,lines,base:p.base,option:p.option,count,extra:p.extra,days:p.days,start:p.start,amount:expected,status:'요청됨',messages:[]});
    }
    const id=crypto.randomUUID();
    const moreImages=d.moreImages??[];
    if(!Array.isArray(moreImages)||moreImages.length>2||moreImages.some(img=>!img)||(moreImages.length&&!d.img))fail(400,'이미지는 총 3장까지 첨부할 수 있어요.');
    const project={details:str(d.details,1800),moreImages:moreImages.map(photo),id,created:new Date().toISOString(),client:user,description:str(d.description,4000),budget:d.budget==null?null:money(d.budget),deadline:date(d.deadline),deadlineFirm:!!d.deadlineFirm,img:photo(d.img),quotes};
    await bucket.put('projects/'+id,JSON.stringify(project));return json({id});
  }
  if(path==='/api/action'){
    const key='projects/'+str(d.id,64);const obj=await bucket.get(key);
    if(!obj)fail(404,'의뢰를 찾을 수 없어요.');
    const project=await obj.json(), q=project.quotes.find(q=>q.product===d.product);
    if(!q)fail(404,'견적을 찾을 수 없어요.');
    const buyer=project.client===user, seller=q.owner===user, note=str(d.note);
    const allowed={question:seller&&['요청됨','답변 도착'].includes(q.status),reply:buyer&&q.status==='추가 질문',quote:seller&&['요청됨','답변 도착'].includes(q.status),decline:seller&&['요청됨','추가 질문','답변 도착'].includes(q.status),accept:buyer&&q.status==='견적 도착'};
    if(!Object.hasOwn(allowed,d.action)||!allowed[d.action])fail(409,'현재 진행 상태에서는 처리할 수 없어요.');
    if(['question','reply'].includes(d.action)&&!note)fail(400,'메시지를 입력해 주세요.');
    if(d.action==='quote'){q.amount=money(d.amount);q.delivery=date(d.delivery);if(!q.delivery)fail(400,'납품 예정일을 입력해 주세요.');}
    if(note)q.messages.push({by:['reply','accept'].includes(d.action)?'의뢰인':'작가',note});
    q.status={question:'추가 질문',reply:'답변 도착',quote:'견적 도착',decline:'진행 어려움',accept:'확정'}[d.action];
    if(d.action==='accept')project.quotes.filter(other=>other!==q&&other.status!=='진행 어려움').forEach(other=>other.status='마감');
    if(!await bucket.put(key,JSON.stringify(project),{onlyIf:{etagMatches:obj.etag}}))fail(409,'새 답변이 있어요. 새로고침 후 확인해 주세요.');
    return json({id:project.id});
  }
  fail(404,'화면을 찾을 수 없어요.');
}
export default {async fetch(req,env){try{return await handle(req,env);}catch(e){return json({error:e.status?e.message:'저장 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'},e.status||500);}}};
