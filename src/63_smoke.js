
/* ==========================================================================
 * 연막탄 — 전차 연막탄 발사기처럼 함교 양옆 발사기에서 5발을 "퐁" 쏜다
 * 적이 300m보다 멀면: 적 쪽으로 부채꼴, 300~400m 지점 공중에서 "팡" 터져 원형 연막 5개가 벽처럼 선다
 * 적이 300m 안이면: 내 둘레에 터뜨려 나를 감춘다 (위기 때 체력 autoHp 아래면 자동으로, 이때도 내 둘레)
 * 연막이 시선을 가리면 적은 나를 못 본다: 사격·미사일·드론 유도가 끊긴다
 * 배가 지나가면 연막이 양옆으로 밀려 틈이 생기고, 그 틈으로는 보인다. 시간이 지나면 다시 메워진다
 * ========================================================================== */
const SMK_G = 12, SMK_C = 16, SMK_CARVE = 40;
const smkGren = [], smkClouds = [], smkCarve = [];
let smokeWall = null, smkGeo = null, smkMat = null;
const SMK_LIT = new THREE.Vector3(1, 1, 1), SMK_BACK = new THREE.Vector3(0.45, 0.4, 0.34);

function initSmoke() {
  const maxP = Math.round(CONFIG.quality.maxSmoke * 1.15);
  smokeWall = new ParticleSystem(maxP, SMK_LIT, SMK_BACK, false, 0.18, 0, 9);
  smkGeo = new THREE.SphereGeometry(0.22, 8, 6);
  smkMat = new THREE.MeshStandardMaterial({ color: 0x3e4a33, roughness: 0.7, metalness: 0.3 });
  for (let i = 0; i < SMK_G; i++) {
    const m = new THREE.Mesh(smkGeo, smkMat); m.visible = false; scene.add(m);
    smkGren.push({ on: false, m: m, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, T: 0, trail: 0, mine: true });
  }
  for (let i = 0; i < SMK_C; i++) smkClouds.push({ on: false, x: 0, z: 0, R: 0, age: 0, life: 0, emit: 0, auto: false });
  for (let i = 0; i < SMK_CARVE; i++) smkCarve.push({ x: 0, z: 0, t: -99 });
}
function smokeClear() {
  for (const g of smkGren) { g.on = false; g.m.visible = false; }
  for (const c of smkClouds) c.on = false;
  for (const k of smkCarve) k.t = -99;
  if (smokeWall) smokeWall.clear();
  Game.smokeCD = 0; Game.smokeAutoT = 0;
}

// 가장 가까운 위협 (배·하늘 적)
function smokeThreat() {
  const P = player;
  let best = null, bd = 1e9;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]; if (!e.alive || e.submerged) continue;
    const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; best = e; }
  }
  for (let i = 0; i < airs.length; i++) {
    const a = airs[i]; if (!a.alive) continue;
    const d = Math.hypot(a.x - P.x, a.z - P.z); if (d < bd) { bd = d; best = a; }
  }
  return best ? { t: best, d: bd } : null;
}

// 연막탄 쓰기 (auto: 위기 자동 사용 → 늘 내 둘레)
function smokeDeploy(auto) {
  const S = CONFIG.smoke, P = player;
  if (!P.alive) return false;
  if (Game.smokeCD > 0) return false;
  if (Game.smokes < S.per) { if (!auto) { Hud.toast('연막탄이 부족합니다 (' + S.per + '발 필요)'); Sound.play('dry', 0.5, 1, 0); } return false; }
  Game.smokes -= S.per; Game.smokeCD = 1.2;
  const th = smokeThreat(), around = auto || !th || th.d < S.near;
  const sh = Math.sin(P.heading), ch = Math.cos(P.heading);
  const pts = [];
  if (around) {
    // 내 둘레: 1초 뒤 내가 있을 자리를 감싸도록 다섯 곳
    const cx = P.x + P.vx * 1.0, cz = P.z + P.vz * 1.0, a0 = rnd() * TAU;
    for (let k = 0; k < S.per; k++) { const a = a0 + k / S.per * TAU, r = S.ring * rr(0.8, 1.15); pts.push([cx + Math.sin(a) * r, cz + Math.cos(a) * r]); }
  } else {
    const a0 = Math.atan2(th.t.x - P.x, th.t.z - P.z);
    for (let k = 0; k < S.per; k++) {
      const a = a0 + (k - (S.per - 1) / 2) * S.fan / (S.per - 1) * 2 * 0.5, d = rr(S.dist[0], S.dist[1]);
      pts.push([P.x + Math.sin(a) * d, P.z + Math.cos(a) * d]);
    }
  }
  // 함교 양옆 발사기에서 번갈아 (짧은 간격으로 퐁퐁퐁)
  for (let k = 0; k < pts.length; k++) {
    let g = null; for (let i = 0; i < SMK_G; i++) if (!smkGren[i].on) { g = smkGren[i]; break; }
    if (!g) break;
    const side = k % 2 ? 1 : -1, ox = P.x + ch * side * 1.5 - sh * 1.2, oz = P.z - sh * side * 1.5 - ch * 1.2, oy = P.y + 3.2;
    const tx = pts[k][0], tz = pts[k][1], ty = 7, dx = tx - ox, dz = tz - oz, dist = Math.hypot(dx, dz);
    const T = around ? 0.7 + k * 0.05 : clamp(dist / 125, 1.2, 3.6), gG = 18;
    g.on = true; g.x = ox; g.y = oy; g.z = oz; g.T = T; g.t = -k * 0.09; g.trail = 0; g.auto = !!auto;
    g.vx = dx / T; g.vz = dz / T; g.vy = (ty - oy) / T + 0.5 * gG * T; g.g = gG;
    g.m.visible = false;
  }
  Sound.play('pop', 0.9, 1, 0);
  Cam.trauma = Math.min(1, Cam.trauma + 0.08);
  achStat('smokeUse', 1);
  return true;
}

function smokeCloudAt(x, z, auto) {
  let c = null; for (let i = 0; i < SMK_C; i++) if (!smkClouds[i].on) { c = smkClouds[i]; break; }
  if (!c) { let o = 0; for (let i = 1; i < SMK_C; i++) if (smkClouds[i].age > smkClouds[o].age) o = i; c = smkClouds[o]; }
  const S = CONFIG.smoke;
  c.on = true; c.x = x; c.z = z; c.R = 4; c.age = 0; c.life = S.life; c.emit = 0; c.auto = !!auto;
  // 팡: 섬광과 사방으로 퍼지는 첫 연기 덩어리
  fireSys.spawn(x, 7, z, 0, 0, 0, 0.1, 2, 6, 10, 9, 7, 1, 0, 0, 0, 0, 0.5, -100);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU, sp = rr(8, 18), g = rr(0.82, 0.95);
    smokeWall.spawn(x, rr(3, 9), z, Math.cos(a) * sp, rr(-1, 3), Math.sin(a) * sp, rr(6, 9), 4, rr(14, 20), g, g, g * 0.97, 0.85, -0.2, 1.1, rr(-0.3, 0.3), 0, 0.95, -100);
  }
  Sound.playAt('puff', x, z, 1.0, rr(0.9, 1.1));
}

function smokeUpdate(dt) {
  if (!smokeWall) return;
  const S = CONFIG.smoke, P = player, t = simTime;
  if (Game.smokeCD > 0) Game.smokeCD -= dt;
  if (Game.smokeAutoT > 0) Game.smokeAutoT -= dt;
  // 위기: 체력이 autoHp 아래로 떨어지면 저절로 (한 번 쓰면 연막이 걷힐 때까지 다시 안 씀)
  if (Game.state === 'play' && P.alive && P.hp < S.autoHp && Game.smokes >= S.per && !(Game.smokeAutoT > 0)) {
    if (smokeDeploy(true)) { Game.smokeAutoT = S.life; Hud.toast('위기 · 연막탄 자동 사용'); }
  }
  // 날아가는 연막탄
  for (let i = 0; i < SMK_G; i++) {
    const g = smkGren[i]; if (!g.on) continue;
    if (g.t < 0) { g.t += dt; if (g.t >= 0) { g.m.visible = true; fireSys.spawn(g.x, g.y, g.z, g.vx * 0.05, g.vy * 0.05, g.vz * 0.05, 0.08, 0.8, 2, 10, 8, 5, 1, 0, 0, 0, 0, 0.5, -100); } continue; }
    g.t += dt;
    g.vy -= g.g * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
    g.m.position.set(g.x, g.y, g.z);
    g.trail += dt;
    while (g.trail > 0.04) { g.trail -= 0.04; const v = rr(0.75, 0.88); smokeSys.spawn(g.x, g.y, g.z, rr(-0.3, 0.3), rr(0, 0.5), rr(-0.3, 0.3), rr(0.6, 1), 0.3, 1.3, v, v, v, 0.45, -0.2, 1.4, 0, 0, 0.9, -100); }
    if (g.t >= g.T || g.y < 1) { g.on = false; g.m.visible = false; smokeCloudAt(g.x, g.z, g.auto); }
  }
  // 구름: 처음 몇 초는 부풀고, life 동안 계속 연기를 뿜어 두껍게 유지하다가 끝 무렵에 옅어진다
  const scale = CONFIG.quality.effectScale;
  for (let i = 0; i < SMK_C; i++) {
    const c = smkClouds[i]; if (!c.on) continue;
    c.age += dt;
    if (c.age > c.life) { c.on = false; continue; }
    const grow = Math.min(1, c.age / S.grow), fade = clamp((c.life - c.age) / 5, 0, 1);
    c.R = (4 + (S.cloudR - 4) * Math.sqrt(grow)) * (0.55 + 0.45 * fade);
    c.x += WIND_X * 0.12 * dt; c.z += WIND_Z * 0.12 * dt;
    if (c.age < c.life - 4) {
      c.emit += dt * (S.puffs / 6) * (0.6 + 0.4 * scale) * (FX_LITE ? 0.6 : 1);
      while (c.emit > 1) {
        c.emit -= 1;
        const a = rnd() * TAU, r = Math.sqrt(rnd()) * c.R * 0.8, g = rr(0.8, 0.94);
        smokeWall.spawn(c.x + Math.cos(a) * r, rr(1, S.height * 0.7), c.z + Math.sin(a) * r, rr(-1, 1), rr(0.4, 2), rr(-1, 1),
          rr(7, 10), rr(10, 14), rr(20, 30), g, g * 0.99, g * 0.96, 0.72, -0.05, 0.35, rr(-0.15, 0.15), 0, 0.95, -100);
      }
    }
  }
  // 배가 연막을 가른다: 지나가는 배 둘레의 연기를 양옆으로 밀어내고, 그 자리를 틈으로 기억한다
  smokePart(P, dt, t);
  for (let i = 0; i < enemies.length; i++) smokePart(enemies[i], dt, t);
  const ek = Game.envKey === 'night' ? 0.28 : (Game.envKey === 'storm' ? 0.65 : 1);
  SMK_LIT.set(ek, ek, ek); SMK_BACK.set(0.45 * ek, 0.4 * ek, 0.34 * ek);
  smokeWall.update(dt, WIND_X * 0.25, WIND_Z * 0.25);
}

function smokeInside(x, z, pad) {
  for (let i = 0; i < SMK_C; i++) { const c = smkClouds[i]; if (c.on && (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < (c.R + pad) * (c.R + pad)) return true; }
  return false;
}
let smkCarveI = 0;
function smokePart(b, dt, t) {
  if (!b || !b.alive || b.submerged) return;
  const sp = Math.hypot(b.vx, b.vz);
  if (sp < 3 || !smokeInside(b.x, b.z, 6)) return;
  const S = CONFIG.smoke, R = S.carveR + b.M.L * 0.35, ux = b.vx / sp, uz = b.vz / sp;
  // 틈 기록 (같은 자리에 겹치지 않게 조금씩 떨어진 점만)
  const last = smkCarve[(smkCarveI + SMK_CARVE - 1) % SMK_CARVE];
  if (Math.hypot(last.x - b.x, last.z - b.z) > 5 || t - last.t > 0.5) { const k = smkCarve[smkCarveI]; k.x = b.x; k.z = b.z; k.t = t; smkCarveI = (smkCarveI + 1) % SMK_CARVE; }
  // 연기 입자 밀어내기: 진행 방향의 수직으로
  const pos = smokeWall.pos, vel = smokeWall.vel, n = smokeWall.n;
  for (let i = 0; i < n; i++) {
    const i3 = i * 3, dx = pos[i3] - b.x, dz = pos[i3 + 2] - b.z;
    if (dx > R || dx < -R || dz > R || dz < -R || pos[i3 + 1] > 22) continue;
    const d2 = dx * dx + dz * dz; if (d2 > R * R) continue;
    const side = dx * -uz + dz * ux >= 0 ? 1 : -1, k = (1 - Math.sqrt(d2) / R) * (6 + sp * 0.8) * dt;
    pos[i3] += -uz * side * k; pos[i3 + 2] += ux * side * k;
    vel[i3] += -uz * side * k * 2.5; vel[i3 + 2] += ux * side * k * 2.5;
  }
}

// 두 점 사이 시선을 연막이 가리는가 (배가 가른 틈은 통과)
function smokeBlocks(ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1, S = CONFIG.smoke, now = simTime;
  for (let i = 0; i < SMK_C; i++) {
    const c = smkClouds[i]; if (!c.on || c.age < 0.6) continue;
    const t = clamp(((c.x - ax) * vx + (c.z - az) * vz) / L2, 0, 1), px = ax + vx * t, pz = az + vz * t;
    const d2 = (px - c.x) * (px - c.x) + (pz - c.z) * (pz - c.z);
    if (d2 > c.R * c.R) continue;
    // 가린다. 다만 시선이 지나는 자리가 갓 갈라진 틈이면 보인다
    let gap = false;
    for (let k = 0; k < SMK_CARVE && !gap; k++) {
      const q = smkCarve[k]; if (now - q.t > S.carveT) continue;
      const qt = clamp(((q.x - ax) * vx + (q.z - az) * vz) / L2, 0, 1), qx = ax + vx * qt - q.x, qz = az + vz * qt - q.z;
      if (qx * qx + qz * qz < S.carveR * S.carveR && (q.x - c.x) * (q.x - c.x) + (q.z - c.z) * (q.z - c.z) < (c.R + 6) * (c.R + 6)) gap = true;
    }
    if (!gap) return true;
  }
  return false;
}
// 적이 나를 볼 수 있나 (연막·섬)
function canSeePlayer(x, y, z) {
  const P = player;
  if (smokeBlocks(x, z, P.x, P.z)) return false;
  if (ISLES.length && isleBlocks(x, y, z, P.x, P.y + 2, P.z)) return false;
  return true;
}
