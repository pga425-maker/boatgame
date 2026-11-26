/* ==========================================================================
 * 강화 카드 — 웨이브를 깰 때마다 3장 중 1장을 골라 배를 강화한다
 * 카드 한 장마다 등급(동·은·금·플래티넘)을 먼저 굴리고, 그 등급 안에서 카드를 굴린다.
 * 같은 카드를 또 고르면 효과가 쌓인다 (고른 카드가 reuseAfter장이 되기 전에는 한 번씩만 나온다)
 * ========================================================================== */
const CARD_TIERS = ['동', '은', '금', '플래티넘'];
const CARDS = [
  // 동 20
  { id: 'reload', t: 0, name: '빠른 장전', cat: '함포' },
  { id: 'shellSpd', t: 0, name: '포탄 가속', cat: '함포' },
  { id: 'range', t: 0, name: '긴 사거리', cat: '함포·기관총' },
  { id: 'mgrate', t: 0, name: '빠른 연사', cat: '기관총' },
  { id: 'misdmg', t: 0, name: '미사일 강화', cat: '미사일' },
  { id: 'near', t: 0, name: '근접 사격', cat: '특수' },
  { id: 'far', t: 0, name: '원거리 저격', cat: '특수' },
  { id: 'bossHunt', t: 0, name: '기함 사냥꾼', cat: '특수' },
  { id: 'fastHunt', t: 0, name: '고속정 사냥꾼', cat: '특수' },
  { id: 'armorB', t: 0, name: '두꺼운 장갑', cat: '선체' },
  { id: 'heal', t: 0, name: '처치 회복', cat: '선체' },
  { id: 'speed', t: 0, name: '엔진 강화', cat: '기동' },
  { id: 'rev', t: 0, name: '빠른 후진', cat: '기동' },
  { id: 'boost', t: 0, name: '부스트 연료', cat: '기동' },
  { id: 'boostRegen', t: 0, name: '부스트 충전', cat: '기동' },
  { id: 'dodge', t: 0, name: '회피 기동', cat: '기동' },
  { id: 'luck', t: 0, name: '행운의 부적', cat: '특수' },
  // 공통 카드: 같은 카드가 동·은·금에 다 있고 등급이 높을수록 세다 (v.common의 [동, 은, 금] 값)
  { id: 'kitB', t: 0, name: '수리 키트', cat: '선체', cm: 'kit' },
  { id: 'mgB', t: 0, name: '기관총 강화', cat: '기관총', cm: 'mg' },
  { id: 'cnB', t: 0, name: '함포 강화', cat: '함포', cm: 'cn' },
  { id: 'blB', t: 0, name: '폭발 범위', cat: '함포', cm: 'bl' },
  { id: 'msB', t: 0, name: '미사일 보급', cat: '미사일', cm: 'ms' },
  { id: 'hlB', t: 0, name: '선체 보강', cat: '선체', cm: 'hl' },
  // 은 20
  { id: 'burn', t: 1, name: '불타는 포탄', cat: '함포' },
  { id: 'shock', t: 1, name: '충격탄', cat: '함포' },
  { id: 'acc', t: 1, name: '명중 보정', cat: '함포·기관총' },
  { id: 'crit', t: 1, name: '치명타', cat: '특수' },
  { id: 'focus', t: 1, name: '집중 사격', cat: '특수' },
  { id: 'mishit', t: 1, name: '정밀 유도', cat: '미사일' },
  { id: 'misdmgS', t: 1, name: '큰 탄두', cat: '미사일' },
  { id: 'lock', t: 1, name: '빠른 락온', cat: '미사일' },
  { id: 'armorS', t: 1, name: '강철 장갑', cat: '선체' },
  { id: 'thorns', t: 1, name: '가시 장갑', cat: '선체' },
  { id: 'killHeal', t: 1, name: '격파 수리', cat: '선체' },
  { id: 'ram', t: 1, name: '들이받기', cat: '기동' },
  { id: 'haste', t: 1, name: '처치 가속', cat: '기동' },
  { id: 'mines', t: 1, name: '기뢰 추가', cat: '아이템' },
  { id: 'emp', t: 1, name: 'EMP 확장', cat: '아이템' },
  { id: 'repair', t: 1, name: '수리 강화', cat: '아이템' },
  { id: 'exec', t: 1, name: '마무리 일격', cat: '특수' },
  { id: 'crisis', t: 1, name: '위기 집중', cat: '특수' },
  { id: 'kitS', t: 1, name: '수리 키트', cat: '선체', cm: 'kit' },
  { id: 'mgS', t: 1, name: '기관총 강화', cat: '기관총', cm: 'mg' },
  { id: 'cnS', t: 1, name: '함포 강화', cat: '함포', cm: 'cn' },
  { id: 'blS', t: 1, name: '폭발 범위', cat: '함포', cm: 'bl' },
  { id: 'msS', t: 1, name: '미사일 보급', cat: '미사일', cm: 'ms' },
  { id: 'hlS', t: 1, name: '선체 보강', cat: '선체', cm: 'hl' },
  // 금 20
  { id: 'twin', t: 2, name: '쌍포', cat: '함포' },
  { id: 'guided', t: 2, name: '유도 포탄', cat: '함포' },
  { id: 'cluster', t: 2, name: '집속탄', cat: '함포' },
  { id: 'revenge', t: 2, name: '복수의 일격', cat: '함포' },
  { id: 'pierce', t: 2, name: '관통탄', cat: '함포·기관총' },
  { id: 'lines', t: 2, name: '기관총 두 줄', cat: '기관총' },
  { id: 'zap', t: 2, name: '전기 사슬', cat: '기관총' },
  { id: 'ice', t: 2, name: '얼음 미사일', cat: '미사일' },
  { id: 'chainMis', t: 2, name: '연쇄 미사일', cat: '미사일' },
  { id: 'reflect', t: 2, name: '미사일 반사판', cat: '선체' },
  { id: 'regen', t: 2, name: '수리 드론', cat: '선체' },
  { id: 'steal', t: 2, name: '흡혈탄', cat: '선체' },
  { id: 'shield', t: 2, name: '방어막', cat: '선체' },
  { id: 'second', t: 2, name: '두 번째 기회', cat: '선체' },
  { id: 'mineTrail', t: 2, name: '기뢰 꼬리', cat: '기동' },
  { id: 'loot', t: 2, name: '전리품 상자', cat: '아이템' },
  { id: 'bossLoot', t: 2, name: '보스 전리품', cat: '아이템' },
  { id: 'slot', t: 2, name: '아이템 칸 추가', cat: '아이템' },
  { id: 'combo', t: 2, name: '연속 격파', cat: '특수' },
  { id: 'supply', t: 2, name: '출격 보급', cat: '특수' },
  { id: 'kitG', t: 2, name: '수리 키트', cat: '선체', cm: 'kit' },
  { id: 'mgG', t: 2, name: '기관총 강화', cat: '기관총', cm: 'mg' },
  { id: 'cnG', t: 2, name: '함포 강화', cat: '함포', cm: 'cn' },
  { id: 'blG', t: 2, name: '폭발 범위', cat: '함포', cm: 'bl' },
  { id: 'msG', t: 2, name: '미사일 보급', cat: '미사일', cm: 'ms' },
  { id: 'hlG', t: 2, name: '선체 보강', cat: '선체', cm: 'hl' },
  // 플래티넘 20
  { id: 'support', t: 3, name: '지원 포격', cat: '아군' },
  { id: 'bomber', t: 3, name: '폭격기 호출', cat: '아군' },
  { id: 'ally', t: 3, name: '아군 고속정', cat: '아군' },
  { id: 'sub', t: 3, name: '잠수함 지원', cat: '아군' },
  { id: 'turret', t: 3, name: '뒤쪽 포탑', cat: '무기' },
  { id: 'drone', t: 3, name: '공격 드론', cat: '무기' },
  { id: 'rail', t: 3, name: '레일건', cat: '함포' },
  { id: 'misDouble', t: 3, name: '미사일 2연발', cat: '미사일' },
  { id: 'salvo', t: 3, name: '일제 사격', cat: '미사일' },
  { id: 'misDef', t: 3, name: '미사일 방어망', cat: '선체' },
  { id: 'chain', t: 3, name: '연쇄 폭발', cat: '특수' },
  { id: 'ew', t: 3, name: '전자전', cat: '특수' },
  { id: 'frenzy', t: 3, name: '폭주', cat: '특수' },
  { id: 'overcharge', t: 3, name: '과충전', cat: '특수' },
  { id: 'executioner', t: 3, name: '처형자', cat: '특수' },
  { id: 'rage', t: 3, name: '분노', cat: '특수' },
  { id: 'battleship', t: 3, name: '전함 개조', cat: '선체' },
  { id: 'undying', t: 3, name: '불사', cat: '선체' },
  { id: 'ghost', t: 3, name: '유령선', cat: '선체' },
  { id: 'four', t: 3, name: '네 장 보기', cat: '특수' }
];

const Upg = {
  n: {}, picks: 0, history: [],
  takeMul: 1, lives: 0,
  shieldHp: 0, shieldT: 0, regenT: 0, frenzyT: 0, frenzyOn: 0, supportT: -1,
  turretT: 0, droneT: 0, droneA: 0, chainQ: [],
  second: 0, focusTgt: null, focusN: 0, focusT: 0, comboN: 0, comboT: 0, hasteT: 0, smokeT: 0, smokeUsed: false,
  revengeReady: false, revengeCd: 0, railN: 0, ewUsed: false, ghostT: 0, ghostUsed: false,
  bomberT: 0, subT: 0, salvoT: 0, misDefT: 0, mineT: 0, grayT: 0, bombQ: [], subQ: [],
  // 테스트용: 죽지 않고 잃은 체력을 빚으로 쌓는다
  testNoDeath: false, debt: 0, taken: 0, healed: 0, dealt: {}, hurt: {}
};

// 고정 피해(화상·들이받기·연쇄 폭발·지원 포격·포탑·드론)는 적 체력이 느는 만큼 같이 커진다
function upgWaveK() { return CONFIG.cards.scaleWithWave ? 1 + CONFIG.rounds.healthGrowth * Math.max(0, round - 1) : 1; }
// 방어막·수리 드론은 적 데미지가 느는 만큼 같이 커진다
function upgDmgK() { return CONFIG.cards.scaleWithWave ? 1 + CONFIG.rounds.damageGrowth * Math.max(0, round - 1) : 1; }
// 카드로 회복 (테스트 기록용으로 회복량을 센다)
function upgHeal(a) { const h = Math.min(player.maxHp - player.hp, a); if (h > 0) { player.hp += h; Upg.healed += h; } }
let UB = null;                 // 카드가 바꾸는 CONFIG 값들의 원래 값
const droneMeshes = [];

function un(id) { return Upg.n[id] || 0; }
// 공통 카드: 동·은·금 장수 × 각 등급 값의 합
const CM_IDS = { kit: ['kitB', 'kitS', 'kitG'], mg: ['mgB', 'mgS', 'mgG'], cn: ['cnB', 'cnS', 'cnG'], bl: ['blB', 'blS', 'blG'], ms: ['msB', 'msS', 'msG'], fl: ['flB', 'flS', 'flG'], hl: ['hlB', 'hlS', 'hlG'] };
function cmSum(k, idk) { const ids = CM_IDS[idk || k], c = CONFIG.cards.v.common[k]; return un(ids[0]) * c[0] + un(ids[1]) * c[1] + un(ids[2]) * c[2]; }
function cmVal(id) { const c = CARDS.find(q => q.id === id); return CONFIG.cards.v.common[c.cm][c.t]; }

function upgSnapshot() {
  const C = CONFIG;
  UB = {
    reload: C.cannon.reload, cdmg: C.cannon.damage, cRad: C.cannon.radius, cSplashK: C.cannon.splashK, cRange: C.cannon.maxRange,
    mgdmg: C.mg.damage, mgrate: C.mg.rate, mgRange: C.mg.range, lockRange: C.lock.range, lockTime: C.lock.time,
    misdmg: C.missile.damage, missplash: C.missile.splash, misRad: C.missile.radius, misMax: C.missile.maxAmmo,
    misHit: C.missile.hitChance, acc: C.fcs.hitChance, lockHit: C.lock.hitChance,
    hp: C.player.maxHealth, heal: C.player.healOnKill, speed: C.player.maxSpeed, rev: C.player.reverseSpeed,
    boost: C.boost.max, slots: C.items.maxHeld, mines: C.items.mines.n, empR: C.items.emp.radius, empT: C.items.emp.time,
    repHeal: C.items.repair.heal, repShield: C.items.repair.shield,
    shellSpeed: C.cannon.shellSpeed, boostRegen: C.boost.regenPerSec,
    accel: C.player.accel, turn: C.player.turnRate, misDrop: C.missile.dropP, boostSpd: C.boost.speedMul
  };
}

// 쌓인 카드 수에 맞춰 CONFIG 값을 다시 계산한다
function upgApply() {
  if (!UB) upgSnapshot();
  const C = CONFIG, v = C.cards.v, cap = C.cards.cap, B = UB;
  C.cannon.reload = Math.max(cap.reloadMin || 0, B.reload * Math.pow(1 - v.reload, un('reload')) * (1 - skillSum('reload')));      // 스킬 트리도 더한다
  C.cannon.damage = B.cdmg * (1 + v.cdmg * un('cdmg') + cmSum('cn') + skillSum('cn')) * (1 + v.bsDmg * un('battleship')) * (1 + v.guidedDmg * un('guided'));
  C.cannon.shellSpeed = B.shellSpeed * (1 + v.shellSpd * un('shellSpd'));
  C.boost.regenPerSec = B.boostRegen * (1 + v.boostRegen * un('boostRegen') + skillSum('boostRegen'));
  const rg = 1 + v.range * un('range');
  C.mg.range = B.mgRange * rg * (1 + skillSum('mgRange')); C.cannon.maxRange = B.cRange * rg; C.lock.range = B.lockRange * rg;
  C.mg.damage = B.mgdmg * (1 + v.mgdmg * un('mgdmg') + cmSum('mg') + skillSum('mg'));
  C.mg.rate = B.mgrate * (1 + v.mgrate * un('mgrate') + skillSum('mgRate'));
  const dk = DIFF(), md = (1 + v.misdmg * un('misdmg') + v.misdmgS * un('misdmgS') + skillSum('mis')) * (dk.misDmg || 1);     // 난이도별 내 미사일 데미지 배율
  C.missile.damage = B.misdmg * md; C.missile.splash = B.missplash * md;
  C.missile.maxAmmo = (dk.misMax || B.misMax) + v.misMax * un('mishit') + skillSum('misMax');                                       // 강화 카드 '정밀 유도': 미사일을 더 모을 수 있다                                                                 // 난이도별 최대 미사일 수
  const bl = 1 + v.blast * un('blast');
  C.cannon.radius = B.cRad * (bl + cmSum('bl') + skillSum('blast')); C.missile.radius = B.misRad * (bl + skillSum('misBlast'));
  C.missile.dropP = Math.min(1, B.misDrop + skillSum('misDrop'));
  C.cannon.splashK = B.cSplashK * (1 + cmSum('blDmg', 'bl'));                    // 공통 카드 '폭발 범위'는 폭발 피해도 조금 올린다
  C.fcs.hitChance = Math.min(cap.acc || 1, B.acc + v.acc * un('acc'));
  C.lock.hitChance = Math.min(cap.acc || 1, B.lockHit + v.acc * un('acc'));
  C.missile.hitChance = B.misHit;
  C.lock.time = B.lockTime * Math.pow(1 - v.lock, un('lock'));
  C.player.healOnKill = B.heal + v.heal * un('heal') + v.killHeal * un('killHeal') + skillSum('killHeal');
  C.player.maxSpeed = B.speed * (1 + v.speed * un('speed') + skillSum('speed')) * Math.max(0.5, 1 - v.bsSpeed * un('battleship')) * (Upg.hasteT > 0 ? 1 + v.haste * un('haste') : 1);
  C.player.reverseSpeed = B.rev * (1 + v.rev * un('rev') + skillSum('rev'));
  C.player.accel = B.accel * (1 + skillSum('accel')); C.player.turnRate = B.turn * (1 + skillSum('turn'));
  C.boost.speedMul = B.boostSpd * (1 + skillSum('boostSpd'));
  C.boost.max = B.boost * (1 + v.boost * un('boost') + skillSum('boost'));
  C.items.maxHeld = Math.min(cap.slots || 99, B.slots + v.slot * un('slot'));
  C.items.mines.n = Math.min(MINE_MAX, B.mines + v.mines * un('mines'));
  C.items.emp.radius = B.empR * (1 + v.empR * un('emp'));
  C.items.emp.time = B.empT + v.empT * un('emp');
  C.items.repair.heal = B.repHeal + v.repHeal * un('repair');
  C.items.repair.shield = B.repShield + v.repShield * un('repair');
  const red = 1 - Math.pow(1 - v.armorB, un('armorB')) * Math.pow(1 - v.armorS, un('armorS'));
  Upg.takeMul = 1 - Math.min(cap.armor || 1, 1 - (1 - red) * (1 - skillSum('armor')));     // 스킬 트리 장갑도 같은 상한 안에서
  SPECS.player = makeSpec(C.player);
  if (player) player.S = SPECS.player;
}

function upgReset() {
  Upg.n = {}; Upg.picks = 0; Upg.history.length = 0; Upg.lives = 0;
  Upg.shieldHp = 0; Upg.shieldT = 0; Upg.regenT = 0; Upg.frenzyT = 0; Upg.frenzyOn = 0; Upg.supportT = -1;
  Upg.turretT = 0; Upg.droneT = 0; Upg.chainQ.length = 0;
  Upg.second = 0; Upg.focusTgt = null; Upg.focusN = 0; Upg.comboN = 0; Upg.comboT = 0; Upg.hasteT = 0; Upg.smokeT = 0;
  Upg.revengeReady = false; Upg.revengeCd = 0; Upg.railN = 0; Upg.ghostT = 0; Upg.bombQ.length = 0; Upg.subQ.length = 0;
  Upg.bomberT = 0; Upg.subT = 0; Upg.salvoT = 0; Upg.misDefT = 0; Upg.mineT = 0; upgGhostLook(false); upgGray(0);
  for (let i = 0; i < allies.length; i++) { allies[i].alive = false; allies[i].root.visible = false; } Upg.debt = 0; Upg.taken = 0; Upg.healed = 0; Upg.dealt = {}; Upg.hurt = {};
  upgApply();
  for (let i = 0; i < droneMeshes.length; i++) droneMeshes[i].visible = false;
}

/* ---------- 카드 뽑기 ---------- */
function upgTierP() {
  const P = CONFIG.cards.tierP.slice(), L = un('luck') * CONFIG.cards.v.luck;
  if (L > 0) {
    // 행운: 동 확률을 덜어 은·금·플래티넘에 원래 비율대로 나눠 준다
    const take = Math.min(L, P[0]), up = P[1] + P[2] + P[3];
    P[0] -= take;
    for (let k = 1; k < 4; k++) P[k] += take * P[k] / up;
  }
  return P;
}
function upgEligible(tier, exclude) {
  const reuse = Upg.picks >= CONFIG.cards.reuseAfter, out = [];
  for (let i = 0; i < CARDS.length; i++) {
    const c = CARDS[i];
    if (c.t !== tier || exclude.indexOf(c.id) >= 0) continue;
    if (!reuse && un(c.id) > 0) continue;
    if (c.t >= 2 && un(c.id) >= (CONFIG.cards.cap.rareMax || 99)) continue;
    out.push(c.id);
  }
  return out;
}
// 카드 3장: 등급을 굴리고 그 등급에서 아직 안 나온 카드를 고른다. 그 등급에 남은 카드가 없으면 남은 등급에서 다시 굴린다
function upgOffer() {
  const P = upgTierP(), ids = [];
  const nOffer = Math.min(5, 3 + un('four'));
  for (let k = 0; k < nOffer; k++) {
    let tier = 0, r = rnd() * 100;
    for (tier = 0; tier < 3; tier++) { r -= P[tier]; if (r < 0) break; }
    let pool = upgEligible(tier, ids);
    if (!pool.length) {
      let sum = 0; const w = [];
      for (let q = 0; q < 4; q++) { w[q] = upgEligible(q, ids).length ? P[q] : 0; sum += w[q]; }
      if (sum <= 0) break;
      r = rnd() * sum;
      for (tier = 0; tier < 3; tier++) { r -= w[tier]; if (r < 0) break; }
      pool = upgEligible(tier, ids);
    }
    ids.push(pool[(rnd() * pool.length) | 0]);
  }
  return ids;
}

function upgPick(id) {
  const v = CONFIG.cards.v;
  Upg.n[id] = un(id) + 1; Upg.picks++; Upg.history.push(id);
  if (id === 'hp') { player.maxHp += v.hp; player.hp += v.hp; }
  else if (id === 'undying') Upg.lives++;
  else if (id === 'second') Upg.second++;
  else if (id === 'battleship') { player.maxHp += v.bsHp; player.hp += v.bsHp; }
  else if (id === 'ally') upgSpawnAlly();
  else if (id === 'shield') Upg.shieldHp = v.shield * un('shield');
  else if (/^(kit|hl|ms|fl)[BSG]$/.test(id)) {
    const x = cmVal(id);
    if (id[0] === 'k') upgHeal(x);                                                   // 수리 키트: 바로 회복
    else if (id[0] === 'h') { player.maxHp += x; player.hp += x; }                   // 선체 보강: 최대 체력이 늘고 그만큼 회복
    else if (id[0] === 'f') Game.flares += x;                                        // 플레어 보급
  }
  upgApply();
  if (/^ms[BSG]$/.test(id)) Game.missiles = Math.min(CONFIG.missile.maxAmmo, Game.missiles + cmVal(id));   // 미사일 보급 (최대 보유 수까지)
  // 아이템 카드는 그 아이템을 바로 하나 준다
  if (id === 'slot') { for (let k = 0; k < v.slotItems; k++) if (Game.items.length < CONFIG.items.maxHeld) Game.items.push(rollItem()); }
  else if ((id === 'mines' || id === 'emp' || id === 'repair') && Game.items.length < CONFIG.items.maxHeld) Game.items.push(id);
}

/* ---------- 웨이브 시작 / 격파 ---------- */
function upgWaveStart() {
  const v = CONFIG.cards.v;
  if (un('supply') && player.alive) {
    upgHeal(v.supplyHp * un('supply'));
    Game.missiles = Math.min(CONFIG.missile.maxAmmo, Game.missiles + v.supplyMis * un('supply'));
    if (rnd() < v.supplyItem * un('supply') && Game.items.length < CONFIG.items.maxHeld) { Game.items.push(rollItem()); Hud.toast('보급품: ' + ITEM_NAMES[Game.items[Game.items.length - 1]]); }
  }
  if (un('support')) Upg.supportT = v.supportDelay;
  Upg.smokeUsed = false; Upg.ewUsed = false; Upg.ghostUsed = false;
  Upg.bomberT = Math.min(Upg.bomberT, 8); Upg.subT = Math.min(Upg.subT, 6);
  // 아군 고속정은 웨이브가 시작되면 내 옆으로 다시 붙는다
  for (let i = 0; i < allies.length; i++) {
    const a = allies[i];
    if (!a.alive) continue;
    const sh = Math.sin(player.heading), ch = Math.cos(player.heading), sd = i % 2 ? 1 : -1;
    a.reset(player.x + ch * 24 * sd - sh * 10, player.z - sh * 24 * sd - ch * 10, player.heading, simTime); a.ally = true;
  }
}

function upgOnKill(b) {
  const v = CONFIG.cards.v;
  if (un('loot') && b.kind !== 'boss' && rnd() < v.lootP * un('loot')) spawnCrate(b.x, b.z);     // 전리품 상자
  if (un('chain')) Upg.chainQ.push({ x: b.x, z: b.z, t: 0.25 });
  if (un('haste')) { const was = Upg.hasteT > 0; Upg.hasteT = v.hasteT; if (!was) upgApply(); }
  if (un('combo')) { Upg.comboN = Math.min(v.comboMax, Upg.comboN + 1); Upg.comboT = v.comboT; }
  if (b.kind === 'boss') for (let k = 0; k < v.bossLoot * un('bossLoot'); k++) spawnCrate(b.x + rr(-30, 30), b.z + rr(-30, 30));
  if (Upg.focusTgt === b) { Upg.focusTgt = null; Upg.focusN = 0; }
}

// 내가 적에게 주는 피해 배율 (마무리 일격, 위기 집중)
function upgDealMul(b) {
  const v = CONFIG.cards.v;
  let m = 1;
  if (un('exec') && b.hp < b.maxHp * v.execAt) m += v.exec * un('exec');
  if (un('crisis') && player.hp < player.maxHp * v.crisisAt) m += v.crisis * un('crisis');
  if (un('pierce') && b.kind !== 'fast' && b.kind !== 'misboat' && (DSRC === 'cannon' || DSRC === 'mg')) m += v.ap * un('pierce');   // 관통탄: 포함·기함에 함포·기관총이 더 잘 먹힌다
  if (un('near') || un('far')) {
    const d = Math.hypot(b.x - player.x, b.z - player.z);
    if (d < v.nearR) m += v.near * un('near');
    if (d > v.farR) m += v.far * un('far');
  }
  if (b.kind === 'boss') m += v.bossHunt * un('bossHunt');
  if (b.kind === 'fast' || b.kind === 'misboat') m += v.fastHunt * un('fastHunt');
  if (un('focus') && Upg.focusTgt === b) m += v.focus * Math.min(v.focusMax, Upg.focusN) * un('focus');
  if (un('combo')) m += v.combo * Upg.comboN * un('combo');
  if (un('ew') && b.ai && b.ai.empT > 0) m += v.ewVuln * un('ew');     // 전자전: 멈춘 적은 더 아프게 맞는다
  if (un('rage')) m += v.rage * un('rage') * clamp(1 - player.hp / player.maxHp, 0, 1);
  return m;
}

// 내가 적에게 피해를 준 뒤 (흡혈)
function upgDealt(amount) {
  if (un('steal') && player.alive) upgHeal(amount * CONFIG.cards.v.steal * un('steal'));
}

// 내가 피해를 받을 때: 장갑으로 줄이고, 방어막이 먼저 받고, 가시 장갑이 되돌린다
function upgPlayerHit(amount, sx, sz) {
  const v = CONFIG.cards.v;
  amount *= Upg.takeMul;
  if (un('dodge') && Game.boostOn) amount *= Math.max(0.3, 1 - v.dodge * un('dodge'));    // 회피 기동: 부스트 중 피해 감소
  if (Upg.shieldHp > 0) {
    const a = Math.min(Upg.shieldHp, amount);
    Upg.shieldHp -= a; amount -= a;
  }
  if (un('thorns') && amount > 0) {
    let best = null, bd = 60 * 60;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || e.submerged) continue;
      const dx = e.x - sx, dz = e.z - sz, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) upgRawDamage(best, amount * CONFIG.cards.v.thorns * un('thorns'));
  }
  Upg.taken += amount;
  if (amount > 0 && un('revenge') && Upg.revengeCd <= 0) { Upg.revengeReady = true; Upg.revengeCd = v.revengeCd; }
  // 연막탄: 체력이 기준 아래로 떨어지는 순간 연막을 뿌린다 (웨이브마다 한 번)
  if (un('smoke') && !Upg.smokeUsed && player.hp - amount < player.maxHp * v.smokeAt) {
    Upg.smokeUsed = true; Upg.smokeT = v.smokeT * un('smoke');
    for (let i = 0; i < enemies.length; i++) enemies[i].ai.errT = 0;
    Hud.toast('연막탄 · 적이 잘 못 맞힙니다');
  }
  return amount;
}

// 체력이 0이 됐을 때: 불사가 있으면 버틴다. 테스트 모드면 빚으로 쌓고 계속
function upgSaveDeath(b) {
  const v = CONFIG.cards.v;
  if (Upg.second > 0) {
    // 두 번째 기회: 체력 20으로 버티고, 금빛 충격파로 가까운 적을 밀어낸다. 잠깐 흑백 슬로모션
    Upg.second--;
    b.hp = v.secondHp; Game.shieldT = v.secondT; Upg.healed += b.hp;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || e.submerged) continue;
      const dx = e.x - b.x, dz = e.z - b.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
      if (d < v.secondR) { const k = v.secondPush * (1 - d / v.secondR * 0.5); e.vx += dx / d * k; e.vz += dz / d * k; }
    }
    ringOn(b.x, b.z, 4, v.secondR, 0.7, 0.95, 0, RING_GOLD);
    flash(0.6, 1, 0.85, 0.4);
    Game.slowT = 0.6; upgGray(0.7);
    Sound.play('hurt', 0.8, 0.6, 0);
    Hud.banner('두 번째 기회', v.secondT + '초 동안 무적');
    return true;
  }
  if (Upg.lives > 0) {
    Upg.lives--;
    b.hp = b.maxHp * CONFIG.cards.v.undyingHp; Game.shieldT = CONFIG.cards.v.undyingT; Upg.healed += b.hp;
    Hud.banner('불사 발동', CONFIG.cards.v.undyingT + '초 동안 무적');
    return true;
  }
  if (Upg.testNoDeath) { Upg.debt += b.maxHp; b.hp += b.maxHp; return true; }
  return false;
}

// 히트 표시·경보 없이 바로 체력을 깎는다 (화상, 가시, 연쇄 폭발 등)
function upgRawDamage(b, amount) {
  if (!b.alive) return;
  amount *= upgDealMul(b);
  Upg.dealt.card = (Upg.dealt.card || 0) + Math.min(amount, Math.max(0, b.hp));
  b.hp -= amount;
  if (b.hp <= 0) destroyBoat(b);
}

// 포탄이 적에게 직격했을 때: 화상
function upgShellHit(s, boat, x, z) {
  const v = CONFIG.cards.v;
  if (un('burn')) { boat.burnT = v.burnTime; boat.burnDps = v.burnDps * un('burn') * upgWaveK(); }
  if (un('shock')) { boat.slowT = v.shock * un('shock'); boat.ai.empT = Math.max(boat.ai.empT || 0, v.shockStun * un('shock')); boat.ai.burstLeft = 0; }   // 충격탄: 느려지고 잠깐 못 쏜다
}

// 들이받기: 내 배가 적과 부딪힌 순간 (rv: 서로 다가오던 속도, 음수)
function upgRam(b, rv) {
  if (!un('ram') || rv > -4) return;
  if (b.ramT && simTime - b.ramT < 1) return;
  b.ramT = simTime;
  fxExplosion(b.x, b.y + 1, b.z, 0.5);
  DSRC = 'card';
  damageBoat(b, CONFIG.cards.v.ram * un('ram') * upgWaveK() * clamp(-rv / 15, 0.4, 1.5), player.x, player.z, true);
  DSRC = 'item';
}

/* ---------- 자동 무기: 뒤쪽 포탑, 공격 드론 ---------- */
function upgNearest(x, z, range) {
  let best = null, bd = range * range;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive || e.submerged) continue;
    const dx = e.x - x, dz = e.z - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function upgAutoShot(x, y, z, e, dmg) {
  const G = CONFIG.mg;
  predictBoat(e, x, z, G.speed, 1, 0);
  const life = (Math.hypot(e.x - x, e.z - z) + 80) / G.speed;
  let tx = Pred.x, tz = Pred.z, ty = e.y + 1, tgt = e;
  if (rnd() >= CONFIG.fcs.hitChance) { const a = rnd() * TAU, r = rr(3, 5); tx += Math.cos(a) * r; tz += Math.sin(a) * r; ty += rr(-1, 2); tgt = null; }
  const dx = tx - x, dy = ty - y, dz = tz - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  BUL_AUTO = 1; bulletSpawn(x, y, z, dx / d * G.speed, dy / d * G.speed, dz / d * G.speed, life, dmg, 0, tgt); BUL_AUTO = 0;
  fxMuzzleMG(x, y, z, dx / d, dy / d, dz / d);
}

function upgEnsureDrones(n) {
  while (droneMeshes.length < n) {
    const g = new GeoBuilder(), body = sRGB(0x3a4148), lite = sRGB(0xffb347);
    g.box(0.9, 0.25, 0.9, 0, 0, 0, body);
    g.box(1.8, 0.06, 0.12, 0, 0.1, 0, body); g.box(0.12, 0.06, 1.8, 0, 0.1, 0, body);
    g.box(0.2, 0.12, 0.2, 0, -0.18, 0.3, lite);
    const m = new THREE.Mesh(g.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }));
    m.visible = false; scene.add(m); droneMeshes.push(m);
  }
}

/* ---------- 추가 카드 효과 ---------- */
// 과충전: 부스트를 쓰는 동안 모든 무기가 빨라진다
function upgOverMul() { return un('overcharge') && Game.boostOn ? CONFIG.cards.v.overMul : 1; }
const allies = [];             // 아군 고속정
let ghostMat = null;

// 치명타: 확률로 피해 2배
function upgCrit() {
  const n = un('crit');
  return n && rnd() < CONFIG.cards.v.crit * n ? CONFIG.cards.v.critMul : 1;
}

// 적에게 피해가 들어간 직후: 집중 사격 쌓기, 처형자
function upgAfterHit(b) {
  const v = CONFIG.cards.v;
  if (un('focus')) {
    if (Upg.focusTgt !== b) { Upg.focusTgt = b; Upg.focusN = 0; }
    Upg.focusN++; Upg.focusT = 0;
  }
  if (un('executioner') && b.alive && b.kind !== 'boss' && b.hp > 0 && b.hp < b.maxHp * v.killAt * Math.min(2, un('executioner'))) {
    fxExplosion(b.x, b.y + 1.5, b.z, 0.9);
    b.hp = 0;
  }
}

// 기관총이 적에게 맞았을 때: 전기 사슬
function upgMgHit(b) {
  const v = CONFIG.cards.v, n = un('zap');
  if (!n || rnd() >= v.zapP * n) return;
  let left = v.zapN;
  DSRC = 'card';
  for (let i = 0; i < enemies.length && left > 0; i++) {
    const e = enemies[i];
    if (!e.alive || e === b) continue;
    const dx = e.x - b.x, dz = e.z - b.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d > v.zapR) continue;
    // 번개: 두 배 사이에 하얀 불꽃 점을 이어 찍는다
    const steps = Math.max(4, d / 6 | 0);
    for (let k = 0; k <= steps; k++) {
      const f = k / steps, j = (k > 0 && k < steps) ? 1.6 : 0;
      fireSys.spawn(b.x + dx * f + rr(-j, j), b.y + 2 + rr(-j, j), b.z + dz * f + rr(-j, j), 0, 0, 0, 0.08, 0.5, 0.9, 6, 7, 9, 1, 0, 0, 0, 0, 0.3, -100);
    }
    damageBoat(e, v.zapDmg * upgWaveK(), player.x, player.z, true);
    left--;
  }
  DSRC = 'mg';
}

// 내 미사일이 적에게 맞았을 때: 얼음 미사일, 연쇄 미사일
function upgMissileHit(m, hit) {
  const v = CONFIG.cards.v;
  if (un('ice')) {
    // 얼음 미사일: 맞은 자리 주변 적이 몇 초 동안 얼어붙는다
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.alive && Math.hypot(e.x - m.x, e.z - m.z) < v.iceR + e.M.L * 0.3) { e.ai.empT = Math.max(e.ai.empT || 0, v.ice * un('ice')); e.ai.burstLeft = 0; }
    }
    ringOn(m.x, m.z, 3, v.iceR, 0.5, 0.8, 0, RING_CYAN);
  }
  if (un('chainMis') && m.scale > 1.5) {
    for (let k = 0; k < un('chainMis'); k++) {
      let best = null, bd = v.chainMisR * v.chainMisR;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.alive || e === hit) continue;
        const dx = e.x - m.x, dz = e.z - m.z, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      const M = CONFIG.missile;
      spawnMissile(0, m.x, m.y + 3, m.z, rr(-8, 8), 22, rr(-8, 8), best, rnd() < M.hitChance, M.damage * v.chainMis, M.splash * v.chainMis, M.radius * 0.7, 1.0, M.turnRate, M.maxSpeed, M.fuse, player.x, player.z);
    }
  }
}

// 적 미사일이 나를 맞히기 직전: 미사일 반사판이면 확률로 튕겨서 쏜 쪽 적에게 돌려보낸다
function upgReflect(m) {
  const n = un('reflect');
  if (!n || rnd() >= CONFIG.cards.v.reflectP * n) return false;
  const tgt = pickMissileTarget(m.x, m.z, 1500);
  fxHitSpark(m.x, m.y, m.z); ringOn(m.x, m.z, 2, 12, 0.35, 0.9, 0, RING_CYAN);
  Sound.play('ping', 0.8, 0.7, 0);
  if (!tgt) { m.on = false; m.mesh.visible = false; return true; }
  const M = CONFIG.missile;
  m.owner = 0; m.target = tgt; m.willHit = true; m.lost = false; m.loseT = 1e9; m.age = 0.33;
  m.vx = -m.vx; m.vy = Math.abs(m.vy) + 10; m.vz = -m.vz;
  m.dmg = M.damage * 0.6; m.splash = M.splash * 0.6; m.vmax = M.maxSpeed; m.turn = M.turnRate; m.sx = player.x; m.sz = player.z;
  return true;
}

// 내 포탄이 떨어진 곳 (배든 바다든): 집속탄
function upgShellImpact(s, x, z) {
  const v = CONFIG.cards.v, n = un('cluster');
  if (!n || s.bomblet) return;
  for (let k = 0; k < v.clusterN; k++) {
    const a = rnd() * TAU, r = rr(8, 18);
    Upg.bombQ.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, t: 0.2 + k * 0.08, dmg: s.dmg * v.cluster * n, r: v.clusterR, sc: 0.45 });
  }
}

// 레일건: 조준한 방향으로 일직선의 적을 모두 뚫는다
function upgRail(P) {
  const v = CONFIG.cards.v, C = CONFIG.cannon;
  const dx = Aim.seaX - P.x, dz = Aim.seaZ - P.z, dl = Math.sqrt(dx * dx + dz * dz) || 1, ux = dx / dl, uz = dz / dl;
  DSRC = 'card';
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive || e.submerged) continue;
    const ex = e.x - P.x, ez = e.z - P.z, along = ex * ux + ez * uz, side = Math.abs(ex * uz - ez * ux);
    if (along > 0 && along < v.railRange && side < v.railW + e.M.L * 0.3) {
      fxExplosion(e.x, e.y + 1.5, e.z, 0.8);
      damageBoat(e, C.damage * v.railMul * un('rail'), P.x, P.z, true);
    }
  }
  DSRC = 'item';
  // 빛줄기: 밝은 점을 길게 찍는다
  for (let d = 6; d < Math.min(v.railRange, 900); d += 5) {
    const x = P.x + ux * d, z = P.z + uz * d;
    fireSys.spawn(x, P.y + 2.4 + d * 0.002, z, 0, 0, 0, 0.12, 0.9, 1.6, 5, 8, 12, 1, 0, 0, 0, 0, 0.35, -100);
  }
  flash(0.25, 0.6, 0.8, 1);
  Sound.play('cannon', 1.0, 1.4, 0);
  Hud.toast('레일건 발사');
}

// 아군 고속정
function upgSpawnAlly() {
  let a = null;
  for (let i = 0; i < allies.length; i++) if (!allies[i].alive) { a = allies[i]; break; }
  if (!a) {
    a = new Boat('fast');
    // 아군 표시: 돛대 위 초록 불빛
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: sRGB(0x5dff8a) }));
    lamp.position.set(0, 5.2, -0.5); a.root.add(lamp);
    allies.push(a);
  }
  const sh = Math.sin(player.heading), ch = Math.cos(player.heading), sd = allies.indexOf(a) % 2 ? 1 : -1;
  a.reset(player.x + ch * 24 * sd - sh * 10, player.z - sh * 24 * sd - ch * 10, player.heading, simTime);
  a.ally = true; a.fireT = 0;
}

function allyUpdate(a, dt, t) {
  const v = CONFIG.cards.v, P = player;
  const e = upgNearest(a.x, a.z, 3000);                 // 가장 가까운 적부터
  let mx, mz, thr = 1;
  if (e) {
    const dx = e.x - a.x, dz = e.z - a.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    if (d > 160) { mx = dx / d; mz = dz / d; }
    else { mx = -dz / d + dx / d * 0.2; mz = dx / d + dz / d * 0.2; thr = 0.85; }   // 가까우면 옆으로 돌면서 쏜다
    a.boosting = d > 350;
    a.aimWeapons(e.x, e.z, e.x, e.z, 0.06, dt);
    if (d < v.allyRange) {
      a.fireT -= dt;
      while (a.fireT <= 0) {
        a.fireT += 1 / v.allyRate;
        a.mgMuzzle.getWorldPosition(_v3);
        upgAutoShot(_v3.x, _v3.y, _v3.z, e, v.allyDmg * upgWaveK());
      }
    }
  } else {
    const dx = P.x - a.x, dz = P.z - a.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    mx = dx / d; mz = dz / d; thr = d > 40 ? 1 : 0.2; a.boosting = false;
  }
  const diff = wrapAngle(Math.atan2(mx, mz) - a.heading);
  a.inSteer = clamp(diff * 2.0, -1, 1);
  a.inThrottle = thr * (Math.abs(diff) > 1.4 ? 0.5 : 1);
  a.lod = 1;
  a.step(dt, t);
  a.emitWater(dt, t, 1);
}

// 유령선: 내 배를 반투명하게
function upgGhostLook(on) {
  if (!player) return;
  if (on && !ghostMat) { ghostMat = boatMat.clone(); ghostMat.transparent = true; ghostMat.opacity = 0.32; ghostMat.depthWrite = false; }
  for (let i = 0; i < player.meshes.length; i++) player.meshes[i].material = on ? ghostMat : boatMat;
}

// 화면 흑백 (두 번째 기회)
function upgGray(t) {
  Upg.grayT = t;
  if (renderer) renderer.domElement.style.filter = t > 0 ? 'grayscale(1) contrast(1.15)' : '';
}

function upgDropMine(x, z) {
  for (let i = 0; i < MINE_MAX; i++) {
    const m = mineList[i];
    if (m.on) continue;
    m.on = true; m.x = x; m.z = z; m.life = CONFIG.items.mines.trailLife; m.pct = false; m.ph = rnd() * TAU; m.mesh.visible = true;
    fxSplashSmall(x, waveHeight(x, z, simTime), z, 1);
    return;
  }
}

/* ---------- 매 프레임 ---------- */
function upgUpdate(dt) {
  const v = CONFIG.cards.v, P = player, play = Game.state === 'play' && P.alive;
  // 화상
  for (let i = 0; i < enemies.length; i++) {
    const b = enemies[i];
    if (!b.alive || !(b.burnT > 0)) continue;
    b.burnT -= dt;
    if (rnd() < dt * 8) fireSys.spawn(b.x + rr(-2, 2), b.y + 1.2, b.z + rr(-2, 2), 0, 2, 0, 0.1, 0.8, 1.6, 9, 5, 2, 1, 0, 0, 0, 0, 0.4, -100);
    upgRawDamage(b, b.burnDps * dt);
  }
  // 연쇄 폭발
  for (let i = Upg.chainQ.length - 1; i >= 0; i--) {
    const q = Upg.chainQ[i];
    q.t -= dt;
    if (q.t > 0) continue;
    Upg.chainQ.splice(i, 1);
    fxExplosion(q.x, 1.5, q.z, 1.4);
    ringOn(q.x, q.z, 3, v.chainR, 0.5, 0.8, 0.0, RING_WHITE);
    Sound.playAt('explosion', q.x, q.z, 0.9, 0.75);
    DSRC = 'card';
    for (let e = 0; e < enemies.length; e++) {
      const b = enemies[e];
      if (!b.alive) continue;
      if (Math.hypot(b.x - q.x, b.z - q.z) < v.chainR + b.M.L * 0.3) damageBoat(b, v.chain * un('chain') * upgWaveK(), q.x, q.z, true);
    }
    DSRC = 'item';
  }
  // 집속탄·폭격기 폭탄
  for (let i = Upg.bombQ.length - 1; i >= 0; i--) {
    const q = Upg.bombQ[i];
    q.t -= dt;
    if (q.t > 0) continue;
    Upg.bombQ.splice(i, 1);
    fxExplosion(q.x, 1.2, q.z, q.sc);
    if (q.sc > 0.8) { ringOn(q.x, q.z, 2, q.r, 0.45, 0.7, 0, RING_WHITE); Sound.playAt('explosion', q.x, q.z, 0.7, 0.9); }
    DSRC = 'card';
    for (let e = 0; e < enemies.length; e++) {
      const b = enemies[e];
      if (b.alive && Math.hypot(b.x - q.x, b.z - q.z) < q.r + b.M.L * 0.3) damageBoat(b, q.dmg, player.x, player.z, true);
    }
    DSRC = 'item';
  }
  // 잠수함 어뢰
  for (let i = Upg.subQ.length - 1; i >= 0; i--) {
    const q = Upg.subQ[i];
    q.t -= dt;
    const b = q.b;
    if (b.alive && q.t > 0) { if (rnd() < dt * 20) foamDecal(b.x - Math.sin(b.heading) * q.t * 60, b.z - Math.cos(b.heading) * q.t * 60, 1, 3, 2, 0.6, 0, 0.3); continue; }
    Upg.subQ.splice(i, 1);
    if (!b.alive) continue;
    fxExplosion(b.x, b.y, b.z, 1.6); fxWaterColumn(b.x, b.z, 1.4, simTime);
    Sound.playAt('explosion', b.x, b.z, 1.0, 0.7);
    DSRC = 'card'; damageBoat(b, v.subDmg * un('sub') * upgWaveK(), player.x, player.z, true); DSRC = 'item';
  }
  if (Upg.grayT > 0) { Upg.grayT -= dt / 0.3; if (Upg.grayT <= 0) upgGray(0); }
  // 적 감속 (충격탄)
  for (let i = 0; i < enemies.length; i++) { const b = enemies[i]; if (b.slowT > 0) b.slowT -= dt; }
  if (!play) {
    for (let i = 0; i < droneMeshes.length; i++) droneMeshes[i].visible = false;
    if (Upg.ghostT > 0) { Upg.ghostT = 0; upgGhostLook(false); }
    for (let i = 0; i < allies.length; i++) if (allies[i].alive && Game.state !== 'play') { allies[i].alive = false; allies[i].root.visible = false; }
    return;
  }
  const t = simTime;
  // 아군 고속정
  for (let i = 0; i < allies.length; i++) if (allies[i].alive) allyUpdate(allies[i], dt, t);
  // 시간이 지나면 풀리는 효과들
  if (Upg.focusTgt) { Upg.focusT += dt; if (Upg.focusT > v.focusReset || !Upg.focusTgt.alive) { Upg.focusTgt = null; Upg.focusN = 0; } }
  if (Upg.comboT > 0) { Upg.comboT -= dt; if (Upg.comboT <= 0) Upg.comboN = 0; }
  if (Upg.hasteT > 0) { Upg.hasteT -= dt; if (Upg.hasteT <= 0) upgApply(); }
  if (Upg.revengeCd > 0) Upg.revengeCd -= dt;
  if (Upg.smokeT > 0) {
    Upg.smokeT -= dt;
    if (rnd() < dt * 14) { const g = rr(0.75, 0.9); smokeSys.spawn(P.x + rr(-14, 14), P.y + 1, P.z + rr(-14, 14), rr(-2, 2), rr(0.5, 2), rr(-2, 2), rr(5, 9), 2.5, 6, g, g, g, 0.7, -0.2, 2.5, rr(-1, 1), 0, 0.9, -100); }
  }
  // 유령선: 위기 때 8초 투명 (웨이브마다 한 번)
  if (Upg.ghostT > 0) { Upg.ghostT -= dt; if (Upg.ghostT <= 0) { upgGhostLook(false); Hud.toast('투명 해제'); } }
  else if (un('ghost') && !Upg.ghostUsed && P.hp <= v.ghostHp) {
    let near = 0;
    for (let i = 0; i < enemies.length; i++) { const e = enemies[i]; if (e.alive && Math.hypot(e.x - P.x, e.z - P.z) < v.ghostR) near++; }
    if (near >= v.ghostN) {
      Upg.ghostUsed = true; Upg.ghostT = v.ghostT * un('ghost'); upgHeal(v.ghostHeal); upgGhostLook(true);
      ringOn(P.x, P.z, 3, 40, 0.6, 0.6, 0, RING_CYAN);
      Hud.banner('유령선', v.ghostT + '초 동안 적이 나를 못 봅니다');
    }
  }
  // 전자전: 200m 안에 적이 3척 이상 들어오면 그 적들이 5초 멈춘다 (웨이브마다 한 번)
  if (un('ew') && !Upg.ewUsed) {
    let near = 0;
    for (let i = 0; i < enemies.length; i++) { const e = enemies[i]; if (e.alive && Math.hypot(e.x - P.x, e.z - P.z) < v.ewR) near++; }
    if (near >= v.ewN) {
      Upg.ewUsed = true;
      for (let i = 0; i < enemies.length; i++) { const e = enemies[i]; if (e.alive && Math.hypot(e.x - P.x, e.z - P.z) < v.ewR) { e.ai.empT = v.ewT * un('ew'); e.ai.burstLeft = 0; } }
      ringOn(P.x, P.z, 5, v.ewR, 0.8, 0.9, 0, RING_CYAN); flash(0.3, 0.5, 0.9, 1);
      Sound.play('emp', 0.9, 1, 0);
      Hud.toast('전자전 · 가까운 적이 멈췄습니다');
    }
  }
  // 미사일 방어망: 충전되면 가까이 온 적 미사일을 한꺼번에 떨어뜨린다
  if (un('misDef')) {
    if (Upg.misDefT > 0) Upg.misDefT -= dt;
    else {
      let any = false;
      for (let i = 0; i < MIS_MAX; i++) {
        const m = missiles[i];
        if (!m.on || m.owner === 0) continue;
        if (Math.hypot(m.x - P.x, m.z - P.z) < v.misDefR) { any = true; m.on = false; m.mesh.visible = false; m.target = null; fxExplosion(m.x, m.y, m.z, 0.5); }
      }
      // 적 포탄도 공중에서 터뜨린다
      for (let i = 0; i < shells.length; i++) {
        const sh = shells[i];
        if (!sh.on || sh.owner === 0) continue;
        if (Math.hypot(sh.x - P.x, sh.z - P.z) < v.misDefR && sh.vy < 0) { any = true; sh.on = false; sh.mesh.visible = false; fxExplosion(sh.x, sh.y, sh.z, 0.35); }
      }
      if (any) { Upg.misDefT = v.misDefEvery / un('misDef'); Hud.toast('방어망 요격'); Sound.play('ping', 0.9, 1.2, 0); }
    }
  }
  // 기뢰 꼬리: 부스트를 쓰는 동안 뒤에 기뢰를 흘린다
  if (un('mineTrail') && Game.boostOn) {
    Upg.mineT -= dt;
    if (Upg.mineT <= 0) { Upg.mineT = v.mineEvery / un('mineTrail'); upgDropMine(P.x - Math.sin(P.heading) * 8, P.z - Math.cos(P.heading) * 8); }
  }
  // 폭격기: 적이 가장 많이 모인 곳에 폭탄을 줄지어 떨어뜨린다
  if (un('bomber')) {
    Upg.bomberT -= dt;
    if (Upg.bomberT <= 0) {
      let best = null, bn = 0;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.alive || e.submerged) continue;
        let n = 0;
        for (let j = 0; j < enemies.length; j++) { const o = enemies[j]; if (o.alive && Math.hypot(o.x - e.x, o.z - e.z) < 120) n++; }
        if (n > bn) { bn = n; best = e; }
      }
      if (best) {
        Upg.bomberT = v.bomberEvery / un('bomber');
        const a = rnd() * TAU, ux = Math.cos(a), uz = Math.sin(a);
        for (let k = 0; k < v.bomberN; k++) {
          const f = (k - (v.bomberN - 1) / 2) * 16;
          Upg.bombQ.push({ x: best.x + ux * f + rr(-6, 6), z: best.z + uz * f + rr(-6, 6), t: 1.2 + k * 0.15, dmg: v.bomberDmg * upgWaveK(), r: v.bomberR, sc: 1.1 });
        }
        Hud.toast('폭격기 진입');
      } else Upg.bomberT = 2;
    }
  }
  // 잠수함: 가장 체력이 많은 적에게 어뢰
  if (un('sub')) {
    Upg.subT -= dt;
    if (Upg.subT <= 0) {
      let best = null;
      for (let i = 0; i < enemies.length; i++) { const e = enemies[i]; if (e.alive && (!best || e.hp > best.hp)) best = e; }
      if (best) { Upg.subT = v.subEvery; Upg.subQ.push({ b: best, t: 1.5 }); Hud.toast('잠수함 어뢰 발사'); } else Upg.subT = 2;
    }
  }
  // 일제 사격: 주기마다 미사일 몇 발이 각각 다른 적에게
  if (un('salvo')) {
    Upg.salvoT -= dt;
    if (Upg.salvoT <= 0) {
      if (pickMissileTarget(P.x, P.z, CONFIG.missile.lockRange)) {
        Upg.salvoT = v.salvoEvery / un('salvo');
        MIS_AUTO = true; for (let k = 0; k < v.salvoN; k++) launchMissile(); MIS_AUTO = false;
      } else Upg.salvoT = 1;
    }
  }

  // 수리 드론
  if (un('regen')) {
    Upg.regenT += dt;
    if (Upg.regenT >= v.regenEvery) { Upg.regenT -= v.regenEvery; upgHeal(v.regen * un('regen') * upgDmgK()); }
  }
  // 방어막: 주기마다 다시 가득 찬다
  if (un('shield')) {
    Upg.shieldT += dt;
    if (Upg.shieldT >= v.shieldEvery) { Upg.shieldT = 0; Upg.shieldHp = v.shield * un('shield') * upgDmgK(); }
  }
  // 폭주: 주기마다 일정 시간 동안 함포 장전이 두 배 빨라진다
  if (un('frenzy')) {
    Upg.frenzyT += dt;
    if (Upg.frenzyT >= v.frenzyEvery) { Upg.frenzyT = 0; Upg.frenzyOn = Math.min(v.frenzyEvery, v.frenzyTime * un('frenzy')); cannonT = Math.min(cannonT, CONFIG.cannon.reload * 0.5); Hud.toast('폭주 · 장전 2배 · 연사 1.5배'); }
    if (Upg.frenzyOn > 0) Upg.frenzyOn -= dt;
  }
  // 지원 포격: 웨이브 시작 몇 초 뒤 모든 적에게 포탄이 떨어진다
  if (Upg.supportT > 0) {
    Upg.supportT -= dt;
    if (Upg.supportT <= 0) {
      Upg.supportT = -1;
      DSRC = 'card';
      for (let i = 0; i < enemies.length; i++) {
        const b = enemies[i];
        if (!b.alive) continue;
        fxExplosion(b.x, b.y + 1, b.z, 1.0);
        damageBoat(b, v.support * un('support') * upgWaveK(), P.x, P.z, true);
      }
      DSRC = 'item';
      Hud.toast('지원 포격');
    }
  }
  // 뒤쪽 포탑
  if (un('turret')) {
    Upg.turretT -= dt;
    while (Upg.turretT <= 0) {
      Upg.turretT += 1 / (v.turretRate * un('turret'));
      const sh = Math.sin(P.heading), ch = Math.cos(P.heading), x = P.x - sh * 4.2, z = P.z - ch * 4.2;
      const e = upgNearest(x, z, v.turretRange);
      if (e) upgAutoShot(x, P.y + 2.2, z, e, v.turretDmg * upgWaveK());
      else { Upg.turretT = Math.max(Upg.turretT, 0.1); break; }
    }
  }
  // 공격 드론: 배 주위를 돌며 쏜다
  const nd = un('drone');
  if (nd) {
    upgEnsureDrones(nd);
    Upg.droneA += dt * 1.3;
    Upg.droneT -= dt;
    const fire = Upg.droneT <= 0;
    if (fire) Upg.droneT += v.droneEvery;
    for (let k = 0; k < nd; k++) {
      const a = Upg.droneA + k * TAU / nd, x = P.x + Math.sin(a) * 10, z = P.z + Math.cos(a) * 10, y = P.y + 7 + Math.sin(simTime * 2 + k) * 0.4;
      const m = droneMeshes[k];
      m.visible = true; m.position.set(x, y, z); m.rotation.y = a;
      if (fire) { const e = upgNearest(x, z, v.droneRange); if (e) upgAutoShot(x, y - 0.3, z, e, v.droneDmg * upgWaveK()); }
    }
  }
}

/* ==========================================================================
 * 카드 화면 — 웨이브를 깨면 잠깐 뒤 게임을 멈추고, 멈춘 바다를 흐리게 깔고 카드를 고르게 한다
 * ========================================================================== */
const CARD_DELAY = 1.3;          // 마지막 적을 잡고 카드 화면이 뜨기까지 (초, 게임 시간)
function pc(x) { return Math.round(x * 100); }
// 카드 설명: CONFIG 값을 그대로 읽어서 쓴다 (수치를 고치면 설명도 같이 바뀐다)
function cardDesc(id) {
  const v = CONFIG.cards.v;
  switch (id) {
    case 'reload': return '함포 장전 시간이 ' + pc(v.reload) + '% 줄어든다';
    case 'cdmg': return '함포 데미지가 ' + pc(v.cdmg) + '% 올라간다';
    case 'kitB': case 'kitS': case 'kitG': return '체력을 바로 ' + cmVal(id) + ' 회복한다';
    case 'mgB': case 'mgS': case 'mgG': return '기관총 데미지가 ' + pc(cmVal(id)) + '% 올라간다';
    case 'cnB': case 'cnS': case 'cnG': return '함포 데미지가 ' + pc(cmVal(id)) + '% 올라간다';
    case 'blB': case 'blS': case 'blG': { const c = CARDS.find(q => q.id === id); return '함포 폭발 범위가 ' + pc(cmVal(id)) + '% 넓어지고 폭발 피해가 ' + pc(CONFIG.cards.v.common.blDmg[c.t]) + '% 세진다'; }
    case 'msB': case 'msS': case 'msG': return '미사일을 바로 ' + cmVal(id) + '발 받는다';
    case 'flB': case 'flS': case 'flG': return '플레어를 바로 ' + cmVal(id) + '개 받는다';
    case 'hlB': case 'hlS': case 'hlG': return '최대 체력이 ' + cmVal(id) + ' 늘고 그만큼 회복한다';
    case 'shellSpd': return '포탄이 ' + pc(v.shellSpd) + '% 더 빨리 날아간다';
    case 'range': return '함포와 기관총이 ' + pc(v.range) + '% 더 멀리 나간다';
    case 'mgdmg': return '기관총 데미지가 ' + pc(v.mgdmg) + '% 올라간다';
    case 'mgrate': return '기관총을 ' + pc(v.mgrate) + '% 더 빠르게 쏜다';
    case 'misdmg': return '미사일 데미지가 ' + pc(v.misdmg) + '% 올라간다';
    case 'near': return v.nearR + 'm 안의 적에게 주는 피해가 ' + pc(v.near) + '% 늘어난다';
    case 'far': return v.farR + 'm 밖의 적에게 주는 피해가 ' + pc(v.far) + '% 늘어난다';
    case 'bossHunt': return '기함에게 주는 피해가 ' + pc(v.bossHunt) + '% 늘어난다';
    case 'fastHunt': return '고속정에게 주는 피해가 ' + pc(v.fastHunt) + '% 늘어난다';
    case 'hp': return '최대 체력이 ' + v.hp + ' 늘고 그만큼 바로 회복한다';
    case 'armorB': return '받는 피해가 ' + pc(v.armorB) + '% 줄어든다';
    case 'heal': return '적을 격파할 때마다 체력을 ' + v.heal + ' 더 회복한다';
    case 'speed': return '최고 속도가 ' + pc(v.speed) + '% 빨라진다';
    case 'rev': return '후진 속도가 ' + pc(v.rev) + '% 빨라진다';
    case 'boost': return '부스트를 ' + pc(v.boost) + '% 더 오래 쓸 수 있다';
    case 'boostRegen': return '부스트가 ' + pc(v.boostRegen) + '% 더 빨리 찬다';
    case 'dodge': return '부스트를 쓰는 동안 받는 피해가 ' + pc(v.dodge) + '% 줄어든다';
    case 'luck': return '다음 카드부터 은 이상이 나올 확률이 ' + v.luck + '%p 오른다';
    case 'burn': return '함포에 맞은 적이 ' + v.burnTime + '초 동안 불타며 계속 피해를 입는다';
    case 'shock': return '함포에 맞은 적이 ' + v.shock + '초 동안 느려지고 ' + v.shockStun + '초 동안 쏘지 못한다';
    case 'blast': return '함포와 미사일 폭발 범위가 ' + pc(v.blast) + '% 넓어진다';
    case 'acc': return '락온과 사격 컴퓨터 명중률이 ' + pc(v.acc) + '%p 오른다';
    case 'crit': return pc(v.crit) + '% 확률로 ' + v.critMul + '배 피해를 준다';
    case 'focus': return '같은 적을 계속 맞히면 피해가 최대 ' + pc(v.focus * v.focusMax) + '%까지 쌓인다';
    case 'mishit': return '미사일을 ' + v.misMax + '발 더 모을 수 있다';
    case 'misdmgS': return '미사일 데미지가 ' + pc(v.misdmgS) + '% 올라간다';
    case 'lock': return '락온이 ' + pc(v.lock) + '% 더 빨리 잡힌다';
    case 'armorS': return '받는 피해가 ' + pc(v.armorS) + '% 줄어든다';
    case 'thorns': return '받은 피해의 ' + v.thorns + '배를 쏜 적에게 돌려준다';
    case 'killHeal': return '적을 격파할 때마다 체력을 ' + v.killHeal + ' 더 회복한다';
    case 'smoke': return '체력이 ' + pc(v.smokeAt) + '% 아래로 떨어지면 ' + v.smokeT + '초 동안 연막을 뿌려 적이 잘 못 맞힌다 (웨이브마다)';
    case 'ram': return '적 배를 들이받으면 ' + v.ram + ' 피해를 준다';
    case 'haste': return '적을 격파하면 ' + v.hasteT + '초 동안 속도가 ' + pc(v.haste) + '% 빨라진다';
    case 'mines': return '기뢰가 ' + v.mines + '개 더 깔리고 기뢰 아이템을 바로 하나 받는다';
    case 'emp': return 'EMP 범위 +' + pc(v.empR) + '%, 멈춤 +' + v.empT + '초, EMP를 바로 하나 받는다';
    case 'repair': return '수리 회복 +' + v.repHeal + ', 무적 +' + v.repShield + '초, 수리 아이템을 바로 하나 받는다';
    case 'exec': return '체력이 ' + pc(v.execAt) + '% 아래인 적에게 피해를 ' + pc(v.exec) + '% 더 준다';
    case 'crisis': return '내 체력이 ' + pc(v.crisisAt) + '% 아래면 모든 공격이 ' + pc(v.crisis) + '% 세진다';
    case 'twin': return '함포를 쏠 때마다 포탄이 1발 더 나간다 (추가 포탄 데미지 ' + pc(v.twinMul) + '%)';
    case 'guided': return '함포 명중률이 ' + pc(v.guided) + '%p 오르고 함포 데미지가 ' + pc(v.guidedDmg) + '% 올라간다';
    case 'cluster': return '포탄이 터질 때 작은 폭탄 ' + v.clusterN + '개가 주변으로 흩어진다';
    case 'revenge': return '피해를 받으면 다음 함포 한 발이 ' + (1 + v.revenge) + '배로 들어간다';
    case 'pierce': return '포함과 기함에게 주는 함포·기관총 피해가 ' + pc(v.ap) + '% 늘어난다';
    case 'lines': return '기관총 총알이 한 줄 더 나간다 (추가 줄 데미지 ' + pc(v.lineMul) + '%)';
    case 'zap': return '기관총이 ' + pc(v.zapP) + '% 확률로 근처 적 ' + v.zapN + '척에게 전기를 튀긴다';
    case 'ice': return '미사일이 터진 자리 주변의 적이 ' + v.ice + '초 동안 얼어붙는다';
    case 'chainMis': return '미사일이 터진 뒤 근처 적에게 작은 미사일 1발이 더 날아간다';
    case 'reflect': return '날아오는 적 미사일을 ' + pc(v.reflectP) + '% 확률로 튕겨 쏜 쪽으로 돌려보낸다';
    case 'regen': return v.regenEvery + '초마다 체력을 ' + v.regen + '씩 회복한다';
    case 'steal': return '적에게 준 피해의 ' + (v.steal * 100).toFixed(1) + '%만큼 체력을 회복한다';
    case 'shield': return v.shieldEvery + '초마다 피해를 ' + v.shield + '만큼 막아 주는 막이 다시 찬다';
    case 'second': return '한 판에 한 번, 죽는 순간 체력 ' + v.secondHp + '으로 살아나고 주변 적을 밀어낸다';
    case 'mineTrail': return '부스트를 쓰면 지나간 자리에 기뢰를 흘린다';
    case 'loot': return '적을 격파하면 ' + pc(v.lootP) + '% 확률로 보급 상자가 떠오른다';
    case 'bossLoot': return '기함을 잡으면 보급 상자가 하나 더 나온다';
    case 'slot': return '아이템을 하나 더 들 수 있고 아이템 ' + v.slotItems + '개를 바로 받는다';
    case 'combo': return '연달아 격파할수록 피해가 ' + pc(v.combo) + '%씩 늘어나 최대 ' + pc(v.combo * v.comboMax) + '%까지 쌓인다';
    case 'supply': return '웨이브마다 체력 ' + v.supplyHp + '과 미사일 ' + v.supplyMis + '발, 가끔 아이템도 받는다';
    case 'support': return '웨이브가 시작되면 아군 함대가 모든 적에게 포격한다';
    case 'bomber': return v.bomberEvery + '초마다 아군 폭격기가 적이 모인 곳에 폭탄 ' + v.bomberN + '발을 떨어뜨린다';
    case 'ally': return '아군 고속정 1척이 따라다니며 가까운 적부터 공격한다';
    case 'sub': return v.subEvery + '초마다 아군 잠수함이 가장 강한 적에게 어뢰를 쏜다';
    case 'turret': return '배 뒤에 자동 포탑이 생겨 가까운 적을 알아서 쏜다';
    case 'drone': return '드론 1대가 내 배 주위를 돌면서 적을 쏜다';
    case 'rail': return '함포 ' + v.railEvery + '발마다 일직선의 적을 모두 뚫는 레일건이 나간다';
    case 'misDouble': return '미사일을 쏠 때 ' + pc(v.misDoubleP) + '% 확률로 다른 적에게 1발이 더 날아간다';
    case 'salvo': return v.salvoEvery + '초마다 미사일 ' + v.salvoN + '발이 자동으로 서로 다른 적에게 날아간다';
    case 'misDef': return v.misDefEvery + '초마다 가까이 날아온 적 미사일과 포탄을 한꺼번에 요격한다';
    case 'chain': return '격파된 적이 터지면서 주변 적에게 피해를 준다';
    case 'ew': return '적 ' + v.ewN + '척 이상이 ' + v.ewR + 'm 안에 들어오면 ' + v.ewT + '초 동안 멈추고 더 아프게 맞는다 (웨이브마다)';
    case 'frenzy': return v.frenzyEvery + '초마다 ' + v.frenzyTime + '초 동안 장전 2배, 연사 ' + v.frenzyMg + '배';
    case 'overcharge': return '부스트를 쓰는 동안 모든 무기가 ' + v.overMul + '배 빨리 쏜다';
    case 'executioner': return '체력이 ' + pc(v.killAt) + '% 아래로 떨어진 적은 바로 침몰한다 (기함 제외)';
    case 'rage': return '잃은 체력 1%마다 주는 피해가 ' + v.rage + '% 늘어난다';
    case 'battleship': return '최대 체력 +' + v.bsHp + ', 함포 데미지 +' + pc(v.bsDmg) + '%, 대신 속도가 ' + pc(v.bsSpeed) + '% 느려진다';
    case 'undying': return '한 판에 한 번, 죽을 때 체력이 가득 찬 채로 살아나고 ' + v.undyingT + '초 동안 무적';
    case 'ghost': return '체력 ' + v.ghostHp + ' 이하로 포위되면 체력 ' + v.ghostHeal + '을 회복하고 ' + v.ghostT + '초 동안 투명해진다 (웨이브마다)';
    case 'four': return '앞으로 카드가 한 장 더 나온다';
  }
  return '';
}

// 카드 그림: 분류마다 선 그림 하나 (몇 장은 따로)
const CARD_ICON = {
  cannon: '<path d="M6 30h16l18-12 4 6-16 10H6z"/><circle cx="14" cy="36" r="5"/>',
  mg: '<path d="M4 22h30v6H4z"/><path d="M34 24h10M10 28v10M18 28l-3 8"/>',
  missile: '<path d="M24 4c4 4 5 9 5 14v16l5 6H14l5-6V18c0-5 1-10 5-14z"/>',
  armor: '<path d="M24 5l16 6v12c0 10-7 17-16 21C15 40 8 33 8 23V11z"/>',
  engine: '<path d="M8 32l10-10 6 6 14-14"/><path d="M30 14h8v8"/>',
  crate: '<rect x="8" y="14" width="32" height="24" rx="2"/><path d="M8 22h32M24 14v24"/>',
  target: '<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="3"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10"/>',
  fleet: '<path d="M4 34h40l-5 8H9z"/><path d="M14 34v-8h10v8M30 34v-6h8v6M10 14l6 4M24 10v6M38 14l-6 4"/>',
  turret: '<circle cx="22" cy="28" r="10"/><path d="M28 22l14-10M10 40h24"/>',
  warhead: '<circle cx="24" cy="26" r="12"/><path d="M24 6v6M24 40v4M8 26H4M44 26h-4M12 14l4 4M36 14l-4 4"/>',
  wrench: '<path d="M30 8a8 8 0 0 0-8 11L8 33l7 7 14-14a8 8 0 0 0 11-8l-5 5-6-1-1-6z"/>',
  drone: '<circle cx="12" cy="14" r="5"/><circle cx="36" cy="14" r="5"/><path d="M17 16l5 6h4l5-6M18 30h12M24 22v12M20 38h8"/>',
  star: '<path d="M24 4l6 13 14 2-10 10 3 14-13-7-13 7 3-14L4 19l14-2z"/>',
  bolt: '<path d="M27 4L10 27h12l-3 17 19-25H26z"/>',
  ghost: '<path d="M10 40V22a14 14 0 0 1 28 0v18l-5-4-4 4-5-4-5 4-4-4z"/><circle cx="19" cy="22" r="2"/><circle cx="29" cy="22" r="2"/>'
};
const CAT_ICON = { '함포': 'cannon', '기관총': 'mg', '미사일': 'missile', '선체': 'armor', '기동': 'engine', '아이템': 'crate', '특수': 'target', '아군': 'fleet', '무기': 'turret', '함포·기관총': 'target', '함포·미사일': 'warhead', '플레어': 'star' };
const ID_ICON = { kitB: 'wrench', kitS: 'wrench', kitG: 'wrench', hp: 'wrench', heal: 'wrench', killHeal: 'wrench', regen: 'wrench', repair: 'wrench', drone: 'drone', luck: 'star', four: 'star', zap: 'bolt', ew: 'bolt', overcharge: 'bolt', ghost: 'ghost', second: 'star', undying: 'star' };
const TIER_K = ['b', 's', 'g', 'p'];

const Cards = { open: false, offer: [], picking: false, timers: [], els: [] };
function cardLater(fn, ms) { Cards.timers.push(setTimeout(fn, ms)); }

function openCards() {
  if (Game.state !== 'play' || !player.alive) return;
  Game.state = 'cards';
  clearInput();
  Cards.offer = upgOffer();
  Cards.open = true; Cards.picking = false; Cards.els.length = 0;
  for (let i = 0; i < Cards.timers.length; i++) clearTimeout(Cards.timers[i]);
  Cards.timers.length = 0;
  if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();    // 카드를 누를 수 있게 마우스 고정을 푼다
  updateCursor();
  const row = $('cd-row'), n = Cards.offer.length;
  row.innerHTML = ''; row.style.setProperty('--n', n);
  $('cd-wave').textContent = '웨이브 ' + round + ' 확보';
  $('cd-msg').textContent = '';
  $('cd-head').classList.remove('on');
  for (let i = 0; i < n; i++) {
    const id = Cards.offer[i], c = CARDS.find(function (q) { return q.id === id; }), tk = TIER_K[c.t], have = un(id);
    const ic = CARD_ICON[ID_ICON[id] || CAT_ICON[c.cat] || 'target'];
    const col = c.t === 2 ? '#ffd77a' : c.t === 3 ? '#d9f0ff' : '#eef6f7';
    const slot = document.createElement('div'); slot.className = 'cd-slot';
    const el = document.createElement('div'); el.className = 'cd-card cdt-' + tk;
    el.innerHTML = '<div class="cd-flare"></div>' +
      '<div class="cd-face cd-back"><div class="cd-tier">' + CARD_TIERS[c.t] + '</div></div>' +
      '<div class="cd-face cd-front"><div class="cd-tag">' + CARD_TIERS[c.t] + '</div><div class="cd-cat">' + c.cat + '</div>' +
      '<div class="cd-ic" style="color:' + col + '"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + ic + '</svg></div>' +
      '<div class="cd-info"><div class="cd-nm">' + c.name + '</div><div class="cd-ef">' + cardDesc(id) + '</div><div class="cd-st">' + (have ? '보유 ' + have + '장' : '') + '</div></div></div>';
    slot.appendChild(el);
    const key = document.createElement('div'); key.className = 'cd-key'; key.textContent = (i + 1) + '번';
    slot.appendChild(key);
    row.appendChild(slot);
    Cards.els.push(el);
    el.addEventListener('click', function (e) { e.stopPropagation(); chooseCard(i); });
  }
  $('cards').classList.remove('off');
  cardLater(function () { $('cd-head').classList.add('on'); }, 40);
  // 1) 뒷면으로 날아 들어오고  2) 왼쪽부터 차례로 뒤집히고  3) 고를 수 있게
  for (let i = 0; i < n; i++) cardLater(function () { Cards.els[i].classList.add('in'); Sound.play('tick', 0.35, 0.8, 0); }, 180 + i * 120);
  const t0 = 900;
  for (let i = 0; i < n; i++) {
    cardLater(function () {
      Cards.els[i].classList.add('open');
      const t = CARDS.find(function (q) { return q.id === Cards.offer[i]; }).t;
      if (t >= 2) Sound.play('pickup', 0.7, t === 3 ? 1.25 : 1.0, 0); else Sound.play('tick', 0.5, 1.2 + i * 0.1, 0);
    }, t0 + i * 300);
  }
  cardLater(function () {
    Cards.picking = true;
    for (let i = 0; i < n; i++) Cards.els[i].classList.add('pick');
    $('cd-msg').textContent = Touch.on ? '카드를 눌러 고르세요' : '카드를 누르거나 ' + Array.from({ length: n }, function (_, k) { return k + 1; }).join(' · ') + ' 키로 고르세요';
  }, t0 + (n - 1) * 300 + 500);
}

// 카드 고르기. instant는 테스트용 (연출 없이 바로)
function chooseCard(i, instant) {
  if (!Cards.open || i < 0 || i >= Cards.offer.length) return;
  if (!instant && !Cards.picking) return;
  Cards.picking = false;
  const id = Cards.offer[i], c = CARDS.find(function (q) { return q.id === id; });
  upgPick(id);
  if (instant) { closeCards(); return; }
  for (let j = 0; j < Cards.els.length; j++) { Cards.els[j].classList.remove('pick'); Cards.els[j].classList.add(j === i ? 'chosen' : 'lost'); }
  $('cd-msg').textContent = c.name + ' 획득 · 다음 웨이브 준비';
  Sound.play('pickup', 0.8, 1.1, 0);
  if (!Touch.on) requestLock();                  // 누른 그 순간에 다시 마우스를 고정한다 (브라우저는 클릭 안에서만 허락한다)
  cardLater(closeCards, 650);
}

function closeCards(force) {
  for (let i = 0; i < Cards.timers.length; i++) clearTimeout(Cards.timers[i]);
  Cards.timers.length = 0;
  Cards.open = false; Cards.picking = false;
  $('cards').classList.add('off');
  if (!force && Game.state === 'cards') { Game.state = 'play'; lastT = performance.now(); }
  updateCursor();
}

// 일시정지 화면에 보여 줄 보유 카드
function upgOwnedText() {
  const out = [];
  for (let i = 0; i < CARDS.length; i++) {
    const c = CARDS[i], n = un(c.id);
    if (n) out.push(c.name + (n > 1 ? ' ×' + n : ''));
  }
  return out.length ? '<b>보유 카드 ' + Upg.picks + '장</b> · ' + out.join(' · ') : '';
}
