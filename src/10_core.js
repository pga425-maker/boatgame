(function () {
'use strict';

/* ==========================================================================
 * CONFIG — 게임 수치는 전부 여기서 조절한다
 * 거리 단위는 대략 1 = 1m, 시간은 초, 각도는 따로 적지 않으면 라디안
 * ========================================================================== */
const CONFIG = {
  world: {
    size: 4000,           // 바다 한 변의 길이. 중심이 (0, 0)
    warnMargin: 150,      // 경계까지 이 거리 안이면 경고를 띄움
    pushMargin: 110,      // 경계까지 이 거리 안이면 안쪽으로 밀어냄
    pushAccel: 34         // 밀어내는 힘의 최대 가속도
  },
  // 레벨: 판이 끝나도 이어지는 내 레벨. 격파·웨이브 클리어로 경험치, 레벨이 오를수록 적이 세지고(enemyPer) 판 시작 포인트(startPts)를 더 받는다
  level: { xpKill: 10, xpBoss: 100, xpWave: 20, base: 100, step: 50, enemyPer: 0.03, startPts: 8 },
  // 배는 안개를 이 비율만큼만 받는다 (멀리 있는 배도 또렷하게)
  boatFog: 0.4,
  quality: {
    maxPixelRatio: 1.5,   // 렌더링 해상도 상한. 낮추면 가장 크게 빨라짐
    minPixelRatio: 0.6,   // 자동 해상도 조절의 하한
    adaptive: true,       // 프레임이 떨어지면 해상도를 자동으로 낮춤 (최저까지 낮춰도 느리면 효과도 줄임)
    maxFps: 60,           // 화면 주사율이 높아도 초당 이만큼만 그린다 (90·120Hz 기기의 발열·배터리 절약)
    oceanRings: 170,      // 바다 메쉬 해상도: 고리 수
    oceanSectors: 200,    // 바다 메쉬 해상도: 둘레 분할 수
    foamMapSize: 1024,    // 항적·거품 맵 해상도 (512로 낮추면 빨라짐)
    foamMapRange: 620,    // 항적·거품 맵이 덮는 범위 (한 변)
    maxSpray: 4200,       // 물방울 파티클 최대 개수
    maxMist: 520,         // 물안개 파티클 최대 개수
    maxSmoke: 420,        // 연기 파티클 최대 개수
    maxFire: 520,         // 불꽃·섬광 파티클 최대 개수
    maxBullets: 220,      // 동시에 날아가는 예광탄 최대 개수
    effectRange: 420,     // 이 거리보다 먼 보트는 물보라를 생략
    effectScale: 1.0,     // 물보라·물기둥 입자 양 배율
    detailWaves: 6,       // 빛 계산에 쓰는 잔파도 개수 (최대 6)
    showFps: true         // 미니맵 아래에 FPS 표시
  },
  // 저사양 모드(화면 오른쪽 위 버튼·L 키): 해상도 상한 1.0, 입자 절반, 배경 효과 줄임, 블러 끔, 안티앨리어싱 끔
  // 해상도·입자·효과는 바로 바뀌고, 바다 메쉬·입자 풀 크기·안티앨리어싱은 새로 고침하면 적용된다
  liteQuality: {
    maxPixelRatio: 1.0, minPixelRatio: 0.6, oceanRings: 110, oceanSectors: 140, foamMapSize: 512,
    maxSpray: 1600, maxMist: 200, maxSmoke: 220, maxFire: 260, maxBullets: 160,
    effectRange: 260, effectScale: 0.45, detailWaves: 3, antialias: false
  },
  // 핸드폰·태블릿(터치가 주 입력인 기기)에서는 위 quality 값 대신 이 값을 쓴다
  mobileQuality: {
    maxPixelRatio: 1.0, minPixelRatio: 0.75, oceanRings: 120, oceanSectors: 150, foamMapSize: 512,
    maxSpray: 2400, maxMist: 300, maxSmoke: 260, maxFire: 320, maxBullets: 160,
    effectRange: 300, effectScale: 0.6, detailWaves: 4
  },
  touch: {
    lookSensitivity: 0.0055, // 화면을 끌 때 시점이 도는 정도 (1픽셀당 rad)
    deadZone: 0.12,          // 조이스틱 가운데의 반응하지 않는 범위 (0~1)
    joystickZone: 0.40,      // 화면 왼쪽 이 비율 안, 아래쪽 60%를 누르면 그 자리에 조이스틱이 잡힘
    throttleGain: 1.2,       // 조이스틱을 비스듬히 밀어도 충분히 가속하도록 키우는 배율
    steerCurve: 0.65         // 조이스틱 좌우 감도 곡선 (0이면 직선, 클수록 가운데 근처가 덜 민감해 미세 조정이 쉬움)
  },
  render: {
    exposure: 0.92        // 화면 밝기 (ACES 톤매핑 노출)
  },
  // 배경: 게임 시작 전에 고른다. sun 해(밤에는 달)의 방위·고도, light 직사광 색·세기, hemi 하늘·바다 주변광,
  // hor0/hor1 수평선(해 반대쪽·해 쪽), mid0/mid1 중간 하늘, zen 천정, glow 해 둘레 빛, disc 해·달 원반,
  // cloud 구름 [어두운 면, 밝은 면, 해 쪽 빛], cov 구름 덮임(낮을수록 많음), water 물빛 배율, wave 파도 높이 배율
  env: {
    sunset: { label: '노을', sun: [250, 13], light: [1.0, 0.80, 0.56, 2.7], hemi: [0.52, 0.64, 0.86, 0.05, 0.12, 0.16, 0.95], exposure: 0.92,
      fog: [0.62, 0.64, 0.66, 0.00062], hor0: [0.44, 0.56, 0.71], hor1: [1.30, 0.80, 0.44], mid0: [0.16, 0.34, 0.64], mid1: [0.42, 0.46, 0.60],
      zen: [0.05, 0.16, 0.43], glow: [1.0, 0.60, 0.28], disc: [1.0, 0.80, 0.55], cloud: [0.34, 0.36, 0.46, 1.22, 0.96, 0.72, 1.7, 1.15, 0.72], cov: [0.55, 0.76, 0.86],
      stars: 0, sunCol: [3.2, 2.35, 1.5], water: [1, 1, 1], foam: 1, smoke: 1, wave: 1, rain: 0, lightning: 0, tracer: 1, nav: 0 },
    day: { label: '낮', sun: [200, 52], light: [1.0, 0.96, 0.90, 3.0], hemi: [0.60, 0.72, 0.95, 0.08, 0.16, 0.20, 1.1], exposure: 0.82,
      fog: [0.70, 0.78, 0.88, 0.00042], hor0: [0.60, 0.72, 0.86], hor1: [0.72, 0.80, 0.90], mid0: [0.26, 0.48, 0.84], mid1: [0.32, 0.53, 0.85],
      zen: [0.09, 0.26, 0.68], glow: [0.55, 0.52, 0.45], disc: [1.0, 0.97, 0.90], cloud: [0.60, 0.64, 0.72, 1.35, 1.35, 1.35, 1.45, 1.40, 1.30], cov: [0.56, 0.78, 0.85],
      stars: 0, sunCol: [3.4, 3.2, 2.9], water: [1.15, 1.3, 1.25], foam: 1.1, smoke: 1.05, wave: 1, rain: 0, lightning: 0, tracer: 1, nav: 0 },
    night: { label: '밤', sun: [120, 28], light: [0.55, 0.65, 0.90, 0.6], hemi: [0.12, 0.16, 0.28, 0.01, 0.02, 0.04, 0.5], exposure: 1.05,
      fog: [0.05, 0.07, 0.11, 0.00070], hor0: [0.035, 0.05, 0.09], hor1: [0.07, 0.08, 0.13], mid0: [0.015, 0.025, 0.06], mid1: [0.03, 0.04, 0.08],
      zen: [0.004, 0.008, 0.025], glow: [0.22, 0.27, 0.40], disc: [0.85, 0.92, 1.10], cloud: [0.03, 0.035, 0.05, 0.16, 0.18, 0.24, 0.30, 0.33, 0.42], cov: [0.58, 0.80, 0.70],
      stars: 1, sunCol: [0.9, 1.0, 1.3], water: [0.35, 0.40, 0.55], foam: 0.35, smoke: 0.15, wave: 1, rain: 0, lightning: 0, tracer: 1.6, nav: 1 },
    storm: { label: '폭풍', sun: [250, 25], light: [0.75, 0.78, 0.82, 1.1], hemi: [0.45, 0.50, 0.56, 0.05, 0.07, 0.08, 0.9], exposure: 0.95,
      fog: [0.32, 0.35, 0.38, 0.0011], hor0: [0.30, 0.33, 0.36], hor1: [0.36, 0.38, 0.40], mid0: [0.22, 0.24, 0.27], mid1: [0.25, 0.27, 0.30],
      zen: [0.14, 0.15, 0.17], glow: [0.08, 0.08, 0.08], disc: [0, 0, 0], cloud: [0.16, 0.17, 0.19, 0.40, 0.42, 0.45, 0.42, 0.44, 0.47], cov: [0.25, 0.55, 0.97],
      stars: 0, sunCol: [0.6, 0.62, 0.66], water: [0.55, 0.62, 0.62], foam: 0.9, smoke: 0.6, wave: 1.35, rain: 1, lightning: 1, tracer: 1.2, nav: 0 }
  },
  ocean: {
    gravity: 9.8,         // 파도가 진행하는 속도를 정함
    waveScale: 1.0,       // 파도 높이 배율 (0.6 잔잔 ~ 1.4 거침)
    fogDensity: 0.00062,  // 수평선 안개 농도
    // 큰 파도: 메쉬가 실제로 움직이고 보트가 타고 넘는다
    // length 파장, steep 가파름(전체 합이 1보다 작아야 함), dirDeg 진행 방향
    waves: [
      { length: 96.0, steep: 0.070, dirDeg: 18 },
      { length: 61.0, steep: 0.078, dirDeg: -24 },
      { length: 38.0, steep: 0.090, dirDeg: 52 },
      { length: 23.5, steep: 0.098, dirDeg: -58 },
      { length: 14.2, steep: 0.100, dirDeg: 8 },
      { length: 8.6, steep: 0.090, dirDeg: 84 }
    ],
    // 잔파도: 빛 반사 계산에만 쓰이고 보트는 영향받지 않는다
    detail: [
      { length: 5.3, steep: 0.072, dirDeg: -35 },
      { length: 3.4, steep: 0.070, dirDeg: 61 },
      { length: 2.15, steep: 0.066, dirDeg: -78 },
      { length: 1.37, steep: 0.060, dirDeg: 27 },
      { length: 0.88, steep: 0.055, dirDeg: -12 },
      { length: 0.57, steep: 0.048, dirDeg: 95 }
    ]
  },
  sun: {
    bearingDeg: 250,      // 해의 방위 (북 0, 동 90, 남 180, 서 270)
    elevationDeg: 13      // 해의 고도. 낮을수록 늦은 오후
  },
  player: {
    maxHealth: 100,
    healOnKill: 20,       // 적 한 척을 격파할 때 회복하는 체력 (보스를 잡으면 체력이 가득 참)
    maxSpeed: 36,         // 최고 속도 (1 = 약 1.94노트)
    reverseSpeed: 36,     // 후진 최고 속도 (전진과 같음)
    accel: 12.5,          // 출발 가속도. 낮출수록 묵직하게 가속 (후진 가속도 같은 세기)
    brake: 12.5,          // 전진 중 S를 누를 때 뒤로 미는 힘 (후진 가속과 같아서 감속하다 끊김 없이 후진으로 넘어감)
    dragLinear: 0.10,     // 키를 뗐을 때 물의 저항 (클수록 빨리 멈춤)
    throttleResponse: 2.4,// 엔진 반응 속도
    turnRate: 1.05,       // 최대 선회 속도 (rad/s)
    steerRamp: 0.2,       // A/D를 누르고 타가 끝까지 꺾이기까지 걸리는 시간(초). 톡 누르면 조금만 돈다
    steerReturn: 0.12,    // A/D를 떼고 타가 가운데로 돌아오는 시간(초)
    turnRefSpeed: 13,     // 이 속도가 돼야 선회가 완전히 먹힘
    yawResponse: 2.6,     // 타 반응 속도 (낮을수록 둔함)
    sideGrip: 4.7,        // 옆 미끄러짐을 잡는 힘 (낮을수록 많이 미끄러짐)
    turnDrag: 0.16,       // 선회 중 속도 손실
    bankAngle: 0.30,      // 선회할 때 안쪽으로 기우는 최대 각
    bowLift: 0.085,       // 가속·고속에서 뱃머리가 들리는 각
    turretSlew: 4.2,      // 포탑 회전 속도 (rad/s)
    sprayRate: 220       // 뱃머리 물보라 양 (한쪽, 초당 입자 수)
  },
  boost: {
    max: 100,             // 부스트 게이지 최대치
    drainPerSec: 34,      // 사용 중 초당 소모량
    regenPerSec: 16,      // 초당 충전량
    regenDelay: 1.2,      // 사용을 멈춘 뒤 충전이 시작되기까지의 시간
    speedMul: 1.5,        // 부스트 최고 속도 배율
    minToStart: 10,       // 이만큼은 차 있어야 부스트를 시작할 수 있음
    bonusPerKill: 3,      // 적 한 척을 격파할 때 쌓이는 추가 부스트(노란 게이지, 초). 다시 차지 않고 쓰면 사라짐
    bonusBarFull: 15      // 노란 게이지 막대가 꽉 차 보이는 양(초). 이보다 많이 쌓여도 그대로 쌓임
  },
  lock: {
    enabled: true,        // 처음 켜져 있는지 (게임 중 T 키로 켜고 끔)
    time: 1.0,            // 조준 원 안에 적을 이 시간(초) 동안 두면 락온
    radiusPx: 30,         // 조준 원 반경 (화면 픽셀, 마우스)
    radiusPxTouch: 46,    // 조준 원 반경 (터치)
    breakPx: 120,         // 락온된 적이 조준점에서 이만큼(픽셀) 벗어나면 락온이 풀림
    range: 800,           // 락온할 수 있는 최대 거리 (사격 컴퓨터도 같은 거리)
    hitChance: 0.8        // 락온 상태에서 쏜 기관총탄·포탄의 명중률
  },
  // 난이도: 시작 화면에서 고른다. sp 탄 퍼짐·ae 조준 오차·mn 최소 오차가 적 명중률을 정한다
  // grow: 웨이브마다 적 체력·데미지가 오르는 속도 배율 (어려움은 처음엔 보통과 비슷하지만 빨리 강해진다)
  // misMax: 내 미사일 최대 보유 수 (없으면 missile.maxAmmo), misDmg: 내 미사일 데미지 배율 (없으면 1)
  // misMob: 내 미사일 직격이 기함이 아닌 적에게 주는 데미지 = 그 배의 misMob웨이브 체력 (그 웨이브까지는 한 방, 다음 웨이브부터 조금 남는다)
  // misRate: 미사일 고속정의 미사일 간격 배율 (작을수록 자주), specials: 특수 적 등장 설정 덮어쓰기
  // eRange: 적 사거리(m). 기관총 mg(기함 mgBoss), 함포 cannon(기함 cannonBoss). 없으면 enemy 설정값 그대로
  difficulty: {
    easy:   { label: '쉬움',   dmg: 0.55, hp: 0.85, countAdd: -1, boss: 850,  sp: 0.026,  ae: 0.072, mn: 3,    grow: 0.9,
              eRange: { mg: 450, mgBoss: 550, cannon: 500, cannonBoss: 600 }, misRate: 1.2 },
    normal: { label: '보통',   dmg: 0.8,  hp: 1.0,  countAdd: 0,  boss: 650,  sp: 0.015,  ae: 0.048, mn: 2.3,  grow: 1.0,
              eRange: { mg: 450, mgBoss: 550, cannon: 500, cannonBoss: 600 } },
    hard:   { label: '어려움', dmg: 0.9,  hp: 1.0,  countAdd: 0,  boss: 750,  sp: 0.0155, ae: 0.056, mn: 2.5,  grow: 1.9, misMax: 7, misDmg: 1.3, misMob: 3,
              misRate: 0.75, specials: { misboat: { from: 2, every: 2, max: 5 } } }
  },
  // 보스를 격파하면 떨어지는 보급 상자의 아이템. weights는 나올 확률(%)
  items: {
    maxHeld: 2,           // 들고 있을 수 있는 아이템 수
    pickupRadius: 12,     // 상자를 줍는 거리
    dropP: 0.08,          // 일반 적을 격파할 때 보급 상자가 떨어질 확률 (기함은 늘 1개)
    weights: { nuke: 11, barrage: 14, torpedo: 14, cluster: 16, mines: 14, emp: 15, repair: 16 },
    // 아이템 피해는 대부분 맞은 적의 최대 체력 비율(frac). 기함은 bossFrac. 아이템으로는 나는 피해를 받지 않는다
    cluster: { k: 15, frac: 0.7, bossFrac: 0.03, R: 350, range: 1500 },        // 조준점(최대 range)으로 날아가 터지고, 자탄 k개가 그 둘레 R 안의 적을 가까운 순으로 하나씩
    // B-2 폭격: delay초 뒤 B-2가 1.5km(seek) 안에서 적이 가장 몰린 해역(반경 r) 위를 지나가며 폭탄과 무유도 미사일을 퍼붓는다. 맞은 만큼만 피해
    barrage: { delay: 2.5, seek: 1500, r: 480, bombs: 60, perEnemy: 2, scatter: 35, blast: 20, frac: 0.6, bossFrac: 0.06, rockets: 8, rFrac: 0.7, rBossFrac: 0.08, rSpeed: 230 },
    torpedo: { n: 6, fan: 0.6, frac: 0.7, bossFrac: 0.08, speed: 58, range: 1600, turn: 2.6 },   // 가까운 적부터 하나씩 맡아 유도미사일처럼 끝까지 쫓는다
    mines: { n: 12, frac: 0.5, bossFrac: 0.08, r: 15, trig: 16, life: 300, seek: 1000, lead: 7, flight: 1.6, ring: 130, trailLife: 60, trailDmg: 150 },  // 1km 안에서 적이 가장 몰린 무리가 lead초 뒤 지나갈 길목에 깐다 (적이 없으면 내 주위 ring 거리). trail은 카드 '기뢰 꼬리'용
    emp: { radius: 700, time: 10 },                                             // 범위 안 적이 time초 동안 못 쏘고 느려짐
    repair: { heal: 60, shield: 15, blink: 3 },                                 // 체력 회복 + shield초 동안 무적 (끝나기 blink초 전부터 보호막이 깜빡임)
    nuke: { r: 600, delay: 2.5, bossFrac: 0.7, range: 1500 }                   // delay초 뒤 B-2가 조준점(최대 range)에 떨어뜨린다. 반경 안 일반 적 격침, 기함은 최대 체력의 bossFrac
  },
  // 레이더 미니맵과 화면 적 표시
  radar: {
    range: 1500,          // 레이더(미니맵)가 보여 주는 반경(m). 이보다 먼 적은 가장자리에 방향만 표시
    markFrom: 800,        // 이보다 먼 적은 화면에 위치 표시와 거리를 띄운다 (가까운 적은 체력바만)
    sweep: false,         // 은은한 회전 스캔선 (false면 스캔선 없이 표적이 늘 같은 밝기)
    icons: 'side'         // 레이더 표시: 'side' 옆모습 실루엣 (함정 식별 도감), 'nato' 나토 군사 기호, 'top' 위에서 본 실루엣
  },
  // 멀리 있는 적을 화면에서 잘 보이게 키운다: near(m) 안은 실제 크기, far(m)부터 max배, 그 사이는 거리에 따라 점점 커진다
  // 맞는 판정과 폭발 범위 판정도 보이는 크기를 따른다. 가까이 오면 실제 크기로 돌아와서 내 배보다 커 보이지 않는다
  enlarge: { near: 100, far: 650, max: { fast: 2.6, misboat: 2.6, gunboat: 2.2, minelayer: 2.2, sub: 2.2, boss: 1.5 } },

  // 사격 컴퓨터: 락온하지 않아도 조준점이 적 배 위에 있으면 쏠 때마다 이 확률로 탄이 그 배를 따라가 맞는다 (기관총·함포)
  fcs: {
    hitChance: 0.6,       // 명중 확률
    radiusPx: 17,         // 배 윤곽에서 이 픽셀까지는 "배 위"로 본다 (PC)
    radiusPxTouch: 26     // 같은 값 (폰·태블릿)
  },

  // 예광탄·포탄 빛줄기 모양과 색 (색은 HDR 값이라 1보다 클수록 더 밝게 빛남)
  tracer: {
    mgP: [3.2, 0.55, 0.12],    // 내 기관총 예광탄 색 (빨강, 나토식)
    mgE: [0.45, 2.8, 0.6],     // 적 기관총 예광탄 색 (초록, 동구권식)
    shellP: [3.6, 0.42, 0.08], // 내 포탄 색
    shellE: [0.35, 3.2, 0.45], // 적 포탄 색
    core: 0.7,                 // 한가운데 하얗게 달아오른 심지 밝기
    halo: 0.9,                 // 빛번짐 (작을수록 넓고 부드럽게 퍼짐)
    width: 0.0028,             // 굵기 (거리에 비례, 멀리서도 같은 두께로 보이게)
    minWidth: 0.06,            // 가까이서 최소 굵기(m)
    len: 0.045,                // 빛줄기 길이 (속도에 곱함)
    shellWidth: 0.9,           // 포탄 꼬리 굵기 배율 (기관총 예광탄 대비)
    shellLen: 0.026,           // 포탄 꼬리 길이 (속도에 곱함)
    shellGlow: 0.0055,         // 포탄 꽁무니 예광제 빛점 크기 (거리에 비례해서 화면에서는 늘 비슷한 크기)
    shellGlowMin: 0.3          // 빛점 최소 크기(m)
  },


  // 보스 미사일 요격: 락온으로는 못 잡고 직접 맞혀야 한다
  intercept: {
    mgHits: 2,            // 기관총으로 요격하는 데 필요한 명중 수
    hitRadius: 2.2,       // 기관총 탄이 미사일에 맞는 판정 반경(m). 미사일이 빨라서 실제보다 조금 크게
    shellProx: 6,         // 포탄이 미사일에서 이 거리 안을 지나가면 공중에서 터진다
    blast: 22,            // 포탄 폭발(물에 떨어진 것 포함) 반경 안의 적 미사일은 요격된다
    aimPx: 24,            // 조준점에서 적 미사일이 이 픽셀 안에 있으면 그동안 기관총은 락온·사격 컴퓨터 보정 없이 조준점으로 똑바로 쏜다 (PC)
    aimPxTouch: 34        // 같은 값 (폰·태블릿)
  },
  missile: {
    perKill: 1,           // 적 한 척을 격파할 때 얻는 미사일 수
    dropP: 0.8,           // 그 미사일이 나올 확률 (기함은 늘 bossReward발). 스킬 트리로 오른다
    bossReward: 3,        // 보스를 격파할 때 얻는 미사일 수
    maxAmmo: 5,           // 최대로 모을 수 있는 미사일 수
    hitChance: 1.0,       // 명중률 (100%). 1보다 작으면 빗나가는 미사일은 도중에 유도가 풀려 표적에서 멀리 떨어진 바다에 떨어짐
    damage: 140,          // 직격 데미지
    splash: 93,           // 폭발 범위 피해 최대치
    radius: 45,           // 폭발 범위 반경 (함포의 약 2배)
    maxSpeed: 175,        // 최고 속도 (10초에 약 1.6km)
    accel: 220,           // 가속도
    turnRate: 2.3,        // 유도 선회 속도 (rad/s). 낮을수록 급선회하는 적이 잘 피함
    lockRange: 1500,      // 이 거리 안에서 가까운 적부터 표적으로 잡음
    fuse: 4,              // 표적에서 이 거리(m) 안에 들어오면 터짐
    life: 10,             // 최대 비행 시간 (내 미사일)
    enemyLife: 20,        // 적 미사일이 터지지 않고 나를 쫓는 최대 시간
    // 직사 고속 미사일: 적 미사일 중 fastP 비율. 유도 없이 예측 지점으로 곧장, 플레어에 안 속는다
    fast: { p: 0.2, speed: 220, dmgMul: 1.15, life: 6, hpFrac: 0.6, splashFrac: 0.3 },   // 직격하면 늘 내 최대 체력의 hpFrac, 근처에서 터지면 거리에 따라 최대 splashFrac
    // 잠수함을 노리는 미사일: 수직 발사관에서 냉발사(가스로 밀어 올린 뒤 공중 점화) → 수직 상승 → 아주 빠르게 내리꽂음. 잠수 중이어도 맞는다
    // 퉁(냉발사로 튀어 오름) → hover초까지 가스 분사로 자세 조정하며 떠 있음 → eject초에 점화. dmgMul: 수직으로 꽂혀 더 세다
    // 해치가 열리고 가스로 수직으로 툭(pop초) → 측추력기 칙-(pop) 칙-(pop+gap)에 기수가 적 쪽으로 tilt만큼 꺾임 → eject초에 점화, 그 기울기로 치솟음
    top: { pop: 0.5, gap: 0.17, eject: 0.83, ejectV: 24, tilt: 0.7, dmgMul: 1.3, lean: 0.84, climbSpeed: 230, climbAcc: 340, climbMax: 2.6, apex: [90, 170], diveTurn: 5, diveSpeed: 520, diveAcc: 800 },
    cooldown: 0.6         // 연달아 쏠 때의 최소 간격
  },
  // 플레어: F 키·플레어 버튼. 적을 격파할 때마다 perKill개씩 쌓이고(상한 없음), 한 번 쓰면 cooldown초 뒤에 다시 쓸 수 있다
  // 날아오는 적 미사일 쪽(없으면 가까운 적 쪽, 적도 없으면 배 뒤쪽)으로 왼쪽·가운데·오른쪽 세 줄기, 낮은 층과 높은 층 두 겹으로 자탄이 퍼진다
  // 나를 쫓던 적 미사일은 하나하나 decoyP 확률로 자탄을 쫓아가 부딪혀 터진다
  flare: {
    start: 2,             // 처음 들고 시작하는 수
    perKill: 2,           // 한 척 격파할 때 쌓이는 수 (최대치 없음)
    cooldown: 0.5,        // 다시 쓸 수 있을 때까지(초)
    low: 12, high: 8,     // 낮은 층·높은 층 자탄 수
    gap: 0.075,           // 자탄이 차례로 튀어나오는 간격(초): 1.3초쯤 동안 계속 뿜어져 나온다
    seq: 1.4,             // 뿜어내는 동안 새로 날아든 적 미사일도 속인다(초)
    autoR: 250,           // 자동 플레어(상점): 적 미사일이 이 거리 안에 들어오면 저절로 쏜다
    blindR: 350, blindT: 3, blindErr: 3, blindSp: 2.5,   // 섬광: 쏠 때 이 거리 안 적은 blindT초 동안 조준 오차 ×blindErr, 기관총 퍼짐 ×blindSp, 미사일 못 쏨
    life: [3.2, 4.2],     // 자탄이 타는 시간 범위(초)
    gravity: 13, drag: 0.9,
    decoyP: 0.6,          // 날아오던 적 미사일 하나가 속을 확률
    range: 600,           // 이 거리 안에서 나를 쫓던 미사일만 속는다
    hitR: 6,              // 미사일이 자탄에 이만큼 가까워지면 부딪혀 터진다(m)
    shockR: 25,           // 속은 미사일이 터진 자리가 이 거리 안이면 충격 데미지
    shockMax: 0.25,       // 충격 데미지 최대치 (그 미사일 데미지 대비, 가까울수록 크다)
    light: 6              // 밤에 둘레를 비추는 빛 세기
  },
  // 스킬 트리: 격파할 때마다 포인트(일반 perKill, 기함 perBoss). 일시정지(Esc·K·폰 일시정지 버튼)하면 나오는 트리에서 쓴다
  // 나무마다 아래 뿌리에서 시작해 두 갈래로 뻗고, 큰 마디에서 모였다가 맨 위 궁극 스킬 두 개로 끝난다
  // 마디: id, 이름, x(0~1 가로 위치), row(0이 맨 아래), max(단계 수), cost(단계당 포인트), req(앞 마디들 중 하나), big(큰 마디: 앞 마디를 끝까지 찍어야 열림), fx(단계당 효과)
  skills: {
    perKill: 8, perBoss: 30,
    // 배 강화: 한 번에 cost점, 성공하면 기관총 데미지·최대 체력·미사일 데미지가 각각 per씩. rates[n]이 n+1강 성공 확률 (실패하면 포인트만 잃는다)
    // 끝없이 강화: rates[n]이 n+1강 확률, 그 뒤로는 after에서 1강마다 step씩 내려가고 min 밑으로는 안 내려간다
    ship: { cost: 10, per: 0.03, rates: [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55], after: 0.5, step: 0.02, min: 0.2 },
    // 포인트 상점
    shop: [
      { id: 'missile', name: '유도미사일 2발', cost: 30, n: 2 },
      { id: 'shield', name: '무적 보호권', cost: 70 },
      { id: 'barrage', name: 'B-2 폭격', cost: 80 },
      { id: 'nuke', name: '핵폭탄', cost: 100 },
      { id: 'cluster', name: '집속탄', cost: 50 },
      { id: 'torpedo', name: '어뢰', cost: 50 },
      { id: 'mines', name: '기뢰', cost: 35 },
      { id: 'emp', name: 'EMP', cost: 40 },
      { id: 'repair', name: '수리', cost: 40 },
      { id: 'smoke1', name: '연막탄 1발', cost: 15, smoke: 1 },
      { id: 'smoke5', name: '연막탄 5발', cost: 60, smoke: 5 },
      { id: 'autoflare', name: '자동 플레어', cost: 60, perm: true },
      { id: 'topdown', name: '탑다운 미사일', cost: 70, perm: true }
    ],
    trees: [
      { key: 'hull', name: '선체', color: '#3ee08a', nodes: [
        { id: 'h0', name: '두꺼운 선체', x: 0.5, row: 0, max: 3, cost: 3, big: true, fx: { hp: 6 } },
        { id: 'h1', name: '장갑판', x: 0.22, row: 1, max: 3, cost: 4, req: ['h0'], fx: { armor: 0.02 } },
        { id: 'h2', name: '전투 수리', x: 0.78, row: 1, max: 3, cost: 4, req: ['h0'], fx: { killHeal: 2 } },
        { id: 'h3', name: '이중 선체', x: 0.22, row: 2, max: 1, cost: 10, req: ['h1'], big: true, fx: { hp: 25 } },
        { id: 'h4', name: '자동 수리', x: 0.78, row: 2, max: 1, cost: 10, req: ['h2'], big: true, fx: { regen: 0.5 } },
        { id: 'h5', name: '보강 늑골', x: 0.18, row: 3, max: 3, cost: 6, req: ['h3'], fx: { hp: 6 } },
        { id: 'h6', name: '복합 장갑', x: 0.5, row: 3, max: 3, cost: 6, req: ['h3', 'h4'], fx: { armor: 0.025 } },
        { id: 'h7', name: '응급 수리', x: 0.82, row: 3, max: 3, cost: 6, req: ['h4'], fx: { killHeal: 2 } },
        { id: 'h8', name: '요새 선체', x: 0.32, row: 4, max: 1, cost: 16, req: ['h5', 'h6'], big: true, ult: true, fx: { hp: 35 } },
        { id: 'h9', name: '나노 수리', x: 0.68, row: 4, max: 1, cost: 16, req: ['h6', 'h7'], big: true, ult: true, fx: { regen: 0.6 } }
      ] },
      { key: 'mg', name: '기관총', color: '#ffd23e', nodes: [
        { id: 'g0', name: '강화 탄약', x: 0.5, row: 0, max: 3, cost: 3, big: true, fx: { mg: 0.04 } },
        { id: 'g1', name: '철갑탄', x: 0.22, row: 1, max: 3, cost: 4, req: ['g0'], fx: { mg: 0.04 } },
        { id: 'g2', name: '급탄 장치', x: 0.78, row: 1, max: 3, cost: 4, req: ['g0'], fx: { mgRate: 0.05 } },
        { id: 'g3', name: '고폭 탄두', x: 0.22, row: 2, max: 1, cost: 10, req: ['g1'], big: true, fx: { mg: 0.12 } },
        { id: 'g4', name: '쌍열 급탄', x: 0.78, row: 2, max: 1, cost: 10, req: ['g2'], big: true, fx: { mgRate: 0.14 } },
        { id: 'g5', name: '정밀 가공', x: 0.18, row: 3, max: 3, cost: 6, req: ['g3'], fx: { mg: 0.04 } },
        { id: 'g6', name: '긴 총열', x: 0.5, row: 3, max: 3, cost: 6, req: ['g3', 'g4'], fx: { mgRange: 0.06 } },
        { id: 'g7', name: '냉각 총열', x: 0.82, row: 3, max: 3, cost: 6, req: ['g4'], fx: { mgRate: 0.05 } },
        { id: 'g8', name: '파쇄탄', x: 0.32, row: 4, max: 1, cost: 16, req: ['g5', 'g6'], big: true, ult: true, fx: { mg: 0.20 } },
        { id: 'g9', name: '회전 총열', x: 0.68, row: 4, max: 1, cost: 16, req: ['g6', 'g7'], big: true, ult: true, fx: { mgRate: 0.18 } }
      ] },
      { key: 'cn', name: '함포', color: '#ff4a3a', nodes: [
        { id: 'c0', name: '강화 장약', x: 0.5, row: 0, max: 3, cost: 3, big: true, fx: { cn: 0.04 } },
        { id: 'c1', name: '고폭 포탄', x: 0.22, row: 1, max: 3, cost: 4, req: ['c0'], fx: { cn: 0.04 } },
        { id: 'c2', name: '장전 훈련', x: 0.78, row: 1, max: 3, cost: 4, req: ['c0'], fx: { reload: 0.03 } },
        { id: 'c3', name: '대형 작약', x: 0.22, row: 2, max: 1, cost: 10, req: ['c1'], big: true, fx: { blast: 0.25 } },
        { id: 'c4', name: '자동 장전기', x: 0.78, row: 2, max: 1, cost: 10, req: ['c2'], big: true, fx: { reload: 0.08 } },
        { id: 'c5', name: '관통 포탄', x: 0.18, row: 3, max: 3, cost: 6, req: ['c3'], fx: { cn: 0.04 } },
        { id: 'c6', name: '파편 포탄', x: 0.5, row: 3, max: 3, cost: 6, req: ['c3', 'c4'], fx: { blast: 0.08 } },
        { id: 'c7', name: '탄약 승강기', x: 0.82, row: 3, max: 3, cost: 6, req: ['c4'], fx: { reload: 0.03 } },
        { id: 'c8', name: '거포', x: 0.32, row: 4, max: 1, cost: 16, req: ['c5', 'c6'], big: true, ult: true, fx: { cn: 0.20 } },
        { id: 'c9', name: '속사 포탑', x: 0.68, row: 4, max: 1, cost: 16, req: ['c6', 'c7'], big: true, ult: true, fx: { reload: 0.12 } }
      ] },
      { key: 'mis', name: '미사일', color: '#c084ff', nodes: [
        { id: 'm0', name: '개량 탄두', x: 0.5, row: 0, max: 3, cost: 3, big: true, fx: { mis: 0.04 } },
        { id: 'm1', name: '성형 작약', x: 0.22, row: 1, max: 3, cost: 4, req: ['m0'], fx: { mis: 0.04 } },
        { id: 'm2', name: '노획 기술', x: 0.78, row: 1, max: 3, cost: 4, req: ['m0'], fx: { misDrop: 0.05 } },
        { id: 'm3', name: '추가 발사관', x: 0.22, row: 2, max: 1, cost: 10, req: ['m1'], big: true, fx: { misMax: 1 } },
        { id: 'm4', name: '보급선', x: 0.78, row: 2, max: 1, cost: 10, req: ['m2'], big: true, fx: { misDrop: 0.12 } },
        { id: 'm5', name: '열압력 탄두', x: 0.18, row: 3, max: 3, cost: 6, req: ['m3'], fx: { mis: 0.05 } },
        { id: 'm6', name: '확산 탄두', x: 0.5, row: 3, max: 3, cost: 6, req: ['m3', 'm4'], fx: { misBlast: 0.08 } },
        { id: 'm7', name: '현지 조달', x: 0.82, row: 3, max: 3, cost: 6, req: ['m4'], fx: { misDrop: 0.05 } },
        { id: 'm8', name: '함대 킬러', x: 0.32, row: 4, max: 1, cost: 16, req: ['m5', 'm6'], big: true, ult: true, fx: { mis: 0.20 } },
        { id: 'm9', name: '대형 탄창', x: 0.68, row: 4, max: 1, cost: 16, req: ['m6', 'm7'], big: true, ult: true, fx: { misMax: 1 } }
      ] },
      { key: 'eng', name: '엔진', color: '#4cc3ff', nodes: [
        { id: 'e0', name: '엔진 정비', x: 0.5, row: 0, max: 3, cost: 3, big: true, fx: { speed: 0.03 } },
        { id: 'e1', name: '터보차저', x: 0.22, row: 1, max: 3, cost: 4, req: ['e0'], fx: { accel: 0.07 } },
        { id: 'e2', name: '보조 연료', x: 0.78, row: 1, max: 3, cost: 4, req: ['e0'], fx: { boost: 0.08 } },
        { id: 'e3', name: '대형 방향타', x: 0.22, row: 2, max: 1, cost: 10, req: ['e1'], big: true, fx: { turn: 0.12 } },
        { id: 'e4', name: '빠른 충전', x: 0.78, row: 2, max: 1, cost: 10, req: ['e2'], big: true, fx: { boostRegen: 0.25 } },
        { id: 'e5', name: '경량 선체', x: 0.18, row: 3, max: 3, cost: 6, req: ['e3'], fx: { speed: 0.03 } },
        { id: 'e6', name: '역추진', x: 0.5, row: 3, max: 3, cost: 6, req: ['e3', 'e4'], fx: { rev: 0.10 } },
        { id: 'e7', name: '대용량 탱크', x: 0.82, row: 3, max: 3, cost: 6, req: ['e4'], fx: { boost: 0.08 } },
        { id: 'e8', name: '고출력 엔진', x: 0.32, row: 4, max: 1, cost: 16, req: ['e5', 'e6'], big: true, ult: true, fx: { speed: 0.10 } },
        { id: 'e9', name: '애프터버너', x: 0.68, row: 4, max: 1, cost: 16, req: ['e6', 'e7'], big: true, ult: true, fx: { boostSpd: 0.15 } }
      ] }
    ]
  },
  mg: {
    rate: 13,             // 초당 발사 수
    damage: 3,            // 한 발 데미지
    armor: { fast: 1.0, misboat: 1.0, gunboat: 0.7, minelayer: 0.7, sub: 0.7, boss: 0.45 },   // 장갑: 배 종류별로 기관총 데미지가 들어가는 비율 (함포·미사일·아이템은 그대로)
    speed: 400,           // 탄속
    spread: 0.014,        // 탄 퍼짐 (rad)
    range: 800,           // 사거리
    gravity: 0,           // 탄 낙차 (0 = 일직선으로 쭉 날아감)
    shake: 0.006          // 한 발마다 쌓이는 화면 흔들림 (연사해도 조준이 크게 떨리지 않게)
  },
  cannon: {
    reload: 1.5,          // 재장전 시간
    damage: 60,           // 직격 데미지 (재장전 1.5초와 함께 초당 40)
    radius: 22,           // 폭발 범위 반경
    splashK: 0.9,         // 폭발 범위 피해 (직격 대비)
    maxRange: 1000,       // 최대 사거리
    minRange: 8,          // 최소 사거리 (가까운 적도 쏠 수 있게)
    shellSpeed: 265,      // 포탄 수평 속도 (800m를 약 3초에 날아감)
    gravity: 26,          // 포탄 중력 (클수록 높은 포물선)
    recoil: 2.6,          // 발사 반동으로 보트가 밀리는 속도
    leadAssist: 1.0,      // 락온 상태에서 적의 이동(선회 포함)을 앞서 겨눠 주는 정도 (0이면 끔, 1이면 완전히)
    proximityFuse: 2.5,   // 근접 신관: 포탄이 적 선체에서 이 거리(m) 안을 지나가면 그 자리에서 터진다 (0이면 끔)
    fuseDamage: 0.6,      // 근접 신관으로 터졌을 때의 데미지 (직격 대비 비율)
    minFlight: 0.35       // 포탄 최소 비행 시간(초). 가까운 곳을 쏠 때 너무 낮게 날아 파도에 걸리지 않게 포물선을 높인다
  },
  enemy: {
    // 고속정: 빠르고 체력이 낮다. 기관총만 쓴다
    fast: {
      health: 45, maxSpeed: 31, reverseSpeed: 7, accel: 11, brake: 9, dragLinear: 0.10, throttleResponse: 2.2,
      turnRate: 1.15, turnRefSpeed: 11, yawResponse: 2.4, sideGrip: 4.0, turnDrag: 0.16, bankAngle: 0.32, bowLift: 0.09,
      turretSlew: 2.6, sprayRate: 130,
      mgDamage: 1.8,      // 기관총 한 발 데미지
      mgRate: 10,         // 초당 발사 수
      mgSpeed: 300,       // 탄속
      mgRange: 550,       // 사격을 시작하는 거리
      burst: [5, 8],      // 한 번에 쏘는 발 수 범위
      burstPause: [0.9, 1.8], // 점사 사이 쉬는 시간 범위
      orbit: [85, 150]    // 플레이어 주위를 도는 거리 범위
    },
    // 포함: 느리고 체력이 높다. 기관총과 함포를 쓴다
    gunboat: {
      health: 160, maxSpeed: 19, reverseSpeed: 5, accel: 6, brake: 6, dragLinear: 0.10, throttleResponse: 1.6,
      turnRate: 0.62, turnRefSpeed: 8, yawResponse: 1.7, sideGrip: 4.6, turnDrag: 0.14, bankAngle: 0.14, bowLift: 0.05,
      turretSlew: 1.5, sprayRate: 150,
      mgDamage: 2.2, mgRate: 8, mgSpeed: 300, mgRange: 550, burst: [6, 10], burstPause: [1.0, 1.9],
      orbit: [170, 260],
      cannonDamage: 19,   // 함포 직격 데미지
      cannonSplash: 13,   // 함포 범위 피해 최대치
      cannonRadius: 13,   // 함포 폭발 반경
      cannonReload: 4.2,  // 함포 재장전 시간
      cannonRange: [110, 600], // 함포를 쏘는 거리 범위
      shellSpeed: 105,    // 포탄 수평 속도 (느릴수록 피하기 쉬움)
      shellGravity: 22
    },
    // 미사일 고속정: 빠르고 약하다. 멀리서 미사일 2발을 쏘고 거리를 벌린다 (4웨이브부터)
    misboat: {
      health: 60, maxSpeed: 30, reverseSpeed: 7, accel: 10, brake: 9, dragLinear: 0.10, throttleResponse: 2.1,
      turnRate: 1.05, turnRefSpeed: 11, yawResponse: 2.2, sideGrip: 4.0, turnDrag: 0.16, bankAngle: 0.28, bowLift: 0.09,
      turretSlew: 2.4, sprayRate: 130,
      mgDamage: 1.6, mgRate: 9, mgSpeed: 300, mgRange: 550, burst: [5, 8], burstPause: [1.1, 2.1],
      orbit: [400, 560],
      missileEvery: [15, 20], missileSalvo: 2, missileDamage: 31, missileRadius: 10, missileTurn: 0.85, missileSpeed: 110, missileRange: 750
    },
    // 기뢰 부설함: 느리고 단단하다. 지나간 자리에 기뢰를 뿌린다 (5웨이브부터). 기뢰는 기관총·함포로 터뜨릴 수 있다
    minelayer: {
      health: 230, maxSpeed: 15, reverseSpeed: 4, accel: 5, brake: 5, dragLinear: 0.10, throttleResponse: 1.4,
      turnRate: 0.55, turnRefSpeed: 8, yawResponse: 1.5, sideGrip: 4.8, turnDrag: 0.14, bankAngle: 0.12, bowLift: 0.05,
      turretSlew: 1.4, sprayRate: 150,
      mgDamage: 2.0, mgRate: 7.5, mgSpeed: 300, mgRange: 550, burst: [6, 9], burstPause: [1.0, 1.9],
      orbit: [110, 190],
      mineEvery: 3.5,     // 기뢰를 떨어뜨리는 간격(초)
      mineDamage: 22,     // 기뢰 한 개 데미지
      mineRadius: 8,      // 닿으면 터지는 거리
      mineLife: 50        // 기뢰가 떠 있는 시간
    },
    // 잠수함: 물속에 숨어 있다가 떠올라 어뢰 2발을 쏘고 다시 잠수한다 (6웨이브부터). 떠 있을 때만 맞힐 수 있다
    sub: {
      health: 200, maxSpeed: 17, reverseSpeed: 4, accel: 5, brake: 5, dragLinear: 0.10, throttleResponse: 1.4,
      turnRate: 0.6, turnRefSpeed: 8, yawResponse: 1.5, sideGrip: 5.0, turnDrag: 0.14, bankAngle: 0.08, bowLift: 0.03,
      turretSlew: 1.4, sprayRate: 120,
      mgDamage: 0, mgRate: 1, mgSpeed: 300, mgRange: 0, burst: [1, 1], burstPause: [9, 9],
      orbit: [280, 420],
      downTime: [9, 13],  // 잠수해 있는 시간
      upTime: 6,          // 떠올라 있는 시간 (이때만 맞힐 수 있다)
      depth: 5,           // 잠수 깊이
      torpDamage: 18,     // 어뢰 한 발 데미지
      torpSpeed: 32,      // 어뢰 속도 (물살 자국이 보여서 피할 수 있다)
      torpCount: 2
    },
    // 보스(적 기함): 크고 느리다. 포탑 2개, 기관총, 미사일 일제 사격
    boss: {
      health: 1000,       // 첫 보스 체력
      maxSpeed: 15, reverseSpeed: 4, accel: 4, brake: 4, dragLinear: 0.10, throttleResponse: 1.2,
      turnRate: 0.42, turnRefSpeed: 7, yawResponse: 1.2, sideGrip: 5.5, turnDrag: 0.12, bankAngle: 0.07, bowLift: 0.03,
      turretSlew: 1.1, sprayRate: 200,
      mgDamage: 1.8, mgRate: 13, mgSpeed: 320, mgRange: 650, burst: [9, 15], burstPause: [0.75, 1.5],
      orbit: [220, 320],
      cannonDamage: 21, cannonSplash: 14, cannonRadius: 14, cannonReload: 3.6, cannonRange: [100, 700],
      shellSpeed: 110, shellGravity: 22,
      missileEvery: [26, 34], // 미사일 일제 사격 간격 범위(초)
      missileSalvo: 3,        // 한 번에 쏘는 미사일 수
      missileDamage: 35,      // 미사일 한 발 직격 데미지
      missileRadius: 11,      // 미사일 폭발 반경
      missileTurn: 0.9,       // 미사일 선회 속도 (낮을수록 급선회로 피하기 쉬움)
      missileSpeed: 110,      // 미사일 최고 속도
      missileRange: 520,      // 미사일을 쏘는 거리
      // 기함 격노: 체력이 at 아래로 떨어지는 순간 한 번. 연출을 보여 주는 invulnT초 동안만 무적
      rage: { at: 0.5, missileMul: 0.5, salvo: 4, speedMul: 1.2, escorts: 3, invulnT: 2, reloadMul: 0.66, escortHp: 1 }   // reloadMul: 함포 장전 시간 배율 (4.4초 → 2.9초)
    }
  },
  ai: {
    detectRange: 700,     // 이 거리 안에 플레이어가 들어오면 추격
    alertRadius: 320,     // 한 척이 발견하면 이 거리 안의 아군도 함께 추격
    loseRange: 1400,      // 이 거리 밖으로 벗어나면 추격을 포기하기 시작
    loseTime: 7,          // 포기하기까지 걸리는 시간
    separation: 60,       // 적끼리 유지하는 간격
    mgSpread: 0.050,      // 적 기관총 탄 퍼짐 (클수록 덜 맞음). 0.03이면 명중률 약 23%, 0.05면 약 13%
    maxShooters: 4,       // 동시에 기관총을 쏘는 적의 최대 수 (웨이브 3개마다 1씩 늘어남)
    accK: 0.82,           // 적 조준 오차·탄 퍼짐 배율 (작을수록 정확)
    evadeR: 320,          // 내 미사일이 이 거리 안으로 오면 급회전해 피한다
    dodgeP: { fast: 0.3, misboat: 0.3, gunboat: 0.15, minelayer: 0.12, boss: 0, sub: 0 },   // 피하는 중 미사일이 70m 안에 오면 이 확률로 빗나가게 만든다
    coverAt: 0.45,        // 체력이 이 비율 아래면 가까운 섬 뒤로 숨는다
    boost: { max: 100, drain: 32, regen: 11, delay: 1.5, min: 25 },   // 나를 쫓을 때만 쓰는 적 부스트 게이지
    aimError: 0.075,      // 조준 오차 (거리 대비 비율)
    aimErrorMin: 3.0,     // 최소 조준 오차(m). 바로 옆에서 쏴도 이만큼은 빗나갈 수 있음
    cannonErr: 2.4,       // 함포 조준 오차 배율 (기관총 오차 대비)
    leadMin: 0.55,        // 플레이어 움직임 예측 정도의 범위 (1이 정확)
    leadMax: 1.05,
    patrolThrottle: 0.5   // 평소 순찰 속도 (최고 속도 대비)
  },
  rounds: {
    firstCount: 6,        // 첫 웨이브의 적 수
    addPerWave: 1.2,      // 웨이브마다 늘어나는 적 수 (1.2면 대체로 1척, 다섯 웨이브에 한 번 2척)
    maxCount: 16,         // 한 웨이브의 최대 적 수
    gunboatRatio: 0.34,   // 포함 비율 (웨이브가 오를수록 조금씩 늘어남)
    healthGrowth: 0.18,   // 웨이브마다 적 체력 증가율
    healthGrowth2: 0.006, // 뒤로 갈수록 더 가파르게 (웨이브 수의 제곱에 곱함)
    damageGrowth: 0.07,   // 웨이브마다 적 데미지 증가율
    damageGrowth2: 0.002, // 뒤로 갈수록 더 가파르게
    accuracyGrowth: 0.03, // 웨이브마다 적 명중률 증가율
    spawnMinDist: 620,    // 새 웨이브가 나타나는 최소 거리
    spawnMaxDist: 950,    // 새 웨이브가 나타나는 최대 거리
    nextDelay: 4.5,       // 전멸 후 다음 웨이브까지의 시간
    bossEvery: 3,         // 이 웨이브마다 보스가 나옴 (3, 6, 9...)
    bossEscorts: 4,       // 첫 보스와 함께 나오는 호위 고속정 수 (보스마다 1척씩 늘어남)
    bossEscortsMax: 7,
    bossGrowPow: 0.7,     // 보스 체력이 일반 적 체력 증가를 따라가는 정도 (1이면 같게, 낮을수록 천천히)
    // 새 적: from 웨이브부터 1척, every 웨이브마다 1척씩 더 (최대 max). 그만큼 고속정 자리를 대신한다
    specials: { misboat: { from: 2, every: 3, max: 4 }, minelayer: { from: 5, every: 8, max: 2 }, sub: { from: 4, every: 4, max: 3 } }
  },
  camera: {
    fov: 62,              // 3인칭 기본 시야각 (도)
    fovFirstPerson: 72,   // 1인칭 기본 시야각 (도)
    fovSpeedAdd: 13,      // 최고 속도에서 더해지는 시야각
    fovBoostAdd: 9,       // 부스트 중 추가 시야각
    sensitivity: 0.0022,  // 마우스 감도
    distance: 20,         // 3인칭 카메라 거리
    height: 5.4,          // 3인칭 카메라가 바라보는 중심 높이
    pitch: -0.10,         // 3인칭 기본 내려다보는 각
    shake: 1.0,           // 카메라 흔들림 배율 (0이면 끔)
    edgeZone: 0.55,       // 커서 조준 모드: 화면 중앙에서 이 비율을 넘으면 시점이 돎
    edgeTurnRate: 1.9,    // 커서 조준 모드: 시점 회전 속도 (rad/s)
    followHullDelay: 1.0, // 마우스를 멈추고 이 시간이 지나면 시점이 선체 회전을 따라감
    followHullRate: 1.2,  // 선체 회전을 따라가기 시작하는 빠르기 (낮을수록 천천히 스며들 듯 돈다)
    followPos: 7,         // 3인칭 카메라가 보트 위치를 따라가는 빠르기 (낮을수록 부드럽고 살짝 늦게 따라옴)
    followHeight: 3.2     // 카메라가 보트 높이(파도에 출렁임)를 따라가는 빠르기 (낮을수록 화면이 덜 출렁임)
  },
  // 연막탄: C 키·연막 버튼. 늘 per발씩 한꺼번에 쏜다. 적이 near보다 멀면 적 쪽 dist 지점에, 가까우면 내 둘레에 원형 연막
  // 연막이 시선을 가리면 적은 나를 못 본다(사격·미사일·드론 유도 중단). 배가 지나가면 연막이 갈라진 틈이 생긴다
  smoke: { per: 5, near: 300, dist: [300, 400], fan: 0.42, ring: 22, cloudR: 44, grow: 2.2, life: 22, height: 26, carveR: 10, carveT: 7, autoHp: 25, puffs: 34 },
  // 하늘의 적: 공격 헬기(기총·로켓)와 자폭 드론 떼. 레이더에는 세모로 보인다
  air: {
    heli: { hp: 90, alt: [30, 42], speed: 40, orbit: [230, 360], mgDamage: 1.5, mgRate: 9, mgSpeed: 320, mgRange: 520, burst: [6, 10], burstPause: [1.3, 2.3],
      rocketEvery: [8, 11], rockets: 4, rocketDmg: 9, rocketR: 10, rocketSpeed: 150, from: 5, every: 4, max: 3 },
    drone: { hp: 5, alt: [14, 24], speed: 44, diveSpeed: 64, diveR: 150, dmg: 13, r: 9, from: 4, size: [4, 11], decoyP: 0.65 }
  },
  // 섬과 암초: 섬은 탄·미사일을 막고, 부딪히면 멈춘다. 암초에 걸리면 배가 서고 피해를 입는다 (적도 같다)
  isles: { n: 6, r: [70, 150], h: [20, 52], reefs: 5, reefR: [28, 50], rocks: [10, 16], clearR: 520, reefDmg: 6, reefSpeedDmg: 0.9, reefStopK: 0.22, hitDmg: 0.8 },
  // 특수 웨이브: from 웨이브부터, 보스가 아닌 웨이브에 p 확률. 안개는 시야 fogDen, 야간 기습은 적이 가까이(near)에서 불을 끄고 나타난다
  special: { from: 4, p: 0.32, fogDen: 0.0056, nightNear: [430, 600], escortDist: 1300, escortSpeed: 9, escortReward: { pts: 40, mis: 2, paint: 15 }, stormSpread: 1.25 },
  // 페인트: 격파·웨이브 클리어로 모아서 배 스킨을 연다 (판이 끝나도 남는다)
  paint: { kill: 1, boss: 8, wave: 3, heli: 2 },
  audio: {
    master: 0.55,         // 전체 음량
    engine: 0.55,         // 엔진음 음량
    effects: 1.0,         // 효과음 음량
    music: 0.5            // 배경음악 음량 (일시정지 화면의 음악 버튼으로 크게·작게·끄기)
  },
  // 강화 카드: 웨이브를 깰 때마다 3장 중 1장을 고른다. 카드 한 장마다 등급을 굴리고, 그 등급 안에서 카드를 굴린다
  cards: {
    enabled: true,        // 웨이브를 깰 때마다 카드 화면을 띄운다
    tierP: [43, 40, 10, 7],   // 동·은·금·플래티넘 확률(%)
    reuseAfter: 35,       // 고른 카드가 이만큼 쌓이면 이미 고른 카드도 다시 나온다 (그 전에는 한 번씩만)
    scaleWithWave: true,  // 고정 피해 카드(화상·들이받기·연쇄 폭발·지원 포격·포탑·드론)는 적 체력이 느는 만큼, 방어막·수리 드론은 적 데미지가 느는 만큼 같이 커진다
    // 카드 한 장(한 번 쌓을 때)의 효과 크기
    v: {
      reload: 0.05,      cdmg: 0.05,      range: 0.10,     mgdmg: 0.07,    mgrate: 0.07,   misdmg: 0.05,
      hp: 8,             armorB: 0.05,    heal: 10,        speed: 0.05,    rev: 0.10,      boost: 0.10,     luck: 2,
      burnDps: 2,        burnTime: 2.5,   blast: 0.30,     acc: 0.12,      misdmgS: 0.15,   misMax: 1,
      // 공통 카드 [동, 은, 금]: 수리 키트(즉시 회복), 기관총·함포 데미지, 함포 폭발 범위, 미사일·플레어 보급(즉시), 선체 보강(최대 체력)
      common: { kit: [20, 35, 60], mg: [0.06, 0.12, 0.22], cn: [0.06, 0.12, 0.22], bl: [0.15, 0.35, 0.65], blDmg: [0.08, 0.20, 0.40], ms: [1, 2, 4], fl: [2, 4, 8], hl: [8, 16, 30] },
      lock: 0.30,        armorS: 0.10,    ram: 60,         mines: 2,       empR: 0.10,     empT: 1,         repHeal: 15,
      repShield: 1,      exec: 0.20,      execAt: 0.5,     crisis: 0.50,   crisisAt: 0.5,
      twinMul: 0.4,      ap: 0.2,         lineMul: 0.4,    lootP: 0.08,    regen: 3,       regenEvery: 4,
      steal: 0.015,      shield: 8,       shieldEvery: 20, thorns: 5.0,    slot: 1,        slotItems: 2,    supplyHp: 20,    supplyMis: 1,    supplyItem: 0.2,
      support: 15,       supportDelay: 4, turretRate: 5,   turretDmg: 2.5, turretRange: 450, droneDmg: 4, droneEvery: 0.5,
      droneRange: 500,   chain: 25,       chainR: 70,      misDoubleP: 0.25, frenzyEvery: 25, frenzyTime: 8, frenzyMg: 1.5,
      undyingHp: 1.0,    undyingT: 5,
      // 추가 카드 (동)
      shellSpd: 0.10,    near: 0.05,      nearR: 200,      far: 0.25,      farR: 400,      bossHunt: 0.30,  fastHunt: 0.40,
      dodge: 0.15,       boostRegen: 0.15,
      // (은)
      crit: 0.05,        critMul: 2,      focus: 0.01,     focusMax: 8,   focusReset: 2,  haste: 0.20,     hasteT: 3,
      smokeAt: 0.3,      smokeT: 6,       smokeErr: 4,     shock: 1.5,     shockMul: 0.5,  shockStun: 0.8, killHeal: 20,
      // (금)
      guided: 0.15,      guidedDmg: 0.15,      cluster: 0.15,   clusterN: 3,     clusterR: 10,   zapP: 0.04,     zapDmg: 10,      zapN: 2,         zapR: 120,
      ice: 5,            iceR: 25,            chainMis: 0.3,   chainMisR: 400,  mineEvery: 1.2, reflectP: 0.5, combo: 0.04,     comboMax: 5,     comboT: 5,
      bossLoot: 1,       revenge: 1.5,    revengeCd: 3,    secondHp: 20,   secondT: 2,     secondR: 120,    secondPush: 30,
      // (플래티넘)
      bomberEvery: 45,   bomberN: 8,      bomberDmg: 45,   bomberR: 25,    allyDmg: 2.0,     allyRate: 8,     allyRange: 400,
      subEvery: 20,      subDmg: 150,     railEvery: 8,    railMul: 2.5,     railW: 6,       railRange: 1500,
      ewR: 300,          ewN: 3,          ewT: 10,         ewVuln: 0.4,          salvoEvery: 20, salvoN: 2,      bsHp: 40,        bsDmg: 0.15,     bsSpeed: 0.10,
      killAt: 0.15,      rage: 1.0,       overMul: 2,      misDefEvery: 3, misDefR: 200,  ghostR: 400,     ghostN: 3,       ghostHp: 50,
      ghostHeal: 30,     ghostT: 10
    },
    // 쌓을 때 상한 (null이면 상한 없음)
    cap: { armor: 0.6, reloadMin: 0.75, acc: 0.95, slots: 4, rareMax: 2 }   // 받는 피해 감소 최대 60%, 함포 장전 최소 0.75초, 명중률 최대 95%, 아이템 칸 최대 4, 금·플래티넘은 같은 카드 최대 2장
  }
};

function fatal(msg) {
  var el = document.getElementById('fatal');
  document.getElementById('fatal-msg').textContent = msg;
  el.classList.remove('off');
  document.getElementById('start').classList.add('off');
}
if (typeof THREE === 'undefined') {
  fatal('3D 라이브러리(Three.js)를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로 고침해 주세요.');
  return;
}

/* ==========================================================================
 * 공용 도구
 * ========================================================================== */
const TAU = Math.PI * 2;
const HALF = CONFIG.world.size * 0.5;
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const rnd = Math.random;
// 터치가 주 입력인 기기(핸드폰·태블릿)인지. 그렇다면 그래픽을 가볍게 바꾼다
const TOUCH_DEVICE = (navigator.maxTouchPoints || 0) > 0 && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
if (TOUCH_DEVICE) Object.assign(CONFIG.quality, CONFIG.mobileQuality);
// 크롬북·코어 4개 이하·메모리 4GB 이하: 안티앨리어싱을 끄고 바다·거품 맵을 조금 가볍게 (해상도 상한 1.5는 그대로, 느리면 자동으로 낮춘다)
const LOW_HW = /CrOS/.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
if (LOW_HW || TOUCH_DEVICE) CONFIG.quality.antialias = false;
if (LOW_HW && !TOUCH_DEVICE) Object.assign(CONFIG.quality, { foamMapSize: 512, detailWaves: 4, oceanRings: 140, oceanSectors: 170 });
// 저사양 모드는 저장된 설정에서 바로 읽는다 (바다·입자 풀을 만들기 전에 알아야 해서)
let LITE_ON = false;
try { LITE_ON = JSON.parse(localStorage.getItem('gr_boat_set_v1') || '{}').lo === 1; } catch { LITE_ON = false; }
const QBASE = Object.assign({}, CONFIG.quality);
if (LITE_ON) Object.assign(CONFIG.quality, CONFIG.liteQuality);

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function approach(v, t, step) { return v < t ? Math.min(t, v + step) : Math.max(t, v - step); }   // t를 향해 step만큼만 다가간다
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth01(t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }
function rr(a, b) { return a + (b - a) * rnd(); }
function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
// 프레임 속도와 무관하게 같은 빠르기로 목표값에 다가간다
function damp(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
function $(id) { return document.getElementById(id); }

// 매 프레임 새로 만들지 않도록 미리 만들어 두고 돌려 쓰는 임시 객체
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _e1 = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

// 게임 안 시간(초). 일시정지 중에는 흐르지 않는다
let simTime = 0;

/* ==========================================================================
 * 파도 — 셰이더(GLSL)와 물리(JS)가 같은 표를 쓴다
 * 거스트너 파도 한 개: f = k(d·p) - ωt
 *   수평 변위 = d * a * cos(f),  수직 변위 = a * sin(f),  a = steep / k
 * ========================================================================== */
function makeWaveTable(list, scale) {
  const n = list.length;
  const T = {
    n: n, maxAmp: 0,
    dx: new Float64Array(n), dz: new Float64Array(n), k: new Float64Array(n),
    a: new Float64Array(n), s: new Float64Array(n), om: new Float64Array(n), len: new Float64Array(n)
  };
  for (let i = 0; i < n; i++) {
    const w = list[i], ang = w.dirDeg * Math.PI / 180;
    const k = TAU / w.length, s = w.steep * scale;
    T.dx[i] = Math.cos(ang); T.dz[i] = Math.sin(ang);
    T.k[i] = k; T.s[i] = s; T.a[i] = s / k;
    T.om[i] = Math.sqrt(CONFIG.ocean.gravity * k);
    T.len[i] = w.length;
    T.maxAmp += s / k;
  }
  return T;
}
const WV = makeWaveTable(CONFIG.ocean.waves, CONFIG.ocean.waveScale);                 // 큰 파도 (메쉬 + 물리)
const WD = makeWaveTable(CONFIG.ocean.detail.slice(0, CONFIG.quality.detailWaves), Math.min(CONFIG.ocean.waveScale, 1.2)); // 잔파도 (빛 계산 전용)

// 월드 좌표 (x, z)의 수면 높이.
// 거스트너 파도는 물을 수평으로도 밀기 때문에, 그 자리에 온 물이 원래 어디 있었는지를 반복 계산으로 거꾸로 찾는다.
// 배경(폭풍)에 따라 큰 파도 높이를 바꾸는 배율. 셰이더에는 uWaveAmp로 같은 값이 들어간다
let WAMP = 1;
const uWaveAmp = { value: 1 };
function wvMax() { return WV.maxAmp * WAMP; }
function waveHeight(x, z, t) {
  const n = WV.n, dxs = WV.dx, dzs = WV.dz, ks = WV.k, as = WV.a, oms = WV.om, A = WAMP;
  let px = x, pz = z, ox, oz, f, c, i;
  for (let it = 0; it < 2; it++) {
    ox = 0; oz = 0;
    for (i = 0; i < n; i++) {
      f = ks[i] * (dxs[i] * px + dzs[i] * pz) - oms[i] * t;
      c = Math.cos(f) * as[i] * A;
      ox += dxs[i] * c; oz += dzs[i] * c;
    }
    px = x - ox; pz = z - oz;
  }
  let h = 0;
  for (i = 0; i < n; i++) {
    f = ks[i] * (dxs[i] * px + dzs[i] * pz) - oms[i] * t;
    h += Math.sin(f) * as[i];
  }
  return h * A;
}

// ---- 같은 표에서 GLSL 코드를 만들어 낸다 ----
function gf(v) { return '(' + v.toFixed(6) + ')'; }

// 정점 셰이더용: 변위. 멀리 있는 정점은 간격이 넓어 짧은 파도를 표현할 수 없으므로 파장에 따라 서서히 뺀다
function glslWaveDisp() {
  let s = 'uniform float uWaveAmp;\nvec3 waveDisp(vec2 p, float t, float dist){\n  vec3 d = vec3(0.0);\n  float f; float c; float fd;\n';
  for (let i = 0; i < WV.n; i++) {
    s += '  fd = 1.0 - smoothstep(' + gf(WV.len[i] * 4.0) + ', ' + gf(WV.len[i] * 8.5) + ', dist);\n';
    s += '  f = ' + gf(WV.k[i]) + ' * (p.x * ' + gf(WV.dx[i]) + ' + p.y * ' + gf(WV.dz[i]) + ') - ' + gf(WV.om[i]) + ' * t;\n';
    s += '  c = cos(f) * ' + gf(WV.a[i]) + ' * fd * uWaveAmp;\n';
    s += '  d.x += ' + gf(WV.dx[i]) + ' * c; d.z += ' + gf(WV.dz[i]) + ' * c; d.y += sin(f) * ' + gf(WV.a[i]) + ' * fd * uWaveAmp;\n';
  }
  return s + '  return d;\n}\n';
}

// 프래그먼트 셰이더용: 픽셀마다 노멀, 야코비안(파도 꼭대기가 뭉치는 정도), 높이를 해석적으로 구한다.
// fp는 픽셀 한 칸이 덮는 수면 크기. 픽셀보다 짧은 파도는 노멀에서 빼고 그만큼을 거칠기(vr)로 넘긴다
function glslWaveShade() {
  let s = 'uniform float uWaveAmp;\nvoid waveShade(vec2 p, float t, float fp, out vec3 nrm, out float jac, out float vr, out float hgt){\n' +
    '  float sx = 0.0; float sz = 0.0; float jxx = 0.0; float jzz = 0.0; float jxz = 0.0;\n' +
    '  float f; float sn; float cs; float w;\n  vr = 0.0; hgt = 0.0;\n';
  function one(T, i, withHeight) {
    const dx = T.dx[i], dz = T.dz[i], st = T.s[i];
    // 픽셀보다 작은 파도(w = 0)는 계산을 건너뛴다. 멀리 있는 바다일수록 많이 건너뛰어서 빨라지고, 결과는 똑같다
    s += '  w = 1.0 - smoothstep(0.28, 0.9, fp * ' + gf(1 / T.len[i]) + ');\n';
    s += '  if (w > 0.0) {\n';
    s += '    f = ' + gf(T.k[i]) + ' * (p.x * ' + gf(dx) + ' + p.y * ' + gf(dz) + ') - ' + gf(T.om[i]) + ' * t;\n';
    s += '    sn = sin(f) * w' + (withHeight ? ' * uWaveAmp' : '') + '; cs = cos(f) * w' + (withHeight ? ' * uWaveAmp' : '') + ';\n';
    s += '    sx += ' + gf(dx * st) + ' * cs; sz += ' + gf(dz * st) + ' * cs;\n';
    s += '    jxx += ' + gf(dx * dx * st) + ' * sn; jzz += ' + gf(dz * dz * st) + ' * sn; jxz += ' + gf(dx * dz * st) + ' * sn;\n';
    if (withHeight) s += '    hgt += sn * ' + gf(T.a[i]) + ';\n';     // sn에 이미 uWaveAmp가 곱해져 있다
    s += '  }\n';
    s += '  vr += (1.0 - w) * ' + gf(st * st * 0.5) + ';\n';
  }
  for (let i = 0; i < WV.n; i++) one(WV, i, true);
  for (let i = 0; i < WD.n; i++) one(WD, i, false);
  s += '  jac = (1.0 - jxx) * (1.0 - jzz) - jxz * jxz;\n';
  s += '  nrm = vec3(-sx * (1.0 - jzz) - sz * jxz, jac, -sz * (1.0 - jxx) - sx * jxz);\n}\n';
  return s;
}

// 하늘 색: 하늘 돔과 바다 반사, 수평선 안개가 같은 함수를 써서 경계가 보이지 않게 한다
const GLSL_SKY =
  'uniform vec3 uHor0;\nuniform vec3 uHor1;\nuniform vec3 uMid0;\nuniform vec3 uMid1;\nuniform vec3 uZen;\nuniform vec3 uGlow;\nuniform float uSkyFlash;\n' +
  'vec3 skyBase(vec3 d){\n' +
  '  float y = max(d.y, 0.0);\n' +
  '  vec2 az = normalize(d.xz + vec2(0.00001, 0.0));\n' +
  '  vec2 saz = normalize(uSunDir.xz);\n' +
  '  float sa = clamp(dot(az, saz) * 0.5 + 0.5, 0.0, 1.0);\n' +
  '  vec3 hor = mix(uHor0, uHor1, pow(sa, 3.5));\n' +
  '  vec3 mid = mix(uMid0, uMid1, pow(sa, 4.0));\n' +
  '  vec3 zen = uZen;\n' +
  '  vec3 c = mix(hor, mid, 1.0 - exp(-y * 8.0));\n' +
  '  c = mix(c, zen, 1.0 - exp(-y * 2.4));\n' +
  '  float mu = max(dot(normalize(vec3(d.x, y, d.z)), uSunDir), 0.0);\n' +
  '  c += uGlow * (0.30 * pow(mu, 6.0) + 1.1 * pow(mu, 60.0));\n' +
  '  c += vec3(0.75, 0.80, 1.0) * uSkyFlash * (0.4 + 0.6 * y);\n' +        // 번개: 하늘 전체가 번쩍
  '  return c;\n' +
  '}\n';

// 모든 직접 만든 셰이더의 마지막에 붙인다: ACES 톤매핑과 sRGB 출력
const GLSL_OUT = '\n  #include <tonemapping_fragment>\n  #include <encodings_fragment>\n';
