
/* ==========================================================================
 * 아이템 — 보스를 격파하면 보급 상자가 떠오르고, 배로 지나가면 줍는다 (최대 2개, E 키)
 * 집속탄, B-2 폭격, 유도 어뢰, 기뢰, EMP, 수리와 방어막, 핵폭탄(B-2가 떨어뜨림). 아이템으로는 나는 피해를 받지 않는다
 * ========================================================================== */
const ITEM_NAMES = { cluster: '집속탄', barrage: 'B-2 폭격', torpedo: '어뢰', mines: '기뢰', emp: 'EMP', repair: '수리', nuke: '핵폭탄', shield: '무적 보호권' };
const ITEM_KEYS = ['cluster', 'barrage', 'torpedo', 'mines', 'emp', 'repair', 'nuke'];

const crates = [];               // 바다에 떠 있는 보급 상자
const iproj = [];                // 아이템 발사체 (운반탄, 자탄, 포격탄, 어뢰)
const mineList = [];             // 깔아 둔 기뢰
const rings = [];                // 바다 위 표시 고리 (포격 구역, 핵 착탄 지점, 충격파)
const IP_MAX = 96, MINE_MAX = 40, RING_MAX = 8, CRATE_MAX = 8;
const bombers = [];              // 지원 온 B-2 폭격기
let nukeGlow = 0;                // 핵폭탄 자리 초록 바다 세기
let shieldMesh = null, flashEl = null, flashA = 0, flashR = 1, flashG = 1, flashB = 1;
let fullMsgT = 0, nukeCount = -1;
const IV = new THREE.Vector3();

function rollItem() {
  const W = CONFIG.items.weights;
  let sum = 0;
  for (let i = 0; i < ITEM_KEYS.length; i++) sum += W[ITEM_KEYS[i]];
  let r = rnd() * sum;
  for (let i = 0; i < ITEM_KEYS.length; i++) { r -= W[ITEM_KEYS[i]]; if (r <= 0) return ITEM_KEYS[i]; }
  return 'repair';
}

function initItems() {
  // 보급 상자: 노란·검은 줄무늬 상자 + 하늘로 뻗는 빛기둥
  const g = new GeoBuilder(), yel = sRGB(0xffc267), blk = sRGB(0x1d2024), wht = sRGB(0xeef6f7);
  g.box(2.4, 1.6, 2.4, 0, 0.8, 0, yel);
  for (let k = -1; k <= 1; k += 2) { g.box(2.46, 0.3, 2.46, 0, 0.8 + k * 0.45, 0, blk); }
  g.box(0.5, 0.06, 2.5, 0, 1.63, 0, wht); g.box(2.5, 0.06, 0.5, 0, 1.63, 0, wht);
  g.cyl(1.7, 1.9, 0.5, 14, 0, 0.1, 0, sRGB(0xd8362b));
  const crateGeo = g.build();
  const beamGeo = new THREE.CylinderGeometry(0.5, 0.9, 70, 10, 1, true);
  beamGeo.translate(0, 35, 0);
  for (let i = 0; i < CRATE_MAX; i++) {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(crateGeo, boatMat));
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.4), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    grp.add(beam);
    grp.visible = false;
    scene.add(grp);
    crates.push({ on: false, mesh: grp, x: 0, z: 0, item: 'repair', t: 0 });
  }
  // 발사체
  const sGeo = new THREE.SphereGeometry(0.25, 8, 6); sGeo.scale(1, 1, 2.6);
  const tGeo = new THREE.CylinderGeometry(0.22, 0.22, 3.2, 8); tGeo.rotateX(Math.PI / 2);
  const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 2.6, 0.9) });
  const nMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.2, 0.5) });
  const tMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.05, 0.06, 0.07), roughness: 0.4 });
  for (let i = 0; i < IP_MAX; i++) {
    const m = new THREE.Mesh(sGeo, pMat); m.visible = false; scene.add(m);
    const tm = new THREE.Mesh(tGeo, tMat); tm.visible = false; scene.add(tm);
    iproj.push({ on: false, kind: '', mesh: m, tmesh: tm, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, t: 0, T: 0, ex: 0, ez: 0, target: null, left: 0, trail: 0, dx: 0, dz: 1, sx: 0, sz: 0 });
  }
  iproj.nMat = nMat; iproj.pMat = pMat; iproj.dMat = new THREE.MeshStandardMaterial({ color: sRGB(0x2a2e33), roughness: 0.5, metalness: 0.4 });
  // 어뢰가 물속으로 가는 게 보이게: 물 위에 비치는 청록 빛
  const gc = document.createElement('canvas'); gc.width = gc.height = 64;
  const gx = gc.getContext('2d'), gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gg.addColorStop(0, 'rgba(220,255,255,1)'); gg.addColorStop(0.3, 'rgba(90,230,255,0.7)'); gg.addColorStop(1, 'rgba(40,180,255,0)');
  gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64);
  const gMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, fog: false, toneMapped: false });
  for (let i = 0; i < IP_MAX; i++) { const sp = new THREE.Sprite(gMat); sp.visible = false; sp.renderOrder = 18; scene.add(sp); iproj[i].glow = sp; }
  // B-2 폭격기 (실사풍 전익기)
  const b2Geo = buildB2Geo(), bMat = thinFog(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.22, side: THREE.DoubleSide }));
  for (let i = 0; i < 2; i++) {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(b2Geo, bMat));
    grp.visible = false; scene.add(grp);
    bombers.push({ on: false, mesh: grp, x: 0, y: 0, z: 0, dx: 0, dz: 1, sp: 150, t: 0, mode: '', rel: 0, done: false, cx: 0, cz: 0, tx: 0, tz: 0 });
  }
  // 기뢰: 뿔 달린 검은 공 + 깜빡이는 빨간 불
  const mg = new GeoBuilder(), dk = sRGB(0x202326), rd = sRGB(0x8a1a12);
  _bm.makeTranslation(0, 0, 0);
  mg.add(new THREE.SphereGeometry(0.9, 12, 9), dk, _bm);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU, e = (k % 2 ? 0.5 : -0.3);
    mg.rod(0, 0, 0, Math.cos(a) * Math.cos(e) * 1.35, Math.sin(e) * 1.35, Math.sin(a) * Math.cos(e) * 1.35, 0.08, rd, 5);
  }
  const mineGeo = mg.build();
  const lampGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.6, 0.3), fog: false });
  for (let i = 0; i < MINE_MAX; i++) {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(mineGeo, boatMat));
    const lamp = new THREE.Mesh(lampGeo, lampMat); lamp.position.y = 1.0; grp.add(lamp);
    grp.visible = false; scene.add(grp);
    mineList.push({ on: false, mesh: grp, lamp: lamp, x: 0, z: 0, life: 0, ph: 0 });
  }
  // 표시 고리
  const rGeo = new THREE.RingGeometry(0.965, 1.0, 96); rGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < RING_MAX; i++) {
    const m = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.3, 0.2), transparent: true, opacity: 0.6, depthTest: false, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.renderOrder = 16; m.visible = false; scene.add(m);
    rings.push({ on: false, mesh: m, x: 0, z: 0, r0: 1, r1: 1, t: 0, T: 1, a0: 0.6, a1: 0.6, follow: false });
  }
  // 방어막 거품
  shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.9, 1.4), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  shieldMesh.scale.set(5.5, 3.6, 9.5); shieldMesh.visible = false; scene.add(shieldMesh);
  flashEl = $('flash');
}

function itemsClear() {
  for (let i = 0; i < CRATE_MAX; i++) { crates[i].on = false; crates[i].mesh.visible = false; }
  for (let i = 0; i < IP_MAX; i++) { const p = iproj[i]; p.on = false; p.mesh.visible = false; p.tmesh.visible = false; p.glow.visible = false; p.target = null; }
  for (let i = 0; i < bombers.length; i++) { bombers[i].on = false; bombers[i].mesh.visible = false; }
  nukeGlow = 0; if (oceanUniforms) oceanUniforms.uNuke.value.w = 0;
  for (let i = 0; i < MINE_MAX; i++) { mineList[i].on = false; mineList[i].mesh.visible = false; }
  for (let i = 0; i < RING_MAX; i++) { rings[i].on = false; rings[i].mesh.visible = false; }
  shieldMesh.visible = false; flashA = 0; nukeCount = -1;
  Game.items.length = 0; Game.shieldT = 0;
}

function spawnCrate(x, z) {
  for (let i = 0; i < CRATE_MAX; i++) {
    const c = crates[i];
    if (c.on) continue;
    c.on = true; c.x = x; c.z = z; c.t = 0; c.item = rollItem(); c.mesh.visible = true;
    return;
  }
}

function ringOn(x, z, r0, r1, T, a0, a1, col) {
  for (let i = 0; i < RING_MAX; i++) {
    const r = rings[i];
    if (r.on) continue;
    r.on = true; r.x = x; r.z = z; r.r0 = r0; r.r1 = r1; r.t = 0; r.T = T; r.a0 = a0; r.a1 = a1; r.follow = false;
    r.mesh.material.color.copy(col); r.mesh.visible = true;
    return r;
  }
  return null;
}
const ZONE_RED = new THREE.Color(1.2, 0.25, 0.15), RING_CYAN = new THREE.Color(0.3, 1.2, 1.6), RING_WHITE = new THREE.Color(1.6, 1.5, 1.3);

function projSpawn(kind) {
  for (let i = 0; i < IP_MAX; i++) {
    const p = iproj[i];
    if (p.on) continue;
    p.on = true; p.kind = kind; p.t = 0; p.trail = 0; p.target = null; p.glow.visible = false;
    p.mesh.visible = kind !== 'torp' && kind !== 'bombwait'; p.tmesh.visible = kind === 'torp';
    p.mesh.material = kind === 'nuke' ? iproj.nMat : iproj.pMat;
    p.mesh.scale.setScalar(kind === 'nuke' ? 3 : (kind === 'sub' ? 0.7 : 1.2));
    return p;
  }
  return null;
}

// 포물선 운반탄 (집속탄, 핵폭탄): 포구에서 (tx, tz)까지 T초 동안
// 적이 가장 몰린 곳: 반경 180m 안에 다른 적이 가장 많은 적을 중심으로, 그 무리의 평균 위치
function mineCluster(range) {
  const P = player, R2 = 180 * 180, r2 = range * range;
  let best = null, bn = 0;
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (!a.alive || (a.x - P.x) * (a.x - P.x) + (a.z - P.z) * (a.z - P.z) > r2) continue;
    let n = 0;
    for (let j = 0; j < enemies.length; j++) { const b = enemies[j]; if (b.alive && (b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z) < R2) n++; }
    if (n > bn) { bn = n; best = a; }
  }
  if (!best) return null;
  let sx = 0, sz = 0;
  for (let j = 0; j < enemies.length; j++) { const b = enemies[j]; if (b.alive && (b.x - best.x) * (b.x - best.x) + (b.z - best.z) * (b.z - best.z) < R2) { sx += b.x; sz += b.z; } }
  return { x: sx / bn, z: sz / bn, n: bn };
}
// 아이템 피해: 맞은 적 최대 체력의 비율 (기함은 따로)
function itemFrac(b, frac, bossFrac) { return b.maxHp * (b.kind === 'boss' ? bossFrac : frac); }

// 기뢰: (vx, vz) 방향으로 움직이는 무리의 길목에 진행 방향을 가로지르는 두 줄로 깐다. 움직임이 없으면 고리 모양
function layMines(x, z, vx, vz, ringR) {
  const M = CONFIG.items.mines, sp = Math.hypot(vx, vz);
  const pts = [];
  if (sp > 3) {
    const fx = vx / sp, fz = vz / sp, rx = fz, rz = -fx, per = Math.ceil(M.n / 2);
    for (let k = 0; k < M.n; k++) {
      const row = k < per ? -1 : 1, col = (k % per) - (per - 1) / 2;
      pts.push([x + rx * col * 22 + fx * row * 16 + rr(-3, 3), z + rz * col * 22 + fz * row * 16 + rr(-3, 3)]);
    }
  } else for (let k = 0; k < M.n; k++) { const a = k / M.n * TAU; pts.push([x + Math.cos(a) * ringR, z + Math.sin(a) * ringR]); }
  let k = 0;
  for (let i = 0; i < MINE_MAX && k < pts.length; i++) {
    const m = mineList[i];
    if (m.on) continue;
    m.on = true; m.x = pts[k][0]; m.z = pts[k][1]; m.life = M.life; m.pct = true; m.ph = rnd() * TAU; m.mesh.visible = true;
    fxSplashSmall(m.x, waveHeight(m.x, m.z, simTime), m.z, 1);
    k++;
  }
  ringOn(x, z, 10, sp > 3 ? 90 : ringR, 0.8, 0.8, 0.2, ZONE_RED);
  Sound.playAt('splash', x, z, 0.7, 0.8);
}

function launchCarrier(kind, tx, tz, T, h) {
  const p = projSpawn(kind);
  if (!p) return null;
  const P = player;
  p.x = P.x + Math.sin(P.heading) * 4; p.z = P.z + Math.cos(P.heading) * 4; p.y = P.y + 3;
  p.g = 9.8 * 2.2; p.T = T; p.ex = tx; p.ez = tz;
  p.vx = (tx - p.x) / T; p.vz = (tz - p.z) / T; p.vy = (h - p.y) / T + 0.5 * p.g * T;
  p.sx = P.x; p.sz = P.z;
  fxMuzzleCannon(p.x, p.y, p.z, p.vx / 60, 0.5, p.vz / 60, 1.1);
  Sound.play('cannon', 1.0, 0.85, 0);
  Cam.trauma = Math.min(1, Cam.trauma + 0.3);
  return p;
}

// 조준점이 가리키는 바다 지점 (최대 거리 maxD)
function itemAim(maxD) {
  const P = player;
  let x = Aim.seaX, z = Aim.seaZ;
  const dx = x - P.x, dz = z - P.z, dl = Math.sqrt(dx * dx + dz * dz) || 1;
  if (maxD && dl > maxD) { x = P.x + dx / dl * maxD; z = P.z + dz / dl * maxD; }
  IV.set(x, 0, z);
  return IV;
}

// B-2 폭격기를 부른다. mode 'carpet': T초 뒤 내 위를 지나며 융단 폭격, 'nuke': T초 뒤 (tx, tz)에 핵폭탄이 떨어지게
function callB2(mode, tx, tz, T) {
  let b = null;
  for (let i = 0; i < bombers.length; i++) if (!bombers[i].on) { b = bombers[i]; break; }
  if (!b) b = bombers[0];
  const P = player;
  let dx, dz;
  dx = tx - P.x; dz = tz - P.z; { const l = Math.hypot(dx, dz); if (l > 1) { dx /= l; dz /= l; } else { dx = Math.sin(P.heading); dz = Math.cos(P.heading); } }
  // 머리 위를 지나는 시각: 폭격은 T초, 핵은 떨어지는 시간(0.9초)만큼 먼저 떨어뜨리고 조금 뒤에 지나간다
  const over = mode === 'nuke' ? T - 0.5 : T;
  b.on = true; b.mode = mode; b.t = 0; b.done = false; b.dx = dx; b.dz = dz; b.sp = 150; b.over = over;
  b.tx = tx; b.tz = tz;
  b.x = b.tx - dx * b.sp * over; b.z = b.tz - dz * b.sp * over; b.y = 95;
  b.mesh.visible = true;
  Sound.play('missile', 0.7, 0.45, 0);
}

// B-2 융단 폭격 한 발이 떨어진 자리: 맡은 적이 있으면 일반 적은 격침, 기함은 최대 체력의 bossFrac
// B-2 폭탄·미사일 한 발이 터진 자리: 반경 blast 안 적에게만, 가운데일수록 세게 (안 맞으면 멀쩡)
function carpetHit(x, z, t, frac, bossFrac, sc) {
  const B = CONFIG.items.barrage, h = waveHeight(x, z, t);
  fxExplosion(x, h + 1, z, sc);
  fxWaterColumn(x, z, 0.9 * sc, t);
  for (let k = 0; k < enemies.length; k++) {
    const e = enemies[k];
    if (!e.alive || e.submerged) continue;
    const d = Math.max(0, Math.hypot(e.x - x, e.z - z) - e.M.L * 0.3);
    if (d < B.blast) damageBoat(e, itemFrac(e, frac, bossFrac) * (1 - 0.6 * d / B.blast), x, z, true);
  }
  Sound.playAt('explosion', x, z, 0.7, rr(0.8, 1.1));
  addTraumaAt(x, z, 0.25);
}

// slot: 몇 번째 칸의 아이템을 쓸지 (PC E·R·G, 폰은 누른 칸)
function useItem(slot) {
  slot = slot || 0;
  if (slot >= Game.items.length || !player.alive) { Sound.play('dry', 0.5, 1, 0); return; }
  const key = Game.items.splice(slot, 1)[0], I = CONFIG.items, P = player;
  Hud.toast(ITEM_NAMES[key] + ' 사용');
  if (key === 'nuke') achStat('nuke', 1);
  if (key === 'cluster') {
    // 조준점으로 날아가 그 위에서 터진다
    const C = I.cluster, a = itemAim(C.range), dl = Math.hypot(a.x - P.x, a.z - P.z);
    launchCarrier('cluster', a.x, a.z, clamp(dl / 650, 0.8, 2.3), 45);
    ringOn(a.x, a.z, C.R, C.R, clamp(dl / 650, 0.8, 2.3) + 0.6, 0.6, 0.2, ZONE_RED);
  } else if (key === 'barrage') {
    // 1.5km 안에서 적이 가장 몰린 해역으로 (없으면 내 앞 500m)
    const B = I.barrage, c = mineCluster(B.seek);
    const tx = c ? c.x : P.x + Math.sin(P.heading) * 500, tz = c ? c.z : P.z + Math.cos(P.heading) * 500;
    callB2('carpet', tx, tz, B.delay);
    ringOn(tx, tz, B.r, B.r, B.delay + 2, 0.75, 0.25, ZONE_RED);
    Hud.toast('B-2 폭격기 지원 요청' + (c ? ' · 적 ' + c.n + '척 해역' : ''));
    Sound.play('horn', 0.45, 1.3, 0);
  } else if (key === 'torpedo') {
    // 가까운 적부터 한 척씩 맡아서 끝까지 쫓는다 (적이 모자라면 다시 가까운 순으로)
    const T = I.torpedo, list = enemies.filter(b => b.alive && !b.submerged).sort((u, v) => Math.hypot(u.x - P.x, u.z - P.z) - Math.hypot(v.x - P.x, v.z - P.z));
    for (let i = 0; i < T.n; i++) {
      const p = projSpawn('torp');
      if (!p) break;
      const ang = P.heading + (i - (T.n - 1) / 2) * (T.fan / Math.max(1, (T.n - 1) / 2));
      p.x = P.x + Math.sin(P.heading) * 5; p.z = P.z + Math.cos(P.heading) * 5; p.y = 0;
      p.dx = Math.sin(ang); p.dz = Math.cos(ang); p.left = T.range; p.target = list.length ? list[i % list.length] : null; p.sx = P.x; p.sz = P.z;
      p.glow.visible = true;
    }
    Sound.play('splashBig', 0.6, 1.4, 0);
  } else if (key === 'mines') {
    // 1km 안에서 적이 가장 몰린 무리를 찾아 lead초 뒤 그 무리가 지나갈 곳에 쏘아 보낸다. 적이 없으면 내 주위에 깐다
    const M = I.mines, c = mineCluster(M.seek);
    if (c) {
      let vx = 0, vz = 0, n = 0;
      for (let i = 0; i < enemies.length; i++) { const b = enemies[i]; if (b.alive && Math.hypot(b.x - c.x, b.z - c.z) < 180) { vx += b.vx; vz += b.vz; n++; } }
      vx /= Math.max(1, n); vz /= Math.max(1, n);
      let tx = c.x + vx * M.lead, tz = c.z + vz * M.lead;
      const dl = Math.hypot(tx - P.x, tz - P.z);
      if (dl > M.seek) { tx = P.x + (tx - P.x) / dl * M.seek; tz = P.z + (tz - P.z) / dl * M.seek; }
      const q = launchCarrier('minec', tx, tz, M.flight, 34);
      if (q) { q.mvx = vx; q.mvz = vz; }
      Hud.toast('기뢰 발사: 적 ' + c.n + '척이 지나갈 길목');
      Sound.play('missile', 0.5, 0.75, 0);
    } else layMines(P.x, P.z, 0, 0, M.ring);
  } else if (key === 'emp') {
    const E = I.emp;
    for (let i = 0; i < enemies.length; i++) {
      const b = enemies[i];
      if (!b.alive) continue;
      if (Math.hypot(b.x - P.x, b.z - P.z) < E.radius) { b.ai.empT = E.time; b.ai.burstLeft = 0; }
    }
    for (let i = 0; i < MIS_MAX; i++) {
      const m = missiles[i];
      if (!m.on || m.owner !== 1) continue;
      if (Math.hypot(m.x - P.x, m.z - P.z) < E.radius) { m.target = null; m.tx = m.x + m.vx * 3; m.tz = m.z + m.vz * 3; m.ty = -5; }
    }
    ringOn(P.x, P.z, 5, E.radius, 0.9, 1.0, 0.0, RING_CYAN);
    flash(0.55, 0.3, 0.8, 1.0);
    Sound.play('emp', 0.9, 1, 0);
  } else if (key === 'repair') {
    const R = I.repair;
    P.hp = Math.min(P.maxHp, P.hp + R.heal);
    Game.shieldT = R.shield;
    Hud.toast('수리 완료 · ' + R.shield + '초 동안 무적');
    Sound.play('pickup', 0.7, 0.8, 0);
  } else if (key === 'shield') {
    // 상점 무적 보호권: 수리 아이템의 보호막만
    Game.shieldT = I.repair.shield;
    Hud.toast(I.repair.shield + '초 동안 무적');
    Sound.play('pickup', 0.7, 0.8, 0);
  } else if (key === 'nuke') {
    // B-2가 날아와 조준점에 떨어뜨린다
    const N = I.nuke, a = itemAim(N.range);
    ringOn(a.x, a.z, N.r, N.r, N.delay, 0.9, 0.9, ZONE_RED);
    callB2('nuke', a.x, a.z, N.delay);
    nukeCount = N.delay;
    Hud.toast('B-2 폭격기 핵폭탄 투하 요청');
    Sound.play('horn', 0.7, 0.6, 0);
  }
}

function flash(a, r, g, b) { flashA = Math.max(flashA, a); flashR = r; flashG = g; flashB = b; }

function clusterBurst(p, t) {
  const C = CONFIG.items.cluster, x = p.x, y = p.y, z = p.z;
  fireSys.spawn(x, y, z, 0, 0, 0, 0.18, 8, 18, 10, 7, 4, 1, 0, 0, 0, 0, 0.6, -100);
  for (let i = 0; i < 14; i++) { const g = rr(0.3, 0.5); smokeSys.spawn(x, y, z, rr(-8, 8), rr(-2, 5), rr(-8, 8), rr(1, 2.2), 2, 7, g, g, g, 0.6, -0.5, 1.2, rr(-1, 1), 0, 0.9, -100); }
  Sound.playAt('explosion', x, z, 0.9, 1.3);
  // 반경 안의 적을 가까운 순으로 자탄을 하나씩 (적이 모자라면 다시 처음부터)
  const list = enemies.filter(b => b.alive && !b.submerged && Math.hypot(b.x - x, b.z - z) < C.R).sort((u, v) => Math.hypot(u.x - x, u.z - z) - Math.hypot(v.x - x, v.z - z));
  for (let k = 0; k < C.k; k++) {
    const s = projSpawn('sub');
    if (!s) break;
    s.x = x; s.y = y; s.z = z; s.sx = p.sx; s.sz = p.sz;
    s.target = list.length ? list[k % list.length] : null;
    const a = rnd() * TAU;
    s.vx = Math.cos(a) * 16; s.vz = Math.sin(a) * 16; s.vy = rr(4, 14);
    s.ex = x + Math.cos(a) * rr(20, C.R * 0.7); s.ez = z + Math.sin(a) * rr(20, C.R * 0.7);
  }
}

function nukeDetonate(x, z, t, sx, sz) {
  const N = CONFIG.items.nuke, h = waveHeight(x, z, t);
  flash(1.0, 0.9, 1, 0.85);
  // 반경 안 바다가 초록빛으로 빛났다가 돌아온다
  nukeGlow = 1; oceanUniforms.uNuke.value.set(x, z, N.r, 1);
  Cam.trauma = 1;
  // 불덩이와 버섯구름
  fxExplosion(x, h + 4, z, 6.5);
  for (let i = 0; i < 70; i++) {
    const f = i / 70, a = rnd() * TAU, r = rr(0, 10) * (1 - f) + rr(0, 4);
    const g = rr(0.25, 0.45) + f * 0.25;
    smokeSys.spawn(x + Math.cos(a) * r, h + 5 + f * 20, z + Math.sin(a) * r, Math.cos(a) * rr(0, 3), 14 + f * 34, Math.sin(a) * rr(0, 3),
      rr(5, 8), rr(8, 14), rr(22, 34), g * 1.3, g * 1.05, g * 0.9, 0.85, 1.2, 0.35, rr(-0.3, 0.3), 0, 0.92, -100);
  }
  for (let i = 0; i < 50; i++) {
    const a = rnd() * TAU, sp = rr(6, 16), g = rr(0.35, 0.55);
    smokeSys.spawn(x, h + 60, z, Math.cos(a) * sp, rr(3, 9), Math.sin(a) * sp, rr(6, 9), rr(14, 20), rr(34, 48), g * 1.35, g * 1.1, g * 0.95, 0.8, 0.8, 0.2, rr(-0.3, 0.3), 0, 0.92, -100);
  }
  for (let i = 0; i < 40; i++) {
    const a = rnd() * TAU, e = rr(0.1, 1), sp = rr(20, 70);
    fireSys.spawn(x, h + 8, z, Math.cos(a) * sp * (1 - e * 0.5), e * sp, Math.sin(a) * sp * (1 - e * 0.5), rr(0.8, 1.6), rr(6, 10), rr(14, 22), 9, 5, 2, 1, -2, 1.4, rr(-1, 1), 0, 0.8, -100);
  }
  // 거대한 물 돔과 바깥으로 퍼지는 충격파
  fxWaterColumn(x, z, 3.2, t);
  for (let i = 0; i < 160; i++) {
    const a = rnd() * TAU, sp = rr(30, 70);
    spraySys.spawn(x + Math.cos(a) * 20, h + 1, z + Math.sin(a) * 20, Math.cos(a) * sp, rr(6, 24), Math.sin(a) * sp, rr(1.2, 2.4), rr(0.6, 1.6), 0.2, 1, 1, 1, rr(0.7, 1), 16, 0.4, 0, 0.03, 0, h - 1);
  }
  ringOn(x, z, 10, N.r * 2.2, 3.2, 1.0, 0.0, RING_WHITE);
  foamDecal(x, z, 20, N.r * 1.4, 9, 1.4, 0.7, 0.2);
  foamDecal(x, z, 30, N.r * 0.9, 8, 1.3, 0, 0.4);
  Sound.play('nuke', 1.0, 1, 0);
  // 반경 안에 낮게 깔리는 초록 방사능 안개 (멀리서도 초록 바다가 보이게)
  for (let i = 0; i < 70; i++) {
    const a = rnd() * TAU, r = N.r * Math.sqrt(rnd()) * 0.95, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    smokeSys.spawn(px, waveHeight(px, pz, t) + rr(3, 12), pz, rr(-1, 1), rr(0.2, 0.8), rr(-1, 1), rr(7, 10), rr(18, 26), rr(40, 60), 0.3, 1.25, 0.42, 0.45, -0.05, 0.3, rr(-0.2, 0.2), 0, 0.95, -100);
  }
  // 반경 끝까지 퍼지는 물보라 고리
  for (let i = 0; i < 90; i++) { const a = rnd() * TAU, r = N.r * rr(0.3, 1); fxSplashSmall(x + Math.cos(a) * r, waveHeight(x + Math.cos(a) * r, z + Math.sin(a) * r, t), z + Math.sin(a) * r, 2.2); }
  // 피해: 반경 안 일반 적은 격침, 보스는 최대 체력의 일정 비율
  for (let i = 0; i < enemies.length; i++) {
    const b = enemies[i];
    if (!b.alive) continue;
    const dd = Math.max(0, Math.hypot(b.x - x, b.z - z) - b.M.L * 0.3);
    if (dd < N.r) damageBoat(b, b.kind === 'boss' ? b.maxHp * N.bossFrac : 1e9, sx, sz, true);
  }
}

function itemsUpdate(dt, t) {
  const I = CONFIG.items, P = player;
  // 보급 상자: 파도 위에 떠서 천천히 돌고, 가까이 가면 줍는다
  if (fullMsgT > 0) fullMsgT -= dt;
  for (let i = 0; i < CRATE_MAX; i++) {
    const c = crates[i];
    if (!c.on) continue;
    c.t += dt;
    const h = waveHeight(c.x, c.z, t);
    c.mesh.position.set(c.x, h - 0.3 + Math.sin(c.t * 2) * 0.15, c.z);
    c.mesh.rotation.y = c.t * 0.6;
    c.mesh.children[1].material.opacity = 0.25 + 0.12 * Math.sin(c.t * 4);
    if (Math.random() < dt * 3) fxSplashSmall(c.x + rr(-1.5, 1.5), h, c.z + rr(-1.5, 1.5), 0.3);
    if (P.alive && Game.state === 'play' && Math.hypot(P.x - c.x, P.z - c.z) < I.pickupRadius + P.M.L * 0.3) {
      if (Game.items.length < I.maxHeld) {
        Game.items.push(c.item); c.on = false; c.mesh.visible = false;
        Hud.banner(ITEM_NAMES[c.item] + ' 획득', 'E 키(터치는 아이템 버튼)로 사용');
        Sound.play('pickup', 0.8, 1, 0);
      } else if (fullMsgT <= 0) { Hud.toast('아이템이 가득 찼습니다 (최대 ' + I.maxHeld + '개)'); fullMsgT = 3; }
    }
  }
  // 발사체
  for (let i = 0; i < IP_MAX; i++) {
    const p = iproj[i];
    if (!p.on) continue;
    p.t += dt;
    if (p.kind === 'cluster' || p.kind === 'minec') {
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z); p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      p.trail += dt;
      while (p.trail > 0.03) { p.trail -= 0.03; const g = rr(0.6, 0.75); smokeSys.spawn(p.x, p.y, p.z, rr(-0.5, 0.5), rr(0, 0.8), rr(-0.5, 0.5), rr(0.8, 1.4), 0.5, 2.2, g, g, g, 0.4, -0.3, 1.2, rr(-1, 1), 0, 0.9, -100); }
      if (p.t >= p.T) {
        p.on = false; p.mesh.visible = false;
        if (p.kind === 'cluster') clusterBurst(p, t);
        else layMines(p.ex, p.ez, p.mvx || 0, p.mvz || 0, 55);      // 기뢰 운반체: 도착하면 길목에 기뢰를 뿌린다
      }
    } else if (p.kind === 'nukefall') {
      // B-2가 떨어뜨린 핵폭탄: 낙하산 없이 곧장 떨어진다
      const k = Math.min(1, p.t / p.T);
      p.x = p.ax + (p.ex - p.ax) * k; p.z = p.az + (p.ez - p.az) * k; p.y = p.ay + (waveHeight(p.ex, p.ez, t) - p.ay) * k * k;
      p.mesh.position.set(p.x, p.y, p.z); p.mesh.lookAt(p.ex, p.y - 50, p.ez);
      p.trail += dt;
      while (p.trail > 0.03) { p.trail -= 0.03; const g = rr(0.7, 0.85); smokeSys.spawn(p.x, p.y, p.z, 0, 0.5, 0, rr(0.6, 1), 0.6, 2.4, g, g, g, 0.45, -0.3, 1.2, 0, 0, 0.9, -100); }
      if (nukeCount > 0) {
        const before = Math.ceil(nukeCount);
        nukeCount -= dt;
        if (Math.ceil(nukeCount) !== before && nukeCount > 0) Hud.toast('핵폭탄 착탄까지 ' + Math.ceil(nukeCount));
      }
      if (k >= 1) { p.on = false; p.mesh.visible = false; nukeCount = -1; nukeDetonate(p.ex, p.ez, t, p.sx, p.sz); }
    } else if (p.kind === 'sub') {
      // 자탄: 잠깐 흩어졌다가 맡은 적에게 곧장 내리꽂힌다
      let gx, gy, gz;
      if (p.target && p.target.alive) { gx = p.target.x; gy = p.target.y + 1; gz = p.target.z; }
      else { gx = p.ex; gy = waveHeight(p.ex, p.ez, t) - 1; gz = p.ez; }
      if (p.t > 0.3) {
        const qx = gx - p.x, qy = gy - p.y, qz = gz - p.z, ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1, sp = 130;
        p.vx = qx / ql * sp; p.vy = qy / ql * sp; p.vz = qz / ql * sp;
        if (ql < 3.5 || ql < sp * dt) {
          p.on = false; p.mesh.visible = false;
          const C = I.cluster, h = waveHeight(gx, gz, t);
          fxExplosion(gx, Math.max(gy, h), gz, 0.8);
          if (p.target && p.target.alive) damageBoat(p.target, itemFrac(p.target, C.frac, C.bossFrac), p.sx, p.sz, true);
          else fxWaterColumn(gx, gz, 0.6, t);
          Sound.playAt('explosion', gx, gz, 0.5, rr(1.1, 1.4));
          continue;
        }
      } else { p.vy -= 9.8 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z); p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      fireSys.spawn(p.x, p.y, p.z, 0, 0, 0, 0.06, 0.5, 0.9, 8, 5, 2, 1, 0, 0, 0, 0, 0.4, -100);
    } else if (p.kind === 'bombwait') {
      // B-2 폭탄: 차례가 오면 폭격기 배에서 떨어지기 시작한다
      if (p.t >= p.T) {
        const b = p.bomber;
        p.kind = 'bomb'; p.mesh.material = iproj.dMat; p.mesh.scale.setScalar(2.2); p.t = 0; p.T = rr(1.0, 1.3); p.ax = b.x + rr(-6, 6); p.ay = b.y - 2; p.az = b.z + rr(-6, 6); p.x = p.ax; p.y = p.ay; p.z = p.az;
        p.mesh.visible = true;
      }
    } else if (p.kind === 'bomb') {
      // 떨어질 자리는 투하할 때 정해진다 (그사이 적이 움직이면 빗나간다)
      const k = Math.min(1, p.t / p.T);
      p.x = p.ax + (p.ex - p.ax) * k; p.z = p.az + (p.ez - p.az) * k; p.y = p.ay + (waveHeight(p.ex, p.ez, t) - p.ay) * k * k;
      p.mesh.position.set(p.x, p.y, p.z); p.mesh.lookAt(p.ex, p.y - 50, p.ez);
      if (k >= 1) { p.on = false; p.mesh.visible = false; carpetHit(p.ex, p.ez, t, I.barrage.frac, I.barrage.bossFrac, 1.1); }
    } else if (p.kind === 'rocket') {
      // B-2 무유도 미사일: 쏠 때 적이 있던 자리로 곧장 날아간다
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z); p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      p.trail += dt;
      while (p.trail > 0.02) { p.trail -= 0.02; const g = rr(0.75, 0.9); smokeSys.spawn(p.x, p.y, p.z, rr(-0.4, 0.4), rr(0, 0.6), rr(-0.4, 0.4), rr(0.8, 1.3), 0.5, 2.4, g, g, g, 0.5, -0.3, 1.2, rr(-1, 1), 0, 0.9, -100); }
      fireSys.spawn(p.x, p.y, p.z, -p.vx * 0.02, -p.vy * 0.02, -p.vz * 0.02, 0.06, 0.8, 0.3, 10, 6, 2.5, 1, 0, 0, 0, 0, 0.4, -100);
      if (p.t >= p.T || p.y <= waveHeight(p.x, p.z, t)) { p.on = false; p.mesh.visible = false; carpetHit(p.x, p.z, t, I.barrage.rFrac, I.barrage.rBossFrac, 1.3); }
    } else if (p.kind === 'torp') {
      const T = I.torpedo;
      // 맡은 적이 죽거나 잠수하면 가장 가까운 적으로 바꾼다. 유도미사일처럼 세게 꺾는다
      if (!p.target || !p.target.alive || p.target.submerged) {
        p.target = null; let bd = 1e9;
        for (let k = 0; k < enemies.length; k++) { const b = enemies[k]; if (!b.alive || b.submerged) continue; const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < bd) { bd = d; p.target = b; } }
      }
      if (p.target) {
        const b = p.target, lt = Math.hypot(b.x - p.x, b.z - p.z) / T.speed;
        const want = Math.atan2(b.x + b.vx * lt * 0.6 - p.x, b.z + b.vz * lt * 0.6 - p.z), cur = Math.atan2(p.dx, p.dz);
        const rate = T.turn * (p.t < 0.4 ? 0.4 : 1);
        const na = cur + clamp(wrapAngle(want - cur), -rate * dt, rate * dt);
        p.dx = Math.sin(na); p.dz = Math.cos(na);
      }
      const s = T.speed * dt;
      p.x += p.dx * s; p.z += p.dz * s; p.left -= s;
      const h = waveHeight(p.x, p.z, t);
      p.tmesh.position.set(p.x, h - 1.1, p.z); p.tmesh.rotation.set(0, Math.atan2(p.dx, p.dz), 0);
      // 물속으로 가는 게 보이게: 물 위 청록 빛 + 흰 거품 줄 + 올라오는 공기 방울
      const cd = camera.position.distanceTo(p.glow.position.set(p.x, h + 0.15, p.z)), gs = Math.max(4, cd * 0.03) * (0.85 + 0.15 * Math.sin(p.t * 20));
      p.glow.scale.set(gs, gs, 1);
      foamStamp(p.x - p.dx * 3, p.z - p.dz * 3, p.dx, p.dz, 9, 1.4, 1.2, 0, 0.8, 0);
      p.trail += dt;
      while (p.trail > 0.03) { p.trail -= 0.03; fireSys.spawn(p.x, h + 0.1, p.z, 0, 0.2, 0, rr(0.9, 1.3), 1.6, 0.6, 0.35, 2.0, 2.6, 0.75, 0, 0, 0, 0, 0.5, -100); }     // 청록 빛 꼬리
      if (rnd() < dt * 40) spraySys.spawn(p.x - p.dx * rr(1, 6), h, p.z - p.dz * rr(1, 6), rr(-0.6, 0.6), rr(1.5, 3.5), rr(-0.6, 0.6), rr(0.3, 0.6), 0.25, 0.06, 1, 1, 1, 0.8, 10, 0.5, 0, 0.04, 0, h - 0.4);
      let hit = null;
      for (let k = 0; k < enemies.length; k++) {
        const b = enemies[k];
        if (b.alive && !b.submerged && Math.hypot(b.x - p.x, b.z - p.z) < Math.max(b.M.L * 0.4, 4)) { hit = b; break; }
      }
      if (hit || p.left <= 0) {
        p.on = false; p.tmesh.visible = false; p.glow.visible = false;
        fxWaterColumn(p.x, p.z, hit ? 1.4 : 0.6, t);
        if (hit) { fxExplosion(p.x, h + 0.5, p.z, 1.0); damageBoat(hit, itemFrac(hit, T.frac, T.bossFrac), p.sx, p.sz, true); Sound.playAt('explosion', p.x, p.z, 0.9, 0.9); addTraumaAt(p.x, p.z, 0.35); }
      }
    }
  }
  // B-2 폭격기: 정해진 길로 날아가다가 폭탄을 떨어뜨리고 지나간다
  for (let i = 0; i < bombers.length; i++) {
    const b = bombers[i];
    if (!b.on) continue;
    b.t += dt;
    b.x += b.dx * b.sp * dt; b.z += b.dz * b.sp * dt;
    b.mesh.position.set(b.x, b.y, b.z); b.mesh.rotation.set(0, Math.atan2(b.dx, b.dz), Math.sin(b.t * 0.8) * 0.03);
    if (!b.done && b.mode === 'carpet' && b.t >= b.over - 0.7) {
      // 해역 안 적마다 폭탄 perEnemy발을 지금 있는 자리 근처(흩어짐 scatter)에, 나머지는 해역 전체에 고루. 무유도 미사일은 적이 있던 자리로
      b.done = true;
      const B = CONFIG.items.barrage, Q = player;
      const list = enemies.filter(e => e.alive && !e.submerged && Math.hypot(e.x - b.tx, e.z - b.tz) < B.r);
      const aimed = Math.min(B.bombs, list.length * B.perEnemy);
      for (let k = 0; k < B.bombs; k++) {
        const q = projSpawn('bombwait');
        if (!q) break;
        q.bomber = b; q.T = k / B.bombs * 1.1; q.sx = Q.x; q.sz = Q.z; q.target = null;
        if (k < aimed) { const e = list[k % list.length]; q.ex = e.x + rr(-1, 1) * B.scatter; q.ez = e.z + rr(-1, 1) * B.scatter; }
        else { const a = rnd() * TAU, r = Math.sqrt(rnd()) * B.r; q.ex = b.tx + Math.cos(a) * r; q.ez = b.tz + Math.sin(a) * r; }
      }
      for (let k = 0; k < B.rockets; k++) {
        const q = projSpawn('rocket');
        if (!q) break;
        const e = list.length ? list[k % list.length] : null;
        const ex = e ? e.x : b.tx + rr(-B.r, B.r) * 0.6, ez = e ? e.z : b.tz + rr(-B.r, B.r) * 0.6;
        q.x = b.x + rr(-8, 8); q.y = b.y - 3; q.z = b.z + rr(-8, 8);
        const dx = ex - q.x, dy = waveHeight(ex, ez, simTime) - q.y, dz = ez - q.z, dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        q.T = dl / B.rSpeed + 0.05; q.vx = dx / dl * B.rSpeed; q.vy = dy / dl * B.rSpeed; q.vz = dz / dl * B.rSpeed;
        q.sx = Q.x; q.sz = Q.z;
      }
      Sound.play('missile', 0.8, 0.35, 0);
    }
    if (!b.done && b.mode === 'nuke' && b.t >= b.over - 0.4) {
      b.done = true;
      const q = projSpawn('nukefall');
      if (q) {
        q.mesh.material = iproj.nMat; q.mesh.scale.setScalar(3);
        q.ax = b.x; q.ay = b.y - 3; q.az = b.z; q.ex = b.tx; q.ez = b.tz; q.T = CONFIG.items.nuke.delay - b.t; q.sx = player.x; q.sz = player.z;
      }
    }
    if (b.t > b.over + 7) { b.on = false; b.mesh.visible = false; }
  }
  // 핵폭탄 자리 초록 바다: 잠깐 그대로였다가 천천히 돌아온다
  if (nukeGlow > 0) {
    nukeGlow -= dt / 9;
    oceanUniforms.uNuke.value.w = Math.max(0, Math.min(1, nukeGlow * 1.6));
  }
  // 기뢰
  for (let i = 0; i < MINE_MAX; i++) {
    const m = mineList[i];
    if (!m.on) continue;
    m.life -= dt;
    const h = waveHeight(m.x, m.z, t);
    m.mesh.position.set(m.x, h - 0.5 - (m.life < 1 ? (1 - m.life) * 2 : 0), m.z);
    m.lamp.visible = Math.sin(t * 6 + m.ph) > 0;
    let trig = null;
    const M = I.mines;
    for (let k = 0; k < enemies.length; k++) {
      const b = enemies[k];
      if (b.alive && Math.hypot(b.x - m.x, b.z - m.z) - b.M.L * 0.3 < M.trig) { trig = b; break; }
    }
    if (trig) {
      m.on = false; m.mesh.visible = false;
      fxWaterColumn(m.x, m.z, 1.1, t); fxExplosion(m.x, h + 0.5, m.z, 0.8);
      // 아이템 기뢰는 밟은 적 최대 체력의 frac (기함은 bossFrac), 카드 '기뢰 꼬리' 기뢰는 trailDmg
      const dmgOf = o => m.pct ? itemFrac(o, M.frac, M.bossFrac) : M.trailDmg;
      damageBoat(trig, dmgOf(trig), player.x, player.z, true);
      for (let k = 0; k < enemies.length; k++) {
        const o = enemies[k];
        if (!o.alive || o === trig) continue;
        const dd = Math.max(0, Math.hypot(o.x - m.x, o.z - m.z) - o.M.L * 0.3);
        if (dd < M.r) damageBoat(o, dmgOf(o) * 0.6 * (1 - dd / M.r), player.x, player.z, true);
      }
      Sound.playAt('explosion', m.x, m.z, 0.9, 1.0);
      addTraumaAt(m.x, m.z, 0.3);
    } else if (m.life <= 0) { m.on = false; m.mesh.visible = false; }
  }
  // 표시 고리
  for (let i = 0; i < RING_MAX; i++) {
    const r = rings[i];
    if (!r.on) continue;
    r.t += dt;
    const k = Math.min(r.t / r.T, 1), rad = r.r0 + (r.r1 - r.r0) * Math.sqrt(k);
    if (r.follow) { r.x = P.x; r.z = P.z; }
    r.mesh.position.set(r.x, waveHeight(r.x, r.z, t) + 0.4, r.z);
    r.mesh.scale.set(rad, 1, rad);
    r.mesh.material.opacity = r.a0 + (r.a1 - r.a0) * k;
    if (r.t >= r.T) { r.on = false; r.mesh.visible = false; }
  }
  // EMP 맞은 적: 파란 불꽃이 튄다
  for (let i = 0; i < enemies.length; i++) {
    const b = enemies[i];
    if (!b.alive || !(b.ai.empT > 0)) continue;
    b.ai.empT -= dt;
    if (rnd() < dt * 6) fireSys.spawn(b.x + rr(-2, 2), b.y + b.M.topY * rr(0.4, 1), b.z + rr(-2, 2), rr(-4, 4), rr(1, 5), rr(-4, 4), rr(0.15, 0.3), 0.6, 1.4, 1.2, 3.5, 7, 1, 0, 1, 0, 0, 0.4, -100);
  }
  // 방어막
  if (Game.shieldT > 0) {
    Game.shieldT -= dt;
    // 끝나기 직전에는 깜빡깜빡 (점점 빨라진다)
    const bl = CONFIG.items.repair.blink, ending = Game.shieldT < bl;
    const blinkOn = !ending || Math.floor(t * (Game.shieldT < bl * 0.5 ? 12 : 6)) % 2 === 0;
    shieldMesh.visible = P.alive && blinkOn;
    shieldMesh.position.set(P.x, P.y + 1.4, P.z);
    shieldMesh.rotation.set(0, P.heading, 0);
    shieldMesh.material.opacity = 0.16 + 0.07 * Math.sin(t * 8);
  } else if (shieldMesh.visible) shieldMesh.visible = false;
  // 화면 섬광
  if (flashA > 0.004) {
    flashEl.style.opacity = flashA.toFixed(3);
    flashEl.style.background = 'rgb(' + Math.round(flashR * 255) + ',' + Math.round(flashG * 255) + ',' + Math.round(flashB * 255) + ')';
    flashA *= Math.exp(-dt * 1.8);
  } else if (flashA > 0) { flashA = 0; flashEl.style.opacity = '0'; }
}

// B-2 폭격기 모형: 꼬리 없는 전익기. 날개 단면이 가운데서 두껍고(동체가 녹아든 모양) 끝으로 갈수록 얇아진다
// 앞전은 곧게 뒤로 젖혀지고 뒷전은 W자 톱니. 조종석 창 네 장, 날개 위 엔진 흡입구 혹 두 쌍, 뒤쪽에 움푹한 배기구
function buildB2Geo() {
  const body = sRGB(0x4b5259), dark = sRGB(0x23282d), win = sRGB(0x0b1014), lip = sRGB(0x5a6168);
  const TE = [[0, -7.2], [6.5, -10.2], [12.5, -6.2], [19.5, -11], [26, -8.4]];
  const zLE = x => 10.5 - 17.6 * x / 26;
  const zTE = x => { for (let k = 0; k < TE.length - 1; k++) { const a = TE[k], b = TE[k + 1]; if (x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return TE[TE.length - 1][1]; };
  const thick = x => 0.22 + 2.2 * Math.pow(1 - x / 26, 2.3) + 1.25 * Math.pow(Math.max(0, 1 - x / 4.5), 2);
  const foil = u => 5 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u * u * u - 0.1036 * u * u * u * u);
  const topAt = (x, z) => { const a = zLE(Math.abs(x)), b = zTE(Math.abs(x)), u = clamp((a - z) / (a - b), 0, 1); return thick(Math.abs(x)) * foil(u) * 1.25; };
  const xs = []; for (let x = 0; x <= 26; x += 0.65) xs.push(x); xs.push(6.5, 12.5, 19.5, 26); xs.sort((a, b) => a - b);
  const X = xs.filter((v, i) => i === 0 || v - xs[i - 1] > 1e-3), NU = 16, P = [], C = [];
  const us = []; for (let j = 0; j <= NU; j++) us.push((1 - Math.cos(Math.PI * j / NU)) * 0.5);
  function surf(sgn, top) {
    for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < NU; j++) {
      const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => {
        const x = X[a], u = us[b], z = zLE(x) - (zLE(x) - zTE(x)) * u, t = thick(x) * foil(u);
        return [sgn * x, top ? t * 1.25 : -t * 0.55, z];
      });
      const tri = (A, B, D) => { const w = (top ? 1 : -1) * sgn > 0; const L = w ? [A, B, D] : [A, D, B]; for (const p of L) P.push(p[0], p[1], p[2]); for (let k = 0; k < 3; k++) C.push(body.r, body.g, body.b); };
      tri(q[0], q[2], q[1]); tri(q[0], q[3], q[2]);
    }
  }
  surf(1, true); surf(-1, true); surf(1, false); surf(-1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  const gb = new GeoBuilder();
  gb.add(g, body);
  // 조종석 창: 앞쪽 혹 위에 비스듬히 네 장
  for (const x of [-1.05, -0.36, 0.36, 1.05]) {
    const z = 8.1 - Math.abs(x) * 0.25, y = topAt(x, z), sl = Math.atan2(topAt(x, z + 0.3) - topAt(x, z - 0.3), 0.6);
    gb.box(0.6, 0.05, 0.55, x, y + 0.02, z, win, -sl, 0, -x * 0.12);
  }
  // 엔진 흡입구 혹과 톱니 모양 흡입구, 뒤쪽 배기구
  for (const s of [1, -1]) for (const ex of [3.2, 5.6]) {
    const x = s * ex, z = 1.4 - ex * 0.15, y = topAt(x, z);
    const hump = new THREE.SphereGeometry(1, 14, 8); hump.scale(1.1, 0.5, 3.6);
    gb.add(hump, body, new THREE.Matrix4().makeTranslation(x, y - 0.05, z));
    gb.box(1.5, 0.3, 0.12, x, y + 0.3, z + 2.2, dark, -0.5);
    gb.box(1.6, 0.06, 0.25, x, y + 0.42, z + 2.25, lip, -0.5);
  }
  for (const s of [1, -1]) { const x = s * 4.4, z = -5.6, y = topAt(x, z); gb.box(3.0, 0.08, 3.2, x, y + 0.01, z, dark, 0.06); }
  // 앞전 아래 얇은 선
  return gb.build();
}
