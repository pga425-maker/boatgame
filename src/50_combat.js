
/* ==========================================================================
 * 전투 — 포탄, 사격, 피해, 적 AI, 웨이브
 * ========================================================================== */
let kills = 0, round = 0, roundState = 0, roundTimer = 0;   // roundState: 0 교전 중, 1 다음 웨이브 대기
let mgTimer = 0, cannonT = 0;
let shootersNow = 0;                                        // 지금 점사 중인 적의 수
let HM = false;                                           // 지금 들어가는 피해가 내가 직접 쏜 기관총·함포·미사일인지 (이때만 조준점에 명중 표시)
let MIS_AUTO = false;                                     // 강화 카드가 자동으로 쏘는 미사일 (명중 표시 없음)
let DSRC = 'item';                                         // 테스트 기록용: 지금 들어가는 피해의 출처

/* ---------- 포탄: 포물선으로 날아가 물이나 보트에 맞으면 터진다 ---------- */
const SHELL_MAX = 24;
const shells = [];
let shellMatP = null, shellMatE = null;

function initShells() {
  const geo = new THREE.SphereGeometry(0.16, 8, 6);
  geo.scale(1, 1, 2.8);
  // 탄두는 어두운 금속색 (빛은 꽁무니 예광제가 낸다)
  shellMatP = new THREE.MeshBasicMaterial({ color: sRGB(0x3b3f43) });
  shellMatE = new THREE.MeshBasicMaterial({ color: sRGB(0x3b3f43) });
  applyTracerStyle();
  for (let i = 0; i < SHELL_MAX; i++) {
    const mesh = new THREE.Mesh(geo, shellMatP);
    mesh.visible = false;
    scene.add(mesh);
    shells.push({ on: false, near: null, homing: null, tx: 0, tz: 0, mesh: mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, owner: 0, dmg: 0, splash: 0, radius: 0, scale: 1, life: 0, trail: 0, sx: 0, sz: 0 });
  }
}

function shellSpawn(x, y, z, vx, vy, vz, g, owner, dmg, splash, radius, scale) {
  for (let i = 0; i < SHELL_MAX; i++) {
    const s = shells[i];
    if (s.on) continue;
    s.on = true; s.x = x; s.y = y; s.z = z; s.vx = vx; s.vy = vy; s.vz = vz; s.g = g; s.owner = owner;
    s.dmg = dmg; s.splash = splash; s.radius = radius; s.scale = scale; s.life = 9; s.trail = 0; s.sx = x; s.sz = z; s.near = null; s.tx = x; s.tz = z; s.homing = null;
    s.mesh.material = owner === 0 ? shellMatP : shellMatE;
    s.mesh.scale.setScalar(scale);
    s.mesh.position.set(x, y, z);
    s.mesh.visible = true;
    return s;
  }
  return null;
}

function shellsClear() {
  for (let i = 0; i < SHELL_MAX; i++) { shells[i].on = false; shells[i].mesh.visible = false; }
}

// 카메라에서 가까운 폭발일수록 화면이 크게 흔들린다
function addTraumaAt(x, z, amount) {
  const dx = x - camera.position.x, dz = z - camera.position.z;
  Cam.trauma = Math.min(1, Cam.trauma + amount / (1 + (dx * dx + dz * dz) / 3600));
}

function shellImpact(s, x, y, z, boat, t) {
  s.on = false; s.mesh.visible = false;
  const fromPlayer = s.owner === 0;
  DSRC = 'cannon';
  if (fromPlayer) { upgShellImpact(s, x, z); minesBlast(x, z, s.radius); }
  HM = fromPlayer;                                        // 내 함포탄은 전부 내가 직접 쏜 것
  if (boat) {
    fxExplosion(x, y, z, 0.8 * s.scale);
    Sound.playAt('explosion', x, z, 0.8, rr(1.0, 1.25));
    if (fromPlayer) upgShellHit(s, boat, x, z);
    damageBoat(boat, s.dmg, s.sx, s.sz, fromPlayer);
  } else {
    fxWaterColumn(x, z, s.scale, t);
    Sound.playAt('splashBig', x, z, 1.0, rr(0.9, 1.1));
  }
  addTraumaAt(x, z, boat ? 0.5 : 0.42);
  if (fromPlayer) blastVsMissiles(x, y, z, CONFIG.intercept.blast);     // 폭발 범위 안의 적 미사일 요격
  // 폭발 범위 피해: 중심에 가까울수록 크다
  if (fromPlayer) {
    for (let e = 0; e < enemies.length; e++) {
      const b = enemies[e];
      if (!b.alive || b === boat) continue;
      const dx = b.x - x, dz = b.z - z, d = Math.max(0, Math.sqrt(dx * dx + dz * dz) - b.M.L * 0.3);
      if (d < s.radius) damageBoat(b, s.splash * Math.pow(1 - d / s.radius, 1.2), s.sx, s.sz, true);
    }
    if (airs.length) airSplash(x, y, z, s.radius, s.splash, true);
  } else {
    if (player.alive && player !== boat) {
      const dx = player.x - x, dz = player.z - z, d = Math.max(0, Math.sqrt(dx * dx + dz * dz) - player.M.L * 0.3);
      if (d < s.radius) damageBoat(player, s.splash * Math.pow(1 - d / s.radius, 1.2), s.sx, s.sz, false);
    }
    const sp = Special.supply;
    if (sp && sp.alive && sp !== boat) { const d = Math.max(0, Math.hypot(sp.x - x, sp.z - z) - sp.M.L * 0.3); if (d < s.radius) damageBoat(sp, s.splash * Math.pow(1 - d / s.radius, 1.2), s.sx, s.sz, false); }
  }
  DSRC = 'item'; HM = false;
}

function shellsUpdate(dt, t) {
  for (let i = 0; i < SHELL_MAX; i++) {
    const s = shells[i];
    if (!s.on) continue;
    const ox = s.x, oy = s.y, oz = s.z;
    if (s.homing !== null && s.homing.alive) {
      // 락온 명중 포탄: 포물선 모양은 유지하면서, 남은 비행 시간 동안 표적이 갈 곳에 떨어지도록 매번 다시 맞춘다
      const b = s.homing, hs = Math.sqrt(s.vx * s.vx + s.vz * s.vz) || 1;
      let px = b.x, pz = b.z, T = 0;
      for (let it = 0; it < 2; it++) { const qx = px - s.x, qz = pz - s.z; T = Math.sqrt(qx * qx + qz * qz) / hs; px = b.x + b.vx * T; pz = b.z + b.vz * T; }
      if (T > 0.04) {
        const qx = px - s.x, qz = pz - s.z, ql = Math.sqrt(qx * qx + qz * qz) || 1;
        s.vx = qx / ql * hs; s.vz = qz / ql * hs;
        s.vy = (b.y + 0.8 - s.y) / T + 0.5 * s.g * T;
      }
    }
    s.vy -= s.g * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.life -= dt;
    let hitBoat = null, th = -1, grazed = false;
    if (s.owner === 0) {
      for (let e = 0; e < enemies.length; e++) {
        const b = enemies[e];
        if (!b.alive || b.submerged) continue;
        th = segBoat(b, ox, oy, oz, s.x, s.y, s.z, 6, 0.3);
        if (th >= 0) { hitBoat = b; break; }
      }
      // 근접 신관: 선체 바로 옆 구역에 들어오면 기억해 두었다가, 직접 맞지 않고 그 구역을 벗어나거나
      // 물에 닿으면 그때 터진다. 그래서 직격할 포탄은 그대로 직격한다
      const fz = CONFIG.cannon.proximityFuse;
      if (!hitBoat && fz > 0) {
        let inZone = null;
        for (let e = 0; e < enemies.length; e++) {
          const b = enemies[e];
          if (!b.alive || b.submerged) continue;
          const ax = b.x - s.tx, az = b.z - s.tz;
          if (ax * ax + az * az > 400) continue;     // 겨눈 지점 근처(20m)의 적에게만 신관이 반응한다
          if (segBoat(b, ox, oy, oz, s.x, s.y, s.z, 6, fz) >= 0) { inZone = b; break; }
        }
        if (inZone) s.near = inZone;
        else if (s.near && s.near.alive) { hitBoat = s.near; grazed = true; th = 0; }   // 스치고 지나가는 순간
        else s.near = null;
      }
    } else {
      if (player.alive) { th = segBoat(player, ox, oy, oz, s.x, s.y, s.z, 6, 0.3); if (th >= 0) hitBoat = player; }
      const sp = Special.supply;
      if (!hitBoat && sp && sp.alive) { th = segBoat(sp, ox, oy, oz, s.x, s.y, s.z, 6, 0.3); if (th >= 0) hitBoat = sp; }
    }
    if (!hitBoat && s.owner === 0 && shellVsMissiles(s, ox, oy, oz)) continue;
    if (!hitBoat && s.owner === 0 && airs.length && airShell(s, ox, oy, oz, t)) continue;       // 하늘 적 근처에서 공중 폭발
    if (!hitBoat && ISLES.length + REEFS.length && isleSeg(ox, oy, oz, s.x, s.y, s.z)) {     // 섬·바위에 맞음
      s.on = false; s.mesh.visible = false; isleBulletFx(true);
      if (s.owner === 1 && player.alive) { const d = Math.max(0, Math.hypot(player.x - ISLE_HIT.x, player.z - ISLE_HIT.z) - player.M.L * 0.3); if (d < s.radius) damageBoat(player, s.splash * Math.pow(1 - d / s.radius, 1.2), s.sx, s.sz, false); }
      else if (s.owner === 0) for (let e = 0; e < enemies.length; e++) { const b = enemies[e]; if (!b.alive) continue; const d = Math.max(0, Math.hypot(b.x - ISLE_HIT.x, b.z - ISLE_HIT.z) - b.M.L * 0.3); if (d < s.radius) { DSRC = 'cannon'; damageBoat(b, s.splash * Math.pow(1 - d / s.radius, 1.2), s.sx, s.sz, true); DSRC = 'item'; } }
      continue;
    }
    if (hitBoat) {
      if (grazed) s.dmg *= CONFIG.cannon.fuseDamage;      // 스친 것은 직격보다 약하게
      shellImpact(s, ox + (s.x - ox) * th, oy + (s.y - oy) * th, oz + (s.z - oz) * th, hitBoat, t);
      continue;
    }
    if (s.y < wvMax() + 0.5) {
      const h = waveHeight(s.x, s.z, t);
      if (s.y <= h) {
        if (s.near && s.near.alive) { s.dmg *= CONFIG.cannon.fuseDamage; shellImpact(s, s.x, h + 0.5, s.z, s.near, t); }   // 선체 옆 물에 떨어짐
        else shellImpact(s, s.x, h, s.z, null, t);
        continue;
      }
    }
    if (s.life <= 0) { s.on = false; s.mesh.visible = false; continue; }
    s.mesh.position.set(s.x, s.y, s.z);
    s.mesh.lookAt(s.x + s.vx, s.y + s.vy, s.z + s.vz);
    s.trail += dt;
    while (s.trail > 0.03) {                        // 포탄 뒤로 남는 옅은 연기
      s.trail -= 0.03;
      const g = rr(0.5, 0.7), f = rnd();
      smokeSys.spawn(lerp(ox, s.x, f), lerp(oy, s.y, f), lerp(oz, s.z, f), rr(-0.6, 0.6), rr(-0.2, 0.8), rr(-0.6, 0.6),
        rr(0.5, 0.95), 0.35 * s.scale, 1.5 * s.scale, g, g, g, 0.3, -0.3, 1.2, rr(-1, 1), 0, 0.9, -100);
    }
  }
}

// 포탄이 (tx, tz) 바다 지점에 떨어지도록 포물선을 계산해서 쏜다
function fireCannon(b, tx, tz, speed, g, dmg, splash, radius, owner, recoil, scale, homing) {
  if (b.tpl.twin) { b.mzS = b.mzS === 1 ? -1 : 1; b.muzzle.position.x = b.tpl.twin * b.mzS; }     // 포신 두 개: 번갈아 쏜다
  b.muzzle.getWorldPosition(_v1);
  const mx = _v1.x, my = _v1.y, mz = _v1.z;
  const dx = tx - mx, dz = tz - mz, dist = Math.sqrt(dx * dx + dz * dz) || 1;
  const T = clamp(dist / speed, CONFIG.cannon.minFlight, 7);
  const vx = dx / T, vz = dz / T, vy = -my / T + 0.5 * g * T;
  const sh0 = shellSpawn(mx, my, mz, vx, vy, vz, g, owner, dmg, splash, radius, scale);
  if (sh0) { sh0.tx = tx; sh0.tz = tz; sh0.homing = homing || null; }
  const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
  fxMuzzleCannon(mx, my, mz, vx / sp, vy / sp, vz / sp, scale);
  // 반동: 쏜 반대쪽으로 보트가 밀리고 선체가 출렁인다
  const hx = dx / dist, hz = dz / dist;
  const sh = Math.sin(b.heading), ch = Math.cos(b.heading);
  b.vx -= hx * recoil; b.vz -= hz * recoil;
  b.pitchV += 0.17 * recoil * (hx * sh + hz * ch);
  b.leanV -= 0.24 * recoil * (hx * ch - hz * sh);
  b.recoil = 1;
  Sound.playAt('cannon', mx, mz, owner === 0 ? 1.0 : 0.85, rr(0.94, 1.06));
}

function fireMG(b, tx, ty, tz, speed, spread, dmg, owner, life, tgt) {
  b.mgMuzzle.getWorldPosition(_v1);
  let dx = tx - _v1.x, dy = ty - _v1.y, dz = tz - _v1.z;
  let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 1e-3) return;
  dx /= d; dy /= d; dz /= d;
  dx += (rnd() - 0.5) * 2 * spread; dy += (rnd() - 0.5) * 2 * spread; dz += (rnd() - 0.5) * 2 * spread;   // 탄 퍼짐
  d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  dx /= d; dy /= d; dz /= d;
  bulletSpawn(_v1.x, _v1.y, _v1.z, dx * speed, dy * speed, dz * speed, life, dmg, owner, tgt);
  if (!(b === player && Cam.fpE > 0.5)) fxMuzzleMG(_v1.x, _v1.y, _v1.z, dx, dy, dz);     // 1인칭: 눈앞 총구 섬광은 뺀다
}

/* ---------- 피해 ---------- */
function bulletHitBoat(b, x, y, z, dmg, fromPlayer, sx, sz) {
  const arm = (fromPlayer && !b.isPlayer) ? (CONFIG.mg.armor[b.kind] || 1) : 1;   // 장갑: 큰 배일수록 기관총이 덜 먹힌다
  fxHitSpark(x, y, z);
  if (arm < 1) { fxArmorSpark(x, y, z); Sound.playAt('ping', x, z, 0.5, rr(0.9, 1.15)); }   // 장갑에 튕기는 불꽃과 "팅" 소리
  else if (fromPlayer) Sound.playAt('clank', x, z, 0.45, rr(0.85, 1.3));
  else Sound.play('clank', 0.4, rr(0.7, 1.0), 0);
  DSRC = 'mg';
  damageBoat(b, dmg * arm, sx, sz, fromPlayer);
  if (fromPlayer && !b.isPlayer) upgMgHit(b);
  DSRC = 'item';
}

function damageBoat(b, amount, sx, sz, fromPlayer) {
  if (b.air) return damageAir(b, amount, fromPlayer);
  if (!b.alive) return false;
  if (b.isPlayer && Game.shieldT > 0) return false;     // 수리 아이템 보호막: 무적
  if (b.rageT > 0) return false;                        // 기함 격노 연출 중: 잠깐 무적
  if (b.submerged) return false;                        // 잠수한 잠수함은 맞지 않는다
  if (b.isPlayer) { amount = upgPlayerHit(amount, sx, sz); if (amount <= 0) return false; const hk = (bossRef && Math.hypot(sx - bossRef.x, sz - bossRef.z) < 60 ? 'boss_' : '') + DSRC; Upg.hurt[hk] = (Upg.hurt[hk] || 0) + amount; }   // 강화 카드: 장갑·방어막·가시 (기록: 피해 출처)
  else if (fromPlayer) { amount *= upgDealMul(b) * upgCrit(); Upg.dealt[DSRC] = (Upg.dealt[DSRC] || 0) + Math.min(amount, Math.max(0, b.hp)); }   // 강화 카드: 마무리 일격·위기 집중
  b.hp -= amount;
  if (b.isPlayer) { Hud.hurt(sx, sz, amount); if (amount > 0) Game.waveHurt = true; }
  if (b.kind === 'boss' && fromPlayer && DSRC !== 'mg') b.nonMg = true;      // 업적: 기관총만으로 기함
  else if (fromPlayer) { alertEnemy(b, true); if (HM) Hud.hit(false); upgDealt(amount); upgAfterHit(b); }
  if (b.kind === 'boss' && !b.enraged && !b.noRage && b.hp > 0 && b.hp < b.maxHp * CONFIG.enemy.boss.rage.at) bossEnrage(b);
  if (b.hp <= 0) { if (b.isPlayer && upgSaveDeath(b)) return false; destroyBoat(b); return true; }
  return false;
}

function destroyBoat(b) {
  if (b.kind === 'supply') { supplyLost(b); return; }
  b.kill();
  if (b === lastMisTgt) lastMisTgt = null;      // 다음 미사일 표적 고르기에서 제외 기록을 지운다
  Sound.playAt('explosion', b.x, b.z, 1.0, rr(0.85, 1.05));
  addTraumaAt(b.x, b.z, 0.6);
  if (b.isPlayer) { onPlayerDeath(); return; }
  kills++;
  if (HM) Hud.hit(true);
  Sound.play('kill', 0.5, 1, 0);
  if (player.alive) {
    // 격파 보상: 체력 회복, 노란 추가 부스트, 미사일
    const boss = b.kind === 'boss';
    const hp0 = player.hp;
    player.hp = boss ? player.maxHp : Math.min(player.maxHp, player.hp + CONFIG.player.healOnKill);    // 보스를 잡으면 체력 가득
    if (!boss) Upg.healed += Math.max(0, player.hp - hp0 - UB.heal);                                // 기록용: 카드로 더 회복한 양
    Game.bonus += CONFIG.boost.bonusPerKill * (boss ? 3 : 1);
    skillGain(boss);                                                 // 스킬 포인트
    xpGain(boss ? CONFIG.level.xpBoss : CONFIG.level.xpKill);        // 레벨 경험치
    paintGain(boss ? CONFIG.paint.boss : CONFIG.paint.kill);         // 스킨 페인트
    if (boss) { achStat('bossKill', 1); if (!b.nonMg) achStat('mgBoss', 1); } else achCheck();
    const mg = boss ? CONFIG.missile.bossReward : (rnd() < CONFIG.missile.dropP ? CONFIG.missile.perKill : 0);      // 일반 적은 dropP 확률로만
    Game.missiles = Math.min(CONFIG.missile.maxAmmo, Game.missiles + mg);
    Game.flares += CONFIG.flare.perKill;
    Hud.reward();
    upgOnKill(b);
    if (!boss && rnd() < CONFIG.items.dropP) spawnCrate(b.x, b.z);      // 일반 적도 가끔 보급 상자
    if (boss) {
      Hud.banner('적 기함 격침', '체력이 가득 찼고 보급 상자가 떠올랐습니다');
      spawnCrate(b.x + Math.sin(b.heading + 1.6) * 18, b.z + Math.cos(b.heading + 1.6) * 18);
    }
  }
}

/* ---------- 유도 미사일 ----------
 * 플레이어 미사일: 격파할 때마다 얻고, 쏘는 순간 락온된 적(없으면 조준점 근처, 그래도 없으면 가장 가까운 적)을 따라간다.
 *   명중률만큼은 반드시 맞고, 나머지는 도중에 유도가 풀려 표적 너머 먼 바다에 떨어진다.
 * 보스 미사일: 플레이어를 따라오지만 선회가 둔해서 빠르게 급선회하면 피할 수 있다 */
const MIS_MAX = 40;
const missiles = [];
const MGEO = { p: null, e: null, glow: null, glowF: null };
let SPAWN_COLD = false;   // 미사일 모양: p 내 미사일, e 적 미사일
let missileCD = 0;

function initMissiles() {
  const g = new GeoBuilder(), body = sRGB(0xdfe5e8), dark = sRGB(0x2a2f33), red = sRGB(0xd8362b);
  g.cyl(0.17, 0.17, 2.0, 10, 0, 0, 0, body, Math.PI / 2);
  g.cyl(0.0, 0.17, 0.55, 10, 0, 0, 1.27, red, Math.PI / 2);
  g.cyl(0.13, 0.15, 0.2, 10, 0, 0, -1.08, dark, Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    g.box(0.02, 0.38, 0.42, Math.sin(a) * 0.3, Math.cos(a) * 0.3, -0.75, dark, 0, 0, -a);
    g.box(0.015, 0.2, 0.22, Math.sin(a) * 0.22, Math.cos(a) * 0.22, 0.55, dark, 0, 0, -a);
  }
  const geo = g.build();
  // 내 미사일: 탄도미사일처럼 짙은 국방색 몸통, 뾰족한 머리, 노란 띠 두 줄, 꼬리 날개 네 장
  const h = new GeoBuilder(), olive = sRGB(0x2b3227), yel = sRGB(0xf0b20c), blk = sRGB(0x15181a), gry = sRGB(0x4a4f50);
  h.cyl(0.17, 0.17, 1.8, 14, 0, 0, 0, olive, Math.PI / 2);
  h.cyl(0.115, 0.17, 0.42, 14, 0, 0, 1.11, olive, Math.PI / 2);
  h.cyl(0.0, 0.115, 0.5, 14, 0, 0, 1.57, olive, Math.PI / 2);
  h.cyl(0.176, 0.176, 0.07, 14, 0, 0, 0.84, yel, Math.PI / 2);
  h.cyl(0.176, 0.176, 0.09, 14, 0, 0, -0.66, yel, Math.PI / 2);
  h.cyl(0.17, 0.205, 0.26, 14, 0, 0, -1.03, gry, Math.PI / 2);
  h.cyl(0.13, 0.155, 0.12, 12, 0, 0, -1.21, blk, Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    h.box(0.022, 0.3, 0.36, Math.sin(a) * 0.33, Math.cos(a) * 0.33, -0.98, blk, 0, 0, -a);
  }
  MGEO.p = h.build(); MGEO.e = geo;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 });
  // 적 미사일에 두르는 빨간 빛 (멀리서도 빨간 점으로 보이게)
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.22, 'rgba(255,60,30,1)'); gr.addColorStop(0.5, 'rgba(240,20,10,0.8)'); gr.addColorStop(0.75, 'rgba(220,0,0,0.3)'); gr.addColorStop(1, 'rgba(200,0,0,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  // 밝은 하늘에서도 묻히지 않게 일반 합성으로 그린다 (더하기 합성은 하늘에서 하얗게 바랜다)
  const glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, transparent: true, toneMapped: false, fog: false });
  MGEO.glow = glowMat; MGEO.glowF = glowMat.clone(); MGEO.glowF.color.setRGB(1.0, 0.62, 0.15);     // 직사 고속 미사일은 주황빛
  for (let i = 0; i < MIS_MAX; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    const glow = new THREE.Sprite(glowMat); glow.position.set(0, 0, -0.6); glow.visible = false; glow.renderOrder = 20; mesh.add(glow);
    mesh.userData.glow = glow;
    scene.add(mesh);
    missiles.push({ on: false, mesh: mesh, owner: 0, willHit: true, lost: false, loseT: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 0, age: 0,
      target: null, hp: 0, tx: 0, ty: 0, tz: 0, trail: 0, sx: 0, sz: 0, dmg: 0, splash: 0, radius: 0, scale: 1, turn: 1, vmax: 100, fuse: 4 });
  }
}

function missilesClear() {
  lastMisTgt = null;
  for (let i = 0; i < MIS_MAX; i++) { missiles[i].on = false; missiles[i].mesh.visible = false; missiles[i].target = null; }
  missileCD = 0;
}

function spawnMissile(owner, x, y, z, vx, vy, vz, target, willHit, dmg, splash, radius, scale, turn, vmax, fuse, sx, sz) {
  let m = null;
  for (let i = 0; i < MIS_MAX; i++) if (!missiles[i].on) { m = missiles[i]; break; }
  if (!m) return null;
  m.on = true; m.owner = owner; m.manual = false; m.flare = null; m.flareSet = null; m.decoy = false; m.flareTried = 0; m.top = 0; m.ign = false; m.dive = false; m.fast = false; m.puffT = 0; m.b1 = false; m.b2 = false; m.tilt = 0; m.age = 0; m.trail = 0; m.target = target; m.willHit = willHit; m.lost = false; m.hp = CONFIG.intercept.mgHits;
  m.loseT = willHit ? 1e9 : rr(0.5, 1.1);
  m.tx = target ? target.x : x; m.ty = 0.5; m.tz = target ? target.z : z;
  m.x = x; m.y = y; m.z = z; m.vx = vx; m.vy = vy; m.vz = vz;
  m.speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  m.dmg = dmg; m.splash = splash; m.radius = radius; m.scale = scale; m.turn = turn; m.vmax = vmax; m.fuse = fuse; m.sx = sx; m.sz = sz;
  m.mesh.position.set(x, y, z); m.mesh.geometry = owner === 0 ? MGEO.p : MGEO.e; m.mesh.userData.glow.material = MGEO.glow;
  m.mesh.visible = true; m.mesh.userData.glow.visible = owner !== 0; m.beepT = 0;
  if (SPAWN_COLD) return m;                                   // 냉발사: 불꽃 없이
  fireSys.spawn(x, y - 0.8, z, 0, -4, 0, 0.12, 2.2 * scale * 0.6, 3.6 * scale * 0.6, 9, 6, 2.5, 1, 0, 0, 0, 0, 0.5, -100);
  for (let i = 0; i < 6; i++) {
    const g = rr(0.6, 0.8);
    smokeSys.spawn(x + rr(-1, 1), y - 1, z + rr(-1, 1), rr(-3, 3), rr(-1, 2), rr(-3, 3), rr(1.2, 2.2), 0.8, 3.4, g, g, g, 0.5, -0.4, 1.4, rr(-1, 1), 0, 0.9, -100);
  }
  return m;
}

// 미사일 표적 고르기: 가까운 적부터. 이미 미사일이 쫓고 있는 적과 바로 전에 쏜 적은 건너뛴다
// (범위 안에 그런 적밖에 없을 때만 어쩔 수 없이 같은 적에게 간다)
let lastMisTgt = null;
function pickMissileTarget(x, z, range) {
  let a = null, ad = 1e18, b2 = null, bd = 1e18, c2 = null, cd = 1e18, d2 = null, dd = 1e18;
  const r2 = range * range;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive || (e.submerged && !(e.kind === 'sub' && Skill.topDown))) continue;       // 탑다운 미사일을 사면 잠수 중인 잠수함도 노린다
    const dx = e.x - x, dz = e.z - z, d = dx * dx + dz * dz;
    if (d > r2) continue;
    let taken = false;
    if (e.air) continue;
    for (let j = 0; j < MIS_MAX; j++) { const m = missiles[j]; if (m.on && m.owner === 0 && !m.lost && m.target === e) { taken = true; break; } }
    const last = e === lastMisTgt;
    if (!taken && !last && d < ad) { ad = d; a = e; }
    if (!taken && d < bd) { bd = d; b2 = e; }
    if (!last && d < cd) { cd = d; c2 = e; }
    if (d < dd) { dd = d; d2 = e; }
  }
  // 하늘: 배가 없거나 헬기가 훨씬 가까우면 헬기 (드론은 기관총·함포로)
  let h = null, hd = 1e18;
  for (let i = 0; i < airs.length; i++) {
    const e = airs[i]; if (!e.alive || e.kind !== 'heli') continue;
    const dx = e.x - x, dz = e.z - z, d = dx * dx + dz * dz;
    if (d > r2) continue;
    let taken = false;
    for (let j = 0; j < MIS_MAX; j++) { const m = missiles[j]; if (m.on && m.owner === 0 && !m.lost && m.target === e) { taken = true; break; } }
    if (!taken && d < hd) { hd = d; h = e; }
  }
  const boat = a || b2 || c2 || d2;
  if (h && (!boat || hd < dd * 0.6 || boat === c2 || boat === d2)) return h;
  return boat;
}

function launchMissile() {
  const M = CONFIG.missile, P = player, sh = Math.sin(P.heading), ch = Math.cos(P.heading);
  const tgt = pickMissileTarget(P.x, P.z, M.lockRange);
  if (tgt) lastMisTgt = tgt;
  if (tgt && P.vls && Skill.topDown && !tgt.air) return launchTopMissile(tgt);           // 탑다운을 사면 모든 적을 위에서 내리꽂는다
  // 뒷갑판 상자형 발사대의 발사관에서 차례로, 발사관이 향한 쪽으로 비스듬히 튀어나간 뒤 표적 쪽으로 꺾는다
  let lx0 = P.x - sh * 3.4, ly0 = P.y + 2.4, lz0 = P.z - ch * 3.4, dvx = Math.sin(Cam.yaw) * 6, dvy = 26, dvz = Math.cos(Cam.yaw) * 6;
  if (P.launcher) {
    const T = P.tpl, tb = T.launcherTubes[P.tubeI++ % T.launcherTubes.length];
    P.launcher.updateWorldMatrix(true, false);
    _v1.copy(tb).applyMatrix4(P.launcher.matrixWorld); lx0 = _v1.x; ly0 = _v1.y; lz0 = _v1.z;
    _v1.copy(T.launcherDir).transformDirection(P.launcher.matrixWorld);
    dvx = _v1.x * 34; dvy = _v1.y * 34; dvz = _v1.z * 34;
  }
  const m = spawnMissile(0, lx0, ly0, lz0, P.vx + dvx, dvy, P.vz + dvz,
    tgt, rnd() < M.hitChance, M.damage, M.splash, M.radius, 1.9, M.turnRate, M.maxSpeed, M.fuse, P.x, P.z);
  if (!m) return false;
  m.manual = !MIS_AUTO;
  if (!tgt) { m.tx = Aim.seaX; m.tz = Aim.seaZ; }
  // 발사 효과: 갑판의 섬광과 짙은 발사 연기
  // 발사관 입구의 섬광, 뒤로 뿜는 화염과 짙은 연기
  const bx = dvx / 34, by = dvy / 34, bz = dvz / 34;
  fireSys.spawn(lx0, ly0, lz0, 0, 0, 0, 0.14, 2.2, 4.5, 10, 7, 3, 1, 0, 0, 0, 0, 0.55, -100);
  fireSys.spawn(lx0 - bx * 1.6, ly0 - by * 1.6, lz0 - bz * 1.6, -bx * 14, -by * 14, -bz * 14, 0.25, 1.6, 3, 10, 6, 2.5, 1, 0, 0, 0, 0, 0.5, -100);
  for (let i = 0; i < 12; i++) {
    const g = rr(0.68, 0.85), k = rr(4, 12);
    smokeSys.spawn(lx0 - bx * 1.5 + rr(-0.6, 0.6), ly0 - by * 1.5, lz0 - bz * 1.5 + rr(-0.6, 0.6), -bx * k + rr(-2, 2), -by * k * 0.4 + rr(0, 2), -bz * k + rr(-2, 2), rr(1.4, 2.6), 1.2, 4.5, g, g, g, 0.55, -0.5, 1.6, rr(-1, 1), 0, 0.9, -100);
  }
  Sound.play('missile', 0.75, rr(0.95, 1.05), 0);
  Cam.trauma = Math.min(1, Cam.trauma + 0.2);
  return true;
}

// 보스·미사일 고속정의 미사일 일제 사격: 갑판에서 줄지어 솟아올라 플레이어를 쫓는다
let misToastT = -99;
function bossSalvo(b) {
  const S = b.S, sh = Math.sin(b.heading), ch = Math.cos(b.heading);
  for (let k = 0; k < S.missileSalvo; k++) {
    const o = -4 - k * 1.6, side = k % 2 ? 1 : -1;
    const x = b.x + sh * o + ch * side * 2.4, z = b.z + ch * o - sh * side * 2.4;
    if (rnd() < CONFIG.missile.fast.p) { fastMissile(b, x, b.y + 4, z); continue; }
    spawnMissile(1, x, b.y + 4, z, b.vx + ch * side * 6, rr(18, 26), b.vz - sh * side * 6, player, true,
      S.missileDamage * b.dmgMul, S.missileDamage * 0.6 * b.dmgMul, S.missileRadius, 0.9, S.missileTurn, S.missileSpeed, 3.2, b.x, b.z);
  }
  Sound.playAt('missile', b.x, b.z, 1.0, 0.85);
  if (b.kind === 'boss' || simTime - misToastT > 15) { misToastT = simTime; Hud.toast('적 미사일 접근, 급선회로 피하거나 쏴서 요격하세요'); }
}

// 직사 고속 미사일: 내가 갈 자리를 예측해 그쪽으로 곧장 아주 빠르게. 유도가 없어 플레어에 안 속고, 피하거나 쏴서 막는다
function fastMissile(b, x, y, z) {
  const S = b.S, F = CONFIG.missile.fast, P = player;
  const d = Math.hypot(P.x - x, P.z - z), tg = d / F.speed;
  const tx = P.x + P.vx * tg, tz = P.z + P.vz * tg, ty = P.y + 1.2;
  const dx = tx - x, dy = ty - y, dz = tz - z, dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const m = spawnMissile(1, x, y, z, dx / dl * F.speed, dy / dl * F.speed, dz / dl * F.speed, player, true,
    S.missileDamage * F.dmgMul * b.dmgMul, S.missileDamage * F.dmgMul * 0.6 * b.dmgMul, S.missileRadius, 0.9, 0, F.speed, 3.2, b.x, b.z);
  if (!m) return null;
  m.fast = true; m.ax = tx; m.az = tz; m.mesh.userData.glow.material = MGEO.glowF;
  fireSys.spawn(x, y, z, 0, 0, 0, 0.12, 2.5, 5, 11, 7, 3, 1, 0, 0, 0, 0, 0.5, -100);
  return m;
}

/* ---------- 탑다운 미사일(상점): 수직 발사관에서 냉발사해 모든 적을 위에서 내리꽂는다 ---------- */
function launchTopMissile(tgt) {
  const M = CONFIG.missile, TP = M.top, P = player;
  const cell = P.vlsCells[P.vlsI = ((P.vlsI || 0) + 1) % P.vlsCells.length];
  cell.t = 1.8;                                                   // 덮개가 튕겨 열리고 잠시 뒤 닫힌다
  P.root.updateWorldMatrix(true, true);
  _v1.set(0, 0.15, 0.2).applyMatrix4(cell.pv.matrixWorld);
  const me = P.root.matrixWorld.elements;
  _v2.set(me[4], me[5], me[6]).normalize();                       // 갑판의 위쪽
  SPAWN_COLD = true;
  const m = spawnMissile(0, _v1.x, _v1.y, _v1.z, P.vx + _v2.x * TP.ejectV, _v2.y * TP.ejectV, P.vz + _v2.z * TP.ejectV,
    tgt, true, M.damage * TP.dmgMul, M.splash * TP.dmgMul, M.radius, 1.9, M.turnRate, M.maxSpeed, M.fuse, P.x, P.z);
  SPAWN_COLD = false;
  if (!m) return false;
  m.manual = !MIS_AUTO; m.top = 1; m.loseT = 1e9; m.speed = TP.ejectV;
  m.apex = P.y + clamp(Math.hypot(tgt.x - P.x, tgt.z - P.z) * 0.2, TP.apex[0], TP.apex[1]);
  // 덮개가 튕겨 나가는 순간: 하얀 가스가 확 뿜어진다
  for (let i = 0; i < 14; i++) {
    const g = rr(0.88, 0.97), a = rnd() * TAU, sp = rr(2, 6);
    smokeSys.spawn(_v1.x + rr(-0.3, 0.3), _v1.y, _v1.z + rr(-0.3, 0.3), Math.cos(a) * sp, rr(1, 7), Math.sin(a) * sp, rr(1.2, 2.4), 1.2, 4, g, g, g, 0.7, -0.4, 1.5, rr(-1, 1), 0, 0.9, -100);
  }
  Sound.play('cannon', 0.5, 0.5, 0); Sound.play('clank', 0.6, 0.55, 0);      // 퉁
  Cam.trauma = Math.min(1, Cam.trauma + 0.12);
  return true;
}
// 탑다운 미사일 조종: 냉발사(관성으로 솟음) → 점화 후 수직 상승 → 꼭대기에서 꺾어 아주 빠르게 내리꽂음
function topSteer(m, dt) {
  const b = m.target, TP = CONFIG.missile.top;
  if (!b || !b.alive) { m.top = 0; m.ign = true; return false; }
  if (m.age < TP.eject) {
    const dx = b.x - m.x, dz = b.z - m.z, dh = Math.sqrt(dx * dx + dz * dz) || 1, hx = dx / dh, hz = dz / dh;
    if (m.age < TP.pop) {
      // 툭: 가스에 밀려 수직으로 솟구치며 빠르게 느려진다 (불꽃 없음)
      m.vy -= 26 * dt; m.vx *= 1 - 4 * dt; m.vz *= 1 - 4 * dt; m.tilt = 0;
      m.speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy + m.vz * m.vz); return true;
    }
    // 칙- 칙-: 기수 옆 측추력기가 두 번 터질 때마다 기수가 적 쪽으로 확 꺾인다
    if (!m.b1) { m.b1 = true; topThruster(m, hx, hz); }
    if (!m.b2 && m.age >= TP.pop + TP.gap) { m.b2 = true; topThruster(m, hx, hz); }
    const want = m.b2 ? TP.tilt : TP.tilt * 0.45;
    m.tilt += (want - m.tilt) * Math.min(1, 26 * dt);
    const sp = Math.max(2.5, m.speed - 30 * dt), st = Math.sin(m.tilt);
    m.vx = hx * st * sp; m.vz = hz * st * sp; m.vy = Math.cos(m.tilt) * sp; m.speed = sp;
    return true;
  }
  if (!m.ign) {
    // 공중 점화: 꽁무니에서 불꽃이 터지며 엔진이 켜진다
    m.ign = true;
    fireSys.spawn(m.x - m.vx / (m.speed || 1) * 1.3, m.y - m.vy / (m.speed || 1) * 1.3, m.z - m.vz / (m.speed || 1) * 1.3, 0, -4, 0, 0.16, 1.1, 2.6, 10, 6, 2.2, 1, 0, 0, 0, 0, 0.6, -100);
    for (let i = 0; i < 10; i++) { const g = rr(0.8, 0.92); smokeSys.spawn(m.x + rr(-0.8, 0.8), m.y - 1.5, m.z + rr(-0.8, 0.8), rr(-4, 4), rr(-6, -1), rr(-4, 4), rr(1.6, 2.8), 1.3, 5, g, g, g, 0.65, -0.4, 1.6, rr(-1, 1), 0, 0.9, -100); }
    Sound.playAt('missile', m.x, m.z, 1.0, rr(0.95, 1.05));
  }
  const dx = b.x - m.x, dz = b.z - m.z, dh = Math.sqrt(dx * dx + dz * dz) || 1;
  let gx, gy, gz, rate;
  if (!m.dive) {
    gx = dx / dh * TP.lean; gy = 1; gz = dz / dh * TP.lean; rate = 4;
    m.speed = Math.min(TP.climbSpeed, m.speed + TP.climbAcc * dt);
    if (m.y > m.apex || m.age > TP.climbMax) m.dive = true;
  } else {
    const tgo = Math.sqrt(dh * dh + m.y * m.y) / Math.max(m.speed, 50);
    gx = b.x + b.vx * tgo - m.x; gy = (b.submerged ? waveHeight(b.x, b.z, simTime) - 1 : b.y + 1.2) - m.y; gz = b.z + b.vz * tgo - m.z; rate = TP.diveTurn;
    m.speed = Math.min(TP.diveSpeed, m.speed + TP.diveAcc * dt);
  }
  const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1; gx /= gl; gy /= gl; gz /= gl;
  const sp = m.speed || 1;
  let ux = m.vx / sp, uy = m.vy / sp, uz = m.vz / sp;
  const ul0 = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1; ux /= ul0; uy /= ul0; uz /= ul0;
  const ang = Math.acos(clamp(ux * gx + uy * gy + uz * gz, -1, 1));
  const k = ang > 1e-4 ? Math.min(1, rate * dt / ang) : 1;
  ux += (gx - ux) * k; uy += (gy - uy) * k; uz += (gz - uz) * k;
  const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
  m.vx = ux / ul * m.speed; m.vy = uy / ul * m.speed; m.vz = uz / ul * m.speed;
  return true;
}
// 측추력기 분사: 기수 쪽 옆구리에서 적 반대쪽으로 하얀 가스가 짧고 세게 뿜어진다 (그 반동으로 기수가 적 쪽으로)
function topThruster(m, hx, hz) {
  const sp = m.speed || 1, ux = m.vx / sp, uy = m.vy / sp, uz = m.vz / sp;
  const nx = m.x + ux * 1.1, ny = m.y + uy * 1.1, nz = m.z + uz * 1.1;
  for (let i = 0; i < 9; i++) {
    const g = rr(0.93, 1), v = rr(16, 30);
    smokeSys.spawn(nx - hx * 0.2, ny, nz - hz * 0.2, -hx * v + rr(-2, 2), rr(-1.5, 1.5), -hz * v + rr(-2, 2), rr(0.4, 0.75), 0.4, 2.2, g, g, g, 0.9, -0.15, 0.6, rr(-1, 1), 0, 0.85, -100);
  }
  Sound.playAt('dry', m.x, m.z, 0.9, 0.55);
  Sound.playAt('tick', m.x, m.z, 0.5, 0.45);
}
function topImpact(m, t) {
  const b = m.target, h = waveHeight(m.x, m.z, t);
  const near = b && b.alive && Math.hypot(b.x - m.x, b.z - m.z) < Math.max(7, b.M.L * 0.5);
  if (m.y > h + 0.5 && !(near && m.y < h + 3)) return false;
  if (near) {
    const was = b.submerged;
    b.submerged = false;                                          // 잠수 중이어도 일반 미사일과 같은 데미지
    missileExplode(m, m.x, Math.max(m.y, h), m.z, b, t);
    if (b.alive) b.submerged = was;
    if (was) { fxWaterColumn(m.x, m.z, 2.4, t); foamDecal(m.x, m.z, 6, 26, 8, 1.2, 0.7, 0.3); }
  } else missileExplode(m, m.x, Math.max(m.y, h), m.z, null, t);
  return true;
}

/* ---------- 요격: 보스 미사일을 기관총이나 함포로 공중에서 터뜨린다 (락온으로는 겨눌 수 없다) ---------- */
// 선분(o→n)과 점 사이 최단 거리의 제곱
function segPointD2(ox, oy, oz, nx, ny, nz, px, py, pz) {
  const sx = nx - ox, sy = ny - oy, sz = nz - oz, l2 = sx * sx + sy * sy + sz * sz;
  let k = l2 > 0 ? ((px - ox) * sx + (py - oy) * sy + (pz - oz) * sz) / l2 : 0;
  k = k < 0 ? 0 : (k > 1 ? 1 : k);
  const dx = ox + sx * k - px, dy = oy + sy * k - py, dz = oz + sz * k - pz;
  return dx * dx + dy * dy + dz * dz;
}
function missileIntercept(m) {
  m.on = false; m.mesh.visible = false; m.target = null;
  fxExplosion(m.x, m.y, m.z, 0.55);
  Sound.playAt('explosion', m.x, m.z, 0.65, rr(1.35, 1.55));
  if (HM) Hud.hit(false);
  Hud.toast('미사일 요격');
}
function bulletVsMissiles(ox, oy, oz, nx, ny, nz) {
  const R = CONFIG.intercept.hitRadius, R2 = R * R;
  for (let i = 0; i < MIS_MAX; i++) {
    const m = missiles[i];
    if (!m.on || m.owner !== 1) continue;
    if (segPointD2(ox, oy, oz, nx, ny, nz, m.x, m.y, m.z) > R2) continue;
    fxHitSpark(m.x, m.y, m.z);
    if (--m.hp <= 0) missileIntercept(m);
    return true;
  }
  return false;
}
// 포탄 폭발 범위 안의 적 미사일을 모두 요격한다
function blastVsMissiles(x, y, z, r) {
  const r2 = r * r;
  for (let i = 0; i < MIS_MAX; i++) {
    const m = missiles[i];
    if (!m.on || m.owner !== 1) continue;
    const dx = m.x - x, dy = m.y - y, dz = m.z - z;
    if (dx * dx + dy * dy + dz * dz < r2) missileIntercept(m);
  }
}
// 포탄이 적 미사일 바로 옆을 지나가면 공중에서 터진다
function shellVsMissiles(s, ox, oy, oz) {
  const P = CONFIG.intercept.shellProx, P2 = P * P;
  for (let i = 0; i < MIS_MAX; i++) {
    const m = missiles[i];
    if (!m.on || m.owner !== 1) continue;
    if (segPointD2(ox, oy, oz, s.x, s.y, s.z, m.x, m.y, m.z) > P2) continue;
    s.on = false; s.mesh.visible = false;
    fxExplosion(m.x, m.y, m.z, 0.8 * s.scale);
    Sound.playAt('explosion', m.x, m.z, 0.8, rr(1.0, 1.25));
    addTraumaAt(m.x, m.z, 0.3);
    blastVsMissiles(m.x, m.y, m.z, CONFIG.intercept.blast);
    return true;
  }
  return false;
}

function missileExplode(m, x, y, z, hit, t) {
  m.on = false; m.mesh.visible = false; m.target = null;
  const h = waveHeight(x, z, t), sc = m.scale * (m.decoy ? 0.55 : 1);       // 플레어에 속은 미사일은 공중에서 작게 터진다
  fxExplosion(x, Math.max(y, h), z, sc);
  if (y - h < 4) fxWaterColumn(x, z, sc * 0.8, t);
  foamDecal(x, z, 3 * sc, 15 * sc, 6, 1.1, 0.6, 0.25);
  Sound.playAt('explosion', x, z, 1.0, rr(0.72, 0.82));
  addTraumaAt(x, z, 0.45 * sc);
  DSRC = 'missile';
  if (m.owner === 0) {
    HM = m.manual;
    minesBlast(x, z, m.radius);
    // 내 미사일 명중 효과: 퍼져 나가는 충격파 고리와 큰 불덩이
    ringOn(x, z, 3, m.radius, 0.55, 0.85, 0.0, RING_WHITE);
    fireSys.spawn(x, Math.max(y, h) + 1.5, z, 0, 3, 0, 0.3, 5, 11, 10, 6, 2.5, 1, 0, 0, 0, 0, 0.6, -100);
    if (hit) {
      let dm = m.dmg;
      const Dk = DIFF();
      // 어려움: 기함이 아닌 적은 misMob웨이브 체력만큼 깎는다 (카드로 오른 미사일 데미지 비율은 그대로 곱한다)
      if (Dk.misMob && hit.kind !== 'boss' && UB) dm = m.dmg / (UB.misdmg * (Dk.misDmg || 1)) * hit.S.health * waveHpMul(Dk.misMob) * Dk.hp;
      damageBoat(hit, dm, m.sx, m.sz, true); if (!hit.air) upgMissileHit(m, hit);
    }
    if (airs.length) airSplash(x, Math.max(y, h), z, m.radius, m.splash, true);
    for (let e = 0; e < enemies.length; e++) {
      const b = enemies[e];
      if (!b.alive || b === hit) continue;
      const dx = b.x - x, dz = b.z - z, d = Math.max(0, Math.sqrt(dx * dx + dz * dz) - b.M.L * 0.3);
      if (d < m.radius) damageBoat(b, m.splash * (1 - d / m.radius), m.sx, m.sz, true);
    }
  } else if (m.decoy) flareShock(m, x, z);                // 플레어에 속은 미사일: 가까우면 약한 충격 데미지만
  else if (player.alive) {
    const F = CONFIG.missile.fast;
    if (hit) damageBoat(player, m.fast ? player.maxHp * F.hpFrac : m.dmg, m.sx, m.sz, false);      // 직사 고속 미사일은 늘 최대 체력의 60%
    else {
      const dx = player.x - x, dz = player.z - z, d = Math.max(0, Math.sqrt(dx * dx + dz * dz) - player.M.L * 0.3);
      if (d < m.radius) damageBoat(player, (m.fast ? player.maxHp * F.splashFrac : m.splash) * (1 - d / m.radius), m.sx, m.sz, false);
    }
  }
  DSRC = 'item'; HM = false;
}

function missilesUpdate(dt, t) {
  if (missileCD > 0) missileCD -= dt;
  for (let i = 0; i < MIS_MAX; i++) {
    const m = missiles[i];
    if (!m.on) continue;
    m.age += dt;
    const ox = m.x, oy = m.y, oz = m.z, mine = m.owner === 0;
    if (mine && !m.lost) {
      // 표적이 이미 격파됐으면 다른 적으로 바꾼다
      if (m.target && (!m.target.alive || (m.target.submerged && !m.top))) {
        m.target = pickMissileTarget(m.x, m.z, CONFIG.missile.lockRange);
      }
      // 빗나가는 미사일: 유도가 풀리면서 표적 너머 먼 바다로 떨어진다
      if (m.target && m.age > m.loseT) {
        const b = m.target, hx = b.x - m.x, hz = b.z - m.z, hl = Math.sqrt(hx * hx + hz * hz) || 1, side = rr(-0.35, 0.35);
        m.tx = b.x + (hx / hl - hz / hl * side) * 80; m.tz = b.z + (hz / hl + hx / hl * side) * 80; m.ty = -3;
        m.target = null; m.lost = true;
      }
    }
    if (!mine && (!player.alive || Upg.ghostT > 0)) m.target = null;      // 유령선: 적 미사일이 나를 놓친다
    if (m.decoy) flareSteer(m);                                            // 플레어에 속은 미사일: 자탄을 쫓는다
    const sure = mine && m.willHit && m.target !== null && !m.top;
    if (m.top && topSteer(m, dt)) {
      // 탑다운 미사일: 따로 조종한다
    } else if (m.fast) {
      // 직사 고속 미사일: 쏠 때 정한 방향으로 곧장. 파도에 안 닿게 수면 위 5m쯤을 스치듯 날다가 노린 자리 바로 앞에서 내리꽂는다
      const dx = m.ax - m.x, dz = m.az - m.z, dh = Math.sqrt(dx * dx + dz * dz), hs = Math.sqrt(m.vx * m.vx + m.vz * m.vz) || 1;
      const want = dh > 30 ? waveHeight(m.x, m.z, t) + 5 : player.y + 1.2;
      m.vy = clamp((want - m.y) * (dh > 30 ? 4 : 8), -m.speed * 0.5, m.speed * 0.3);
      const k = m.speed / Math.sqrt(hs * hs + m.vy * m.vy); m.vx *= k; m.vz *= k; m.vy *= k;
    } else if (m.age < 0.32) {
      m.vy -= 30 * dt;                                // 솟구치는 단계
    } else {
      let gx, gy, gz;
      if (m.target) {
        const b = m.target, dx0 = b.x - m.x, dz0 = b.z - m.z, tgo = Math.sqrt(dx0 * dx0 + dz0 * dz0) / Math.max(m.speed, 30);
        gx = b.x + b.vx * tgo * 0.6 - m.x; gy = b.y + 1.0 - m.y; gz = b.z + b.vz * tgo * 0.6 - m.z;
      } else { gx = m.tx - m.x; gy = m.ty - m.y; gz = m.tz - m.z; }
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      gx /= gl; gy /= gl; gz /= gl;
      const sp = m.speed || 1;
      let ux = m.vx / sp, uy = m.vy / sp, uz = m.vz / sp;
      const ang = Math.acos(clamp(ux * gx + uy * gy + uz * gz, -1, 1));
      let rate = m.turn;
      if (sure) rate += m.age * 2.5 + (gl < 60 ? 12 : 0);       // 맞힐 미사일은 점점 더 세게, 가까우면 곧장 꺾는다
      if (m.decoy && m.flare) rate += 3 + (gl < 60 ? 10 : 0);   // 속은 미사일은 자탄 쪽으로 세게 꺾는다
      const k = ang > 1e-4 ? Math.min(1, rate * dt / ang) : 1;
      ux += (gx - ux) * k; uy += (gy - uy) * k; uz += (gz - uz) * k;
      const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
      m.speed = Math.min(m.vmax * (m.decoy && m.flare ? 1.8 : 1), m.speed + CONFIG.missile.accel * dt);    // 자탄에 속은 미사일은 열을 쫓아 빨라진다
      m.vx = ux / ul * m.speed; m.vy = uy / ul * m.speed; m.vz = uz / ul * m.speed;
    }
    m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
    if (ISLES.length + REEFS.length && isleSeg(ox, oy, oz, m.x, m.y, m.z)) { isleBulletFx(true); missileExplode(m, ISLE_HIT.x, ISLE_HIT.y + 0.5, ISLE_HIT.z, null, t); continue; }
    if (!mine && !m.fast && m.target === player && !m.decoy && smokeBlocks(m.x, m.z, player.x, player.z)) {
      m.target = null; m.tx = player.x + rr(-30, 30); m.tz = player.z + rr(-30, 30); m.ty = -4;
      if (simTime - misToastT > 3) { misToastT = simTime; Hud.toast('연막 · 적 미사일이 목표를 놓쳤습니다'); }
      achStat('smokeSave', 1);
    }

    // 탑다운 미사일: 내리꽂다가 수면에 닿으면 터진다 (잠수함 바로 위면 잠수 중이어도 맞는다)
    if (m.top && m.dive && topImpact(m, t)) continue;
    // 맞았는지
    let hit = null;
    if (mine) {
      if (!m.lost) {
        for (let e = 0; e < enemies.length; e++) {
          const b = enemies[e];
          if (!b.alive || b.submerged || (sure && b !== m.target)) continue;     // 맞힐 미사일은 표적 말고 다른 배는 지나친다
          if (segBoat(b, ox, oy, oz, m.x, m.y, m.z, 8, 0.6) >= 0) { hit = b; break; }
        }
        if (!hit && m.target) {
          const b = m.target, dx = b.x - m.x, dy = b.y + 1 - m.y, dz = b.z - m.z;
          if (dx * dx + dy * dy + dz * dz < m.fuse * m.fuse) hit = b;
        }
      }
    } else if (m.decoy) {
      if (flareHit(m)) { fxAirBurst(m.x, m.y, m.z); missileExplode(m, m.x, m.y, m.z, null, t); continue; }      // 자탄에 부딪혀 공중에서 터진다 (나는 안 노린다)
    } else if (player.alive && m.age > 0.3) {
      if (segBoat(player, ox, oy, oz, m.x, m.y, m.z, 8, 0.4) >= 0) hit = player;
      else {
        const dx = player.x - m.x, dy = player.y + 1 - m.y, dz = player.z - m.z;
        if (dx * dx + dy * dy + dz * dz < m.fuse * m.fuse) hit = player;
      }
    }
    if (hit === player && upgReflect(m)) continue;                        // 미사일 반사판
    if (hit) { missileExplode(m, m.x, m.y, m.z, hit, t); continue; }
    if (sure) {
      if (m.y < 0.6) { m.y = 0.6; if (m.vy < 0) m.vy = 0; }    // 물에 박히지 않게 수면 위로 스친다
      if (m.age > CONFIG.missile.life) { const b = m.target; missileExplode(m, b.x, b.y + 1, b.z, b, t); continue; }
    } else {
      if (m.age > 0.3 && m.y < wvMax() + 0.5 && m.y <= waveHeight(m.x, m.z, t)) { missileExplode(m, m.x, m.y, m.z, null, t); continue; }
      if (m.age > (mine ? CONFIG.missile.life : (m.fast ? CONFIG.missile.fast.life : CONFIG.missile.enemyLife))) { missileExplode(m, m.x, m.y, m.z, null, t); continue; }
    }

    m.mesh.position.set(m.x, m.y, m.z);
    m.mesh.lookAt(m.x + m.vx, m.y + m.vy, m.z + m.vz);
    if (!mine) {
      // 빨간 빛은 멀어도 일정한 크기로 보이게 키우고, 가까워질수록 빨라지는 경고음
      const cd = camera.position.distanceTo(m.mesh.position), gs = Math.max(5, cd * 0.045) * (0.85 + 0.15 * Math.sin(m.age * 30));
      m.mesh.userData.glow.scale.set(gs, gs, 1);
      if (player.alive && m.target) {
        const pd = Math.hypot(player.x - m.x, player.z - m.z);
        m.beepT -= dt;
        if (pd < (m.fast ? 700 : 450) && m.beepT <= 0) { m.beepT = m.fast ? 0.05 + pd / 700 * 0.12 : 0.1 + pd / 450 * 0.5; Sound.play('tick', m.fast ? 0.7 : 0.55, m.fast ? 2.6 : 1.7, 0); }
      }
    }
    const sp2 = m.speed || 1, bx = m.x - m.vx / sp2 * 1.2, by = m.y - m.vy / sp2 * 1.2, bz = m.z - m.vz / sp2 * 1.2;
    if (m.top && !m.ign) {
      // 냉발사: 아직 점화 전이라 불꽃 없이 하얀 가스만 뿜는다
      if (rnd() < 0.7) { const g = rr(0.9, 0.98); smokeSys.spawn(bx, by, bz, rr(-1, 1), rr(-3, -1), rr(-1, 1), rr(1.2, 2), 0.9, 2.6, g, g, g, 0.6, -0.4, 1.4, rr(-1, 1), 0, 0.9, -100); }
      continue;
    }
    // 꽁무니 불꽃: 길게 뻗는 분사염 두 겹
    fireSys.spawn(bx, by, bz, -m.vx * 0.1, -m.vy * 0.1, -m.vz * 0.1, 0.08, 0.8, 1.5, 10, 6.5, 2.4, 1, 0, 0, 0, 0, 0.4, -100);
    fireSys.spawn(bx, by, bz, -m.vx * 0.22, -m.vy * 0.22, -m.vz * 0.22, 0.12, 0.6, 1.2, 9, 4, 1.2, 1, 0, 0, 0, 0, 0.5, -100);
    m.trail += dt;
    const step = mine ? 0.02 : 0.028;
    while (m.trail > step) {
      m.trail -= step;
      const f = rnd(), g = mine ? rr(0.86, 0.97) : rr(0.74, 0.9);
      // 연기 꼬리: 내 미사일은 하얗고 굵게, 적 미사일은 붉은 기가 돌게 더 굵게
      smokeSys.spawn(lerp(ox, bx, f), lerp(oy, by, f), lerp(oz, bz, f), rr(-0.5, 0.5), rr(-0.2, 0.6), rr(-0.5, 0.5),
        mine ? rr(1.8, 2.9) : rr(1.6, 2.4), mine ? 0.6 : 0.55, mine ? 3.8 : 3.6, g, mine ? g : g * 0.62, mine ? g : g * 0.55, mine ? 0.5 : 0.6, -0.3, mine ? 1.3 : 1.3, rr(-1, 1), 0, 0.9, -100);
    }
  }
}


/* ---------- 적 기뢰 (기뢰 부설함) · 어뢰 (잠수함) ---------- */
const EMINE_MAX = 40, TORP_MAX = 16;
const eMines = [], torps = [];
let eMineToastT = 0, torpToastT = 0;

function initHazards() {
  // 적 기뢰: 검붉은 공에 뿔이 돋고, 위에 빨간 불빛이 깜빡인다
  const g = new GeoBuilder(), body = sRGB(0x3a1512), horn = sRGB(0x1a1c1e);
  _bm.makeTranslation(0, 0, 0);
  g.add(new THREE.SphereGeometry(0.75, 12, 10), body, _bm);
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU;
    g.rod(Math.cos(a) * 0.6, 0.15, Math.sin(a) * 0.6, Math.cos(a) * 1.0, 0.25, Math.sin(a) * 1.0, 0.07, horn, 5);
  }
  g.rod(0, 0.6, 0, 0, 1.05, 0, 0.07, horn, 5);
  const geo = g.build(), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });
  const lampGeo = new THREE.SphereGeometry(0.18, 8, 6), lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.2) });
  for (let i = 0; i < EMINE_MAX; i++) {
    const mesh = new THREE.Mesh(geo, mat), lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, 1.15, 0); mesh.add(lamp);
    mesh.visible = false; scene.add(mesh);
    eMines.push({ on: false, mesh: mesh, lamp: lamp, x: 0, z: 0, t: 0, life: 0, dmg: 0, r: 8, ph: 0 });
  }
  // 어뢰: 물 바로 아래의 어두운 몸체 + 하얀 물살 자국
  const tg = new GeoBuilder();
  tg.cyl(0.28, 0.28, 3.2, 10, 0, 0, 0, sRGB(0x2a2f33), Math.PI / 2);
  tg.cyl(0.0, 0.28, 0.5, 10, 0, 0, 1.85, sRGB(0xb3302a), Math.PI / 2);
  const tgeo = tg.build();
  for (let i = 0; i < TORP_MAX; i++) {
    const mesh = new THREE.Mesh(tgeo, mat);
    mesh.visible = false; scene.add(mesh);
    torps.push({ on: false, mesh: mesh, x: 0, z: 0, vx: 0, vz: 0, life: 0, dmg: 0, foamT: 0 });
  }
}

function hazardsClear() {
  for (let i = 0; i < EMINE_MAX; i++) { eMines[i].on = false; eMines[i].mesh.visible = false; }
  for (let i = 0; i < TORP_MAX; i++) { torps[i].on = false; torps[i].mesh.visible = false; }
}

function enemyMineDrop(b) {
  const S = b.S;
  for (let i = 0; i < EMINE_MAX; i++) {
    const m = eMines[i];
    if (m.on) continue;
    m.on = true; m.x = b.x - Math.sin(b.heading) * (b.M.L * 0.55); m.z = b.z - Math.cos(b.heading) * (b.M.L * 0.55);
    m.t = 0; m.life = S.mineLife; m.dmg = S.mineDamage * b.dmgMul; m.r = S.mineRadius; m.ph = rnd() * TAU;
    m.mesh.visible = true;
    fxSplashSmall(m.x, waveHeight(m.x, m.z, simTime), m.z, 1);
    if (simTime - eMineToastT > 20) { eMineToastT = simTime; Hud.toast('적 기뢰 · 기관총으로 터뜨릴 수 있습니다'); }
    return;
  }
}

function eMineBlow(m, hurt) {
  m.on = false; m.mesh.visible = false;
  const h = waveHeight(m.x, m.z, simTime);
  fxExplosion(m.x, h + 0.5, m.z, 0.9); fxWaterColumn(m.x, m.z, 0.9, simTime);
  Sound.playAt('explosion', m.x, m.z, 0.7, 1.0);
  if (hurt && player.alive) {
    const d = Math.hypot(player.x - m.x, player.z - m.z);
    DSRC = 'mine';
    if (d < m.r * 1.6) damageBoat(player, m.dmg * (d < m.r ? 1 : 0.5), m.x, m.z, false);
    DSRC = 'item';
  }
}

// 내 총알이 적 기뢰를 맞혔는지 (맞으면 그 자리에서 터진다)
function bulletVsMines(ox, oy, oz, nx, ny, nz) {
  for (let i = 0; i < EMINE_MAX; i++) {
    const m = eMines[i];
    if (!m.on) continue;
    const my = m.mesh.position.y;
    if (segPointD2(ox, oy, oz, nx, ny, nz, m.x, my, m.z) < 1.6 * 1.6) { eMineBlow(m, false); return true; }
  }
  return false;
}

// 내 포탄·미사일 폭발 범위 안의 적 기뢰도 같이 터진다
function minesBlast(x, z, r) {
  for (let i = 0; i < EMINE_MAX; i++) {
    const m = eMines[i];
    if (m.on && Math.hypot(m.x - x, m.z - z) < r + 2) eMineBlow(m, false);
  }
}

function subFire(b) {
  const S = b.S, P = player;
  const d = Math.hypot(P.x - b.x, P.z - b.z), tgo = d / S.torpSpeed;
  const ax = P.x + P.vx * tgo * 0.8, az = P.z + P.vz * tgo * 0.8, base = Math.atan2(ax - b.x, az - b.z);
  for (let k = 0; k < S.torpCount; k++) {
    for (let i = 0; i < TORP_MAX; i++) {
      const t = torps[i];
      if (t.on) continue;
      const a = base + (k - (S.torpCount - 1) / 2) * 0.016;
      t.on = true; t.x = b.x + Math.sin(a) * (b.M.L * 0.5); t.z = b.z + Math.cos(a) * (b.M.L * 0.5);
      t.vx = Math.sin(a) * S.torpSpeed; t.vz = Math.cos(a) * S.torpSpeed; t.life = 900 / S.torpSpeed; t.dmg = S.torpDamage * b.dmgMul; t.foamT = 0;
      t.mesh.visible = true;
      break;
    }
  }
  fxSplashSmall(b.x, waveHeight(b.x, b.z, simTime), b.z, 2);
  Sound.playAt('splash', b.x, b.z, 0.8, 0.7);
  if (simTime - torpToastT > 12) { torpToastT = simTime; Hud.toast('어뢰 접근 · 하얀 물살을 보고 피하세요'); }
}

function hazardsUpdate(dt, t) {
  const P = player;
  for (let i = 0; i < EMINE_MAX; i++) {
    const m = eMines[i];
    if (!m.on) continue;
    m.t += dt;
    if (m.t > m.life) { m.on = false; m.mesh.visible = false; continue; }
    const h = waveHeight(m.x, m.z, t);
    m.mesh.position.set(m.x, h - 0.25 + Math.sin(t * 2 + m.ph) * 0.12, m.z);
    m.mesh.rotation.y = m.ph + t * 0.3;
    m.lamp.visible = Math.sin(t * 6 + m.ph) > 0;
    if (m.t > 1.5 && P.alive && Math.hypot(P.x - m.x, P.z - m.z) < m.r) eMineBlow(m, true);
  }
  for (let i = 0; i < TORP_MAX; i++) {
    const tp = torps[i];
    if (!tp.on) continue;
    tp.life -= dt;
    tp.x += tp.vx * dt; tp.z += tp.vz * dt;
    const h = waveHeight(tp.x, tp.z, t);
    tp.mesh.position.set(tp.x, h - 0.55, tp.z);
    tp.mesh.rotation.set(0, Math.atan2(tp.vx, tp.vz), 0);
    // 하얀 물살 자국: 이걸 보고 피한다
    tp.foamT -= dt;
    if (tp.foamT <= 0) { tp.foamT = 0.05; foamDecal(tp.x, tp.z, 0.8, 2.6, 2.2, 0.9, 0, 0.4); }
    if (rnd() < dt * 30) spraySys.spawn(tp.x, h + 0.1, tp.z, rr(-1, 1), rr(1, 2.5), rr(-1, 1), 0.3, 0.8, 1.4, 1, 1, 1, 0.6, -6, 1, 0, 0, 0.9, -100);
    let hit = false;
    if (P.alive) {
      const dx = P.x - tp.x, dz = P.z - tp.z, sh = Math.sin(P.heading), ch = Math.cos(P.heading);
      const along = Math.abs(dx * sh + dz * ch), side = Math.abs(dx * ch - dz * sh);
      hit = along < P.M.L * 0.5 + 1 && side < P.M.B * 0.5 + 1;
    }
    if (hit || tp.life <= 0) {
      tp.on = false; tp.mesh.visible = false;
      if (hit) {
        fxExplosion(tp.x, h + 0.5, tp.z, 1.3); fxWaterColumn(tp.x, tp.z, 1.4, t);
        Sound.playAt('explosion', tp.x, tp.z, 1.0, 0.75);
        DSRC = 'torp'; damageBoat(P, tp.dmg, tp.x - tp.vx, tp.z - tp.vz, false); DSRC = 'item';
      }
    }
  }
}

// 잠수함: 잠수 → 떠오름 → (어뢰 발사) → 다시 잠수. 물속에서는 맞지 않는다
function subAI(b, dt) {
  const A = b.ai, S = b.S, P = player, C = CONFIG.ai;
  const dx = P.x - b.x, dz = P.z - b.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
  if (A.state === 0 && P.alive && d < C.detectRange) alertEnemy(b, true);
  if (!P.alive) A.state = 0;
  if (A.empT > 0) A.subT += dt;                      // EMP 중에는 단계가 멈춘다
  A.subT -= dt;
  const lastOne = enemiesAlive() === 1;
  if (A.sub === 0) {
    b.subDepth = S.depth; b.submerged = true;
    if (lastOne && A.subT > 3) A.subT = 3;           // 혼자 남으면 더 자주 떠오른다
    if (A.subT <= 0 && A.state === 1 && d < 700) { A.sub = 1; A.subT = 1.5; }
  } else if (A.sub === 1) {
    b.subDepth = S.depth * Math.max(0, A.subT / 1.5); b.submerged = b.subDepth > 2;
    if (A.subT <= 0) {
      A.sub = 2; A.subT = S.upTime; A.torpT = 1.0; A.fired = false;
      fxSplashSmall(b.x, waveHeight(b.x, b.z, simTime), b.z, 3); Sound.playAt('splashBig', b.x, b.z, 0.6, 0.8);
    }
  } else if (A.sub === 2) {
    b.subDepth = 0; b.submerged = false;
    A.torpT -= dt;
    if (A.torpT <= 0 && !A.fired && P.alive && !(Upg.ghostT > 0) && !(A.empT > 0)) { subFire(b); A.fired = true; }
    if (A.subT <= 0) { A.sub = 3; A.subT = 1.5; }
  } else {
    b.subDepth = S.depth * (1 - Math.max(0, A.subT / 1.5)); b.submerged = b.subDepth > 2;
    if (A.subT <= 0) { A.sub = 0; A.subT = rr(S.downTime[0], S.downTime[1]); }
  }
  // 움직임: 쫓을 때는 플레이어 주위를 크게 돌고, 아니면 순찰
  let mx, mz, thr;
  if (A.state === 1) {
    const rx = -dx / d, rz = -dz / d, tx = -rz * A.orbitDir, tz = rx * A.orbitDir, R = A.orbitR;
    if (d > R * 1.6) { mx = -rx + tx * 0.3; mz = -rz + tz * 0.3; thr = 1; }
    else { const e = clamp((d - R) / (R * 0.5), -1, 1); mx = tx - rx * e * 0.9; mz = tz - rz * e * 0.9; thr = 0.8; }
  } else {
    let wx = A.wpX - b.x, wz = A.wpZ - b.z, wd = Math.sqrt(wx * wx + wz * wz);
    A.wpT -= dt;
    if (wd < 45 || A.wpT <= 0) {
      const a = rnd() * TAU, r = rr(220, 520), lim = HALF - 220;
      A.wpX = clamp(b.x + Math.cos(a) * r, -lim, lim); A.wpZ = clamp(b.z + Math.sin(a) * r, -lim, lim); A.wpT = rr(25, 50);
      wx = A.wpX - b.x; wz = A.wpZ - b.z; wd = Math.sqrt(wx * wx + wz * wz) || 1;
    }
    mx = wx / wd; mz = wz / wd; thr = C.patrolThrottle;
  }
  if (A.sub === 2) thr *= 0.35;                        // 떠 있을 때는 천천히
  const lim2 = HALF - 150;
  if (b.x > lim2) mx -= (b.x - lim2) / 70; else if (b.x < -lim2) mx += (-lim2 - b.x) / 70;
  if (b.z > lim2) mz -= (b.z - lim2) / 70; else if (b.z < -lim2) mz += (-lim2 - b.z) / 70;
  const diff = wrapAngle(Math.atan2(mx, mz) - b.heading);
  b.inSteer = clamp(diff * 2.0, -1, 1);
  b.inThrottle = thr * (Math.abs(diff) > 1.4 ? 0.5 : 1) * (A.empT > 0 ? 0.4 : 1) * (b.slowT > 0 ? CONFIG.cards.v.shockMul : 1);
}

/* ---------- 기함 격노 ---------- */
function bossEnrage(b) {
  const R = CONFIG.enemy.boss.rage, A = b.ai;
  b.enraged = true; b.rageT = R.invulnT; b.S = SPECS.bossRage;
  A.misT = Math.min(A.misT, R.invulnT + 1.5);           // 연출이 끝나면 곧 첫 일제 사격
  // 바로 옆에서 미사일 고속정·기뢰 부설함·잠수함이 한 척씩 튀어나온다
  const kinds = ['misboat', 'minelayer', 'sub'];
  for (let k = 0; k < R.escorts; k++) {
    const a = b.heading + (k - (R.escorts - 1) / 2) * 0.9 + Math.PI * 0.5 * (k % 2 ? 1 : -1), r = rr(30, 45);
    const e = spawnEnemy(kinds[k % 3], b.x + Math.sin(a) * r, b.z + Math.cos(a) * r, a, round, true, null);
    e.maxHp *= R.escortHp; e.hp = e.maxHp;
    if (e.kind === 'sub') { e.ai.sub = 0; e.ai.subT = rr(3, 5); }
    fxSplashSmall(e.x, waveHeight(e.x, e.z, simTime), e.z, 2);
  }
  const sh = Math.sin(b.heading), ch = Math.cos(b.heading);
  for (let k = -1; k <= 1; k++) fxExplosion(b.x + sh * k * 10, b.y + 4, b.z + ch * k * 10, 1.1);
  ringOn(b.x, b.z, 8, 70, 0.8, 0.9, 0, ZONE_RED);
  flash(0.3, 1, 0.2, 0.12);
  Sound.play('horn', 0.9, 0.55, 0);
  Sound.playAt('explosion', b.x, b.z, 1.0, 0.7);
  Cam.trauma = Math.min(1, Cam.trauma + 0.4);
  Hud.banner('기함 격노', '미사일과 함포가 쏟아지고 호위정이 합류했습니다');
}

// 격노한 기함: 갑판에서 불길과 검은 연기가 계속 오르고, 연출 중에는 붉은 고리가 맥박친다
function bossRageFx(b, dt) {
  if (b.rageT > 0) {
    b.rageT -= dt;
    b.ringT = (b.ringT || 0) - dt;
    if (b.ringT <= 0) { b.ringT = 0.45; ringOn(b.x, b.z, 10, 34, 0.45, 0.8, 0, ZONE_RED); }
  }
  if (rnd() < dt * 10) {
    const sh = Math.sin(b.heading), ch = Math.cos(b.heading), o = rr(-12, 12);
    fireSys.spawn(b.x + sh * o + rr(-2, 2), b.y + 4, b.z + ch * o + rr(-2, 2), rr(-1, 1), rr(3, 6), rr(-1, 1), 0.15, 2.2, 3.8, 10, 4, 1.2, 1, 0, 0, 0, 0, 0.6, -100);
    const g = rr(0.08, 0.16);
    smokeSys.spawn(b.x + sh * o, b.y + 6, b.z + ch * o, rr(-1, 1), rr(3, 5), rr(-1, 1), rr(3, 5), 3.5, 9, g, g, g, 0.75, -0.3, 2.2, rr(-1, 1), 0, 0.9, -100);
  }
}

/* ---------- 적 AI ---------- */
// 추격 상태로 바꾼다. spread가 참이면 근처 아군에게도 알린다
function alertEnemy(b, spread) {
  const A = b.ai;
  if (A.state === 0) { A.state = 1; A.lostT = 0; A.pauseT = rr(0.3, 1.2); }
  if (!spread) return;
  const r2 = CONFIG.ai.alertRadius * CONFIG.ai.alertRadius;
  for (let i = 0; i < enemies.length; i++) {
    const o = enemies[i];
    if (o === b || !o.alive || o.ai.state !== 0) continue;
    const dx = o.x - b.x, dz = o.z - b.z;
    if (dx * dx + dz * dz < r2) { o.ai.state = 1; o.ai.lostT = 0; o.ai.pauseT = rr(0.5, 1.8); }
  }
}

function aiUpdate(b, dt) {
  if (b.enraged) bossRageFx(b, dt);
  if (b.kind === 'sub') { subAI(b, dt); return; }
  const A = b.ai, S = b.S, C = CONFIG.ai;
  if (A.focus && !A.focus.alive) A.focus = null;
  const P = A.focus || player;                                       // 호위 웨이브: 일부는 보급선을 노린다
  const dx = P.x - b.x, dz = P.z - b.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
  // 볼 수 있나: 연막이나 섬이 가리면 못 본다 (0.25초마다 확인)
  A.seeT -= dt;
  if (A.seeT <= 0) { A.seeT = 0.25; A.see = P !== player || canSeePlayer(b.x, b.y + 3, b.z); }

  // 평소에는 순찰. 플레이어가 가까이 오거나 공격받으면 추격
  if (A.state === 0) {
    if (P.alive && d < C.detectRange) alertEnemy(b, true);
  } else if (!P.alive) {
    A.state = 0; A.hunter = false; A.wpT = 0;
  } else if (d > C.loseRange && !A.hunter) {
    A.lostT += dt;
    if (A.lostT > C.loseTime) { A.state = 0; A.wpT = 0; }
  } else A.lostT = 0;

  let mx, mz, thr;
  b.boosting = false;
  if (A.state === 0 && A.leader && A.leader.alive) {
    // 호위함: 보스 둘레의 자기 자리를 지키며 따라간다
    const L = A.leader, a = L.heading + A.slot, R = 48 + (A.slot * 7) % 18;
    const wx = L.x + Math.sin(a) * R - b.x, wz = L.z + Math.cos(a) * R - b.z, wd = Math.sqrt(wx * wx + wz * wz) || 1;
    mx = wx / wd; mz = wz / wd; thr = wd > 35 ? 1 : 0.45;
    if (wd < 20) { mx = Math.sin(L.heading); mz = Math.cos(L.heading); }
  } else if (A.state === 0) {
    let wx = A.wpX - b.x, wz = A.wpZ - b.z, wd = Math.sqrt(wx * wx + wz * wz);
    A.wpT -= dt;
    if (wd < 45 || A.wpT <= 0) {            // 새 순찰 지점을 고른다
      const a = rnd() * TAU, r = rr(220, 520), lim = HALF - 220;
      A.wpX = clamp(b.x + Math.cos(a) * r, -lim, lim);
      A.wpZ = clamp(b.z + Math.sin(a) * r, -lim, lim);
      A.wpT = rr(25, 50);
      wx = A.wpX - b.x; wz = A.wpZ - b.z; wd = Math.sqrt(wx * wx + wz * wz) || 1;
    }
    mx = wx / wd; mz = wz / wd; thr = C.patrolThrottle;
  } else {
    const rx = -dx / d, rz = -dz / d;                       // 플레이어에서 나를 향하는 방향
    const tx = -rz * A.orbitDir, tz = rx * A.orbitDir;      // 그 수직: 플레이어 주위를 도는 방향
    const R = A.orbitR, ERm = DIFF().eRange, mgR0 = S.mgRange > 0 && ERm ? (b.kind === 'boss' ? ERm.mgBoss : ERm.mg) : S.mgRange;
    if (d > R * 1.7) {
      mx = -rx + tx * 0.25; mz = -rz + tz * 0.25; thr = 1;
      // 추격: 공격 거리 밖에서 나를 쫓을 때만 부스트 (게이지가 있을 때)
      const BB = C.boost;
      if (d > Math.max(mgR0, R) * 1.05 && A.bG > (A.bOn ? 0 : BB.min) && !(A.empT > 0)) { A.bOn = true; b.boosting = true; }
      else A.bOn = false;
    } else {
      A.bOn = false;
      const e = clamp((d - R) / (R * 0.5), -1, 1);          // 너무 멀면 안쪽으로, 너무 가까우면 바깥으로
      mx = tx - rx * e * 0.9; mz = tz - rz * e * 0.9; thr = 0.9;
    }
    // 체력이 낮으면 가까운 섬 뒤(나와 반대쪽)로 숨는다 (기함 제외)
    if (b.kind !== 'boss' && b.hp < b.maxHp * C.coverAt && ISLES.length) {
      A.coverT -= dt;
      if (A.coverT <= 0) {
        A.coverT = 3; A.coverX = 0; A.coverZ = 0;
        let bd = 650;
        for (let i = 0; i < ISLES.length; i++) {
          const I = ISLES[i], dd = Math.hypot(I.x - b.x, I.z - b.z);
          if (dd > bd) continue;
          const ax = I.x - P.x, az = I.z - P.z, al = Math.hypot(ax, az) || 1;
          bd = dd; A.coverX = I.x + ax / al * (I.r * 1.25 + 40); A.coverZ = I.z + az / al * (I.r * 1.25 + 40);
        }
      }
      if (A.coverX || A.coverZ) {
        const cx = A.coverX - b.x, cz = A.coverZ - b.z, cl = Math.hypot(cx, cz) || 1;
        mx = cx / cl; mz = cz / cl; thr = cl > 40 ? 1 : 0.25;
      }
    }
    // 내 미사일이 다가오면 급회전해 피한다 (가까이 오면 확률로 따돌린다)
    if (A.evadeT > 0) A.evadeT -= dt;
    for (let i = 0; i < MIS_MAX; i++) {
      const m = missiles[i];
      if (!m.on || m.owner !== 0 || m.target !== b || m.top || m.lost) continue;
      const md = Math.hypot(m.x - b.x, m.z - b.z);
      if (md < C.evadeR) {
        if (!(A.evadeT > 0)) { A.evadeT = 2.2; A.evadeDir = (m.vx * dz - m.vz * dx) > 0 ? 1 : -1; }
        if (md < 70 && !m.dodged) {
          m.dodged = true;
          if (rnd() < (C.dodgeP[b.kind] || 0)) {
            const hl = md || 1, side = rr(-0.4, 0.4);
            m.tx = b.x + ((b.x - m.x) / hl - (b.z - m.z) / hl * side) * 70; m.tz = b.z + ((b.z - m.z) / hl + (b.x - m.x) / hl * side) * 70; m.ty = -3;
            m.target = null; m.lost = true;
            Hud.toast('적이 급회전해 미사일을 피했습니다');
          }
        }
      }
    }
    if (A.evadeT > 0) {
      const sp = Math.hypot(b.vx, b.vz) || 1, ux = b.vx / sp, uz = b.vz / sp;
      mx = -uz * A.evadeDir + ux * 0.4; mz = ux * A.evadeDir + uz * 0.4; thr = 1;
    }
    A.orbitT -= dt;
    if (A.orbitT <= 0) {
      if (rnd() < 0.5) A.orbitDir = -A.orbitDir;
      A.orbitT = rr(7, 15); A.orbitR = rr(S.orbit[0], S.orbit[1]);
    }
  }
  // 서로 겹치지 않게 간격 유지
  const sep = C.separation;
  for (let i = 0; i < enemies.length; i++) {
    const o = enemies[i];
    if (o === b || !o.alive) continue;
    const ox = b.x - o.x, oz = b.z - o.z, od2 = ox * ox + oz * oz;
    if (od2 < sep * sep && od2 > 1e-4) {
      const od = Math.sqrt(od2), k = (1 - od / sep) * 2.0 / od;
      mx += ox * k; mz += oz * k;
    }
  }
  // 섬·암초를 피해 간다
  if (ISLES.length + REEFS.length) { isleAvoid(b, _avo); mx += _avo.x; mz += _avo.z; }
  // 부스트 게이지: 쓰면 줄고, 안 쓰면 잠시 뒤 다시 찬다
  { const BB = C.boost; if (b.boosting) { A.bG = Math.max(0, A.bG - BB.drain * dt); A.bIdle = 0; if (A.bG <= 0) { b.boosting = false; A.bOn = false; } } else { A.bIdle += dt; if (A.bIdle > BB.delay) A.bG = Math.min(BB.max, A.bG + BB.regen * dt); } }
  // 플레이어와 부딪히지 않게
  const avoid = (b.M.L + P.M.L) * 0.5 + 14;
  if (d < avoid) { const k = (1 - d / avoid) * 3; mx -= dx / d * k; mz -= dz / d * k; }
  // 바다 경계에서 돌아선다
  const lim2 = HALF - 150;
  if (b.x > lim2) mx -= (b.x - lim2) / 70; else if (b.x < -lim2) mx += (-lim2 - b.x) / 70;
  if (b.z > lim2) mz -= (b.z - lim2) / 70; else if (b.z < -lim2) mz += (-lim2 - b.z) / 70;

  const diff = wrapAngle(Math.atan2(mx, mz) - b.heading);
  b.inSteer = clamp(diff * 2.0, -1, 1);
  b.inThrottle = thr * ((diff < 0 ? -diff : diff) > 1.4 ? 0.5 : 1) * (A.empT > 0 ? 0.4 : 1) * (b.slowT > 0 ? CONFIG.cards.v.shockMul : 1);

  // 사격: 플레이어의 움직임을 어림해 앞을 겨누되, 오차와 탄 퍼짐을 줘서 일부러 완벽하지 않게 한다
  const FB = CONFIG.flare, blind = A.blindT > 0;                 // 플레어 섬광에 눈이 부신 적
  if (blind) A.blindT -= dt;
  if (A.state === 1 && P.alive && !(Upg.ghostT > 0) && A.see) {      // 유령선 중이거나 연막·섬에 가려 나를 못 보면 쏘지 않는다
    A.errT -= dt;
    if (A.errT <= 0) {
      A.errT = rr(0.6, 1.4);
      const er = (d * DIFF().ae + DIFF().mn) * C.accK * b.accMul * Math.sqrt(rnd()) * (blind ? FB.blindErr : 1) * (Special.kind === 'storm' ? CONFIG.special.stormSpread : 1), a = rnd() * TAU;
      A.errX = Math.cos(a) * er; A.errZ = Math.sin(a) * er;
      A.lead = rr(C.leadMin, C.leadMax);
    }
    const tof = d / S.mgSpeed * A.lead;
    const ax = P.x + P.vx * tof + A.errX, az = P.z + P.vz * tof + A.errZ;
    let cx = ax, cz = az, elev = 0.06;
    if (b.turretPivot) {
      const ts = d / S.shellSpeed;
      cx = P.x + P.vx * ts * A.lead + A.errX * C.cannonErr; cz = P.z + P.vz * ts * A.lead + A.errZ * C.cannonErr;
      elev = Math.atan2(0.5 * S.shellGravity * ts, S.shellSpeed);
    }
    b.aimWeapons(cx, cz, ax, az, elev, dt);
    const ER = DIFF().eRange, boss = b.kind === 'boss';             // 난이도별 적 사거리 (쉬움·보통은 조금 짧다)
    const mgR = S.mgRange > 0 && ER ? (boss ? ER.mgBoss : ER.mg) : S.mgRange, cnR = ER && S.cannonRange ? (boss ? ER.cannonBoss : ER.cannon) : (S.cannonRange ? S.cannonRange[1] : 0);
    if (d < mgR && b.mgErr < 0.2 && !(A.empT > 0)) {
      if (A.burstLeft > 0) {
        A.fireT -= dt;
        if (A.fireT <= 0) {
          A.fireT += 1 / S.mgRate; A.burstLeft--;
          fireMG(b, ax, P.y + 1.3, az, S.mgSpeed, DIFF().sp * C.accK * b.accMul * (blind ? FB.blindSp : 1) * (Special.kind === 'storm' ? CONFIG.special.stormSpread : 1), S.mgDamage * b.dmgMul, 1, (mgR + 160) / S.mgSpeed);
          Sound.playAt('mgEnemy', b.x, b.z, 0.55, rr(0.9, 1.1));
          if (A.burstLeft === 0) A.pauseT = rr(S.burstPause[0], S.burstPause[1]);
        }
      } else {
        A.pauseT -= dt;
        if (A.pauseT <= 0) {
          // 한꺼번에 너무 많은 적이 쏘지 않게 차례를 기다린다
          if (shootersNow < C.maxShooters + Math.floor((round - 1) / 3)) { A.burstLeft = rr(S.burst[0], S.burst[1] + 1) | 0; A.fireT = 0; shootersNow++; }
          else A.pauseT = rr(0.2, 0.6);
        }
      }
    }
    if (b.turretPivot && !(A.empT > 0)) {
      A.cannonT -= dt;
      const ok1 = b.turretErr < 0.12, ok2 = b.muzzle2 !== null && b.turretErr2 < 0.12;
      if (A.cannonT <= 0 && d > S.cannonRange[0] && d < cnR && (ok1 || ok2)) {
        A.cannonT = S.cannonReload * rr(0.9, 1.3);
        const sc = b.kind === 'boss' ? 1.1 : 0.8;
        if (ok1) fireCannon(b, cx, cz, S.shellSpeed, S.shellGravity, S.cannonDamage * b.dmgMul, S.cannonSplash * b.dmgMul, S.cannonRadius, 1, 1.2, sc, null);
        if (ok2) {
          // 뒤쪽 포탑: 포구만 바꿔서 같은 방식으로 쏜다 (조금 다르게 빗나가도록 오차를 더한다)
          const m0 = b.muzzle; b.muzzle = b.muzzle2;
          fireCannon(b, cx + rr(-6, 6), cz + rr(-6, 6), S.shellSpeed, S.shellGravity, S.cannonDamage * b.dmgMul, S.cannonSplash * b.dmgMul, S.cannonRadius, 1, 0.6, sc, null);
          b.muzzle = m0;
        }
      }
    }
    if (S.missileSalvo && !(A.empT > 0) && !blind && P === player) {         // 기함·미사일 고속정: 미사일 일제 사격
      A.misT -= dt;
      if (A.misT <= 0 && d < S.missileRange) { A.misT = rr(S.missileEvery[0], S.missileEvery[1]) * (b.kind === 'misboat' ? (DIFF().misRate || 1) : 1); bossSalvo(b); }
    }
  } else {
    const fx = b.x + Math.sin(b.heading) * 100, fz = b.z + Math.cos(b.heading) * 100;
    b.aimWeapons(fx, fz, fx, fz, 0.06, dt);
  }
  // 기뢰 부설함: 쫓는 동안 지나간 자리에 기뢰를 떨어뜨린다
  if (S.mineEvery && A.state === 1 && P.alive && !(A.empT > 0)) {
    A.mineT = (A.mineT === undefined ? rr(1, 3) : A.mineT) - dt;
    if (A.mineT <= 0 && d < 900) { A.mineT = S.mineEvery * rr(0.8, 1.2); enemyMineDrop(b); }
  }
}

// 보트끼리 겹치면 서로 밀어낸다 (무거운 쪽이 덜 밀린다)
function collideBoats() {
  const n = enemies.length;
  for (let i = -1; i < n; i++) {
    const a = i < 0 ? player : enemies[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < n; j++) {
      const b = enemies[j];
      if (!b.alive || b.submerged) continue;
      const dx = b.x - a.x, dz = b.z - a.z, rs = (a.M.L + b.M.L) * 0.36, d2 = dx * dx + dz * dz;
      if (d2 >= rs * rs || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = rs - d;
      const ma = a.M.L * a.M.L, mb = b.M.L * b.M.L, ka = mb / (ma + mb), kb = ma / (ma + mb);
      a.x -= nx * pen * ka; a.z -= nz * pen * ka;
      b.x += nx * pen * kb; b.z += nz * pen * kb;
      const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rv < 0) {
        a.vx += nx * rv * ka * 1.2; a.vz += nz * rv * ka * 1.2;
        b.vx -= nx * rv * kb * 1.2; b.vz -= nz * rv * kb * 1.2;
        if (a.isPlayer) upgRam(b, rv);
        if (rv < -6 && a.isPlayer) { Cam.trauma = Math.min(1, Cam.trauma + 0.3); Sound.play('hurt', 0.6, 0.8, 0); }
      }
    }
  }
}

/* ---------- 웨이브 ---------- */
function enemiesAlive() {
  let n = 0;
  for (let i = 0; i < enemies.length; i++) if (enemies[i].alive) n++;
  return n + airAliveN();
}

function spawnEnemy(kind, x, z, heading, n, hunter, leader) {
  let b = boatPool[kind].pop();
  if (!b) b = new Boat(kind);
  if (ISLES.length + REEFS.length) { const f = isleFree(x, z, 30); x = f.x; z = f.y; }
  b.reset(x, z, heading, simTime);
  b.nonMg = false; b.reefT = 0;
  b.S = SPECS[kind]; b.enraged = false; b.rageT = 0; b.submerged = false; b.subDepth = 0;
  b.ai.sub = 0; b.ai.subT = rr(2, 5); b.ai.mineT = undefined;
  if (kind === 'sub') { b.submerged = true; b.subDepth = b.S.depth; }
  const R = CONFIG.rounds, k = n - 1, A = b.ai;
  const D = DIFF();
  b.maxHp = b.S.health * waveHpMul(n) * D.hp * lvMul(); b.hp = b.maxHp;          // 내 레벨이 높을수록 적이 세다
  b.dmgMul = waveDmgMul(n) * D.dmg * lvMul();
  b.accMul = Math.max(0.5, 1 - R.accuracyGrowth * k);
  A.state = hunter ? 1 : 0; A.hunter = hunter; A.wpX = x; A.wpZ = z; A.wpT = 0;
  A.orbitDir = rnd() < 0.5 ? 1 : -1; A.orbitR = rr(b.S.orbit[0], b.S.orbit[1]); A.orbitT = rr(6, 14); A.lostT = 0;
  A.errX = 0; A.errZ = 0; A.errT = 0; A.lead = 1; A.burstLeft = 0; A.fireT = 0; A.pauseT = rr(0.5, 2); A.cannonT = rr(1.5, 4);
  A.misT = rr(6, 9); A.leader = leader || null; A.slot = rr(0, TAU); A.empT = 0; A.blindT = 0;
  A.focus = null; A.bG = CONFIG.ai.boost.max; A.bIdle = 9; A.evadeT = 0; A.evadeDir = 1; A.coverT = 0; A.coverX = 0; A.coverZ = 0; A.seeT = 0; A.see = true;
  if (kind === 'boss') {
    b.maxHp = D.boss * Math.pow(waveHpMul(n) / waveHpMul(R.bossEvery), R.bossGrowPow) * lvMul(); b.hp = b.maxHp;     // 첫 보스 체력에서 일반 적보다 조금 느리게 늘어난다
  }
  enemies.push(b);
  return b;
}

// 웨이브가 오를수록 적 체력·데미지가 커지는 배율. 처음엔 거의 일정하게, 뒤로 갈수록 가파르게 (난이도마다 오르는 속도가 다르다)
function waveHpMul(n) { const R = CONFIG.rounds, k = n - 1, g = DIFF().grow; return 1 + (R.healthGrowth * k + R.healthGrowth2 * k * k) * g; }
function waveDmgMul(n) { const R = CONFIG.rounds, k = n - 1, g = DIFF().grow; return 1 + (R.damageGrowth * k + R.damageGrowth2 * k * k) * g; }

// n번째 웨이브: 갈수록 더 많이, 더 강하게, 플레이어에게서 멀리 떨어진 곳에 나타난다
function startRound(n) {
  if (Special.kind) specialEnd(false);              // 스킵 등으로 끝나지 않은 특수 웨이브
  round = n; roundState = 0;
  saveRun();                                        // 웨이브 시작마다 이어하기 저장·코드·기록 갱신
  upgWaveStart();
  Game.waveHurt = false;
  achCheck();
  const spk = specialPick(n);
  specialStart(spk);
  startRoundSpawn(n);
  { let cx = 0, cz = 0, c = 0; for (let i = 0; i < enemies.length; i++) { cx += enemies[i].x; cz += enemies[i].z; c++; } if (c) airWave(n, cx / c, cz / c, n % CONFIG.rounds.bossEvery === 0); }
  specialAfterSpawn(n);
  if (spk) { const I = SPECIAL_INFO[spk]; Hud.banner(I[0], I[1]); Sound.play('horn', 0.6, spk === 'night' ? 0.7 : 0.9, 0); }
}
function startRoundSpawn(n) {
  const R = CONFIG.rounds;
  const count = Math.max(2, Math.min(R.firstCount + DIFF().countAdd + Math.floor((n - 1) * R.addPerWave), R.maxCount));
  const guns = clamp(Math.round(count * (R.gunboatRatio + 0.04 * (n - 1))), 1, Math.floor(count * 0.6));
  // 새 적: 웨이브가 오르면 고속정 자리를 미사일 고속정·기뢰 부설함·잠수함이 대신한다
  const spec = [];
  const SPC = Object.assign({}, R.specials, DIFF().specials || {});     // 난이도별로 특수 적 등장을 덮어쓸 수 있다
  for (const k in SPC) { const q = SPC[k]; if (n >= q.from) for (let j = 0; j < Math.min(q.max, 1 + Math.floor((n - q.from) / q.every)); j++) spec.push(k); }
  const kindAt = (i) => i < guns ? 'gunboat' : (i - guns < spec.length && count - guns > 1 ? spec[i - guns] : 'fast');
  const lim = HALF - 200;
  if (n % R.bossEvery === 0) {
    // 보스 웨이브: 먼 곳에 적 기함이 호위 고속정들을 거느리고 나타나 플레이어를 찾아온다
    let cx = 0, cz = 0;
    for (let tries = 0; tries < 40; tries++) {
      const a = rnd() * TAU, r = rr(R.spawnMinDist, R.spawnMaxDist);
      cx = clamp(player.x + Math.cos(a) * r, -lim, lim); cz = clamp(player.z + Math.sin(a) * r, -lim, lim);
      if (Math.hypot(cx - player.x, cz - player.z) > R.spawnMinDist * 0.8) break;
    }
    const hd = Math.atan2(player.x - cx, player.z - cz);
    const boss = spawnEnemy('boss', cx, cz, hd, n, true, null);
    // 보스전은 번갈아: 홀수 번째 보스는 격노하고, 짝수 번째 보스는 격노하지 않는 대신 처음부터 호위가 많다
    const calm = Math.round(n / R.bossEvery) % 2 === 0;
    boss.noRage = calm;
    const esc = Math.min(R.bossEscorts + Math.round(n / R.bossEvery) - 1, R.bossEscortsMax) + (calm ? 2 : 0);
    for (let i = 0; i < esc; i++) {
      const a = hd + i / esc * TAU, r = rr(50, 65);
      const e = spawnEnemy('fast', cx + Math.sin(a) * r, cz + Math.cos(a) * r, hd, n, false, boss);
      e.ai.slot = i / esc * TAU;
    }
    if (calm) {
      // 미사일정·기뢰함·잠수함도 처음부터 한 척씩
      const kinds = ['misboat', 'minelayer', 'sub'];
      for (let k = 0; k < 3; k++) {
        const a = hd + Math.PI * 0.5 + (k - 1) * 0.8, r = rr(90, 120);
        const e = spawnEnemy(kinds[k], cx + Math.sin(a) * r, cz + Math.cos(a) * r, hd, n, true, null);
        if (e.kind === 'sub') { e.ai.sub = 0; e.ai.subT = rr(3, 5); }
      }
    }
    Hud.banner('웨이브 ' + n + ' · 보스 출현', calm ? '적 기함과 대규모 호위 함대가 접근합니다' : '적 기함과 호위 함대가 접근합니다');
    Sound.play('horn', 0.6, 0.8, 0);
    return;
  }
  if (n === 1) {
    // 첫 웨이브는 바다 곳곳에 흩어져 각자 순찰한다
    const px = [], pz = [];
    for (let i = 0; i < count; i++) {
      let x = 0, z = 0;
      for (let tries = 0; tries < 40; tries++) {
        const a0 = rnd() * TAU, r0 = rr(450, 1100);
        x = clamp(player.x + Math.cos(a0) * r0, -lim, lim); z = clamp(player.z + Math.sin(a0) * r0, -lim, lim);
        const dx = x - player.x, dz = z - player.z;
        let ok = dx * dx + dz * dz > 430 * 430;
        for (let j = 0; ok && j < px.length; j++) { const ex = x - px[j], ez = z - pz[j]; if (ex * ex + ez * ez < 120 * 120) ok = false; }
        if (ok) break;
      }
      px.push(x); pz.push(z);
      spawnEnemy(kindAt(i), x, z, rnd() * TAU, n, false);
    }
  } else {
    // 이후 웨이브는 먼 곳에서 무리를 지어 나타나 플레이어를 찾아온다
    const groups = n >= 4 ? 2 : 1;
    let made = 0, a0 = rnd() * TAU;
    for (let g = 0; g < groups; g++) {
      let cx = 0, cz = 0, found = false;
      for (let tries = 0; tries < 40 && !found; tries++) {
        // 두 번째 무리는 첫 무리와 같은 쪽, 25~50도 옆에서 (양쪽에서 끼고 들어오지 않게)
        const NN = CONFIG.special.nightNear, night = Special.kind === 'night';
        const a = g === 0 ? (tries ? rnd() * TAU : a0) : a0 + (rnd() < 0.5 ? -1 : 1) * rr(0.44, 0.87), r = night ? rr(NN[0], NN[1]) : rr(R.spawnMinDist, R.spawnMaxDist);
        if (g === 0) a0 = a;
        cx = clamp(player.x + Math.cos(a) * r, -lim, lim); cz = clamp(player.z + Math.sin(a) * r, -lim, lim);
        const dx = cx - player.x, dz = cz - player.z;
        found = dx * dx + dz * dz > (night ? NN[0] * NN[0] * 0.8 : R.spawnMinDist * R.spawnMinDist * 0.8);
      }
      if (!found) { cx = player.x > 0 ? -lim : lim; cz = (player.z > 0 ? -lim : lim) * (g === 0 ? 1 : 0.2); }
      const members = g === groups - 1 ? count - made : Math.ceil(count / groups);
      for (let i = 0; i < members; i++) {
        const a = i / members * TAU + rnd() * 0.6, r = 45 + 26 * Math.sqrt(i) + rr(0, 20);
        const x = clamp(cx + Math.cos(a) * r, -HALF + 60, HALF - 60), z = clamp(cz + Math.sin(a) * r, -HALF + 60, HALF - 60);
        spawnEnemy(kindAt(made), x, z, Math.atan2(player.x - x, player.z - z), n, true);
        made++;
      }
    }
  }
  Hud.banner('웨이브 ' + n, n === 1 ? '적 함정을 모두 격파하세요' : '새 적 함대가 접근합니다');
  Sound.play('horn', 0.5, 1, 0);
}

function clearEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    const b = enemies[i];
    b.retire(); b.wake.clear();
    boatPool[b.kind].push(b);
  }
  enemies.length = 0;
  bossRef = null;
  airClear();
}
