/* BokRun: original runner RPG simulation for BokDesk. No application data access. */
(function (root) {
  'use strict';

  const RARITY_ORDER = ['N','R','SR','SSR'];
  const RARITY_WEIGHT = { N: 72, R: 22, SR: 5, SSR: 1 };

  const CHARACTERS = [
    {id:'momo',name:'모모 래빗',rarity:'N',emoji:'🐰',color:'#ffb8c8',accent:'#fff1f4',skill:'토끼 스텝',desc:'점프 착지 후 2초간 속도 +12%.',passive:{landingBoost:.12},active:{type:'dash',cooldown:16,duration:2.4,power:.35}},
    {id:'mint',name:'민트 캣',rarity:'R',emoji:'🐱',color:'#79d8c3',accent:'#e7fff8',skill:'민트 마그넷',desc:'기본 자석 범위 +55%. 스킬 사용 시 6초간 초대형 자석.',passive:{magnet:.55},active:{type:'magnet',cooldown:19,duration:6,power:220}},
    {id:'bolt',name:'볼트 폭스',rarity:'R',emoji:'🦊',color:'#ff9b64',accent:'#fff0e7',skill:'라이트닝 점프',desc:'3단 점프 가능. 공중 코인 점수 +35%.',passive:{maxJumps:3,airCoin:.35},active:{type:'airdash',cooldown:17,duration:1.4,power:.45}},
    {id:'bobo',name:'보보 베어',rarity:'SR',emoji:'🐻',color:'#c69a70',accent:'#fff1e4',skill:'허니 가드',desc:'매 런 실드 1개로 시작. 피격 후 3초 무적.',passive:{startShield:1,hitInvincible:3},active:{type:'shield',cooldown:23,duration:0,power:1}},
    {id:'nova',name:'노바 위습',rarity:'SR',emoji:'✨',color:'#9678ff',accent:'#f1edff',skill:'스타 오버드라이브',desc:'무적 아이템 지속시간 +60%. 스킬 중 점수 ×2.2.',passive:{starDuration:.6},active:{type:'score',cooldown:21,duration:5,power:2.2}},
    {id:'goldy',name:'골디 카피',rarity:'SSR',emoji:'🦫',color:'#f3c54e',accent:'#fff7d6',skill:'골든 타임',desc:'골드 획득 +40%, 런당 1회 자동 부활.',passive:{gold:.4,revive:1},active:{type:'coinrush',cooldown:25,duration:6,power:1.8}}
    ,
    {id:'strawberry_milk',name:'딸기우유맛 쿠키',rarity:'N',emoji:'🍓',color:'#ff8fae',accent:'#fff0f5',skill:'딸기 대시',desc:'최종 점수 +4%. 스킬 사용 시 짧게 가속.',passive:{finalScore:.04},active:{type:'dash',cooldown:18,duration:2.0,power:.20}},
    {id:'banana_cream',name:'바나나크림맛 쿠키',rarity:'N',emoji:'🍌',color:'#f6d96a',accent:'#fff9d8',skill:'바나나 점프',desc:'점프 높이 +6%. 착지 후 잠깐 가속.',passive:{jump:.06,landingBoost:.05},active:{type:'airdash',cooldown:20,duration:1.1,power:.18}},
    {id:'apple_jam',name:'사과잼맛 쿠키',rarity:'N',emoji:'🍎',color:'#ef6b66',accent:'#fff0ee',skill:'잼 러시',desc:'코인 점수 +8%. 스킬 중 코인 러시.',passive:{coinScore:.08},active:{type:'coinrush',cooldown:22,duration:4.0,power:1.15}},
    {id:'milk_tea',name:'밀크티맛 쿠키',rarity:'N',emoji:'🧋',color:'#c89d76',accent:'#fff5ea',skill:'티타임 실드',desc:'피격 후 무적시간 +0.5초.',passive:{hitInvincible:1.6},active:{type:'shield',cooldown:24,duration:0,power:1}},
    {id:'blue_soda',name:'블루소다맛 쿠키',rarity:'N',emoji:'🥤',color:'#61bfe8',accent:'#edfaff',skill:'소다 버블',desc:'자석 범위 +10%.',passive:{magnet:.10},active:{type:'magnet',cooldown:21,duration:4.2,power:150}},
    {id:'honey_butter',name:'허니버터맛 쿠키',rarity:'N',emoji:'🍯',color:'#e9bb55',accent:'#fff8df',skill:'허니 타임',desc:'골드 획득 +7%.',passive:{gold:.07},active:{type:'score',cooldown:23,duration:3.5,power:1.35}},
    {id:'yogurt',name:'요구르트맛 쿠키',rarity:'N',emoji:'🥛',color:'#f3efe4',accent:'#ffffff',skill:'유산균 부스트',desc:'파워업 지속시간 +8%.',passive:{powerDuration:.08},active:{type:'dash',cooldown:19,duration:2.1,power:.18}},
    {id:'peach_jelly',name:'복숭아젤리맛 쿠키',rarity:'N',emoji:'🍑',color:'#f7a98f',accent:'#fff1eb',skill:'말랑 콤보',desc:'콤보 유지시간 +12%.',passive:{comboWindow:.12},active:{type:'score',cooldown:22,duration:3.5,power:1.4}},
    {id:'coconut_milk',name:'코코넛밀크맛 쿠키',rarity:'N',emoji:'🥥',color:'#d6c4a8',accent:'#fffaf0',skill:'코코 실드',desc:'무적 아이템 지속시간 +10%.',passive:{starDuration:.10},active:{type:'shield',cooldown:25,duration:0,power:1}},
    {id:'chocochip',name:'초코칩맛 쿠키',rarity:'N',emoji:'🍪',color:'#8d644d',accent:'#f8eee8',skill:'칩 스프린트',desc:'스킬 쿨타임 -5%.',passive:{cooldown:.05},active:{type:'dash',cooldown:18,duration:2.0,power:.22}},

    {id:'lemon_soda',name:'레몬소다맛 쿠키',rarity:'R',emoji:'🍋',color:'#e9df4c',accent:'#fffbd8',skill:'레몬 스파클',desc:'자석 범위 +22%, 파워업 등장 확률 +10%.',passive:{magnet:.22,itemChance:.10},active:{type:'magnet',cooldown:18,duration:5.0,power:180}},
    {id:'lime_mint',name:'라임민트맛 쿠키',rarity:'R',emoji:'🌿',color:'#5fd09d',accent:'#eafff4',skill:'민트 에어대시',desc:'공중 코인 점수 +18%, 점프 높이 +5%.',passive:{airCoin:.18,jump:.05},active:{type:'airdash',cooldown:17,duration:1.5,power:.28}},
    {id:'caramel_popcorn',name:'카라멜팝콘맛 쿠키',rarity:'R',emoji:'🍿',color:'#e6a75e',accent:'#fff4df',skill:'팝콘 피버',desc:'콤보 점수 +12%.',passive:{comboScore:.12},active:{type:'score',cooldown:20,duration:4.2,power:1.55}},
    {id:'blueberry_yogurt',name:'블루베리요거트맛 쿠키',rarity:'R',emoji:'🫐',color:'#7583dd',accent:'#f0f1ff',skill:'베리 실드',desc:'파워업 지속시간 +15%.',passive:{powerDuration:.15},active:{type:'shield',cooldown:21,duration:0,power:1}},
    {id:'grapefruit_ade',name:'자몽에이드맛 쿠키',rarity:'R',emoji:'🍊',color:'#f37969',accent:'#fff0eb',skill:'에이드 러시',desc:'최종 점수 +7%.',passive:{finalScore:.07},active:{type:'coinrush',cooldown:20,duration:5.0,power:1.3}},
    {id:'pistachio_cream',name:'피스타치오크림맛 쿠키',rarity:'R',emoji:'🥜',color:'#91b56d',accent:'#f2f9e8',skill:'피스타치오 가드',desc:'런 시작 시 실드 1개. 골드 +5%.',passive:{startShield:1,gold:.05},active:{type:'dash',cooldown:22,duration:2.2,power:.24}},
    {id:'cherry_cola',name:'체리콜라맛 쿠키',rarity:'R',emoji:'🍒',color:'#c54b5a',accent:'#fff0f2',skill:'콜라 버스트',desc:'대시 스킬 효과 +15%.',passive:{dashPower:.15},active:{type:'dash',cooldown:16,duration:2.4,power:.30}},
    {id:'maple_pancake',name:'메이플팬케이크맛 쿠키',rarity:'R',emoji:'🥞',color:'#c78b49',accent:'#fff4e5',skill:'메이플 골든타임',desc:'골드 획득 +15%.',passive:{gold:.15},active:{type:'score',cooldown:22,duration:4.5,power:1.6}},
    {id:'green_grape',name:'청포도캔디맛 쿠키',rarity:'R',emoji:'🍇',color:'#9bc65e',accent:'#f7ffe9',skill:'캔디 마그넷',desc:'자석 범위 +35.',passive:{magnet:.16},active:{type:'magnet',cooldown:17,duration:5.5,power:195}},
    {id:'brown_sugar',name:'흑당버블맛 쿠키',rarity:'R',emoji:'🧋',color:'#8a6248',accent:'#f8efe8',skill:'버블 콤보',desc:'콤보 유지 +25%, 콤보 점수 +8%.',passive:{comboWindow:.25,comboScore:.08},active:{type:'coinrush',cooldown:21,duration:4.8,power:1.3}},

    {id:'black_sesame',name:'흑임자크림맛 쿠키',rarity:'SR',emoji:'⚫',color:'#55505e',accent:'#efedf2',skill:'세서미 오버드라이브',desc:'최종 점수 +12%, 콤보 점수 +12%.',passive:{finalScore:.12,comboScore:.12},active:{type:'score',cooldown:19,duration:5.0,power:1.85}},
    {id:'earl_grey',name:'얼그레이마카롱맛 쿠키',rarity:'SR',emoji:'🫖',color:'#9b83a8',accent:'#f7effa',skill:'티 아로마',desc:'스킬 쿨타임 -13%, 파워업 지속 +15%.',passive:{cooldown:.13,powerDuration:.15},active:{type:'magnet',cooldown:18,duration:6.0,power:210}},
    {id:'salt_caramel',name:'솔티카라멜맛 쿠키',rarity:'SR',emoji:'🧂',color:'#ca8a55',accent:'#fff2e7',skill:'솔티 대시',desc:'대시 효과 +22%, 착지 가속 +10%.',passive:{dashPower:.22,landingBoost:.10},active:{type:'dash',cooldown:16,duration:2.8,power:.38}},
    {id:'ruby_grapefruit',name:'루비자몽맛 쿠키',rarity:'SR',emoji:'💎',color:'#e65f72',accent:'#fff0f3',skill:'루비 피버',desc:'코인 점수 +18%, 골드 +12%.',passive:{coinScore:.18,gold:.12},active:{type:'coinrush',cooldown:19,duration:6.0,power:1.5}},
    {id:'mint_choco_frappe',name:'민트초코프라페맛 쿠키',rarity:'SR',emoji:'🍫',color:'#66c8b0',accent:'#ecfff9',skill:'프라페 프리즈',desc:'자석 범위 +35%, 피격 후 무적 2.2초.',passive:{magnet:.35,hitInvincible:2.2},active:{type:'shield',cooldown:20,duration:0,power:1}},
    {id:'yuja_ginger',name:'유자진저맛 쿠키',rarity:'SR',emoji:'🫚',color:'#e1a84d',accent:'#fff6df',skill:'진저 스파크',desc:'점프 높이 +12%, 공중 코인 +28%.',passive:{jump:.12,airCoin:.28},active:{type:'airdash',cooldown:16,duration:1.8,power:.38}},
    {id:'chestnut_tiramisu',name:'밤티라미수맛 쿠키',rarity:'SR',emoji:'🌰',color:'#8e624d',accent:'#f8eee8',skill:'티라미수 가드',desc:'시작 실드 1개, 골드 +10%.',passive:{startShield:1,gold:.10},active:{type:'shield',cooldown:22,duration:0,power:2}},
    {id:'raspberry_choco',name:'라즈베리쇼콜라맛 쿠키',rarity:'SR',emoji:'🍫',color:'#b84f70',accent:'#fff0f5',skill:'쇼콜라 러시',desc:'최종 점수 +10%, 파워업 등장 +20%.',passive:{finalScore:.10,itemChance:.20},active:{type:'score',cooldown:18,duration:5.2,power:1.9}},
    {id:'honey_lavender',name:'허니라벤더맛 쿠키',rarity:'SR',emoji:'💜',color:'#a77cd1',accent:'#f8efff',skill:'라벤더 타임',desc:'콤보 유지 +45%, 스킬 쿨타임 -8%.',passive:{comboWindow:.45,cooldown:.08},active:{type:'magnet',cooldown:19,duration:6.0,power:220}},
    {id:'matcha_brulee',name:'말차크림브륄레맛 쿠키',rarity:'SR',emoji:'🍵',color:'#6e9b5b',accent:'#eff8e8',skill:'브륄레 크래시',desc:'대시 효과 +18%, 최종 점수 +8%.',passive:{dashPower:.18,finalScore:.08},active:{type:'dash',cooldown:17,duration:3.0,power:.42}},

    {id:'aurora_soda',name:'오로라소다맛 쿠키',rarity:'SSR',emoji:'🌌',color:'#6f8cff',accent:'#eef1ff',skill:'오로라 오버로드',desc:'최종 점수 +18%, 파워업 지속 +30%.',passive:{finalScore:.18,powerDuration:.30},active:{type:'score',cooldown:17,duration:6.0,power:2.15}},
    {id:'golden_mango',name:'골든망고맛 쿠키',rarity:'SSR',emoji:'🥭',color:'#f0b93f',accent:'#fff7dc',skill:'망고 골드러시',desc:'골드 +35%, 코인 점수 +22%.',passive:{gold:.35,coinScore:.22},active:{type:'coinrush',cooldown:18,duration:7.0,power:1.8}},
    {id:'black_diamond_choco',name:'블랙다이아초코맛 쿠키',rarity:'SSR',emoji:'💠',color:'#3d3d51',accent:'#eeeeff',skill:'다이아 브레이커',desc:'런당 1회 부활, 대시 효과 +30%.',passive:{revive:1,dashPower:.30},active:{type:'dash',cooldown:18,duration:3.2,power:.52}},
    {id:'moonlight_milk',name:'문라이트밀크맛 쿠키',rarity:'SSR',emoji:'🌙',color:'#c7c8ef',accent:'#f7f7ff',skill:'문라이트 실드',desc:'시작 실드 2개, 무적 지속 +35%.',passive:{startShield:2,starDuration:.35},active:{type:'shield',cooldown:20,duration:0,power:2}},
    {id:'stardust_berry',name:'스타더스트베리맛 쿠키',rarity:'SSR',emoji:'🌠',color:'#a86fe8',accent:'#f7eeff',skill:'스타더스트 피버',desc:'콤보 점수 +28%, 콤보 유지 +45%.',passive:{comboScore:.28,comboWindow:.45},active:{type:'score',cooldown:18,duration:6.2,power:2.25}},
    {id:'royal_vanilla',name:'로열바닐라빈맛 쿠키',rarity:'SSR',emoji:'🤍',color:'#ead7ad',accent:'#fffaf0',skill:'로열 블레싱',desc:'스킬 쿨타임 -20%, 최종 점수 +12%.',passive:{cooldown:.20,finalScore:.12},active:{type:'magnet',cooldown:16,duration:7.0,power:245}},
    {id:'dragonfruit',name:'드래곤후르츠맛 쿠키',rarity:'SSR',emoji:'🐉',color:'#e14975',accent:'#fff0f5',skill:'드래곤 플라이트',desc:'3단 점프, 공중 코인 +45%.',passive:{maxJumps:3,airCoin:.45,jump:.08},active:{type:'airdash',cooldown:15,duration:2.2,power:.55}},
    {id:'crimson_cherry',name:'크림슨체리맛 쿠키',rarity:'SSR',emoji:'🍒',color:'#b92043',accent:'#fff0f3',skill:'크림슨 러시',desc:'파워업 등장 +45%, 대시 효과 +25%.',passive:{itemChance:.45,dashPower:.25},active:{type:'coinrush',cooldown:17,duration:7.0,power:1.85}},
    {id:'emerald_melon',name:'에메랄드멜론맛 쿠키',rarity:'SSR',emoji:'🍈',color:'#49b98b',accent:'#eafff4',skill:'에메랄드 마그넷',desc:'자석 범위 +70%, 골드 +15%.',passive:{magnet:.70,gold:.15},active:{type:'magnet',cooldown:16,duration:7.5,power:260}},
    {id:'sunset_peach',name:'선셋피치맛 쿠키',rarity:'SSR',emoji:'🌅',color:'#f28a78',accent:'#fff0eb',skill:'선셋 타임',desc:'최종 점수 +16%, 런당 1회 부활.',passive:{finalScore:.16,revive:1},active:{type:'score',cooldown:17,duration:6.0,power:2.2}}

  ];

  const RELICS = [
    {id:'feather',name:'바람깃털',rarity:'N',emoji:'🪶',desc:'점프 높이 +10%.',effect:{jump:.10}},
    {id:'coinbell',name:'코인벨',rarity:'N',emoji:'🔔',desc:'코인 점수 +18%.',effect:{coinScore:.18}},
    {id:'magnet',name:'마그넷 코어',rarity:'R',emoji:'🧲',desc:'자석 범위 +70.',effect:{magnetFlat:70}},
    {id:'hourglass',name:'미니 모래시계',rarity:'R',emoji:'⌛',desc:'스킬 쿨타임 -12%.',effect:{cooldown:.12}},
    {id:'clover',name:'럭키 클로버',rarity:'R',emoji:'🍀',desc:'파워업 등장 확률 +35%.',effect:{itemChance:.35}},
    {id:'boots',name:'제트 부츠',rarity:'R',emoji:'🥾',desc:'대시/속도 스킬 효과 +22%.',effect:{dashPower:.22}},
    {id:'prism',name:'스타 프리즘',rarity:'SR',emoji:'🔮',desc:'무적/2배점수 지속시간 +30%.',effect:{powerDuration:.30}},
    {id:'shield',name:'수호 부적',rarity:'SR',emoji:'🛡️',desc:'실드 1개로 시작.',effect:{startShield:1}},
    {id:'combo',name:'콤보 메트로놈',rarity:'SR',emoji:'🎵',desc:'콤보 유지시간 +55%, 콤보 점수 +15%.',effect:{comboWindow:.55,comboScore:.15}},
    {id:'rocket',name:'하늘 로켓',rarity:'SR',emoji:'🚀',desc:'스킬 게이지 회복 +18%.',effect:{cooldown:.18}},
    {id:'phoenix',name:'피닉스 깃털',rarity:'SSR',emoji:'🔥',desc:'런당 1회 50% 체력 대신 즉시 부활.',effect:{revive:1}},
    {id:'crown',name:'골든 크라운',rarity:'SSR',emoji:'👑',desc:'최종 점수 +22%, 골드 +20%.',effect:{finalScore:.22,gold:.20}}
    ,
    {id:'strawberry_spoon',name:'딸기잼 스푼',rarity:'N',emoji:'🥄',desc:'최종 점수 +3%.',effect:{finalScore:.03}},
    {id:'banana_charm',name:'바나나 껍질 부적',rarity:'N',emoji:'🍌',desc:'점프 높이 +5%.',effect:{jump:.05}},
    {id:'milk_cap',name:'우유병 뚜껑',rarity:'N',emoji:'🥛',desc:'파워업 지속 +6%.',effect:{powerDuration:.06}},
    {id:'soda_straw',name:'소다 빨대',rarity:'N',emoji:'🥤',desc:'자석 범위 +24.',effect:{magnetFlat:24}},
    {id:'chip_pouch',name:'초코칩 주머니',rarity:'N',emoji:'🍪',desc:'코인 점수 +7%.',effect:{coinScore:.07}},
    {id:'peach_seed',name:'복숭아 씨앗',rarity:'N',emoji:'🌱',desc:'파워업 등장 +9%.',effect:{itemChance:.09}},
    {id:'honey_knife',name:'꿀버터 나이프',rarity:'N',emoji:'🔪',desc:'골드 +5%.',effect:{gold:.05}},
    {id:'yogurt_cup',name:'요거트 컵',rarity:'N',emoji:'🥛',desc:'콤보 유지 +10%.',effect:{comboWindow:.10}},
    {id:'apple_toast',name:'사과잼 토스트',rarity:'N',emoji:'🍞',desc:'콤보 점수 +5%.',effect:{comboScore:.05}},
    {id:'coconut_straw',name:'코코넛 빨대',rarity:'N',emoji:'🥥',desc:'스킬 쿨타임 -4%.',effect:{cooldown:.04}},

    {id:'lemon_bottle',name:'레몬소다 병',rarity:'R',emoji:'🍋',desc:'자석 범위 +55.',effect:{magnetFlat:55}},
    {id:'lime_watch',name:'라임 타이머',rarity:'R',emoji:'⏱️',desc:'스킬 쿨타임 -9%.',effect:{cooldown:.09}},
    {id:'caramel_bucket',name:'카라멜 팝콘통',rarity:'R',emoji:'🍿',desc:'콤보 점수 +10%.',effect:{comboScore:.10}},
    {id:'blueberry_brooch',name:'블루베리 브로치',rarity:'R',emoji:'🫐',desc:'파워업 지속 +15%.',effect:{powerDuration:.15}},
    {id:'grapefruit_tumbler',name:'자몽 텀블러',rarity:'R',emoji:'🥤',desc:'코인 점수 +13%.',effect:{coinScore:.13}},
    {id:'pistachio_whistle',name:'피스타치오 휘슬',rarity:'R',emoji:'📯',desc:'대시 효과 +13%.',effect:{dashPower:.13}},
    {id:'cherry_cola_can',name:'체리콜라 캔',rarity:'R',emoji:'🥫',desc:'파워업 등장 +22%.',effect:{itemChance:.22}},
    {id:'maple_spatula',name:'메이플 주걱',rarity:'R',emoji:'🥄',desc:'골드 +11%.',effect:{gold:.11}},
    {id:'grape_candy_jar',name:'청포도 사탕병',rarity:'R',emoji:'🍬',desc:'콤보 유지 +28%.',effect:{comboWindow:.28}},
    {id:'brown_sugar_straw',name:'흑당 버블 빨대',rarity:'R',emoji:'🧋',desc:'최종 점수 +7%.',effect:{finalScore:.07}},

    {id:'sesame_teacup',name:'흑임자 찻잔',rarity:'SR',emoji:'☕',desc:'최종 점수 +11%, 콤보 점수 +8%.',effect:{finalScore:.11,comboScore:.08}},
    {id:'earl_teapot',name:'얼그레이 티팟',rarity:'SR',emoji:'🫖',desc:'스킬 쿨타임 -14%.',effect:{cooldown:.14}},
    {id:'salt_caramel_pan',name:'솔티카라멜 팬',rarity:'SR',emoji:'🍳',desc:'대시 효과 +20%, 점프 +5%.',effect:{dashPower:.20,jump:.05}},
    {id:'ruby_glass',name:'루비자몽 글라스',rarity:'SR',emoji:'🍷',desc:'코인 점수 +18%, 골드 +8%.',effect:{coinScore:.18,gold:.08}},
    {id:'mint_shaker',name:'민트초코 셰이커',rarity:'SR',emoji:'🥤',desc:'자석 범위 +90.',effect:{magnetFlat:90}},
    {id:'yuja_candle',name:'유자진저 캔들',rarity:'SR',emoji:'🕯️',desc:'파워업 등장 +35%.',effect:{itemChance:.35}},
    {id:'chestnut_fork',name:'밤티라미수 포크',rarity:'SR',emoji:'🍴',desc:'시작 실드 1개, 골드 +5%.',effect:{startShield:1,gold:.05}},
    {id:'raspberry_ring',name:'라즈베리쇼콜라 링',rarity:'SR',emoji:'💍',desc:'최종 점수 +13%.',effect:{finalScore:.13}},
    {id:'lavender_perfume',name:'허니라벤더 향수',rarity:'SR',emoji:'🧴',desc:'콤보 유지 +48%, 파워업 지속 +12%.',effect:{comboWindow:.48,powerDuration:.12}},
    {id:'matcha_torch',name:'말차 브륄레 토치',rarity:'SR',emoji:'🔥',desc:'대시 효과 +18%, 스킬 쿨타임 -8%.',effect:{dashPower:.18,cooldown:.08}},

    {id:'aurora_crystal',name:'오로라 소다 크리스탈',rarity:'SSR',emoji:'🔷',desc:'최종 점수 +20%, 파워업 지속 +22%.',effect:{finalScore:.20,powerDuration:.22}},
    {id:'mango_crown',name:'황금 망고 왕관',rarity:'SSR',emoji:'👑',desc:'골드 +30%, 코인 점수 +18%.',effect:{gold:.30,coinScore:.18}},
    {id:'diamond_vault',name:'블랙다이아 초코 금고',rarity:'SSR',emoji:'🗝️',desc:'런당 1회 부활, 최종 점수 +8%.',effect:{revive:1,finalScore:.08}},
    {id:'moon_grail',name:'문라이트 밀크 성배',rarity:'SSR',emoji:'🏆',desc:'시작 실드 1개, 파워업 지속 +35%.',effect:{startShield:1,powerDuration:.35}},
    {id:'stardust_orb',name:'스타더스트 베리 오브',rarity:'SSR',emoji:'🔮',desc:'콤보 점수 +25%, 콤보 유지 +40%.',effect:{comboScore:.25,comboWindow:.40}},
    {id:'vanilla_staff',name:'로열 바닐라빈 지팡이',rarity:'SSR',emoji:'🪄',desc:'스킬 쿨타임 -22%.',effect:{cooldown:.22}},
    {id:'dragon_heart',name:'드래곤후르츠 심장',rarity:'SSR',emoji:'❤️‍🔥',desc:'점프 +14%, 대시 효과 +24%.',effect:{jump:.14,dashPower:.24}},
    {id:'crimson_core',name:'크림슨 체리 코어',rarity:'SSR',emoji:'🔴',desc:'파워업 등장 +55%, 최종 점수 +8%.',effect:{itemChance:.55,finalScore:.08}},
    {id:'emerald_gem',name:'에메랄드 멜론 보석',rarity:'SSR',emoji:'💚',desc:'자석 범위 +145, 골드 +12%.',effect:{magnetFlat:145,gold:.12}},
    {id:'sunset_crown',name:'선셋 피치 티아라',rarity:'SSR',emoji:'🌅',desc:'최종 점수 +18%, 콤보 점수 +15%.',effect:{finalScore:.18,comboScore:.15}}

  ];


  const SETS = [
    {id:'citrus_spark',name:'시트러스 스파크 세트',emoji:'🍋',requiredRelics:2,
      characterIds:['lemon_soda','lime_mint','grapefruit_ade','ruby_grapefruit','yuja_ginger'],
      relicIds:['lemon_bottle','lime_watch','grapefruit_tumbler','ruby_glass','yuja_candle'],
      desc:'시트러스 캐릭터 + 관련 유물 2개: 자석 +45, 파워업 +20%, 스킬 쿨다운 추가 -8%.',
      effect:{magnetFlat:45,itemChance:.20,cooldown:.08}},
    {id:'berry_parfait',name:'베리 파르페 세트',emoji:'🍓',requiredRelics:2,
      characterIds:['strawberry_milk','blueberry_yogurt','raspberry_choco','stardust_berry'],
      relicIds:['strawberry_spoon','blueberry_brooch','raspberry_ring','stardust_orb'],
      desc:'베리 캐릭터 + 관련 유물 2개: 콤보 유지 +25%, 콤보 점수 +12%, 최종 점수 +6%.',
      effect:{comboWindow:.25,comboScore:.12,finalScore:.06}},
    {id:'cafe_dessert',name:'카페 디저트 세트',emoji:'🍮',requiredRelics:2,
      characterIds:['caramel_popcorn','maple_pancake','brown_sugar','chestnut_tiramisu','matcha_brulee'],
      relicIds:['caramel_bucket','maple_spatula','brown_sugar_straw','chestnut_fork','matcha_torch'],
      desc:'디저트 캐릭터 + 관련 유물 2개: 골드 +15%, 코인 점수 +10%, 최종 점수 +5%.',
      effect:{gold:.15,coinScore:.10,finalScore:.05}},
    {id:'cosmic_dream',name:'코스믹 드림 세트',emoji:'🌌',requiredRelics:2,
      characterIds:['nova','aurora_soda','moonlight_milk','stardust_berry'],
      relicIds:['prism','aurora_crystal','moon_grail','stardust_orb'],
      desc:'코스믹 캐릭터 + 관련 유물 2개: 최종 점수 +15%, 파워업 지속 +20%.',
      effect:{finalScore:.15,powerDuration:.20}},
    {id:'golden_treasure',name:'골든 트레저 세트',emoji:'👑',requiredRelics:2,
      characterIds:['goldy','golden_mango','emerald_melon'],
      relicIds:['crown','mango_crown','emerald_gem','coinbell'],
      desc:'골드 캐릭터 + 관련 유물 2개: 골드 +25%, 코인 점수 +15%.',
      effect:{gold:.25,coinScore:.15}},
    {id:'guardian',name:'가디언 세트',emoji:'🛡️',requiredRelics:2,
      characterIds:['bobo','black_diamond_choco','moonlight_milk'],
      relicIds:['shield','phoenix','diamond_vault','moon_grail'],
      desc:'가디언 캐릭터 + 관련 유물 2개: 시작 실드 +1, 피격 무적 +1초.',
      effect:{startShield:1,hitInvincible:1}},
    {id:'dragon_air',name:'드래곤 에어 세트',emoji:'🐉',requiredRelics:2,
      characterIds:['bolt','yuja_ginger','dragonfruit'],
      relicIds:['feather','boots','dragon_heart','yuja_candle'],
      desc:'에어 캐릭터 + 관련 유물 2개: 점프 +12%, 공중 코인 +25%, 대시 효과 +15%.',
      effect:{jump:.12,airCoin:.25,dashPower:.15}},
    {id:'mint_magnet',name:'민트 마그넷 세트',emoji:'🧲',requiredRelics:2,
      characterIds:['mint','mint_choco_frappe','green_grape','emerald_melon'],
      relicIds:['magnet','mint_shaker','grape_candy_jar','emerald_gem'],
      desc:'마그넷 캐릭터 + 관련 유물 2개: 자석 +100, 파워업 등장 +15%.',
      effect:{magnetFlat:100,itemChance:.15}}
  ];

  const WORLDS = [
    {id:'meadow',name:'젤리 초원',theme:'MEADOW',emoji:'🌼',unlock:1,palette:['#86d9ee','#e7f8ff','#8fd074','#5ca65b','#7e593d'],weather:'petal'},
    {id:'metro',name:'네온 메트로',theme:'METRO',emoji:'🌃',unlock:6,palette:['#171d45','#4c4078','#2a2f65','#161a36','#24263d'],weather:'spark'},
    {id:'frost',name:'프로스트 랩',theme:'FROST',emoji:'❄️',unlock:11,palette:['#9ddbf3','#e9faff','#b5d7df','#709eae','#7999a3'],weather:'snow'},
    {id:'volcano',name:'마그마 키친',theme:'VOLCANO',emoji:'🌋',unlock:16,palette:['#482238','#ff805f','#6d2e34','#341c28','#562d28'],weather:'ember'},
    {id:'sky',name:'스카이 루인',theme:'SKY',emoji:'☁️',unlock:21,palette:['#78c8ff','#eefaff','#b7d79b','#789b78','#8c7459'],weather:'cloud'}
  ];

  const ROUNDS = [];
  for (let i=0;i<25;i++) {
    const world = Math.floor(i/5);
    const within = i%5;
    const modes = ['distance','coins','score','combo','distance'];
    const mode=modes[within];
    const goal=within===0 ? 520 + world*120 : within===1 ? 45 + world*15 : within===2 ? 22000 + world*8500 : within===3 ? 28 + world*8 : 850 + world*160;
    const bonusGoal=Math.ceil(goal*1.30);
    const baseDistance=650 + within*110 + world*140;
    const courseDistance=mode==='distance'?Math.max(baseDistance,bonusGoal+80):baseDistance;
    ROUNDS.push({
      id:i+1,
      world,
      round:within+1,
      mode,
      goal,
      bonusGoal,
      distance:courseDistance,
      baseSpeed: 250 + world*18 + within*5,
      difficulty: 1 + world*.18 + within*.08,
      rewardGold: 180 + i*22,
      rewardGem: within===4 ? 18 + world*3 : 6 + world,
      title: (world+1)+'-'+(within+1)
    });
  }

  const CONSUMABLES = {
    shield:{id:'shield',name:'스타트 실드',emoji:'🛡️',price:180,desc:'실드 1개를 들고 시작'},
    booster:{id:'booster',name:'터보 부스터',emoji:'⚡',price:220,desc:'첫 12초 속도 +20%, 점수 +15%'},
    magnet:{id:'magnet',name:'포켓 마그넷',emoji:'🧲',price:160,desc:'첫 15초 자석 효과'},
    revive:{id:'revive',name:'리바이브 캔디',emoji:'💗',price:300,desc:'1회 추가 부활'}
  };

  function byId(list,id){ return list.find(function(x){return x.id===id;}) || list[0]; }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  function applyEffect(e,x,amp) {
    amp=amp||1;
    if(x.jump)e.jump*=1+x.jump*amp;
    if(x.coinScore)e.coinScore*=1+x.coinScore*amp;
    if(x.magnet)e.magnet*=1+x.magnet*amp;
    if(x.magnetFlat)e.magnet+=x.magnetFlat*amp;
    if(x.cooldown)e.cooldown*=Math.max(.15,1-x.cooldown*amp);
    if(x.itemChance)e.itemChance*=1+x.itemChance*amp;
    if(x.dashPower)e.dashPower*=1+x.dashPower*amp;
    if(x.starDuration)e.starDuration*=1+x.starDuration*amp;
    if(x.powerDuration)e.powerDuration*=1+x.powerDuration*amp;
    if(x.startShield)e.startShield+=Math.max(1,Math.round(x.startShield*amp));
    if(x.comboWindow)e.comboWindow*=1+x.comboWindow*amp;
    if(x.comboScore)e.comboScore*=1+x.comboScore*amp;
    if(x.revive)e.revive+=Math.max(1,Math.round(x.revive*amp));
    if(x.finalScore)e.finalScore*=1+x.finalScore*amp;
    if(x.gold)e.gold*=1+x.gold*amp;
    if(x.airCoin)e.airCoin+=x.airCoin*amp;
    if(x.landingBoost)e.landingBoost+=x.landingBoost*amp;
    if(x.hitInvincible)e.hitInvincible=Math.max(e.hitInvincible,x.hitInvincible*amp);
    if(x.maxJumps)e.maxJumps=Math.max(e.maxJumps,x.maxJumps);
  }

  function buildEffects(character,relics,characterLevel,relicLevels) {
    const c=character||CHARACTERS[0],rs=relics||[],cLevel=clamp(Math.max(1,Number(characterLevel)||1),1,10),rLevels=relicLevels||{};
    const charAmp=1+(cLevel-1)*.10;
    const e={
      maxJumps:2,jump:1,magnet:92,coinScore:1,itemChance:1,cooldown:1,dashPower:1,
      starDuration:1,powerDuration:1,startShield:0,comboWindow:1,comboScore:1,
      finalScore:1,gold:1,revive:0,airCoin:0,landingBoost:0,hitInvincible:0,
      activePower:1+(cLevel-1)*.05,activeDuration:1+(cLevel-1)*.04,
      activeCooldown:1-Math.min(.18,(cLevel-1)*.02),activeSets:[]
    };
    applyEffect(e,c.passive||{},charAmp);

    rs.forEach(function(r){
      const level=clamp(Math.max(1,Number(rLevels[r.id])||1),1,10);
      const amp=1+(level-1)*.15;
      applyEffect(e,(r&&r.effect)||{},amp);
    });

    SETS.forEach(function(set){
      const matchChar=set.characterIds.includes(c.id);
      const count=rs.filter(r=>set.relicIds.includes(r.id)).length;
      if(matchChar&&count>=set.requiredRelics){
        applyEffect(e,set.effect||{},1);
        e.activeSets.push(set.id);
      }
    });

    e.finalScore*=1+(cLevel-1)*.02;
    return e;
  }

  class RunnerEngine {
    constructor(random) {
      this.random=random||Math.random;
      this.configure({});
    }

    configure(opts) {
      opts=opts||{};
      this.character=byId(CHARACTERS,opts.characterId||'momo');
      this.relics=(opts.relicIds||[]).slice(0,3).map(function(id){return byId(RELICS,id);});
      this.round=ROUNDS[clamp((opts.roundId||1)-1,0,ROUNDS.length-1)];
      this.world=WORLDS[this.round.world];
      this.characterLevel=Math.max(1,Number(opts.characterLevel)||1);
      this.relicLevels=opts.relicLevels||{};
      this.effects=buildEffects(this.character,this.relics,this.characterLevel,this.relicLevels);
      this.consumables=Object.assign({},opts.consumables||{});
      this.reset();
    }

    reset() {
      const e=this.effects||buildEffects(this.character,[]);
      this.distance=0;
      this.coins=0;
      this.jellies=0;
      this.items=0;
      this.elapsed=0;
      this.speed=this.round.baseSpeed;
      this.objects=[];
      this.particles=[];
      this.spawnIn=.9;
      this.dead=false;
      this.cleared=false;
      this.failed=false;
      this.shield=e.startShield+(this.consumables.shield?1:0);
      this.revives=e.revive+(this.consumables.revive?1:0);
      this.invincibleFor=0;
      this.magnetFor=this.consumables.magnet?15:0;
      this.doubleScoreFor=0;
      this.coinRushFor=0;
      this.boosterFor=this.consumables.booster?12:0;
      this.skillFor=0;
      this.skillCooldown=0;
      this.skillReady=true;
      this.skillUses=0;
      this.hitCount=0;
      this.combo=0;
      this.maxCombo=0;
      this.comboTimer=0;
      this.comboPoints=0;
      this.bonusScore=0;
      this.lastEvent='';
      this.lastLandingAt=-99;
      this.player={x:108,y:0,vy:0,jumps:0,width:34,height:46,baseHeight:46,slide:false,slideFor:0,spin:0,spinRate:0};
      this.stats={coins:0,jellies:0,items:0,obstacles:0,nearMiss:0};
    }

    get activeCooldownTotal() {
      const base=(this.character.active&&this.character.active.cooldown)||20;
      return Math.max(5,base*this.effects.cooldown*this.effects.activeCooldown);
    }

    get scoreMultiplier() {
      let m=this.doubleScoreFor>0?2:1;
      if(this.skillFor>0&&this.character.active.type==='score')m*=(this.character.active.power||2)*this.effects.activePower;
      if(this.boosterFor>0)m*=1.15;
      return m;
    }

    get score() {
      const base=this.distance*8 + this.coins*115*this.effects.coinScore + this.jellies*42 + this.comboPoints + this.bonusScore;
      return Math.floor(base*this.scoreMultiplier*this.effects.finalScore);
    }

    get progress() { return clamp(this.distance/this.round.distance,0,1); }

    get objectiveValue() {
      if(this.round.mode==='coins')return this.coins;
      if(this.round.mode==='score')return this.score;
      if(this.round.mode==='combo')return this.maxCombo;
      return Math.floor(this.distance);
    }

    get objectiveMet() { return this.objectiveValue>=this.round.goal; }

    get objectiveLabel() {
      if(this.round.mode==='coins')return '코인 '+this.coins+'/'+this.round.goal;
      if(this.round.mode==='score')return '점수 '+this.score.toLocaleString()+'/'+this.round.goal.toLocaleString();
      if(this.round.mode==='combo')return '콤보 '+this.maxCombo+'/'+this.round.goal;
      return '거리 '+Math.floor(this.distance)+'m/'+this.round.goal+'m';
    }

    jump() {
      const p=this.player;
      if(this.dead||this.cleared||p.slide||p.jumps>=this.effects.maxJumps)return false;
      const mult=this.effects.jump;
      p.vy=(p.jumps===0?650:560)*mult;
      p.spinRate=p.jumps===0?8.4:11.8;
      p.jumps++;
      this.emit('jump',p.x+16,p.y+4,8);
      return true;
    }

    slide(active) {
      const p=this.player;
      if(this.dead||this.cleared)return false;
      p.slide=Boolean(active)&&p.y<=2;
      p.height=p.slide?25:p.baseHeight;
      return p.slide;
    }

    useSkill() {
      if(this.dead||this.cleared||!this.skillReady)return false;
      const a=this.character.active;
      const duration=(a.duration||0)*this.effects.activeDuration;
      const power=(a.power||1)*this.effects.activePower;
      this.skillReady=false;
      this.skillCooldown=this.activeCooldownTotal;
      this.skillUses++;
      this.lastEvent=this.character.skill;
      if(a.type==='shield')this.shield+=Math.max(1,Math.round(power));
      if(a.type==='magnet')this.magnetFor=Math.max(this.magnetFor,duration);
      if(a.type==='score')this.skillFor=duration;
      if(a.type==='coinrush')this.coinRushFor=duration;
      if(a.type==='dash'||a.type==='airdash')this.skillFor=duration;
      this.emit('skill',this.player.x+18,this.player.y+20,24);
      return true;
    }

    addCombo(amount) {
      this.combo+=amount||1;
      this.maxCombo=Math.max(this.maxCombo,this.combo);
      this.comboTimer=2.4*this.effects.comboWindow;
      this.comboPoints+=Math.floor((8+this.combo*.8)*this.effects.comboScore);
    }

    breakCombo() {
      if(this.combo>=12)this.bonusScore+=this.combo*18;
      this.combo=0;
      this.comboTimer=0;
    }

    emit(kind,x,y,count) {
      count=count||5;
      for(let i=0;i<count;i++){
        this.particles.push({kind:kind,x:x,y:y,vx:(this.random()-.5)*160,vy:50+this.random()*180,life:.35+this.random()*.45,max:.8});
      }
      if(this.particles.length>120)this.particles.splice(0,this.particles.length-120);
    }

    collectPower(kind) {
      const dur=5*this.effects.powerDuration;
      if(kind==='shield')this.shield=Math.min(4,this.shield+1);
      else if(kind==='star')this.invincibleFor=Math.max(this.invincibleFor,dur*this.effects.starDuration);
      else if(kind==='magnet')this.magnetFor=Math.max(this.magnetFor,8*this.effects.powerDuration);
      else if(kind==='double')this.doubleScoreFor=Math.max(this.doubleScoreFor,7*this.effects.powerDuration);
      else if(kind==='rush')this.coinRushFor=Math.max(this.coinRushFor,6*this.effects.powerDuration);
      else return;
      this.items++;
      this.stats.items++;
      this.addCombo(2);
      this.lastEvent=kind;
      this.emit('item',this.player.x+20,this.player.y+28,16);
    }

    spawn(width) {
      const d=this.round.difficulty;
      const x=width+50;
      const roll=this.random();
      let obstacle;
      if(roll<.28){
        obstacle={type:'obstacle',kind:'crate',x:x,y:0,width:38,height:40};
      }else if(roll<.50){
        obstacle={type:'obstacle',kind:'wall',x:x,y:0,width:34,height:78+Math.round(28*d)};
      }else if(roll<.72){
        obstacle={type:'obstacle',kind:'drone',x:x,y:48,width:54,height:28};
      }else if(roll<.88){
        obstacle={type:'obstacle',kind:'laser',x:x,y:0,width:72,height:18};
      }else{
        obstacle={type:'obstacle',kind:'gate',x:x,y:0,width:48,height:94};
      }
      this.objects.push(obstacle);

      const arcHigh=obstacle.kind==='wall'||obstacle.kind==='gate';
      const count=5+Math.floor(this.random()*4);
      for(let i=0;i<count;i++){
        const t=i/Math.max(1,count-1);
        const y=(arcHigh?95:55)+Math.sin(t*Math.PI)*(arcHigh?135:70);
        this.objects.push({type:i%3===0?'jelly':'coin',kind:i%3===0?'jelly':'coin',x:x-15+i*34,y:y,width:18,height:18});
      }

      if(this.random()<.35*this.effects.itemChance){
        const kinds=['shield','magnet','double','star','rush'];
        const kind=kinds[Math.floor(this.random()*kinds.length)];
        this.objects.push({type:'item',kind:kind,x:x+70+this.random()*80,y:120+this.random()*95,width:28,height:28});
      }

      if(this.coinRushFor>0){
        for(let i=0;i<7;i++)this.objects.push({type:'coin',kind:'coin',x:x+i*29,y:80+Math.sin(i*.8)*42,width:18,height:18});
      }

      const pace=Math.max(.72,1.42-(this.speed-250)/900);
      this.spawnIn=pace+this.random()*.42;
    }

    revive() {
      if(this.revives<=0)return false;
      this.revives--;
      this.dead=false;
      this.invincibleFor=3;
      this.player.y=0;
      this.player.vy=0;
      this.player.jumps=0;
      this.objects=this.objects.filter(o=>o.x>this.player.x+180||o.type!=='obstacle');
      this.breakCombo();
      this.emit('revive',this.player.x+20,20,30);
      this.lastEvent='revive';
      return true;
    }

    resolveHit(o) {
      if(this.invincibleFor>0||this.skillFor>0&&(this.character.active.type==='dash'||this.character.active.type==='airdash')){
        o.taken=true;
        this.stats.obstacles++;
        this.addCombo(1);
        this.bonusScore+=120;
        this.emit('break',o.x,o.y,10);
        return;
      }
      if(this.shield>0){
        this.shield--;
        o.taken=true;
        this.hitCount++;
        this.invincibleFor=Math.max(this.invincibleFor,this.effects.hitInvincible||1.1);
        this.breakCombo();
        this.emit('hit',this.player.x+18,this.player.y+20,18);
        return;
      }
      if(this.revives>0){
        this.revive();
        o.taken=true;
        return;
      }
      this.dead=true;
      this.failed=true;
      this.breakCombo();
    }

    step(dt,width) {
      if(this.dead||this.cleared)return;
      width=width||1100;
      let remaining=Math.min(Math.max(dt,0),.1);
      while(remaining>0&&!this.dead&&!this.cleared){
        const d=Math.min(remaining,1/120);
        remaining-=d;
        this.elapsed+=d;
        this.invincibleFor=Math.max(0,this.invincibleFor-d);
        this.magnetFor=Math.max(0,this.magnetFor-d);
        this.doubleScoreFor=Math.max(0,this.doubleScoreFor-d);
        this.coinRushFor=Math.max(0,this.coinRushFor-d);
        this.boosterFor=Math.max(0,this.boosterFor-d);
        this.skillFor=Math.max(0,this.skillFor-d);
        this.skillCooldown=Math.max(0,this.skillCooldown-d);
        if(this.skillCooldown<=0)this.skillReady=true;
        if(this.comboTimer>0){this.comboTimer-=d;if(this.comboTimer<=0)this.breakCombo();}

        let speed=this.round.baseSpeed+this.distance*.12;
        if(this.boosterFor>0)speed*=1.2;
        if(this.skillFor>0&&(this.character.active.type==='dash'||this.character.active.type==='airdash'))speed*=1+(this.character.active.power||.35)*this.effects.activePower*this.effects.dashPower;
        speed=Math.min(720,speed);
        this.speed=speed;
        this.distance+=speed*d/10;

        const p=this.player;
        const wasGround=p.y<=0;
        p.vy-=1780*d;
        p.y+=p.vy*d;
        if(p.y<=0){
          p.y=0;p.vy=0;p.jumps=0;p.spin=0;p.spinRate=0;
          if(!wasGround){
            this.lastLandingAt=this.elapsed;
            if(this.effects.landingBoost>0)this.boosterFor=Math.max(this.boosterFor,2);
            this.emit('land',p.x+18,0,8);
          }
        }else{
          p.slide=false;p.height=p.baseHeight;
          p.spin=(p.spin+p.spinRate*d)%(Math.PI*2);
        }

        this.spawnIn-=d;
        if(this.spawnIn<=0)this.spawn(width);

        const magnet=this.magnetFor>0?this.effects.magnet+160:this.effects.magnet;
        for(const o of this.objects){
          o.x-=speed*d;
          if(o.taken)continue;

          if((o.type==='coin'||o.type==='jelly')&&Math.abs((o.x+o.width/2)-(p.x+p.width/2))<magnet){
            const dy=Math.abs((o.y+o.height/2)-(p.y+p.height/2));
            if(dy<magnet*.72){
              o.x+=(p.x-o.x)*Math.min(1,d*8);
              o.y+=(p.y-o.y)*Math.min(1,d*8);
            }
          }

          const overlap=p.x+4<o.x+o.width&&p.x+p.width-4>o.x&&p.y+3<o.y+o.height&&p.y+p.height-3>o.y;
          if(!overlap)continue;

          if(o.type==='coin'){
            o.taken=true;this.coins++;this.stats.coins++;this.addCombo(1);
            if(p.y>20&&this.effects.airCoin>0)this.bonusScore+=Math.floor(20*this.effects.airCoin);
            this.emit('coin',o.x,o.y,3);
          }else if(o.type==='jelly'){
            o.taken=true;this.jellies++;this.stats.jellies++;this.addCombo(1);this.emit('jelly',o.x,o.y,3);
          }else if(o.type==='item'){
            o.taken=true;this.collectPower(o.kind);
          }else if(o.type==='obstacle'){
            this.resolveHit(o);
          }
        }

        for(const pt of this.particles){
          pt.x+=pt.vx*d;pt.y+=pt.vy*d;pt.vy-=420*d;pt.life-=d;
        }
        this.particles=this.particles.filter(pt=>pt.life>0);
        this.objects=this.objects.filter(o=>o.x+o.width>-60&&!o.taken);

        if(this.distance>=this.round.distance){
          this.cleared=this.objectiveMet;
          this.failed=!this.objectiveMet;
          if(!this.cleared)this.dead=true;
        }
      }
    }

    getRewards() {
      const clear=this.cleared;
      const comboBonus=Math.min(120,this.maxCombo*2);
      const gold=Math.floor((this.round.rewardGold+(this.coins*4)+comboBonus)*(clear?1:.45)*this.effects.gold);
      const gems=clear?this.round.rewardGem:0;
      return {gold:Math.max(0,gold),gems:gems,clear:clear,score:this.score,maxCombo:this.maxCombo,coins:this.coins,distance:Math.floor(this.distance)};
    }
  }

  const api={RunnerEngine:RunnerEngine,CHARACTERS:CHARACTERS,RELICS:RELICS,SETS:SETS,WORLDS:WORLDS,ROUNDS:ROUNDS,CONSUMABLES:CONSUMABLES,RARITY_ORDER:RARITY_ORDER,RARITY_WEIGHT:RARITY_WEIGHT,buildEffects:buildEffects};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.WorkHubRunner=api;
})(typeof window==='undefined'?{}:window);