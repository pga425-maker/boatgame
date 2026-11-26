
/* ==========================================================================
 * 섬과 암초 — 판마다 바다 곳곳에 섬 몇 개와 암초 지대를 놓는다
 * 섬: 탄·포탄·미사일을 막는다. 배가 부딪히면 밀려나고 세게 부딪히면 피해
 * 암초: 수면 위로 삐죽 나온 바위들. 걸리면 배가 거의 멈추고 피해 (적도 같다)
 * 쏘면 돌 조각이 튀고 흙먼지가 피어오른다
 * ========================================================================== */
const ISLES = [], REEFS = [];
let isleGroup = null, isleMat = null, isleSeed = 1;
const DEB_MAX = 220;
let debMesh = null, debN = 0;
const debP = new Float32Array(DEB_MAX * 3), debV = new Float32Array(DEB_MAX * 3), debR = new Float32Array(DEB_MAX * 3), debW = new Float32Array(DEB_MAX * 3);
const debS = new Float32Array(DEB_MAX), debL = new Float32Array(DEB_MAX);
const _dm = new THREE.Matrix4(), _dq = new THREE.Quaternion(), _de = new THREE.Euler(), _dv = new THREE.Vector3(), _ds = new THREE.Vector3();

// 섬 둘레 반지름 (각도에 따라 들쭉날쭉)
function isleRad(I, a) { return I.r * (1 + I.k1 * Math.sin(3 * a + I.p1) + I.k2 * Math.sin(5 * a + I.p2) + 0.05 * Math.sin(9 * a + I.p3)); }
// 섬 땅 높이 (섬 밖이면 -99)
function isleH(I, x, z) {
  const dx = x - I.x, dz = z - I.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > I.r * 1.35) return -99;
  const R = isleRad(I, Math.atan2(dz, dx)), u = d / R;
  if (u >= 1.04) return -99;
  const base = Math.pow(Math.max(0, 1 - u * u), 0.75);
  return I.h * base * (0.82 + 0.18 * Math.sin(dx * 0.05 + I.p1) * Math.cos(dz * 0.045 + I.p2)) - 1.6 + 1.6 * (u < 1 ? 1 : 0);
}

function initIsles() {
  isleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
  isleGroup = new THREE.Group(); scene.add(isleGroup);
  // 돌 조각: 모양이 다른 작은 바위 하나를 여러 번 그린다
  const g = new THREE.IcosahedronGeometry(0.5, 0), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const k = 0.7 + Math.random() * 0.6; P.setXYZ(i, P.getX(i) * k, P.getY(i) * k * 0.8, P.getZ(i) * k); }
  g.computeVertexNormals();
  debMesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), DEB_MAX);
  debMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); debMesh.count = 0; debMesh.frustumCulled = false;
  const c = new THREE.Color();
  for (let i = 0; i < DEB_MAX; i++) { const v = 0.22 + Math.random() * 0.18; c.setRGB(v * 1.05, v * 0.95, v * 0.82); debMesh.setColorAt(i, c); }
  scene.add(debMesh);
}

// 판마다 새로 놓는다 (이어하기·코드는 같은 seed로 같은 바다를 만든다)
function islesBuild(seed) {
  isleSeed = seed >>> 0;
  const rng = makeRng(isleSeed), C = CONFIG.isles, lim = HALF - 320, rr2 = (a, b) => a + (b - a) * rng();
  for (let i = isleGroup.children.length - 1; i >= 0; i--) { const m = isleGroup.children[i]; isleGroup.remove(m); if (m.geometry) m.geometry.dispose(); }
  ISLES.length = 0; REEFS.length = 0;
  const free = function (x, z, r) {
    if (Math.hypot(x, z) < C.clearR + r) return false;          // 시작 자리 둘레는 비운다
    for (const I of ISLES) if (Math.hypot(x - I.x, z - I.z) < I.r * 1.3 + r + 120) return false;
    for (const R of REEFS) if (Math.hypot(x - R.x, z - R.z) < R.R + r + 90) return false;
    return true;
  };
  for (let i = 0; i < C.n; i++) {
    for (let t = 0; t < 60; t++) {
      const r = rr2(C.r[0], C.r[1]), x = rr2(-lim, lim), z = rr2(-lim, lim);
      if (!free(x, z, r * 1.3)) continue;
      const I = { x: x, z: z, r: r, h: rr2(C.h[0], C.h[1]) * (r / 110), k1: rr2(0.08, 0.2), k2: rr2(0.04, 0.12), p1: rng() * TAU, p2: rng() * TAU, p3: rng() * TAU, green: rng() < 0.75 };
      ISLES.push(I); isleGroup.add(isleMesh(I, rng));
      break;
    }
  }
  for (let i = 0; i < C.reefs; i++) {
    for (let t = 0; t < 60; t++) {
      const R = rr2(C.reefR[0], C.reefR[1]), x = rr2(-lim, lim), z = rr2(-lim, lim);
      if (!free(x, z, R)) continue;
      const rf = { x: x, z: z, R: R, rocks: [] }, n = Math.round(rr2(C.rocks[0], C.rocks[1]));
      for (let k = 0; k < n; k++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * R, s = rr2(2.2, 5.5);
        rf.rocks.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, r: s, top: rr2(0.6, 2.8) });
      }
      REEFS.push(rf); isleGroup.add(reefMesh(rf, rng));
      break;
    }
  }
}

// 섬 모양: 가운데에서 바깥으로 고리를 이어 만든 언덕. 모래 해변 → 바위 → 풀 덮인 꼭대기
function isleMesh(I, rng) {
  const RINGS = 14, SEC = 56, pos = [], col = [], idx = [];
  const sand = new THREE.Color(0xc9b48a).convertSRGBToLinear(), rock = new THREE.Color(0x6f675c).convertSRGBToLinear(), rock2 = new THREE.Color(0x544d45).convertSRGBToLinear();
  const grass = new THREE.Color(0x4d6b33).convertSRGBToLinear(), grass2 = new THREE.Color(0x3a5527).convertSRGBToLinear(), c = new THREE.Color();
  pos.push(0, I.h * 0.98, 0);
  const top = I.green ? grass : rock;
  col.push(top.r, top.g, top.b);
  for (let r = 1; r <= RINGS + 1; r++) {
    const u = r <= RINGS ? r / RINGS : 1.12;
    for (let s = 0; s < SEC; s++) {
      const a = s / SEC * TAU, R = isleRad(I, a) * u, x = Math.cos(a) * R, z = Math.sin(a) * R;
      let y = r <= RINGS ? isleH(I, I.x + x, I.z + z) : -6;
      if (y < -90) y = -2;
      y += (rng() - 0.5) * Math.min(3, I.h * 0.06) * (u < 0.95 ? 1 : 0.2);
      pos.push(x, y, z);
      const slope = u > 0.55 && u < 0.92;
      if (y < 1.8) c.copy(sand);
      else if (I.green && u < 0.6) c.copy(rng() < 0.5 ? grass : grass2);
      else c.copy(slope || rng() < 0.4 ? rock2 : rock);
      const j = 0.9 + rng() * 0.2; col.push(c.r * j, c.g * j, c.b * j);
    }
  }
  for (let s = 0; s < SEC; s++) idx.push(0, 1 + (s + 1) % SEC, 1 + s);
  for (let r = 0; r < RINGS; r++) for (let s = 0; s < SEC; s++) {
    const a = 1 + r * SEC + s, b = 1 + r * SEC + (s + 1) % SEC, c2 = a + SEC, d = b + SEC;
    idx.push(a, b, c2, b, d, c2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, isleMat); m.position.set(I.x, 0, I.z);
  // 큰 섬: 바위 덩어리와 나무 몇 그루
  if (I.green) {
    const tg = new GeoBuilder(), trunk = sRGB(0x4a3a2a), leaf = sRGB(0x2f4a22), leaf2 = sRGB(0x3f5e2a);
    const n = Math.round(I.r / 10);
    for (let k = 0; k < n; k++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * I.r * 0.55, x = Math.cos(a) * d, z = Math.sin(a) * d, y = isleH(I, I.x + x, I.z + z);
      if (y < 3) continue;
      const hgt = 4 + rng() * 5;
      tg.cyl(0.25, 0.4, hgt * 0.5, 5, x, y + hgt * 0.25, z, trunk);
      tg.cyl(0, hgt * 0.32, hgt * 0.75, 6, x, y + hgt * 0.75, z, rng() < 0.5 ? leaf : leaf2);
    }
    m.add(new THREE.Mesh(tg.build(), boatMat));
  }
  return m;
}

// 암초: 들쭉날쭉한 바위 여러 개
function reefMesh(rf, rng) {
  const gb = new GeoBuilder(), a = sRGB(0x4b4640), b = sRGB(0x3a3631), moss = sRGB(0x4a5a3a);
  for (const k of rf.rocks) {
    const g = new THREE.DodecahedronGeometry(k.r, 0), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) * (0.7 + rng() * 0.5), P.getY(i) * (0.6 + rng() * 0.6), P.getZ(i) * (0.7 + rng() * 0.5));
    g.computeVertexNormals();
    _bm.makeRotationY(rng() * TAU); _bm.setPosition(k.x - rf.x, k.top - k.r * 0.55, k.z - rf.z);
    gb.add(g, rng() < 0.25 ? moss : (rng() < 0.5 ? a : b), _bm);
  }
  const m = new THREE.Mesh(gb.build(), isleMat); m.position.set(rf.x, 0, rf.z);
  return m;
}

/* ---------- 충돌 ---------- */
// 배 하나를 섬·암초에서 밀어낸다. 세게 부딪히면 피해
function isleCollide(b, dt) {
  if (!b.alive || b.submerged) return;
  const C = CONFIG.isles, half = b.M.L * 0.42;
  if (b.reefT > 0) b.reefT -= dt;
  for (let i = 0; i < ISLES.length; i++) {
    const I = ISLES[i], dx = b.x - I.x, dz = b.z - I.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    if (d > I.r * 1.35 + half) continue;
    const R = isleRad(I, Math.atan2(dz, dx)) + half;
    if (d >= R) continue;
    const nx = dx / d, nz = dz / d, vin = -(b.vx * nx + b.vz * nz);
    b.x = I.x + nx * R; b.z = I.z + nz * R;
    if (vin > 0) { b.vx += nx * vin * 1.15; b.vz += nz * vin * 1.15; }
    b.vx *= 0.6; b.vz *= 0.6;
    if (vin > 7 && !(b.reefT > 0)) { b.reefT = 1; isleHurt(b, (vin - 7) * C.hitDmg * 3, b.x - nx * half, b.z - nz * half); }
  }
  for (let i = 0; i < REEFS.length; i++) {
    const rf = REEFS[i];
    if (Math.abs(b.x - rf.x) > rf.R + half + 8 || Math.abs(b.z - rf.z) > rf.R + half + 8) continue;
    for (let k = 0; k < rf.rocks.length; k++) {
      const q = rf.rocks[k], dx = b.x - q.x, dz = b.z - q.z, d = Math.sqrt(dx * dx + dz * dz) || 1, R = q.r * 0.8 + half * 0.8;
      if (d >= R) continue;
      const nx = dx / d, nz = dz / d, sp = Math.hypot(b.vx, b.vz);
      b.x = q.x + nx * R; b.z = q.z + nz * R;
      b.vx = (b.vx + nx * 3) * C.reefStopK; b.vz = (b.vz + nz * 3) * C.reefStopK;     // 암초에 걸려 거의 멈춘다
      if (!(b.reefT > 0) && sp > 3) { b.reefT = 1.2; isleHurt(b, C.reefDmg + sp * C.reefSpeedDmg, q.x + nx * q.r * 0.6, q.z + nz * q.r * 0.6, true); }
    }
  }
}
function isleHurt(b, dmg, x, z, reef) {
  const y = waveHeight(x, z, simTime) + 0.6;
  debrisBurst(x, y, z, reef ? 10 : 6, 0.5, 1);
  fxSplashSmall(x, y, z, 1.2);
  Sound.playAt('slam', x, z, 1.0, 0.75); Sound.playAt('clank', x, z, 0.8, 0.6);
  if (b.isPlayer) { Cam.trauma = Math.min(1, Cam.trauma + 0.45); Hud.toast(reef ? '암초에 걸렸습니다' : '섬에 부딪혔습니다'); }
  DSRC = 'reef';
  damageBoat(b, dmg * (b.isPlayer ? 1 : 1.4), x, z, false);
  DSRC = 'item';
  if (!b.isPlayer && !b.alive) achStat('reefKill', 1);
}

// 적 AI가 섬·암초를 피해 가는 방향 (가까울수록 세게)
function isleAvoid(b, out) {
  let ax = 0, az = 0;
  const half = b.M.L * 0.5;
  for (let i = 0; i < ISLES.length; i++) {
    const I = ISLES[i], dx = b.x - I.x, dz = b.z - I.z, d = Math.sqrt(dx * dx + dz * dz) || 1, R = isleRad(I, Math.atan2(dz, dx)) + half;
    const m = 110;
    if (d < R + m) { const k = (1 - (d - R) / m) * 2.4; ax += dx / d * k; az += dz / d * k; }
  }
  for (let i = 0; i < REEFS.length; i++) {
    const rf = REEFS[i], dx = b.x - rf.x, dz = b.z - rf.z, d = Math.sqrt(dx * dx + dz * dz) || 1, R = rf.R + half;
    const m = 45;                                       // 암초는 늦게 알아챈다 (그래서 가끔 걸린다)
    if (d < R + m) { const k = (1 - (d - R) / m) * 1.3; ax += dx / d * k; az += dz / d * k; }
  }
  out.x = ax; out.z = az;
}
// 빈 바다로 옮긴다 (적이 섬 안에 생기지 않게)
function isleFree(x, z, pad) {
  for (let i = 0; i < ISLES.length; i++) {
    const I = ISLES[i], dx = x - I.x, dz = z - I.z, d = Math.sqrt(dx * dx + dz * dz) || 1, R = isleRad(I, Math.atan2(dz, dx)) + pad;
    if (d < R) { x = I.x + dx / d * R; z = I.z + dz / d * R; }
  }
  for (let i = 0; i < REEFS.length; i++) {
    const rf = REEFS[i], dx = x - rf.x, dz = z - rf.z, d = Math.sqrt(dx * dx + dz * dz) || 1, R = rf.R + pad;
    if (d < R) { x = rf.x + dx / d * R; z = rf.z + dz / d * R; }
  }
  _mm.x = x; _mm.y = z;
  return _mm;
}

/* ---------- 탄이 섬·바위에 맞았는지 ----------
 * 맞으면 맞은 자리(ISLE_HIT)를 남기고 참 */
const ISLE_HIT = { x: 0, y: 0, z: 0, rock: false };
function isleSeg(ox, oy, oz, nx, ny, nz) {
  if (ny > 60 && oy > 60) return false;
  for (let i = 0; i < ISLES.length; i++) {
    const I = ISLES[i], R = I.r * 1.35;
    const mx = (ox + nx) * 0.5 - I.x, mz = (oz + nz) * 0.5 - I.z, hl = Math.hypot(nx - ox, nz - oz) * 0.5;
    if (mx * mx + mz * mz > (R + hl) * (R + hl)) continue;
    // 선분을 몇 조각으로 나눠 땅 높이 아래로 들어간 첫 자리
    const n = Math.max(2, Math.ceil(hl / 3));
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = ox + (nx - ox) * t, y = oy + (ny - oy) * t, z = oz + (nz - oz) * t;
      const h = isleH(I, x, z);
      if (h > -50 && y < h) { ISLE_HIT.x = x; ISLE_HIT.y = h; ISLE_HIT.z = z; ISLE_HIT.rock = false; return true; }
    }
  }
  if (ny > 6 && oy > 6) return false;
  for (let i = 0; i < REEFS.length; i++) {
    const rf = REEFS[i];
    if (Math.abs(nx - rf.x) > rf.R + 8 || Math.abs(nz - rf.z) > rf.R + 8) continue;
    for (let k = 0; k < rf.rocks.length; k++) {
      const q = rf.rocks[k], dx = nx - q.x, dz = nz - q.z;
      if (dx * dx + dz * dz < q.r * q.r * 0.8 && ny < q.top) { ISLE_HIT.x = nx; ISLE_HIT.y = Math.max(ny, 0); ISLE_HIT.z = nz; ISLE_HIT.rock = true; return true; }
    }
  }
  return false;
}
// 두 점 사이를 섬이 가리는지 (적이 섬 뒤를 못 본다)
function isleBlocks(ax, ay, az, bx, by, bz) {
  for (let i = 0; i < ISLES.length; i++) {
    const I = ISLES[i], R = I.r;
    const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
    const t = clamp(((I.x - ax) * vx + (I.z - az) * vz) / L2, 0, 1), px = ax + vx * t, pz = az + vz * t;
    if ((px - I.x) * (px - I.x) + (pz - I.z) * (pz - I.z) > R * R) continue;
    if (ay + (by - ay) * t < isleH(I, px, pz)) return true;
  }
  return false;
}

/* ---------- 돌 조각과 흙먼지 ---------- */
// n: 조각 수, s: 크기, k: 튀는 세기
function debrisBurst(x, y, z, n, s, k) {
  const lod = lodAt(x, z);
  n = Math.max(1, Math.round(n * (0.4 + 0.6 * lod)));
  for (let i = 0; i < n && debN < DEB_MAX; i++) {
    const j = debN++, j3 = j * 3, a = rnd() * TAU, e = rr(0.3, 1), sp = rr(5, 16) * k;
    debP[j3] = x + rr(-0.5, 0.5); debP[j3 + 1] = y + 0.3; debP[j3 + 2] = z + rr(-0.5, 0.5);
    debV[j3] = Math.cos(a) * sp * (1 - e * 0.5); debV[j3 + 1] = e * sp * 1.1 + 3; debV[j3 + 2] = Math.sin(a) * sp * (1 - e * 0.5);
    debR[j3] = rnd() * TAU; debR[j3 + 1] = rnd() * TAU; debR[j3 + 2] = 0;
    debW[j3] = rr(-12, 12); debW[j3 + 1] = rr(-12, 12); debW[j3 + 2] = rr(-12, 12);
    debS[j] = s * rr(0.4, 1.3); debL[j] = rr(1.6, 2.8);
  }
  // 흙먼지: 누런 회색 연기가 낮게 퍼진다
  const nd = Math.round((2 + n * 0.5) * (0.5 + 0.5 * lod));
  for (let i = 0; i < nd; i++) {
    const g = rr(0.42, 0.56);
    smokeSys.spawn(x + rr(-1, 1) * s * 3, y + rr(0, 1), z + rr(-1, 1) * s * 3, rr(-2, 2) * k, rr(0.5, 3) * k, rr(-2, 2) * k,
      rr(1.4, 2.6), 0.8 * s + 0.6, (3 + 5 * s) * k, g * 1.08, g * 0.98, g * 0.82, 0.55, -0.15, 1.2, rr(-1, 1), 0, 0.9, -100);
  }
  // 바위에 튀는 작은 불꽃
  for (let i = 0; i < 3; i++) fireSys.spawn(x, y + 0.2, z, rr(-6, 6), rr(2, 8), rr(-6, 6), rr(0.1, 0.22), 0.25, 0.05, 10, 7, 3, 1, 14, 0.5, 0, 0.04, 0.3, -100);
}
// 탄이 섬·바위에 맞았을 때
function isleBulletFx(big) {
  const H = ISLE_HIT;
  if (big) {
    debrisBurst(H.x, H.y, H.z, 22, 1.1, 1.6);
    fireSys.spawn(H.x, H.y + 1, H.z, 0, 0, 0, 0.16, 6, 13, 10, 7.5, 4.5, 1, 0, 0, 0, 0, 0.6, -100);
    for (let i = 0; i < 6; i++) { const g = rr(0.06, 0.14); smokeSys.spawn(H.x + rr(-2, 2), H.y + rr(0.5, 2), H.z + rr(-2, 2), rr(-2, 2), rr(3, 7), rr(-2, 2), rr(2.2, 3.6), 2.5, 9, g, g, g, 0.7, -1.2, 0.8, rr(-0.7, 0.7), 0, 0.9, -100); }
    Sound.playAt('explosion', H.x, H.z, 0.8, rr(1.05, 1.25));
    addTraumaAt(H.x, H.z, 0.35);
  } else {
    debrisBurst(H.x, H.y, H.z, 3, 0.28, 0.8);
    Sound.playAt('ping', H.x, H.z, 0.35, rr(0.5, 0.7));
  }
}

function islesUpdate(dt) {
  if (!debMesh) return;
  // 돌 조각: 포물선으로 날다가 물에 퐁, 섬 땅에는 한 번 튕긴다
  let i = 0;
  while (i < debN) {
    const i3 = i * 3;
    debL[i] -= dt;
    debV[i3 + 1] -= 24 * dt;
    debP[i3] += debV[i3] * dt; debP[i3 + 1] += debV[i3 + 1] * dt; debP[i3 + 2] += debV[i3 + 2] * dt;
    debR[i3] += debW[i3] * dt; debR[i3 + 1] += debW[i3 + 1] * dt; debR[i3 + 2] += debW[i3 + 2] * dt;
    let dead = debL[i] <= 0;
    if (!dead && debV[i3 + 1] < 0) {
      let ground = -99;
      for (let k = 0; k < ISLES.length; k++) { const h = isleH(ISLES[k], debP[i3], debP[i3 + 2]); if (h > ground) ground = h; }
      if (ground > -50 && debP[i3 + 1] < ground) { debP[i3 + 1] = ground; debV[i3 + 1] *= -0.3; debV[i3] *= 0.5; debV[i3 + 2] *= 0.5; debW[i3] *= 0.5; if (Math.abs(debV[i3 + 1]) < 1.5) debL[i] = Math.min(debL[i], 0.6); }
      else if (debP[i3 + 1] < 0.2) { if (debS[i] > 0.5 && rnd() < 0.5) fxSplashSmall(debP[i3], 0.2, debP[i3 + 2], 0.4); dead = true; }
    }
    if (dead) {
      const l = --debN, l3 = l * 3;
      if (i !== l) {
        for (let q = 0; q < 3; q++) { debP[i3 + q] = debP[l3 + q]; debV[i3 + q] = debV[l3 + q]; debR[i3 + q] = debR[l3 + q]; debW[i3 + q] = debW[l3 + q]; }
        debS[i] = debS[l]; debL[i] = debL[l];
      }
      continue;
    }
    const sc = debS[i] * Math.min(1, debL[i] * 3);
    _de.set(debR[i3], debR[i3 + 1], debR[i3 + 2]); _dq.setFromEuler(_de);
    _dm.compose(_dv.set(debP[i3], debP[i3 + 1], debP[i3 + 2]), _dq, _ds.set(sc, sc, sc));
    debMesh.setMatrixAt(i, _dm);
    i++;
  }
  debMesh.count = debN;
  if (debN) debMesh.instanceMatrix.needsUpdate = true;
  // 암초 둘레의 하얀 파도 거품
  for (let k = 0; k < REEFS.length; k++) {
    const rf = REEFS[k];
    if (rnd() > dt * 6) continue;
    const q = rf.rocks[(rnd() * rf.rocks.length) | 0], a = rnd() * TAU;
    const x = q.x + Math.cos(a) * q.r * 0.9, z = q.z + Math.sin(a) * q.r * 0.9;
    if (Math.hypot(x - camera.position.x, z - camera.position.z) > 500) continue;
    spraySys.spawn(x, 0.3, z, Math.cos(a) * rr(1, 3), rr(1.5, 4), Math.sin(a) * rr(1, 3), rr(0.6, 1.1), rr(0.3, 0.6), 0.15, 1, 1, 1, 0.8, 9, 0.6, 0, 0.04, 0, -0.5);
    if (rnd() < 0.3) foamDecal(x, z, 1, 5, 3, 0.7, 0, 0.5);
  }
}
function islesClear() { debN = 0; if (debMesh) debMesh.count = 0; }
