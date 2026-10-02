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


  const EXPANSION_CHARACTERS = [{"id":"melon_milk","name":"멜론우유맛 쿠키","rarity":"N","emoji":"🍈","color":"#91c98c","accent":"#f2ffe9","skill":"멜론 버블","desc":"자석 범위 +10%.","passive":{"magnet":0.1},"active":{"type":"magnet","cooldown":21,"duration":4,"power":145}},{"id":"orange_marmalade","name":"오렌지마멀레이드맛 쿠키","rarity":"N","emoji":"🍊","color":"#e99a4d","accent":"#fff4e4","skill":"마멀레이드 러시","desc":"코인 점수 +7%.","passive":{"coinScore":0.07},"active":{"type":"coinrush","cooldown":22,"duration":4,"power":1.15}},{"id":"soybean_ricecake","name":"콩가루떡맛 쿠키","rarity":"N","emoji":"🍡","color":"#d2b67c","accent":"#fff8e8","skill":"콩가루 점프","desc":"점프 높이 +6%.","passive":{"jump":0.06},"active":{"type":"airdash","cooldown":20,"duration":1.1,"power":0.18}},{"id":"vanilla_wafer","name":"바닐라웨하스맛 쿠키","rarity":"N","emoji":"🧇","color":"#e6c992","accent":"#fff9ed","skill":"웨하스 가드","desc":"피격 후 무적시간 증가.","passive":{"hitInvincible":1.5},"active":{"type":"shield","cooldown":24,"duration":0,"power":1}},{"id":"raspberry_jelly","name":"라즈베리젤리맛 쿠키","rarity":"N","emoji":"🍓","color":"#e86e8b","accent":"#fff0f4","skill":"젤리 콤보","desc":"콤보 유지 +12%.","passive":{"comboWindow":0.12},"active":{"type":"score","cooldown":22,"duration":3.5,"power":1.35}},{"id":"cream_soda","name":"크림소다맛 쿠키","rarity":"N","emoji":"🥤","color":"#7bcfc9","accent":"#ecfffd","skill":"소다 스프린트","desc":"파워업 지속 +7%.","passive":{"powerDuration":0.07},"active":{"type":"dash","cooldown":19,"duration":2,"power":0.19}},{"id":"peanut_butter","name":"피넛버터맛 쿠키","rarity":"N","emoji":"🥜","color":"#b78352","accent":"#fff2e6","skill":"피넛 실드","desc":"골드 획득 +6%.","passive":{"gold":0.06},"active":{"type":"shield","cooldown":24,"duration":0,"power":1}},{"id":"plum_ade","name":"매실에이드맛 쿠키","rarity":"N","emoji":"🫒","color":"#86a86c","accent":"#f3f8e9","skill":"매실 마그넷","desc":"파워업 등장 +8%.","passive":{"itemChance":0.08},"active":{"type":"magnet","cooldown":21,"duration":4.2,"power":150}},{"id":"cinnamon_roll","name":"시나몬롤맛 쿠키","rarity":"N","emoji":"🥨","color":"#bc8058","accent":"#fff1e7","skill":"시나몬 대시","desc":"대시 효과 +8%.","passive":{"dashPower":0.08},"active":{"type":"dash","cooldown":19,"duration":2,"power":0.21}},{"id":"corn_soup","name":"옥수수수프맛 쿠키","rarity":"N","emoji":"🌽","color":"#e5c552","accent":"#fff9d8","skill":"수프 타임","desc":"최종 점수 +4%.","passive":{"finalScore":0.04},"active":{"type":"score","cooldown":23,"duration":3.5,"power":1.35}},{"id":"greenapple_mojito","name":"청사과모히또맛 쿠키","rarity":"R","emoji":"🍏","color":"#8ccf68","accent":"#f1ffe8","skill":"모히또 스파클","desc":"자석 +22%, 파워업 등장 +12%.","passive":{"magnet":0.22,"itemChance":0.12},"active":{"type":"magnet","cooldown":18,"duration":5,"power":185}},{"id":"mango_lassi","name":"망고라씨맛 쿠키","rarity":"R","emoji":"🥭","color":"#eeb84f","accent":"#fff7dd","skill":"라씨 러시","desc":"골드 +13%.","passive":{"gold":0.13},"active":{"type":"coinrush","cooldown":20,"duration":5,"power":1.35}},{"id":"cafe_mocha","name":"카페모카맛 쿠키","rarity":"R","emoji":"☕","color":"#8e6a59","accent":"#f7eee8","skill":"모카 오버드라이브","desc":"최종 점수 +7%.","passive":{"finalScore":0.07},"active":{"type":"score","cooldown":20,"duration":4.3,"power":1.55}},{"id":"blacktea_biscuit","name":"홍차비스킷맛 쿠키","rarity":"R","emoji":"🍪","color":"#9a735a","accent":"#f9efe7","skill":"티타임","desc":"스킬 쿨타임 -10%.","passive":{"cooldown":0.1},"active":{"type":"shield","cooldown":21,"duration":0,"power":1}},{"id":"watermelon_soda","name":"수박소다맛 쿠키","rarity":"R","emoji":"🍉","color":"#e35f67","accent":"#eaffef","skill":"수박 버블","desc":"콤보 유지 +25%.","passive":{"comboWindow":0.25},"active":{"type":"magnet","cooldown":19,"duration":5,"power":185}},{"id":"purple_sweetpotato","name":"자색고구마라떼맛 쿠키","rarity":"R","emoji":"🍠","color":"#8b66a8","accent":"#f6efff","skill":"라떼 가드","desc":"시작 실드 1개.","passive":{"startShield":1},"active":{"type":"shield","cooldown":23,"duration":0,"power":1}},{"id":"pineapple_coco","name":"파인코코맛 쿠키","rarity":"R","emoji":"🍍","color":"#e8c84f","accent":"#fff8dd","skill":"트로피컬 대시","desc":"대시 효과 +16%.","passive":{"dashPower":0.16},"active":{"type":"dash","cooldown":17,"duration":2.5,"power":0.31}},{"id":"salt_bread","name":"소금빵맛 쿠키","rarity":"R","emoji":"🥐","color":"#c59662","accent":"#fff3e5","skill":"버터 스텝","desc":"착지 가속 +8%, 골드 +6%.","passive":{"landingBoost":0.08,"gold":0.06},"active":{"type":"dash","cooldown":20,"duration":2.2,"power":0.25}},{"id":"blackcherry_ade","name":"블랙체리에이드맛 쿠키","rarity":"R","emoji":"🍒","color":"#6e3f57","accent":"#fff0f5","skill":"체리 피버","desc":"코인 점수 +14%.","passive":{"coinScore":0.14},"active":{"type":"coinrush","cooldown":19,"duration":5.4,"power":1.4}},{"id":"yuja_macaron","name":"유자마카롱맛 쿠키","rarity":"R","emoji":"🍋","color":"#e3bd48","accent":"#fff9da","skill":"유자 점프","desc":"점프 +8%, 공중 코인 +16%.","passive":{"jump":0.08,"airCoin":0.16},"active":{"type":"airdash","cooldown":17,"duration":1.5,"power":0.3}},{"id":"matcha_whitechoco","name":"말차화이트초코맛 쿠키","rarity":"SR","emoji":"🍵","color":"#6e9f69","accent":"#f1f9ec","skill":"화이트 브레이크","desc":"최종 점수 +10%, 쿨타임 -8%.","passive":{"finalScore":0.1,"cooldown":0.08},"active":{"type":"score","cooldown":18,"duration":5,"power":1.88}},{"id":"injeolmi_cream","name":"인절미크림맛 쿠키","rarity":"SR","emoji":"🍡","color":"#c6a66c","accent":"#fff6e5","skill":"크림 가드","desc":"시작 실드 1개, 골드 +10%.","passive":{"startShield":1,"gold":0.1},"active":{"type":"shield","cooldown":21,"duration":0,"power":2}},{"id":"caramel_brownie","name":"카라멜브라우니맛 쿠키","rarity":"SR","emoji":"🍫","color":"#7d4f3c","accent":"#fff0e7","skill":"브라우니 피버","desc":"콤보 점수 +18%, 최종 점수 +8%.","passive":{"comboScore":0.18,"finalScore":0.08},"active":{"type":"score","cooldown":19,"duration":5.2,"power":1.9}},{"id":"passionfruit_tea","name":"패션후르츠티맛 쿠키","rarity":"SR","emoji":"🫖","color":"#c7835e","accent":"#fff4ec","skill":"패션 마그넷","desc":"자석 +40%, 파워업 등장 +25%.","passive":{"magnet":0.4,"itemChance":0.25},"active":{"type":"magnet","cooldown":18,"duration":6,"power":220}},{"id":"jasmine_honey","name":"자스민허니맛 쿠키","rarity":"SR","emoji":"🌼","color":"#d8bd6c","accent":"#fffbed","skill":"허니 티타임","desc":"쿨타임 -13%, 파워업 지속 +18%.","passive":{"cooldown":0.13,"powerDuration":0.18},"active":{"type":"score","cooldown":19,"duration":5.2,"power":1.85}},{"id":"bluecheese_cracker","name":"블루치즈크래커맛 쿠키","rarity":"SR","emoji":"🧀","color":"#6e92c9","accent":"#eef5ff","skill":"치즈 실드","desc":"피격 무적 2.4초, 시작 실드 1개.","passive":{"hitInvincible":2.4,"startShield":1},"active":{"type":"shield","cooldown":22,"duration":0,"power":2}},{"id":"cranberry_tart","name":"크랜베리타르트맛 쿠키","rarity":"SR","emoji":"🥧","color":"#b94f61","accent":"#fff0f3","skill":"타르트 러시","desc":"코인 점수 +20%, 골드 +12%.","passive":{"coinScore":0.2,"gold":0.12},"active":{"type":"coinrush","cooldown":18,"duration":6,"power":1.55}},{"id":"darksugar_latte","name":"흑설탕라떼맛 쿠키","rarity":"SR","emoji":"🧋","color":"#6d4b42","accent":"#f7eee9","skill":"다크 버블","desc":"콤보 유지 +45%, 콤보 점수 +10%.","passive":{"comboWindow":0.45,"comboScore":0.1},"active":{"type":"magnet","cooldown":19,"duration":6,"power":225}},{"id":"peach_oolong","name":"피치우롱맛 쿠키","rarity":"SR","emoji":"🍑","color":"#de927b","accent":"#fff2ed","skill":"우롱 플로우","desc":"파워업 지속 +22%, 자석 +25%.","passive":{"powerDuration":0.22,"magnet":0.25},"active":{"type":"dash","cooldown":18,"duration":2.8,"power":0.38}},{"id":"chestnut_honey_montblanc","name":"밤꿀몽블랑맛 쿠키","rarity":"SR","emoji":"🌰","color":"#8f684b","accent":"#fff2e5","skill":"몽블랑 타임","desc":"골드 +18%, 최종 점수 +7%.","passive":{"gold":0.18,"finalScore":0.07},"active":{"type":"score","cooldown":20,"duration":5,"power":1.85}},{"id":"galaxy_grape","name":"갤럭시포도맛 쿠키","rarity":"SSR","emoji":"🌌","color":"#7258d5","accent":"#f2efff","skill":"갤럭시 피버","desc":"최종 점수 +18%, 콤보 점수 +20%.","passive":{"finalScore":0.18,"comboScore":0.2},"active":{"type":"score","cooldown":16,"duration":6.2,"power":2.25}},{"id":"platinum_vanilla","name":"플래티넘바닐라맛 쿠키","rarity":"SSR","emoji":"🤍","color":"#d8d6df","accent":"#ffffff","skill":"플래티넘 블레싱","desc":"쿨타임 -22%, 시작 실드 1개.","passive":{"cooldown":0.22,"startShield":1},"active":{"type":"shield","cooldown":18,"duration":0,"power":2}},{"id":"luna_blueberry","name":"루나블루베리맛 쿠키","rarity":"SSR","emoji":"🌙","color":"#5f68bd","accent":"#eff1ff","skill":"루나 마그넷","desc":"자석 +75%, 파워업 지속 +25%.","passive":{"magnet":0.75,"powerDuration":0.25},"active":{"type":"magnet","cooldown":16,"duration":7,"power":260}},{"id":"flame_mango","name":"플레임망고맛 쿠키","rarity":"SSR","emoji":"🔥","color":"#e56c3e","accent":"#fff0e8","skill":"플레임 러시","desc":"대시 효과 +32%, 골드 +20%.","passive":{"dashPower":0.32,"gold":0.2},"active":{"type":"dash","cooldown":15,"duration":3.3,"power":0.55}},{"id":"emerald_lime","name":"에메랄드라임맛 쿠키","rarity":"SSR","emoji":"💚","color":"#3fb37e","accent":"#eafff4","skill":"에메랄드 필드","desc":"파워업 등장 +50%, 자석 +45%.","passive":{"itemChance":0.5,"magnet":0.45},"active":{"type":"magnet","cooldown":16,"duration":7.2,"power":255}},{"id":"crystal_lychee","name":"크리스탈리치맛 쿠키","rarity":"SSR","emoji":"💎","color":"#d57ca5","accent":"#fff0f8","skill":"크리스탈 타임","desc":"최종 점수 +16%, 파워업 지속 +35%.","passive":{"finalScore":0.16,"powerDuration":0.35},"active":{"type":"score","cooldown":17,"duration":6,"power":2.2}},{"id":"rosegold_peach","name":"로즈골드피치맛 쿠키","rarity":"SSR","emoji":"🌹","color":"#d7857e","accent":"#fff0ed","skill":"로즈골드 러시","desc":"코인 점수 +25%, 골드 +22%.","passive":{"coinScore":0.25,"gold":0.22},"active":{"type":"coinrush","cooldown":17,"duration":7,"power":1.9}},{"id":"midnight_cacao","name":"미드나잇카카오맛 쿠키","rarity":"SSR","emoji":"🌑","color":"#3b3545","accent":"#f0edf4","skill":"미드나잇 브레이커","desc":"런당 1회 부활, 최종 점수 +14%.","passive":{"revive":1,"finalScore":0.14},"active":{"type":"dash","cooldown":16,"duration":3.1,"power":0.52}},{"id":"solar_yuja","name":"솔라유자맛 쿠키","rarity":"SSR","emoji":"☀️","color":"#e4ad33","accent":"#fff9dc","skill":"솔라 오버드라이브","desc":"공중 코인 +45%, 점프 +10%.","passive":{"airCoin":0.45,"jump":0.1},"active":{"type":"airdash","cooldown":15,"duration":2.2,"power":0.55}},{"id":"prism_melon","name":"프리즘멜론맛 쿠키","rarity":"SSR","emoji":"🔮","color":"#69c6a2","accent":"#effff8","skill":"프리즘 콤보","desc":"콤보 유지 +55%, 최종 점수 +15%.","passive":{"comboWindow":0.55,"finalScore":0.15},"active":{"type":"score","cooldown":16,"duration":6.2,"power":2.2}}];
  CHARACTERS.push(...EXPANSION_CHARACTERS);

  const EXPANSION_RELICS = [{"id":"melon_straw","name":"멜론우유 빨대","rarity":"N","emoji":"🥤","desc":"자석 범위 +25.","effect":{"magnetFlat":25}},{"id":"marmalade_jar","name":"마멀레이드 잼병","rarity":"N","emoji":"🫙","desc":"코인 점수 +7%.","effect":{"coinScore":0.07}},{"id":"soybean_pouch","name":"콩가루 주머니","rarity":"N","emoji":"🎒","desc":"점프 높이 +5%.","effect":{"jump":0.05}},{"id":"wafer_tin","name":"바닐라 웨하스 틴","rarity":"N","emoji":"📦","desc":"파워업 지속 +6%.","effect":{"powerDuration":0.06}},{"id":"raspberry_pin","name":"라즈베리 젤리핀","rarity":"N","emoji":"📌","desc":"콤보 유지 +10%.","effect":{"comboWindow":0.1}},{"id":"cream_soda_cap","name":"크림소다 병뚜껑","rarity":"N","emoji":"🧢","desc":"파워업 등장 +8%.","effect":{"itemChance":0.08}},{"id":"peanut_spreader","name":"피넛버터 스프레더","rarity":"N","emoji":"🥄","desc":"골드 +5%.","effect":{"gold":0.05}},{"id":"plum_glass","name":"매실에이드 잔","rarity":"N","emoji":"🥛","desc":"쿨타임 -4%.","effect":{"cooldown":0.04}},{"id":"cinnamon_stamp","name":"시나몬 롤 스탬프","rarity":"N","emoji":"🌀","desc":"대시 효과 +7%.","effect":{"dashPower":0.07}},{"id":"corn_ladle","name":"옥수수수프 국자","rarity":"N","emoji":"🥄","desc":"최종 점수 +3%.","effect":{"finalScore":0.03}},{"id":"mojito_shaker","name":"청사과 모히또 셰이커","rarity":"R","emoji":"🍸","desc":"파워업 등장 +20%.","effect":{"itemChance":0.2}},{"id":"lassi_cup","name":"망고라씨 컵","rarity":"R","emoji":"🥤","desc":"골드 +11%.","effect":{"gold":0.11}},{"id":"mocha_grinder","name":"카페모카 그라인더","rarity":"R","emoji":"⚙️","desc":"최종 점수 +7%.","effect":{"finalScore":0.07}},{"id":"blacktea_timer","name":"홍차 비스킷 타이머","rarity":"R","emoji":"⏲️","desc":"쿨타임 -10%.","effect":{"cooldown":0.1}},{"id":"watermelon_fan","name":"수박소다 부채","rarity":"R","emoji":"🪭","desc":"콤보 유지 +26%.","effect":{"comboWindow":0.26}},{"id":"sweetpotato_flask","name":"자색고구마 플라스크","rarity":"R","emoji":"🧪","desc":"시작 실드 1개.","effect":{"startShield":1}},{"id":"pineapple_shell","name":"파인코코 셸","rarity":"R","emoji":"🍍","desc":"대시 효과 +14%.","effect":{"dashPower":0.14}},{"id":"saltbread_tongs","name":"소금빵 집게","rarity":"R","emoji":"🥢","desc":"골드 +8%, 코인 점수 +6%.","effect":{"gold":0.08,"coinScore":0.06}},{"id":"blackcherry_glass","name":"블랙체리 글라스","rarity":"R","emoji":"🍷","desc":"코인 점수 +14%.","effect":{"coinScore":0.14}},{"id":"yuja_shell","name":"유자마카롱 셸","rarity":"R","emoji":"🍋","desc":"점프 +8%.","effect":{"jump":0.08}},{"id":"matcha_whisk","name":"말차 화이트초코 휘스크","rarity":"SR","emoji":"🥄","desc":"최종 점수 +12%.","effect":{"finalScore":0.12}},{"id":"injeolmi_tray","name":"인절미크림 트레이","rarity":"SR","emoji":"🍽️","desc":"시작 실드 1개, 골드 +7%.","effect":{"startShield":1,"gold":0.07}},{"id":"brownie_pan","name":"카라멜브라우니 팬","rarity":"SR","emoji":"🍳","desc":"콤보 점수 +17%.","effect":{"comboScore":0.17}},{"id":"passion_teapot","name":"패션후르츠 티팟","rarity":"SR","emoji":"🫖","desc":"자석 +95.","effect":{"magnetFlat":95}},{"id":"jasmine_lantern","name":"자스민허니 랜턴","rarity":"SR","emoji":"🏮","desc":"쿨타임 -13%, 파워업 지속 +10%.","effect":{"cooldown":0.13,"powerDuration":0.1}},{"id":"bluecheese_board","name":"블루치즈 보드","rarity":"SR","emoji":"🧀","desc":"파워업 지속 +22%.","effect":{"powerDuration":0.22}},{"id":"cranberry_fork","name":"크랜베리타르트 포크","rarity":"SR","emoji":"🍴","desc":"코인 점수 +20%, 골드 +8%.","effect":{"coinScore":0.2,"gold":0.08}},{"id":"darksugar_glass","name":"흑설탕라떼 글라스","rarity":"SR","emoji":"🥃","desc":"콤보 유지 +45%.","effect":{"comboWindow":0.45}},{"id":"oolong_kettle","name":"피치우롱 케틀","rarity":"SR","emoji":"🫖","desc":"파워업 등장 +35%.","effect":{"itemChance":0.35}},{"id":"montblanc_pick","name":"밤꿀몽블랑 픽","rarity":"SR","emoji":"🗡️","desc":"골드 +15%, 최종 점수 +6%.","effect":{"gold":0.15,"finalScore":0.06}},{"id":"galaxy_goblet","name":"갤럭시포도 고블렛","rarity":"SSR","emoji":"🏆","desc":"최종 점수 +20%, 콤보 점수 +15%.","effect":{"finalScore":0.2,"comboScore":0.15}},{"id":"platinum_spoon","name":"플래티넘바닐라 스푼","rarity":"SSR","emoji":"🥄","desc":"쿨타임 -22%.","effect":{"cooldown":0.22}},{"id":"luna_gem","name":"루나블루베리 젬","rarity":"SSR","emoji":"💙","desc":"자석 +145, 파워업 지속 +18%.","effect":{"magnetFlat":145,"powerDuration":0.18}},{"id":"flame_core","name":"플레임망고 코어","rarity":"SSR","emoji":"🔥","desc":"대시 효과 +26%, 골드 +12%.","effect":{"dashPower":0.26,"gold":0.12}},{"id":"emerald_leaf","name":"에메랄드라임 리프","rarity":"SSR","emoji":"🍃","desc":"파워업 등장 +55%.","effect":{"itemChance":0.55}},{"id":"crystal_lychee_orb","name":"크리스탈리치 오브","rarity":"SSR","emoji":"🔮","desc":"최종 점수 +18%, 파워업 지속 +20%.","effect":{"finalScore":0.18,"powerDuration":0.2}},{"id":"rosegold_fork","name":"로즈골드피치 포크","rarity":"SSR","emoji":"🍴","desc":"코인 점수 +24%, 골드 +18%.","effect":{"coinScore":0.24,"gold":0.18}},{"id":"midnight_beans","name":"미드나잇카카오 빈","rarity":"SSR","emoji":"🫘","desc":"런당 1회 부활.","effect":{"revive":1}},{"id":"solar_charm","name":"솔라유자 참","rarity":"SSR","emoji":"☀️","desc":"점프 +14%, 대시 효과 +20%.","effect":{"jump":0.14,"dashPower":0.2}},{"id":"prism_crown","name":"프리즘멜론 크라운","rarity":"SSR","emoji":"👑","desc":"최종 점수 +18%, 콤보 유지 +35%.","effect":{"finalScore":0.18,"comboWindow":0.35}}];
  RELICS.push(...EXPANSION_RELICS);

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

  SETS.push(...[{"id":"tea_house","name":"티하우스 세트","emoji":"🫖","requiredRelics":2,"characterIds":["milk_tea","earl_grey","blacktea_biscuit","jasmine_honey","peach_oolong"],"relicIds":["earl_teapot","blacktea_timer","jasmine_lantern","oolong_kettle","hourglass"],"desc":"티 캐릭터 + 관련 유물 2개: 쿨타임 -10%, 콤보 유지 +20%, 파워업 지속 +15%.","effect":{"cooldown":0.1,"comboWindow":0.2,"powerDuration":0.15}},{"id":"tropical_splash","name":"트로피컬 스플래시 세트","emoji":"🏝️","requiredRelics":2,"characterIds":["golden_mango","mango_lassi","pineapple_coco","passionfruit_tea","crystal_lychee","solar_yuja"],"relicIds":["mango_crown","lassi_cup","pineapple_shell","passion_teapot","crystal_lychee_orb","solar_charm"],"desc":"트로피컬 캐릭터 + 관련 유물 2개: 코인 +12%, 파워업 등장 +25%, 자석 +50.","effect":{"coinScore":0.12,"itemChance":0.25,"magnetFlat":50}},{"id":"bakery_forge","name":"베이커리 포지 세트","emoji":"🥐","requiredRelics":2,"characterIds":["caramel_brownie","injeolmi_cream","chestnut_honey_montblanc","salt_bread","cinnamon_roll"],"relicIds":["brownie_pan","injeolmi_tray","montblanc_pick","saltbread_tongs","cinnamon_stamp"],"desc":"베이커리 캐릭터 + 관련 유물 2개: 최종 점수 +8%, 골드 +12%, 콤보 +10%.","effect":{"finalScore":0.08,"gold":0.12,"comboScore":0.1}},{"id":"prism_royal","name":"프리즘 로열 세트","emoji":"🌈","requiredRelics":2,"characterIds":["aurora_soda","galaxy_grape","platinum_vanilla","luna_blueberry","prism_melon","rosegold_peach"],"relicIds":["aurora_crystal","galaxy_goblet","platinum_spoon","luna_gem","prism_crown","rosegold_fork"],"desc":"프리즘 캐릭터 + 관련 유물 2개: 최종 점수 +18%, 파워업 지속 +18%, 쿨타임 -8%.","effect":{"finalScore":0.18,"powerDuration":0.18,"cooldown":0.08}}]);

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
    const goal=within===0 ? 360 + world*100 : within===1 ? 28 + world*12 : within===2 ? 9000 + world*5500 : within===3 ? 14 + world*6 : 600 + world*140;
    const star2Multiplier=1.10+world*.025;
    const bonusGoal=Math.ceil(goal*star2Multiplier);
    const baseDistance=720 + within*130 + world*170;
    const courseDistance=mode==='distance'?Math.max(baseDistance,bonusGoal+140):baseDistance;
    ROUNDS.push({
      id:i+1,
      world,
      round:within+1,
      mode,
      goal,
      star2Multiplier,
      bonusGoal,
      distance:courseDistance,
      baseSpeed: 238 + world*18 + within*5,
      difficulty: .82 + world*.17 + within*.07,
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

  const POWERUPS = {
    magnet:{id:'magnet',name:'자석',emoji:'🧲',desc:'근처 코인과 젤리를 자동으로 끌어옵니다.'},
    booster:{id:'booster',name:'부스터',emoji:'⚡',desc:'속도가 크게 오르고 장애물을 빠르게 돌파합니다.'},
    giant:{id:'giant',name:'거인',emoji:'🦣',desc:'몸집이 커지고 작은 장애물을 부숩니다. 부스터와 겹치면 모든 장애물을 파괴합니다.'},
    shield:{id:'shield',name:'실드',emoji:'🛡️',desc:'충돌 1회를 막습니다.'},
    heart:{id:'heart',name:'회복젤리',emoji:'❤️',desc:'체력을 35 회복합니다.'},
    star:{id:'star',name:'무적별',emoji:'⭐',desc:'잠시 무적이 되어 장애물을 파괴합니다.'},
    double:{id:'double',name:'2배 점수',emoji:'2X',desc:'잠시 획득 점수가 2배가 됩니다.'},
    rush:{id:'rush',name:'코인 러시',emoji:'🪙',desc:'앞쪽에 코인 라인이 연속으로 생성됩니다.'}
  };

  const RARITY_HP = {N:100,R:110,SR:120,SSR:130};
  function getCharacterMaxHealth(character,level){
    const c=character||CHARACTERS[0],lv=clamp(Math.max(1,Number(level)||1),1,10);
    const defensive=(c.passive&&c.passive.startShield?10:0)+(c.active&&c.active.type==='shield'?10:0);
    return Math.round((RARITY_HP[c.rarity]||100)+defensive+(lv-1)*2);
  }

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
      this.maxHealth=getCharacterMaxHealth(this.character,this.characterLevel);
      this.health=this.maxHealth;
      this.invincibleFor=0;
      this.magnetFor=this.consumables.magnet?15:0;
      this.doubleScoreFor=0;
      this.coinRushFor=0;
      this.boosterFor=this.consumables.booster?12:0;
      this.giantFor=0;
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
      const base=this.distance*10 + this.coins*150*this.effects.coinScore + this.jellies*70 + this.comboPoints + this.bonusScore;
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
      p.spin=0;
      p.spinRate=0;
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
      if(kind==='shield')this.shield=Math.min(5,this.shield+1);
      else if(kind==='star')this.invincibleFor=Math.max(this.invincibleFor,dur*this.effects.starDuration);
      else if(kind==='magnet')this.magnetFor=Math.max(this.magnetFor,9*this.effects.powerDuration);
      else if(kind==='double')this.doubleScoreFor=Math.max(this.doubleScoreFor,8*this.effects.powerDuration);
      else if(kind==='rush')this.coinRushFor=Math.max(this.coinRushFor,7*this.effects.powerDuration);
      else if(kind==='booster')this.boosterFor=Math.max(this.boosterFor,7*this.effects.powerDuration);
      else if(kind==='giant')this.giantFor=Math.max(this.giantFor,6*this.effects.powerDuration);
      else if(kind==='heart')this.health=Math.min(this.maxHealth,this.health+35);
      else return;
      this.items++;
      this.stats.items++;
      this.addCombo(2);
      this.lastEvent=kind;
      this.emit('item',this.player.x+20,this.player.y+28,16);
    }

    pushPickup(type,x,y,kind) {
      const size=type==='item'?30:18;
      this.objects.push({type:type,kind:kind||type,x:x,y:y,width:size,height:size});
    }

    pushTrail(x,pattern,count,spacing,baseY) {
      count=count||8;spacing=spacing||30;baseY=baseY||55;
      for(let i=0;i<count;i++){
        let y=baseY;
        if(pattern==='arc')y=baseY+Math.sin((i/Math.max(1,count-1))*Math.PI)*105;
        else if(pattern==='wave')y=baseY+Math.sin(i*.9)*55;
        else if(pattern==='stairs')y=baseY+(i%5)*28;
        else if(pattern==='zigzag')y=baseY+(i%2?90:20);
        const type=i%4===0?'jelly':'coin';
        this.pushPickup(type,x+i*spacing,y,type);
      }
    }

    spawn(width) {
      const d=this.round.difficulty;
      const x=width+55;
      const early=this.round.world===0;
      const patternRoll=this.random();
      const obstacle=(kind,ox,oy,w,h)=>this.objects.push({type:'obstacle',kind,x:ox,y:oy||0,width:w,height:h});

      if(patternRoll<.12){
        // Bonus lane: lots of food, no forced obstacle.
        this.pushTrail(x,'wave',12,28,70);
        this.pushTrail(x+40,'arc',8,34,115);
      }else if(patternRoll<.30){
        obstacle('crate',x,0,38,40);
        this.pushTrail(x-25,'arc',10,31,58);
        if(!early&&this.random()<.35)obstacle('drone',x+220,52,52,28);
      }else if(patternRoll<.47){
        obstacle('drone',x,52,56,28);
        this.pushTrail(x-35,'stairs',10,30,28);
        if(!early&&this.random()<.45)obstacle('crate',x+210,0,38,40);
      }else if(patternRoll<.63){
        obstacle('wall',x,0,34,72+Math.round(22*d));
        this.pushTrail(x-28,'arc',11,31,88);
        if(this.round.round>=3&&this.random()<.45)obstacle('laser',x+240,0,72,18);
      }else if(patternRoll<.78){
        obstacle('gate',x,0,48,88);
        obstacle('drone',x+175,50,54,28);
        this.pushTrail(x-10,'zigzag',12,29,38);
      }else if(patternRoll<.91){
        obstacle('laser',x,0,78,18);
        this.pushTrail(x-20,'wave',11,31,105);
        if(!early)obstacle('crate',x+220,0,38,40);
      }else{
        // Power combo lane - intentionally encourages booster + giant.
        this.pushTrail(x,'wave',14,27,75);
        this.pushPickup('item',x+80,115,'booster');
        this.pushPickup('item',x+185,125,'giant');
        if(!early)obstacle('gate',x+320,0,50,92);
      }

      const itemChance=Math.min(.72,.42*this.effects.itemChance+.03*this.round.round);
      if(this.random()<itemChance){
        const kinds=['shield','magnet','double','star','rush','booster','giant','heart'];
        const kind=kinds[Math.floor(this.random()*kinds.length)];
        this.pushPickup('item',x+100+this.random()*170,105+this.random()*115,kind);
      }

      if(this.coinRushFor>0){
        this.pushTrail(x+20,'wave',11,26,80);
        this.pushTrail(x+70,'arc',8,30,120);
      }

      const pace=Math.max(.58,early?1.15:1.02-(this.speed-250)/1150);
      this.spawnIn=pace+this.random()*(early?.34:.28);
    }

    revive() {
      if(this.revives<=0)return false;
      this.revives--;
      this.dead=false;
      this.health=Math.max(1,Math.ceil(this.maxHealth*.55));
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
      const smashMode=this.invincibleFor>0||this.giantFor>0||(this.skillFor>0&&(this.character.active.type==='dash'||this.character.active.type==='airdash'));
      const superSmash=this.giantFor>0&&this.boosterFor>0;
      if(smashMode){
        o.taken=true;
        this.stats.obstacles++;
        this.addCombo(superSmash?3:1);
        this.bonusScore+=superSmash?320:140;
        this.emit('break',o.x,o.y,superSmash?20:10);
        return;
      }
      if(this.shield>0){
        this.shield--;
        o.taken=true;
        this.hitCount++;
        this.invincibleFor=Math.max(this.invincibleFor,this.effects.hitInvincible||1.15);
        this.breakCombo();
        this.emit('hit',this.player.x+18,this.player.y+20,18);
        return;
      }
      const damage=Math.round(56+this.round.world*8+this.round.round*2);
      this.health=Math.max(0,this.health-damage);
      this.hitCount++;
      o.taken=true;
      this.invincibleFor=Math.max(this.invincibleFor,Math.min(.75,this.effects.hitInvincible||.55));
      this.breakCombo();
      this.emit('hit',this.player.x+18,this.player.y+20,18);
      if(this.health<=0){
        if(this.revives>0)this.revive();
        else{this.dead=true;this.failed=true;}
      }
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
        this.giantFor=Math.max(0,this.giantFor-d);
        this.skillFor=Math.max(0,this.skillFor-d);
        this.skillCooldown=Math.max(0,this.skillCooldown-d);
        if(this.skillCooldown<=0)this.skillReady=true;
        if(this.comboTimer>0){this.comboTimer-=d;if(this.comboTimer<=0)this.breakCombo();}

        let speed=this.round.baseSpeed+this.distance*.12;
        if(this.boosterFor>0)speed*=1.34;
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
          p.spin=0;
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

          const giantPad=this.giantFor>0?12:0;
          const overlap=p.x+4-giantPad<o.x+o.width&&p.x+p.width-4+giantPad>o.x&&p.y+3-giantPad<o.y+o.height&&p.y+p.height-3+giantPad>o.y;
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
      return {gold:Math.max(0,gold),gems:gems,clear:clear,score:this.score,maxCombo:this.maxCombo,coins:this.coins,distance:Math.floor(this.distance),health:this.health,maxHealth:this.maxHealth,revives:this.revives};
    }
  }

  const api={RunnerEngine:RunnerEngine,CHARACTERS:CHARACTERS,RELICS:RELICS,SETS:SETS,WORLDS:WORLDS,ROUNDS:ROUNDS,CONSUMABLES:CONSUMABLES,POWERUPS:POWERUPS,RARITY_ORDER:RARITY_ORDER,RARITY_WEIGHT:RARITY_WEIGHT,buildEffects:buildEffects,getCharacterMaxHealth:getCharacterMaxHealth};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.WorkHubRunner=api;
})(typeof window==='undefined'?{}:window);