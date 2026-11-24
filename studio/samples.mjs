const samples = [
  {id:'demo-face',artist:'여울 스튜디오',title:'원화 기반 얼굴 커스텀',work:'숲의 기록관',look:'세이지빛 숲의 엘프',methods:['얼굴 성형'],desc:'의뢰인의 정면 원화를 기준으로 기존 베이스의 눈매와 얼굴형을 조정합니다. 기본 표정 2종과 방송용 VRM을 포함합니다.',base:240000,days:7,wait:0,extra:20000,option:'특수 표정'},
  {id:'demo-debut',artist:'오후 작업실',title:'첫 방송 아바타 세팅',work:'오렌지 온에어',look:'헤드폰과 오렌지 재킷',methods:['아바타 커스텀'],desc:'기존 베이스를 활용한 외형 커스텀과 VSeeFace 초기 세팅을 함께 진행합니다. 기본 의상 1벌과 테스트를 포함합니다.',base:280000,days:5,wait:0,extra:15000,option:'추가 표정'},
  {id:'demo-original',artist:'소담 스튜디오',title:'원화 기반 오리지널 캐릭터',work:'청람 기사단',look:'은발의 푸른 기사',methods:['오리지널 전신 제작'],desc:'원화의 얼굴 비율과 갑옷 실루엣을 반영해 전신을 새로 제작합니다. 방송용 파일로 전달합니다.',base:1450000,days:45,wait:0,options:[{name:'특수표정',price:35000},{name:'ARKit 표정 세팅',price:180000}]},
  {id:'demo-head',artist:'윤슬 작업실',title:'오리지널 얼굴 제작',work:'라일락 앙코르',look:'검은 리본의 라일락 아이돌',methods:['오리지널 얼굴 제작'],desc:'기존 몸에 어울리는 새 얼굴을 제작합니다. 눈동자와 얼굴 음영을 조율하고 방송용 파일로 세팅합니다.',base:650000,days:21,wait:2,options:[{name:'특수표정',price:25000}]},
  {id:'demo-neon',artist:'네온폴리',title:'테크웨어 캐릭터 전신 제작',work:'심야 주파수',look:'청록 바이저와 테크웨어',methods:['오리지널 전신 제작'],desc:'각진 실루엣의 전신 모델을 제작합니다. 발광 바이저와 소재를 분리해 방송 조명에 맞춰 세팅합니다.',base:1780000,days:50,wait:14,options:[{name:'바이저 전환',price:60000},{name:'ARKit 표정 세팅',price:160000}]},
  {id:'demo-rose',artist:'모브 메이크',title:'무대용 얼굴 모델링',work:'로즈 커튼콜',look:'로즈 헤어와 별 장식',methods:['오리지널 얼굴 제작'],desc:'무대 메이크업과 눈매가 잘 보이는 얼굴을 새로 만듭니다. 기존 바디 연결과 얼굴 텍스처가 기본이에요.',base:780000,days:24,wait:7,options:[{name:'특수표정',price:30000},{name:'메이크업 전환',price:45000}]},
  {id:'demo-grain',artist:'결 모델링',title:'인상과 얼굴 비율 조정',work:'오후의 편집실',look:'둥근 안경의 밤색 머리 캐릭터',methods:['얼굴 성형'],desc:'기존 모델의 턱선, 콧대, 눈 비율을 조정합니다. 안경처럼 얼굴과 맞닿는 소품의 위치도 맞춥니다.',base:330000,days:10,wait:4,options:[{name:'안경 전환',price:20000},{name:'특수표정',price:22000}]},
  {id:'demo-witch',artist:'달실 공방',title:'판타지 오리지널 전신 제작',work:'동백의 밤',look:'자수 의상과 적갈색 땋은 머리',methods:['오리지널 전신 제작'],desc:'원화의 의상 자수와 땋은 머리를 살려 전신을 제작합니다. 의상 디테일과 머리카락의 움직임을 함께 맞춥니다.',base:2100000,days:65,wait:30,options:[{name:'특수표정',price:45000},{name:'헤어 전환',price:120000}]},
  {id:'demo-blue',artist:'파랑상점',title:'베이스 아바타 스타일링',work:'블루 익스프레스',look:'코발트 귀와 네이비 재킷',methods:['아바타 커스텀'],desc:'기존 베이스에 귀, 헤어, 의상을 조합해 개성을 잡습니다. 원화가 없어도 색과 분위기부터 상의할 수 있어요.',base:190000,days:6,wait:3,options:[{name:'특수표정',price:18000},{name:'소품 전환',price:23000}]}
];

export function sampleProducts(now = new Date()) {
  return samples.map(({wait,...p})=>{
    const start=new Date(now);
    start.setUTCDate(start.getUTCDate()+wait);
    return {...p,recommend:true,direct:true,start:start.toISOString().slice(0,10),img:'/portfolio/'+p.id+'.webp',sample:true};
  });
}
