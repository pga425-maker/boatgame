/* ---------- 플레어: 적 유도미사일을 속이는 불덩이 ----------
 * 적을 격파할 때마다 2개씩 쌓이고(상한 없음) F 키나 플레어 버튼으로 하나씩 쓴다. 한 번 쓰면 1초 뒤에 다시 쓸 수 있다.
 * 쓰면 배 위에서 섬광이 터지고, 날아오는 적 미사일 쪽(없으면 가까운 적 쪽)으로 왼쪽·가운데·오른쪽 세 줄기,
 * 낮은 층과 높은 층 두 겹으로 자탄이 차례로 튀어나와 하얗게 타며 연기 꼬리를 끌고 떨어진다.
 * 그 순간 나를 쫓던 적 미사일은 하나하나 decoyP 확률로 자탄 하나를 쫓아가 부딪혀 터진다.
 * 터진 자리가 내 배에서 가까우면 약한 충격 데미지를 받는다 */
const FL_MAX = 220;
const FlSeq = { t: 0, made: null, low: null, high: null, pick: 0, id: 0 };   // 지금 뿜어내는 중인 플레어 묶음
const flares = [];
let flareLight = null, flareSmoke = null;
const FL_LIT = new THREE.Vector3(1, 1, 1), FL_BACK = new THREE.Vector3(0.5, 0.4, 0.3);

function initFlares() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.16, 'rgba(255,253,245,1)');
  gr.addColorStop(0.34, 'rgba(255,236,205,0.55)');
  gr.addColorStop(0.62, 'rgba(255,214,170,0.16)');
  gr.addColorStop(1, 'rgba(255,200,150,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, transparent: true, toneMapped: false, fog: false });
  for (let i = 0; i < FL_MAX; i++) {
    const s = new THREE.Sprite(mat); s.visible = false; s.renderOrder = 20; scene.add(s);
    flares.push({ on: false, s: s, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 0, trail: 0, a: 0, hs: 0, up: 0 });
  }
  // 타는 플레어가 둘레를 비추는 빛 (밤에 잘 보인다). 처음부터 켜 둬야 재질을 다시 만들지 않는다
  flareLight = new THREE.PointLight(0xfff2e0, 0, 160, 2);
  scene.add(flareLight);
  // 자탄 연기 꼬리 전용 풀: 다른 연기(불타는 배 등)를 빼앗지 않게 따로 둔다
  flareSmoke = new ParticleSystem(Math.round(CONFIG.quality.maxSmoke * 5), FL_LIT, FL_BACK, false, 0.1, 0, 10);
}

function flaresClear() {
  FlSeq.t = 0; FlSeq.made = null;
  for (let i = 0; i < flares.length; i++) { flares[i].on = false; flares[i].s.visible = false; }
  if (flareLight) flareLight.intensity = 0;
  if (flareSmoke) flareSmoke.n = 0;
}

// 플레어를 하나 쓴다: 자탄들을 만들고, 날아오던 적 미사일을 속인다
function deployFlare() {
  const F = CONFIG.flare, P = player;
  if (Game.flareT > 0) return false;
  if (Game.flares <= 0) { Sound.play('dry', 0.5, 1, 0); return false; }
  Game.flares--; Game.flareT = F.cooldown;
  const sh = Math.sin(P.heading), ch = Math.cos(P.heading);
  // 쏠 방향: 나를 쫓는 가장 가까운 적 미사일 쪽, 없으면 가장 가까운 적 쪽, 적도 없으면 배 뒤쪽
  let aim = P.heading + Math.PI, bd = 1e9;
  for (let i = 0; i < MIS_MAX; i++) {
    const m = missiles[i];
    if (!m.on || m.owner !== 1 || m.target !== P) continue;
    const d = Math.hypot(m.x - P.x, m.z - P.z);
    if (d < bd) { bd = d; aim = Math.atan2(m.x - P.x, m.z - P.z); }
  }
  if (bd === 1e9) for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive || e.submerged) continue;
    const d = Math.hypot(e.x - P.x, e.z - P.z);
    if (d < bd) { bd = d; aim = Math.atan2(e.x - P.x, e.z - P.z); }
  }
  const x0 = P.x - sh * 2.2, z0 = P.z - ch * 2.2, y0 = P.y + 3.2;
  // 발사 섬광과 짧은 연기
  fireSys.spawn(x0, y0, z0, 0, 2, 0, 0.2, 3, 11, 13, 12, 10, 1, 0, 0, 0, 0, 0.6, -100);
  for (let i = 0; i < 6; i++) { const g = rr(0.86, 0.96); smokeSys.spawn(x0 + rr(-1, 1), y0, z0 + rr(-1, 1), rr(-3, 3), rr(1, 4), rr(-3, 3), rr(1.2, 2), 1.4, 5, g, g, g, 0.6, -0.3, 1.5, rr(-1, 1), 0, 0.9, -100); }
  Sound.play('flare', 0.85, rr(0.95, 1.05), 0);
  Cam.trauma = Math.min(1, Cam.trauma + 0.12);
  // 자탄: 왼쪽·가운데·오른쪽 세 줄기를 번갈아 차례로. 낮은 층은 멀리 낮게, 높은 층은 높이 솟았다가 떨어진다
  // 한 줄기 안에서도 뒤에 나온 것일수록 더 멀리 나가서 휘어진 줄이 여러 가닥 생긴다
  // 한 줄기 안에서도 바깥쪽으로 조금씩 벌어지게 해서 넓게 퍼진다
  const made = [], low = [], high = [], dirs = [-1.25, 0, 1.25], plan = [];
  for (let i = 0; i < F.low; i++) { const g = i % 3, k = Math.floor(i / 3) / Math.max(1, Math.ceil(F.low / 3) - 1); plan.push([dirs[g] + (g - 1) * 0.25 * k + rr(-0.2, 0.2), 14 + 17 * k, 16 - 4 * k]); }
  for (let i = 0; i < F.high; i++) { const g = i % 3, k = Math.floor(i / 3) / Math.max(1, Math.ceil(F.high / 3) - 1); plan.push([dirs[g] * 0.9 + (g - 1) * 0.2 * k + rr(-0.2, 0.2), 8 + 9 * k, 34 - 4 * k]); }
  for (let i = 0; i < plan.length; i++) {
    let f = null;
    for (let j = 0; j < FL_MAX; j++) if (!flares[j].on) { f = flares[j]; break; }
    if (!f) break;
    // 낮은 층과 높은 층을 섞어서 차례로 튀어나오게
    const order = i < F.low ? i * 1.6 : (i - F.low) * 1.6 + 0.8;
    f.on = true; f.age = -order * F.gap; f.life = rr(F.life[0], F.life[1]); f.trail = 0;
    f.a = aim + plan[i][0]; f.hs = plan[i][1]; f.up = plan[i][2];
    f.x = x0; f.y = y0; f.z = z0; f.vx = P.vx; f.vy = 0; f.vz = P.vz;
    f.s.visible = false;
    made.push(f); (i < F.low ? low : high).push(f);
  }
  // 날아오던 적 미사일: 하나하나 확률로 속아서 자탄을 쫓는다. 뿜어내는 동안(seq초) 새로 날아든 미사일도 마찬가지
  // 플레어를 터뜨릴 때마다 새 기회: 앞 플레어에 안 속은 미사일도 이번 플레어에 다시 decoyP 확률로 속는다
  FlSeq.t = F.seq; FlSeq.made = made; FlSeq.low = low; FlSeq.high = high; FlSeq.pick = 0; FlSeq.id++;
  flareDecoyAll();
  if (airs.length) airFlare(made);           // 자폭 드론도 플레어 쪽으로
  // 섬광: 둘레 blindR 안 적은 잠깐 눈이 부셔서 제대로 못 쏜다
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive || e.submerged || Math.hypot(e.x - P.x, e.z - P.z) > F.blindR) continue;
    e.ai.blindT = F.blindT; e.ai.errT = 0;
  }
  return true;
}
function flareDecoyAll() {
  const F = CONFIG.flare, P = player, made = FlSeq.made;
  if (!made || !made.length) return;
  for (let i = 0; i < MIS_MAX; i++) {
    const m = missiles[i];
    if (!m.on || m.owner !== 1 || m.fast || m.flare || m.flareTried === FlSeq.id || m.target !== P) continue;
    if (Math.hypot(m.x - P.x, m.z - P.z) > F.range) continue;
    m.flareTried = FlSeq.id;
    if (rnd() >= F.decoyP) continue;
    achStat('flareDecoy', 1);
    // 낮은 층과 높은 층에 번갈아 보낸다 (높은 층 자탄에 속은 미사일은 위로 치솟아 공중에서 터진다)
    // 먼저 튀어나오는 자탄 쪽으로 보내서, 아직 배 위에 있는 자탄을 쫓다 내 배로 오지 않게 한다
    const pk = FlSeq.pick++;
    const L = (pk % 2 === 1 && FlSeq.high.length) ? FlSeq.high : (FlSeq.low.length ? FlSeq.low : made);
    let f = null;
    for (let j = 0; j < L.length && !f; j++) { const q = L[(Math.floor(pk / 2) + j) % L.length]; if (q.on && q.age >= 0) f = q; }
    if (!f) f = L[Math.floor(pk / 2) % Math.min(3, L.length)];
    m.flare = f; m.flareSet = made; m.decoy = true; m.target = null; m.tx = f.x; m.ty = f.y; m.tz = f.z;
  }
}
// 자동 플레어(상점에서 산 경우): 안 속은 적 미사일이 autoR 안에 있으면 재장전될 때마다 쏜다
function flareAuto() {
  if (!Skill.autoFlare || Game.flareT > 0 || Game.flares <= 0 || !player.alive) return;
  const R = CONFIG.flare.autoR, P = player;
  for (let i = 0; i < MIS_MAX; i++) {
    const m = missiles[i];
    if (!m.on || m.owner !== 1 || m.fast || m.flare || m.target !== P) continue;
    if (Math.hypot(m.x - P.x, m.z - P.z) < R) { deployFlare(); return; }
  }
}

function flaresUpdate(dt) {
  const F = CONFIG.flare, P = player;
  if (FlSeq.t > 0) { FlSeq.t -= dt; flareDecoyAll(); }
  let n = 0, lx = 0, ly = 0, lz = 0;
  for (let i = 0; i < FL_MAX; i++) {
    const f = flares[i];
    if (!f.on) continue;
    if (f.age < 0) {
      // 아직 안 튀어나온 자탄: 발사대를 따라간다
      f.age += dt;
      const sh = Math.sin(P.heading), ch = Math.cos(P.heading);
      f.x = P.x - sh * 2.2; f.y = P.y + 3.2; f.z = P.z - ch * 2.2;
      if (f.age >= 0) {
        // 튀어나온다: 정해진 방향으로 + 위로 (배의 속도를 일부 이어받는다)
        f.vx = Math.sin(f.a) * f.hs + P.vx * 0.55 + rr(-1.2, 1.2);
        f.vz = Math.cos(f.a) * f.hs + P.vz * 0.55 + rr(-1.2, 1.2);
        f.vy = f.up + rr(-1.5, 1.5);
        f.s.visible = true;
        fireSys.spawn(f.x, f.y, f.z, f.vx * 0.2, f.vy * 0.2, f.vz * 0.2, 0.1, 1.2, 3.5, 12, 11, 9, 1, 0, 0, 0, 0, 0.5, -100);
      }
      continue;
    }
    f.age += dt;
    // 무겁지 않은 불덩이: 중력에 비해 공기 저항이 커서 포물선 끝이 축 처진다
    const dr = Math.exp(-F.drag * dt);
    f.vx *= dr; f.vz *= dr; f.vy = f.vy * dr - F.gravity * dt;
    f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    const burnK = 1 - f.age / f.life;
    if (burnK <= 0 || f.y < -0.5) { f.on = false; f.s.visible = false; continue; }
    // 하얀 연기 꼬리와 튀는 불티
    f.trail += dt;
    while (f.trail > 0.035) {
      f.trail -= 0.035;
      // 가늘고 하얀 연기 줄: 작게 촘촘히 남겨서 덩어리가 아니라 휘어진 줄로 보이게
      const g = rr(0.9, 0.98);
      flareSmoke.spawn(f.x + rr(-0.12, 0.12), f.y, f.z + rr(-0.12, 0.12), rr(-0.2, 0.2), rr(0.1, 0.4), rr(-0.2, 0.2),
        rr(2.2, 2.8), 0.7, rr(2.0, 2.6), g, g, g, 0.5 * Math.min(1, burnK * 2.5), -0.12, 1.6, rr(-1, 1), 0, 0.9, -100);
      if (rnd() < 0.5) fireSys.spawn(f.x, f.y, f.z, rr(-3, 3), rr(-2, 1), rr(-3, 3), rr(0.12, 0.25), 0.35, 0.1, 12, 11, 9, 1, 6, 0, 0, 0, 0.4, -100);
    }
    // 빛 크기: 멀리서도 보이게 거리에 맞춰 키우고 지글지글 깜빡인다
    const cd = camera.position.distanceTo(f.s.position.set(f.x, f.y, f.z));
    const gs = Math.max(3.2, cd * 0.02) * (0.82 + 0.18 * rnd()) * (0.55 + 0.45 * Math.min(1, burnK * 3));
    f.s.scale.set(gs, gs, 1);
    n++; lx += f.x; ly += f.y; lz += f.z;
  }
  // 연기 밝기: 밤에는 어둡게 (타는 자탄 둘레라서 다른 연기보다는 밝게)
  const ek = Game.envKey === 'night' ? 0.42 : (Game.envKey === 'storm' ? 0.7 : 1);
  FL_LIT.set(ek, ek, ek); FL_BACK.set(0.5 * ek, 0.4 * ek, 0.3 * ek);
  flareSmoke.update(dt, WIND_X * 0.4, WIND_Z * 0.4);
  if (flareLight) {
    if (n > 0) {
      flareLight.position.set(lx / n, ly / n, lz / n);
      const env = Game.envKey === 'night' ? 1 : (Game.envKey === 'storm' ? 0.55 : 0.25);
      flareLight.intensity = F.light * env * Math.min(1, n / 6) * (0.85 + 0.15 * rnd());
    } else flareLight.intensity = 0;
  }
}

// 속은 적 미사일: 자탄을 쫓아가고, 닿으면 그 자리에서 터진다. 자탄이 다 타면 마지막 자리로 날아가 바다에 떨어진다
function flareSteer(m) {
  let f = m.flare;
  if (f && !f.on) {
    // 쫓던 자탄이 다 타면 같이 터뜨린 자탄 중 가장 가까운 것으로 옮겨 간다
    f = null; let bd = 1e9;
    const S = m.flareSet || [];
    for (let i = 0; i < S.length; i++) {
      const q = S[i]; if (!q.on) continue;
      const d = (q.x - m.x) * (q.x - m.x) + (q.y - m.y) * (q.y - m.y) + (q.z - m.z) * (q.z - m.z);
      if (d < bd) { bd = d; f = q; }
    }
    m.flare = f;
  }
  if (f) { m.tx = f.x; m.ty = f.y; m.tz = f.z; }
}
function flareHit(m) {
  const f = m.flare;
  if (!f || !f.on || f.age < 0) return false;
  const dx = f.x - m.x, dy = f.y - m.y, dz = f.z - m.z, R = CONFIG.flare.hitR;
  if (dx * dx + dy * dy + dz * dz > R * R) return false;
  f.on = false; f.s.visible = false;
  return true;
}
// 미사일이 자탄에 부딪혀 공중에서 터지는 효과: 하얀 섬광, 사방으로 튀는 불티, 흩어져 떨어지는 자탄 조각, 짙은 연기
function fxAirBurst(x, y, z) {
  fireSys.spawn(x, y, z, 0, 0, 0, 0.09, 2.5, 8, 12, 11, 9, 1, 0, 0, 0, 0, 0.6, -100);           // 하얀 섬광
  fireSys.spawn(x, y, z, 0, 1, 0, 0.38, 3, 7, 9, 4.8, 1.8, 1, -2, 1.5, rr(-1, 1), 0, 0.6, -100);    // 불덩이
  for (let i = 0; i < 22; i++) {                                                                 // 사방으로 튀는 불티
    const a = rnd() * TAU, e = rr(-0.6, 0.9), sp = rr(22, 46), c = Math.cos(e);
    fireSys.spawn(x, y, z, Math.cos(a) * c * sp, Math.sin(e) * sp, Math.sin(a) * c * sp, rr(0.35, 0.7), rr(0.4, 0.8), 0.15, 12, 9, 5, 1, 12, 1.2, 0, 0.06, 0.4, -100);
  }
  for (let i = 0; i < 6; i++) {                                                                  // 흩어져 떨어지며 타는 자탄 조각
    const a = rnd() * TAU, sp = rr(6, 14);
    fireSys.spawn(x, y, z, Math.cos(a) * sp, rr(2, 8), Math.sin(a) * sp, rr(0.9, 1.5), 0.9, 0.4, 13, 12, 10, 1, 14, 0.6, 0, 0.03, 0.4, -100);
  }
  for (let i = 0; i < 7; i++) {                                                                  // 짙은 연기
    const g = rr(0.32, 0.5);
    smokeSys.spawn(x + rr(-1.5, 1.5), y + rr(-1, 1), z + rr(-1.5, 1.5), rr(-3, 3), rr(-1, 2.5), rr(-3, 3), rr(2.0, 3.0), 2, rr(6, 9), g, g, g, 0.7, -0.4, 1.6, rr(-1, 1), 0, 0.9, -100);
  }
  Sound.playAt('explosion', x, z, 0.9, rr(1.2, 1.4));
  addTraumaAt(x, z, 0.3);
}

// 플레어에 속은 미사일이 터졌을 때: 가까우면 약한 충격 데미지만
function flareShock(m, x, z) {
  const F = CONFIG.flare, P = player;
  if (!P.alive) return;
  const d = Math.max(0, Math.hypot(P.x - x, P.z - z) - P.M.L * 0.3);
  if (d < F.shockR) damageBoat(P, m.dmg * F.shockMax * (1 - d / F.shockR), m.sx, m.sz, false);
}
