
/* ==========================================================================
 * 하늘의 적 — 공격 헬기와 자폭 드론 떼
 * 헬기: 낮게 날며 둘레를 돌고 기총 점사, 몇 초마다 무유도 로켓 4발. 기관총·함포(공중 폭발)·유도미사일로 잡는다
 * 자폭 드론: 떼로 날아와 150m 안에서 내리꽂혀 부딪혀 터진다. 기관총·함포로 떨어뜨리거나
 *   플레어를 쏘면 플레어 쪽으로 빠지고, 연막이 시선을 가리면 나를 놓친다
 * 레이더에는 세모로 보인다
 * ========================================================================== */
const airs = [], airPool = { heli: [], drone: [] }, rockets = [];
const ROCKET_MAX = 24, NO_FLARES = [];
let AIR_TPL = null, airGlowMat = null;

function initAir() {
  AIR_TPL = { heli: buildHeliModel(), drone: buildDroneModel() };
  airGlowMat = new THREE.SpriteMaterial({ map: (navLamp(0, 0, 0, 0xffffff), navTex), color: 0xff4a30, depthWrite: false, transparent: true, fog: false, toneMapped: false });
  const rg = new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6); rg.rotateX(Math.PI / 2);
  const rmat = new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < ROCKET_MAX; i++) { const m = new THREE.Mesh(rg, rmat); m.visible = false; scene.add(m); rockets.push({ on: false, m: m, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, dmg: 0, trail: 0 }); }
}

// 공격 헬기: 길쭉한 동체, 앞쪽 2인승 조종석 유리, 꼬리 붐과 꼬리 날개, 짧은 날개의 로켓 포드, 턱 아래 기관포, 스키드
function buildHeliModel() {
  const g = new GeoBuilder(), r = new GeoBuilder();
  const body = sRGB(0x4d5244), body2 = sRGB(0x3f4438), dark = sRGB(0x1b1e1f), glass = sRGB(0x0d1a22), red = sRGB(0xb8322a), pod = sRGB(0x5a5e55);
  g.wedge(1.5, 1.7, 5.6, 0, 0, 0, body, 0.3, 0.6, 0.25);
  g.wedge(1.1, 1.0, 2.2, 0, 0.3, 3.4, body2, 1.0, 0, 0.35);
  g.box(0.9, 0.55, 1.6, 0, 0.75, 2.6, glass, -0.35);
  g.box(0.95, 0.5, 1.3, 0, 0.95, 1.2, glass, -0.15);
  g.box(1.3, 0.7, 2.2, 0, 1.2, -0.6, body2);                          // 엔진 덮개
  g.cyl(0.3, 0.42, 6.4, 8, 0, 0.45, -5.6, body, Math.PI / 2);          // 꼬리 붐
  g.box(0.12, 1.6, 1.1, 0, 1.2, -8.6, body2, 0.25);                   // 꼬리 날개
  g.box(2.4, 0.1, 0.7, 0, 0.4, -8.0, body2);
  g.box(0.05, 0.25, 0.9, 0.0, 0.2, 1.6, red);
  for (const s of [1, -1]) {
    g.box(1.6, 0.12, 0.8, s * 1.4, -0.1, 0.1, body2);                  // 짧은 날개
    g.cyl(0.22, 0.22, 1.5, 10, s * 1.9, -0.35, 0.2, pod, Math.PI / 2); // 로켓 포드
    g.cyl(0.23, 0.23, 0.06, 10, s * 1.9, -0.35, 0.95, dark, Math.PI / 2);
    g.rod(s * 0.6, -0.95, 1.6, s * 0.6, -1.35, 1.6, 0.05, dark); g.rod(s * 0.6, -0.95, -1.4, s * 0.6, -1.35, -1.4, 0.05, dark);
    g.rod(s * 0.6, -1.4, 2.2, s * 0.6, -1.4, -2.0, 0.06, dark);       // 스키드
  }
  g.cyl(0.16, 0.2, 0.4, 8, 0, -0.75, 3.1, dark);                       // 턱 기관포
  g.cyl(0.05, 0.05, 1.1, 6, 0, -0.85, 3.7, dark, Math.PI / 2);
  g.cyl(0.18, 0.18, 0.6, 8, 0, 1.7, -0.2, dark);                       // 회전축
  // 주 회전 날개 (따로 돈다)
  r.cyl(0.32, 0.32, 0.18, 10, 0, 0, 0, dark);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; r.box(0.42, 0.05, 6.6, Math.sin(a) * 3.4, 0, Math.cos(a) * 3.4, dark, 0, a, 0); }
  const tr = new GeoBuilder();
  for (let k = 0; k < 2; k++) tr.box(0.05, 1.5, 0.18, 0, 0, 0, dark, k * Math.PI / 2, 0, 0);
  return { geo: g.build(), rotor: r.build(), tail: tr.build(), rotorY: 2.0, tailPos: new THREE.Vector3(0.18, 1.3, -8.7), R: 5.5 };
}
// 자폭 드론: 삼각 날개 (뒤에 프로펠러), 날개 끝의 작은 수직 꼬리
function buildDroneModel() {
  const g = new GeoBuilder(), dark = sRGB(0x3a3d40), dark2 = sRGB(0x2a2c2e), red = sRGB(0xa8302a);
  const wing = new THREE.BufferGeometry();
  const P = [0, 0, 1.4, 1.35, 0, -1.4, -1.35, 0, -1.4, 0, 0.02, 1.4, -1.35, 0.02, -1.4, 1.35, 0.02, -1.4];
  wing.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); wing.computeVertexNormals();
  g.add(wing, dark);
  g.cyl(0.16, 0.2, 2.8, 8, 0, 0.05, -0.1, dark2, Math.PI / 2);
  g.cyl(0, 0.16, 0.5, 8, 0, 0.05, 1.5, red, -Math.PI / 2);
  for (const s of [1, -1]) g.box(0.04, 0.45, 0.45, s * 1.3, 0.2, -1.25, dark2);
  g.box(0.05, 0.9, 0.12, 0, 0.05, -1.62, dark2);
  return { geo: g.build(), R: 2.6 };
}

function airMake(kind) {
  const T = AIR_TPL[kind], root = new THREE.Group();
  const body = new THREE.Mesh(T.geo, boatMat); root.add(body);
  const a = { kind: kind, air: true, root: root, body: body, rotor: null, tail: null, glow: null, alive: false, on: false, hp: 1, maxHp: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    heading: 0, pitch: 0, roll: 0, isPlayer: false, submerged: false, enraged: false, ai: { state: 1 }, M: { L: kind === 'heli' ? 10 : 3, B: 2, topY: 2 }, S: {}, R: T.R };
  if (T.rotor) {
    a.rotor = new THREE.Mesh(T.rotor, boatMat); a.rotor.position.y = T.rotorY; root.add(a.rotor);
    a.tail = new THREE.Mesh(T.tail, boatMat); a.tail.position.copy(T.tailPos); root.add(a.tail);
  }
  a.glow = new THREE.Sprite(airGlowMat); a.glow.renderOrder = 20; root.add(a.glow);
  root.rotation.order = 'YXZ'; root.visible = false; scene.add(root);
  return a;
}

function airSpawn(kind, x, z, n) {
  const C = CONFIG.air[kind], a = airPool[kind].pop() || airMake(kind), D = DIFF();
  a.alive = true; a.on = true; a.x = x; a.z = z; a.y = rr(C.alt[0], C.alt[1]); a.alt = a.y;
  a.vx = 0; a.vy = 0; a.vz = 0; a.heading = Math.atan2(player.x - x, player.z - z); a.pitch = 0; a.roll = 0; a.spin = 0;
  a.maxHp = C.hp * (1 + 0.1 * (n - 1)) * D.hp * lvMul(); a.hp = a.maxHp; a.dmgMul = waveDmgMul(n) * D.dmg * lvMul();
  a.st = 'in'; a.t = rnd() * 10; a.ph = rnd() * TAU; a.fireT = rr(1, 2); a.burst = 0; a.rocketT = rr(C.rocketEvery ? C.rocketEvery[0] : 5, 12); a.rocketN = 0; a.rocketDT = 0;
  a.orbitR = C.orbit ? rr(C.orbit[0], C.orbit[1]) : 0; a.orbitDir = rnd() < 0.5 ? 1 : -1; a.orbitT = rr(8, 14);
  a.lastX = player.x; a.lastZ = player.z; a.lost = false; a.flare = null; a.flareSet = null; a.errX = 0; a.errZ = 0; a.errT = 0; a.beepT = 0; a.downT = 0; a.trail = 0;
  a.root.visible = true; a.body.visible = true;
  airs.push(a);
  return a;
}
// n번째 웨이브의 하늘 적: 헬기(from부터 every마다 1대씩, 최대 max), 드론 떼(from부터 짝수 웨이브)
function airWave(n, cx, cz, boss) {
  const H = CONFIG.air.heli, Dr = CONFIG.air.drone;
  const nh = n >= H.from ? Math.min(H.max, 1 + Math.floor((n - H.from) / H.every)) : 0;
  for (let i = 0; i < nh; i++) { const a = rnd() * TAU, r = rr(60, 140); airSpawn('heli', cx + Math.cos(a) * r, cz + Math.sin(a) * r, n); }
  if (n >= Dr.from && (n % 2 === 0 || boss)) airSwarm(n, cx, cz, Math.min(Dr.size[1], Dr.size[0] + Math.floor((n - Dr.from) / 2)));
}
function airSwarm(n, cx, cz, count) {
  const a0 = rnd() * TAU;
  for (let i = 0; i < count; i++) { const a = a0 + i * 2.4, r = 10 + 7 * Math.sqrt(i); airSpawn('drone', cx + Math.cos(a) * r, cz + Math.sin(a) * r, n); }
}
function airAliveN() { let n = 0; for (let i = 0; i < airs.length; i++) if (airs[i].alive) n++; return n; }
function airClear() {
  for (let i = 0; i < airs.length; i++) { const a = airs[i]; a.alive = false; a.on = false; a.root.visible = false; airPool[a.kind].push(a); }
  airs.length = 0;
  for (const r of rockets) { r.on = false; r.m.visible = false; }
}

/* ---------- 피해 ---------- */
function damageAir(a, amount, fromPlayer) {
  if (!a.alive) return false;
  if (fromPlayer) amount *= upgCrit();
  a.hp -= amount;
  if (fromPlayer && HM) Hud.hit(false);
  fxHitSpark(a.x, a.y, a.z);
  if (a.hp <= 0) { airKill(a, fromPlayer); return true; }
  return false;
}
function airKill(a, fromPlayer) {
  a.alive = false; a.st = 'down'; a.downT = 0;
  if (a.kind === 'drone') {
    airBoom(a.x, a.y, a.z, 0.5); a.on = false; a.root.visible = false;
  } else {
    fxExplosion(a.x, a.y, a.z, 0.6); Sound.playAt('explosion', a.x, a.z, 0.9, 1.1);
    a.spin = rr(3, 5) * (rnd() < 0.5 ? 1 : -1);
  }
  if (!fromPlayer || !player.alive) return;
  kills++;
  if (HM) Hud.hit(true);
  Sound.play('kill', 0.45, a.kind === 'drone' ? 1.3 : 1, 0);
  if (a.kind === 'heli') {
    player.hp = Math.min(player.maxHp, player.hp + 10);
    skillGain(false); xpGain(15); paintGain(CONFIG.paint.heli);
    Game.flares += CONFIG.flare.perKill;
    if (rnd() < CONFIG.missile.dropP) Game.missiles = Math.min(CONFIG.missile.maxAmmo, Game.missiles + 1);
    Hud.reward(); achStat('heliKill', 1);
  } else { Skill.pts += 2; xpGain(3); achStat('droneKill', 1); }
}
function airBoom(x, y, z, s) {
  fireSys.spawn(x, y, z, 0, 0, 0, 0.12, 3 * s, 9 * s, 11, 8, 4, 1, 0, 0, 0, 0, 0.6, -100);
  for (let i = 0; i < 12; i++) { const a = rnd() * TAU, e = rr(-0.5, 0.9), sp = rr(10, 26); fireSys.spawn(x, y, z, Math.cos(a) * sp, e * sp, Math.sin(a) * sp, rr(0.3, 0.6), 0.4, 0.1, 10, 6, 2, 1, 14, 0.8, 0, 0.05, 0.3, -100); }
  for (let i = 0; i < 4; i++) { const g = rr(0.1, 0.2); smokeSys.spawn(x, y, z, rr(-2, 2), rr(0, 2), rr(-2, 2), rr(1.5, 2.5), 1.5, 5 * s + 2, g, g, g, 0.7, -0.3, 1.4, rr(-1, 1), 0, 0.9, -100); }
  Sound.playAt('explosion', x, z, 0.7, rr(1.3, 1.5));
}
// 내 기관총 탄 (선분)이 하늘 적에 맞는지
function airBullet(ox, oy, oz, nx, ny, nz, dmg) {
  for (let i = 0; i < airs.length; i++) {
    const a = airs[i]; if (!a.alive) continue;
    const R = a.R * (a.kind === 'drone' ? 1.25 : 1);
    const mx = (ox + nx) * 0.5 - a.x, my = (oy + ny) * 0.5 - a.y, mz = (oz + nz) * 0.5 - a.z;
    if (mx * mx + my * my + mz * mz > (R + 8) * (R + 8)) continue;
    if (segPointD2(ox, oy, oz, nx, ny, nz, a.x, a.y, a.z) < R * R) { DSRC = 'mg'; damageAir(a, dmg, true); DSRC = 'item'; return true; }
  }
  return false;
}
// 내 포탄: 하늘 적 가까이 지나가면 공중에서 터진다 (드론 떼에 좋다)
function airShell(s, ox, oy, oz, t) {
  for (let i = 0; i < airs.length; i++) {
    const a = airs[i]; if (!a.alive) continue;
    if (segPointD2(ox, oy, oz, s.x, s.y, s.z, a.x, a.y, a.z) < (a.R + 6) * (a.R + 6)) {
      s.on = false; s.mesh.visible = false;
      fxExplosion(s.x, s.y, s.z, 0.7 * s.scale); Sound.playAt('explosion', s.x, s.z, 0.8, 1.2); addTraumaAt(s.x, s.z, 0.3);
      HM = true; airSplash(s.x, s.y, s.z, s.radius * 1.3, s.dmg, true); HM = false;
      return true;
    }
  }
  return false;
}
function airSplash(x, y, z, r, dmg, fromPlayer) {
  for (let i = 0; i < airs.length; i++) {
    const a = airs[i]; if (!a.alive) continue;
    const d = Math.sqrt((a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) + (a.z - z) * (a.z - z));
    if (d < r + a.R) damageAir(a, dmg * (1 - Math.max(0, d - a.R) / r * 0.6), fromPlayer);
  }
}
// 플레어: 드론 하나하나 decoyP 확률로 자탄 쪽으로 빠진다
function airFlare(made) {
  const P = player, F = CONFIG.flare, Dr = CONFIG.air.drone;
  for (let i = 0; i < airs.length; i++) {
    const a = airs[i];
    if (!a.alive || a.kind !== 'drone' || a.flare || Math.hypot(a.x - P.x, a.z - P.z) > F.range) continue;
    if (rnd() >= Dr.decoyP) continue;
    a.flare = made[(rnd() * made.length) | 0]; a.flareSet = made; a.st = 'decoy';
    achStat('droneDecoy', 1);
  }
}

/* ---------- 움직임 ---------- */
function airUpdate(dt, t) {
  const cam = camera.position;
  for (let i = airs.length - 1; i >= 0; i--) {
    const a = airs[i];
    if (!a.on) { airs.splice(i, 1); airPool[a.kind].push(a); continue; }
    a.t += dt;
    if (!a.alive) { airFall(a, dt, t); continue; }
    if (a.kind === 'heli') heliAI(a, dt, t); else droneAI(a, dt, t);
    a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
    a.root.position.set(a.x, a.y, a.z);
    a.root.rotation.set(a.pitch, a.heading, a.roll);
    if (a.rotor) { a.rotor.rotation.y += dt * 28; a.tail.rotation.x += dt * 40; }
    // 멀리서도 보이는 작은 빨간 불빛 (드론은 더 또렷하게)
    const cd = Math.hypot(a.x - cam.x, a.y - cam.y, a.z - cam.z), gs = Math.max(a.kind === 'drone' ? 1.2 : 1.6, cd * (a.kind === 'drone' ? 0.012 : 0.009)) * (0.8 + 0.2 * Math.sin(a.t * 9));
    a.glow.scale.set(gs, gs, 1); a.glow.position.set(0, a.kind === 'drone' ? 0.2 : -0.6, a.kind === 'drone' ? -1.4 : 0);
  }
  rocketsUpdate(dt, t);
}

function heliAI(a, dt, t) {
  const C = CONFIG.air.heli, P = player, dx = P.x - a.x, dz = P.z - a.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
  const see = P.alive && canSeePlayer(a.x, a.y, a.z);
  if (see) { a.lastX = P.x; a.lastZ = P.z; }
  const tx = see ? P.x : a.lastX, tz = see ? P.z : a.lastZ, ex = tx - a.x, ez = tz - a.z, ed = Math.hypot(ex, ez) || 1;
  // 다가오다가 둘레를 돈다 (가끔 방향을 바꾸고 반지름을 바꾼다)
  let wx, wz, sp;
  if (ed > a.orbitR * 1.4) { wx = ex / ed; wz = ez / ed; sp = C.speed; }
  else {
    const rx = -ex / ed, rz = -ez / ed, ox = -rz * a.orbitDir, oz = rx * a.orbitDir, e = clamp((ed - a.orbitR) / (a.orbitR * 0.5), -1, 1);
    wx = ox - rx * e; wz = oz - rz * e; const wl = Math.hypot(wx, wz) || 1; wx /= wl; wz /= wl; sp = C.speed * 0.62;
  }
  a.orbitT -= dt;
  if (a.orbitT <= 0) { a.orbitT = rr(8, 14); if (rnd() < 0.5) a.orbitDir = -a.orbitDir; a.orbitR = rr(C.orbit[0], C.orbit[1]); }
  // 섬을 넘을 때는 높이 뜬다
  let ground = 0;
  for (let k = 0; k < ISLES.length; k++) { const h = isleH(ISLES[k], a.x + a.vx * 2, a.z + a.vz * 2); if (h > ground) ground = h; }
  const alt = Math.max(a.alt + Math.sin(a.t * 0.7 + a.ph) * 3, ground + 18);
  const k = 1 - Math.exp(-1.6 * dt);
  a.vx += (wx * sp - a.vx) * k; a.vz += (wz * sp - a.vz) * k; a.vy = (alt - a.y) * 1.2;
  // 쏠 때는 기수를 나에게, 아니면 가는 쪽으로. 가속하면 기수를 숙이고 돌면 옆으로 기운다
  const fwd = Math.atan2(a.vx, a.vz), aimH = Math.atan2(dx, dz), want = (see && d < C.mgRange * 1.1) ? aimH : fwd;
  const dh = wrapAngle(want - a.heading); a.heading += clamp(dh, -2 * dt, 2 * dt);
  const vf = a.vx * Math.sin(a.heading) + a.vz * Math.cos(a.heading), vs = a.vx * Math.cos(a.heading) - a.vz * Math.sin(a.heading);
  a.pitch = damp(a.pitch, clamp(vf / C.speed * 0.28, -0.2, 0.3), 3, dt); a.roll = damp(a.roll, clamp(-vs / C.speed * 0.35, -0.35, 0.35), 3, dt);
  if (!see || !P.alive || Upg.ghostT > 0) { a.burst = 0; return; }
  // 기총: 짧게 끊어 쏜다
  const sh = Math.sin(a.heading), ch = Math.cos(a.heading), gx = a.x + sh * 3.7, gy = a.y - 0.9, gz = a.z + ch * 3.7, AK = CONFIG.ai.accK;
  a.errT -= dt;
  if (a.errT <= 0) { a.errT = rr(0.5, 1.2); const er = (d * DIFF().ae + DIFF().mn) * AK * 1.25 * Math.sqrt(rnd()) * (Special.kind === 'storm' ? CONFIG.special.stormSpread : 1), q = rnd() * TAU; a.errX = Math.cos(q) * er; a.errZ = Math.sin(q) * er; }
  if (d < C.mgRange && Math.abs(wrapAngle(aimH - a.heading)) < 0.35) {
    if (a.burst > 0) {
      a.fireT -= dt;
      if (a.fireT <= 0) {
        a.fireT += 1 / C.mgRate; a.burst--;
        const tof = d / C.mgSpeed, ax = P.x + P.vx * tof + a.errX, az = P.z + P.vz * tof + a.errZ;
        let vx = ax - gx, vy = P.y + 1.2 - gy, vz = az - gz; const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1, spd = DIFF().sp * AK * 1.4;
        vx = vx / vl + rr(-spd, spd); vy = vy / vl + rr(-spd, spd); vz = vz / vl + rr(-spd, spd); const v2 = Math.sqrt(vx * vx + vy * vy + vz * vz);
        bulletSpawn(gx, gy, gz, vx / v2 * C.mgSpeed, vy / v2 * C.mgSpeed, vz / v2 * C.mgSpeed, (C.mgRange + 150) / C.mgSpeed, C.mgDamage * a.dmgMul, 1, null);
        fxMuzzleMG(gx, gy, gz, vx / v2, vy / v2, vz / v2);
        Sound.playAt('mgEnemy', a.x, a.z, 0.55, rr(1.05, 1.2));
      }
    } else { a.fireT -= dt; if (a.fireT <= 0) { a.burst = rr(C.burst[0], C.burst[1] + 1) | 0; a.fireT = rr(C.burstPause[0], C.burstPause[1]); } }
  }
  // 로켓 일제 사격
  a.rocketT -= dt;
  if (a.rocketT <= 0 && d < 650 && d > 120) { a.rocketT = rr(C.rocketEvery[0], C.rocketEvery[1]); a.rocketN = C.rockets; a.rocketDT = 0; }
  if (a.rocketN > 0) {
    a.rocketDT -= dt;
    if (a.rocketDT <= 0) {
      a.rocketDT = 0.13; a.rocketN--;
      const side = a.rocketN % 2 ? 1 : -1, px = a.x + ch * side * 1.9 + sh * 1, py = a.y - 0.4, pz = a.z - sh * side * 1.9 + ch * 1;
      const tg = d / C.rocketSpeed, tx2 = P.x + P.vx * tg + a.errX * 1.5 + rr(-7, 7), tz2 = P.z + P.vz * tg + a.errZ * 1.5 + rr(-7, 7);
      rocketFire(px, py, pz, tx2, P.y + 0.5, tz2, C.rocketSpeed, C.rocketDmg * a.dmgMul);
    }
  }
}

function droneAI(a, dt, t) {
  const C = CONFIG.air.drone, P = player;
  if (a.st === 'decoy') {
    // 플레어를 쫓는다. 닿거나 플레어가 다 타면 그 자리에서 터진다
    let f = a.flare;
    if (f && !f.on) { f = null; const S = a.flareSet || NO_FLARES; let bd = 1e9; for (let qi = 0; qi < S.length; qi++) { const q = S[qi]; if (!q.on) continue; const dd = (q.x - a.x) * (q.x - a.x) + (q.z - a.z) * (q.z - a.z); if (dd < bd) { bd = dd; f = q; } } a.flare = f; }
    const gx = f ? f.x : a.x + a.vx, gy = f ? f.y : -5, gz = f ? f.z : a.z + a.vz;
    droneSteer(a, gx, gy, gz, C.diveSpeed * 1.1, 4, dt);
    if ((f && Math.hypot(gx - a.x, gy - a.y, gz - a.z) < 5) || a.y < waveHeight(a.x, a.z, t) + 0.5) { a.alive = false; a.on = false; a.root.visible = false; fxAirBurst(a.x, Math.max(a.y, 1), a.z); }
    return;
  }
  const see = P.alive && canSeePlayer(a.x, a.y, a.z) && !(Upg.ghostT > 0);
  if (see) { a.lastX = P.x; a.lastZ = P.z; a.lost = false; }
  else if (!a.lost) { a.lost = true; a.lastX += rr(-25, 25); a.lastZ += rr(-25, 25); }
  const tx = a.lastX, tz = a.lastZ, d = Math.hypot(tx - a.x, tz - a.z);
  if (a.st !== 'dive' && d < C.diveR) { a.st = 'dive'; if (see) { Sound.play('tick', 0.6, 2.2, 0); } }
  if (a.st === 'dive') {
    const tgo = Math.hypot(P.x - a.x, P.y - a.y, P.z - a.z) / C.diveSpeed;
    const gx = see ? P.x + P.vx * tgo * 0.8 : tx, gz = see ? P.z + P.vz * tgo * 0.8 : tz, gy = see ? P.y + 1.4 : -3;
    droneSteer(a, gx, gy, gz, C.diveSpeed, see ? 2.6 : 1.5, dt);
    a.beepT -= dt;
    if (see && a.beepT <= 0) { const pd = Math.hypot(P.x - a.x, P.z - a.z); a.beepT = 0.06 + pd / 150 * 0.25; Sound.play('tick', 0.5, 2.8, 0); }
    // 닿으면 터진다
    if (P.alive && Math.hypot(P.x - a.x, P.y + 1.4 - a.y, P.z - a.z) < 4.5) { droneBlow(a, true); return; }
    if (a.y < waveHeight(a.x, a.z, t) + 0.3) { droneBlow(a, false); return; }
    if (ISLES.length) for (let k = 0; k < ISLES.length; k++) if (a.y < isleH(ISLES[k], a.x, a.z)) { droneBlow(a, false); return; }
  } else {
    // 떼 지어 날아온다: 좌우로 흔들리고 서로 간격을 둔다
    const dx = tx - a.x, dz = tz - a.z, dl = Math.hypot(dx, dz) || 1, wob = Math.sin(a.t * 1.6 + a.ph) * 0.45;
    let wx = dx / dl - dz / dl * wob, wz = dz / dl + dx / dl * wob;
    for (let i = 0; i < airs.length; i++) {
      const o = airs[i]; if (o === a || !o.alive || o.kind !== 'drone') continue;
      const ox = a.x - o.x, oz = a.z - o.z, od2 = ox * ox + oz * oz;
      if (od2 < 100 && od2 > 1e-3) { const od = Math.sqrt(od2); wx += ox / od * (1 - od / 10) * 1.5; wz += oz / od * (1 - od / 10) * 1.5; }
    }
    const wl = Math.hypot(wx, wz) || 1;
    let ground = 0;
    for (let k = 0; k < ISLES.length; k++) { const h = isleH(ISLES[k], a.x + a.vx * 1.5, a.z + a.vz * 1.5); if (h > ground) ground = h; }
    droneSteer(a, a.x + wx / wl * 60, Math.max(a.alt, ground + 12), a.z + wz / wl * 60, C.speed, 1.8, dt);
  }
}
function droneSteer(a, gx, gy, gz, sp, turn, dt) {
  let dx = gx - a.x, dy = gy - a.y, dz = gz - a.z; const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= dl; dy /= dl; dz /= dl;
  const cs = Math.sqrt(a.vx * a.vx + a.vy * a.vy + a.vz * a.vz) || 1;
  let ux = a.vx / cs, uy = a.vy / cs, uz = a.vz / cs;
  if (cs < 1) { ux = Math.sin(a.heading); uy = 0; uz = Math.cos(a.heading); }
  const k = Math.min(1, turn * dt);
  ux += (dx - ux) * k; uy += (dy - uy) * k; uz += (dz - uz) * k;
  const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1, s2 = cs + (sp - cs) * Math.min(1, dt * 1.5);
  a.vx = ux / ul * s2; a.vy = uy / ul * s2; a.vz = uz / ul * s2;
  const h = Math.atan2(a.vx, a.vz), dh = wrapAngle(h - a.heading);
  a.heading = h; a.roll = damp(a.roll, clamp(-dh / Math.max(dt, 1e-3) * 0.08, -0.7, 0.7), 4, dt);
  a.pitch = -Math.asin(clamp(a.vy / (s2 || 1), -1, 1));
}
function droneBlow(a, direct) {
  const C = CONFIG.air.drone, P = player;
  a.alive = false; a.on = false; a.root.visible = false;
  airBoom(a.x, Math.max(a.y, 0.5), a.z, 0.8);
  if (a.y < 3) fxWaterColumn(a.x, a.z, 0.4, simTime);
  if (!P.alive) return;
  const d = Math.max(0, Math.hypot(P.x - a.x, P.z - a.z) - P.M.L * 0.3);
  DSRC = 'drone';
  if (direct) damageBoat(P, C.dmg * a.dmgMul, a.x, a.z, false);
  else if (d < C.r) damageBoat(P, C.dmg * a.dmgMul * (1 - d / C.r) * 0.7, a.x, a.z, false);
  DSRC = 'item';
  addTraumaAt(a.x, a.z, 0.5);
}
// 격추된 헬기: 빙글빙글 돌며 연기를 끌고 떨어져 바다에 처박힌다
function airFall(a, dt, t) {
  a.downT += dt;
  a.vy -= 14 * dt; a.vx *= 1 - 0.3 * dt; a.vz *= 1 - 0.3 * dt;
  a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
  a.heading += a.spin * dt; a.roll = damp(a.roll, 0.6, 1.5, dt); a.pitch = damp(a.pitch, 0.4, 1.5, dt);
  if (a.rotor) a.rotor.rotation.y += dt * 14;
  a.root.position.set(a.x, a.y, a.z); a.root.rotation.set(a.pitch, a.heading, a.roll);
  a.trail += dt;
  while (a.trail > 0.04) {
    a.trail -= 0.04;
    const g = rr(0.06, 0.14);
    smokeSys.spawn(a.x + rr(-1, 1), a.y + 1, a.z + rr(-1, 1), rr(-1, 1), rr(1, 3), rr(-1, 1), rr(2, 3.5), 1.8, 6, g, g, g, 0.75, -0.6, 1.2, rr(-1, 1), 0, 0.9, -100);
    fireSys.spawn(a.x, a.y + 0.6, a.z, rr(-1, 1), rr(1, 3), rr(-1, 1), rr(0.2, 0.4), 1.4, 2.4, 10, 5, 1.5, 1, 0, 0, 0, 0, 0.5, -100);
  }
  const h = waveHeight(a.x, a.z, t);
  if (a.y < h + 0.5) {
    fxExplosion(a.x, h, a.z, 0.8); fxWaterColumn(a.x, a.z, 0.8, t); Sound.playAt('splashBig', a.x, a.z, 1.0, 0.85);
    a.on = false; a.root.visible = false;
  }
}

/* ---------- 헬기 로켓 ---------- */
function rocketFire(x, y, z, tx, ty, tz, sp, dmg) {
  let r = null; for (let i = 0; i < ROCKET_MAX; i++) if (!rockets[i].on) { r = rockets[i]; break; }
  if (!r) return;
  const dx = tx - x, dy = ty - y, dz = tz - z, dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  r.on = true; r.x = x; r.y = y; r.z = z; r.vx = dx / dl * sp; r.vy = dy / dl * sp; r.vz = dz / dl * sp; r.t = 0; r.dmg = dmg; r.trail = 0; r.m.visible = true;
  fireSys.spawn(x, y, z, 0, 0, 0, 0.08, 1, 3, 11, 7, 3, 1, 0, 0, 0, 0, 0.5, -100);
  Sound.playAt('missile', x, z, 0.45, 1.5);
}
function rocketsUpdate(dt, t) {
  const C = CONFIG.air.heli, P = player;
  for (let i = 0; i < ROCKET_MAX; i++) {
    const r = rockets[i]; if (!r.on) continue;
    const ox = r.x, oy = r.y, oz = r.z;
    r.t += dt; r.vy -= 3 * dt;
    r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
    r.m.position.set(r.x, r.y, r.z); r.m.lookAt(r.x + r.vx, r.y + r.vy, r.z + r.vz);
    r.trail += dt;
    while (r.trail > 0.025) { r.trail -= 0.025; const g = rr(0.75, 0.88); smokeSys.spawn(r.x, r.y, r.z, rr(-0.4, 0.4), rr(0, 0.6), rr(-0.4, 0.4), rr(0.8, 1.4), 0.4, 2, g, g, g, 0.5, -0.2, 1.3, 0, 0, 0.9, -100); }
    fireSys.spawn(r.x - r.vx * 0.006, r.y - r.vy * 0.006, r.z - r.vz * 0.006, 0, 0, 0, 0.05, 0.6, 0.9, 10, 6, 2, 1, 0, 0, 0, 0, 0.4, -100);
    let hitP = false, boom = false;
    if (P.alive && segBoat(P, ox, oy, oz, r.x, r.y, r.z, 6, 0.3) >= 0) { hitP = true; boom = true; }
    else if (isleSeg(ox, oy, oz, r.x, r.y, r.z)) { isleBulletFx(true); r.on = false; r.m.visible = false; continue; }
    else if (r.y < waveHeight(r.x, r.z, t) || r.t > 6) boom = true;
    if (!boom) continue;
    r.on = false; r.m.visible = false;
    const h = waveHeight(r.x, r.z, t);
    fxExplosion(r.x, Math.max(r.y, h), r.z, 0.45); if (!hitP) fxWaterColumn(r.x, r.z, 0.45, t);
    Sound.playAt('explosion', r.x, r.z, 0.7, rr(1.2, 1.4));
    if (!P.alive) continue;
    DSRC = 'rocket';
    if (hitP) damageBoat(P, r.dmg, r.x, r.z, false);
    else { const d = Math.max(0, Math.hypot(P.x - r.x, P.z - r.z) - P.M.L * 0.3); if (d < C.rocketR) damageBoat(P, r.dmg * 0.6 * (1 - d / C.rocketR), r.x, r.z, false); }
    DSRC = 'item';
  }
}
