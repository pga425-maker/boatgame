
/* ==========================================================================
 * 특수 웨이브 — 4웨이브부터 보스가 아닌 웨이브에 가끔 규칙이 바뀐다
 * fog 짙은 안개(시야 약 300m, 레이더를 믿어야 한다) · night 야간 기습(적이 불을 끄고 가까이서 나타난다)
 * escort 보급선 호위(보급선이 살아남으면 큰 보상) · storm 폭풍(파도가 커서 조준이 흔들린다)
 * 웨이브가 끝나면 원래 배경으로 돌아간다
 * ========================================================================== */
const Special = { kind: null, last: null, supply: null, dest: null, prevEnv: null, won: false };
const SPECIAL_INFO = {
  fog: ['특수 웨이브 · 짙은 안개', '시야가 300m 남짓입니다. 레이더를 보세요'],
  night: ['특수 웨이브 · 야간 기습', '적이 불을 끄고 가까이 숨어 있습니다'],
  escort: ['특수 웨이브 · 보급선 호위', '보급선이 끝까지 살아남으면 큰 보상을 받습니다'],
  storm: ['특수 웨이브 · 폭풍', '파도가 높아 조준이 흔들립니다. 적도 잘 못 맞힙니다']
};
const uBoatFog = { value: CONFIG.boatFog };

function specialPick(n) {
  const S = CONFIG.special;
  if (n < S.from || n % CONFIG.rounds.bossEvery === 0 || rnd() >= S.p) return null;
  const list = ['fog', 'night', 'escort', 'storm'].filter(k => k !== Special.last);
  return list[(rnd() * list.length) | 0];
}

// 웨이브 시작 직전: 배경과 규칙을 바꾼다
function specialStart(kind) {
  Special.kind = kind; Special.last = kind; Special.won = false;
  if (!kind) return;
  Special.prevEnv = Game.envKey;
  if (kind === 'night') applyEnv('night');
  else if (kind === 'storm') applyEnv('storm');
  else if (kind === 'fog') {
    const D = CONFIG.special.fogDen;
    uFog.value = D; if (scene.fog) { scene.fog.density = D; scene.fog.color.setRGB(0.6, 0.64, 0.67); }
    uBoatFog.value = 1;
  }
}
// 웨이브가 시작된 뒤: 적이 다 나온 다음 손볼 것 (야간: 적 불 끄기, 호위: 보급선)
function specialAfterSpawn(n) {
  const k = Special.kind;
  if (!k) return;
  if (k === 'night') for (let i = 0; i < enemies.length; i++) if (enemies[i].nav) enemies[i].nav.visible = false;
  if (k === 'escort') {
    // 보급선은 내 옆에서 출발해 적이 오는 반대쪽 먼 지점으로 간다
    let ex = 0, ez = 0, c = 0;
    for (let i = 0; i < enemies.length; i++) { ex += enemies[i].x; ez += enemies[i].z; c++; }
    const P = player, away = c ? Math.atan2(P.x - ex / c, P.z - ez / c) : P.heading, lim = HALF - 300;
    const sx = P.x + Math.sin(away + 1.4) * 90, sz = P.z + Math.cos(away + 1.4) * 90;
    let b = boatPool.supply.pop(); if (!b) b = new Boat('supply');
    const f = isleFree(sx, sz, 40);
    b.reset(f.x, f.y, away, simTime);
    b.maxHp = 380 * (1 + 0.1 * (n - 1)); b.hp = b.maxHp;
    if (b.nav) b.nav.visible = !!ENV.nav;
    Special.supply = b;
    Special.dest = { x: clamp(P.x + Math.sin(away) * CONFIG.special.escortDist, -lim, lim), z: clamp(P.z + Math.cos(away) * CONFIG.special.escortDist, -lim, lim) };
    // 적 절반은 보급선을 노린다
    let k2 = 0;
    for (let i = 0; i < enemies.length; i++) if (enemies[i].kind !== 'sub' && (k2++ % 2 === 0)) enemies[i].ai.focus = b;
  }
}
// 웨이브가 끝나거나 판이 끝나면 원래대로
function specialEnd(cleared) {
  const k = Special.kind;
  if (!k) return;
  if (cleared) {
    achStat('sp_' + k, 1);
    if (k === 'escort' && Special.supply && Special.supply.alive) {
      const R = CONFIG.special.escortReward;
      Skill.pts += R.pts; Game.missiles = Math.min(CONFIG.missile.maxAmmo, Game.missiles + R.mis); paintGain(R.paint);
      Hud.banner('보급선 호위 성공', '포인트 +' + R.pts + ' · 미사일 +' + R.mis + ' · 페인트 +' + R.paint);
      achStat('escortOk', 1);
    }
  }
  if (k === 'night' || k === 'storm' || k === 'fog') applyEnv(Special.prevEnv || Game.envKey);
  uBoatFog.value = CONFIG.boatFog;
  if (Special.supply) { const b = Special.supply; if (b.alive) { b.sailAway = true; } else { b.retire(); boatPool.supply.push(b); Special.supply = null; } }
  Special.kind = null;
}
function specialClear() {
  if (Special.kind) specialEnd(false);
  if (Special.supply) { Special.supply.retire(); Special.supply.wake.clear(); boatPool.supply.push(Special.supply); Special.supply = null; }
  Special.last = null;
}

// 보급선 움직임 (물리 단계에서)
function specialPhys(dt, t) {
  const b = Special.supply;
  if (!b) return;
  if (b.alive) {
    const D = Special.dest, tx = b.sailAway ? b.x + Math.sin(b.heading) * 500 : D.x, tz = b.sailAway ? b.z + Math.cos(b.heading) * 500 : D.z;
    let mx = tx - b.x, mz = tz - b.z; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    isleAvoid(b, _avo); mx += _avo.x; mz += _avo.z;
    const lim2 = HALF - 150;
    if (b.x > lim2) mx -= (b.x - lim2) / 70; else if (b.x < -lim2) mx += (-lim2 - b.x) / 70;
    if (b.z > lim2) mz -= (b.z - lim2) / 70; else if (b.z < -lim2) mz += (-lim2 - b.z) / 70;
    const diff = wrapAngle(Math.atan2(mx, mz) - b.heading);
    b.inSteer = clamp(diff * 2, -1, 1);
    b.inThrottle = !b.sailAway && ml < 60 ? 0.15 : 1;
    // 다 와서 웨이브가 끝나면 멀리 떠나간다
    if (b.sailAway && Math.hypot(b.x - player.x, b.z - player.z) > 1300) { b.retire(); b.wake.clear(); boatPool.supply.push(b); Special.supply = null; return; }
  }
  b.lod = CONFIG.quality.effectScale;
  b.step(dt, t);
  if (b.alive) isleCollide(b, dt);
}
function specialEmit(dt, t) {
  const b = Special.supply;
  if (!b || b.gone) return;
  b.emitWater(dt, t, b.lod);
  if (!b.alive) { b.emitBurn(dt, 0.6); if (b.sinkT > b.sinkDur + 0.4) { b.retire(); b.wake.clear(); boatPool.supply.push(b); Special.supply = null; } }
}
const _avo = { x: 0, z: 0 };
// 보급선이 가라앉았다
function supplyLost(b) {
  b.kill();
  Sound.playAt('explosion', b.x, b.z, 1.0, 0.8);
  Hud.banner('보급선 격침', '이번 웨이브 호위 보상은 없습니다');
  Sound.play('horn', 0.6, 0.6, 0);
}
// 폭풍: 파도에 조준이 살짝 흔들린다
function specialUpdate(dt) {
  if (Special.kind === 'storm' && Game.state === 'play') Cam.trauma = Math.max(Cam.trauma, 0.16 + 0.06 * Math.sin(simTime * 0.9));
}
