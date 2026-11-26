
/* ==========================================================================
 * 파티클 — 미리 만들어 둔 풀을 재사용한다 (실행 중 새로 만들지 않음, 최대 개수 고정)
 * 사각형 하나를 인스턴싱으로 여러 번 그리고, 입자 정보는 Float32Array에 담는다
 * ========================================================================== */
const SPRITE_VS =
  'attribute vec3 iPos;\nattribute vec3 iVel;\nattribute vec4 iCol;\nattribute vec4 iMisc;\n' +   // iMisc: 크기, 회전, 늘어남, 부드러움+무늬 씨앗
  'uniform vec3 uSunDir;\nuniform vec3 uLit;\nuniform vec3 uBack;\nuniform float uFogDensity;\n' +
  'varying vec2 vUv;\nvarying vec4 vCol;\nvarying vec2 vSoft;\n' +
  'void main(){\n' +
  '  vec4 mv = viewMatrix * vec4(iPos, 1.0);\n' +
  '  vec2 corner = position.xy;\n' +
  '  float size = iMisc.x;\n' +
  '  vec2 off;\n' +
  '  if (iMisc.z > 0.0) {\n' +                                   // 빠른 물방울은 진행 방향으로 길게 늘인다
  '    vec3 vv = (viewMatrix * vec4(iVel, 0.0)).xyz;\n' +
  '    float sp = length(vv.xy);\n' +
  '    vec2 ax = sp > 0.0001 ? vv.xy / sp : vec2(0.0, 1.0);\n' +
  '    vec2 ay = vec2(-ax.y, ax.x);\n' +
  '    off = ax * corner.y * size * (1.0 + iMisc.z * sp) + ay * corner.x * size;\n' +
  '  } else {\n' +
  '    float c = cos(iMisc.y);\n    float s = sin(iMisc.y);\n' +
  '    off = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * size;\n' +
  '  }\n' +
  '  mv.xy += off;\n' +
  '  gl_Position = projectionMatrix * mv;\n' +
  '  vUv = corner + 0.5;\n' +
  '  vec3 vd = normalize(iPos - cameraPosition);\n' +
  '  float back = pow(max(dot(vd, uSunDir), 0.0), 5.0);\n' +     // 해를 등지고 보면 역광으로 빛난다
  '  float fd = length(mv.xyz) * uFogDensity;\n' +
  '  vCol = vec4(iCol.rgb * (uLit + uBack * back), iCol.a * exp(-fd * fd));\n' +
  '  vSoft = vec2(fract(iMisc.w), floor(iMisc.w) / 16.0);\n' +
  '}\n';

const SPRITE_FS =
  'uniform sampler2D tNoise;\nvarying vec2 vUv;\nvarying vec4 vCol;\nvarying vec2 vSoft;\n' +
  'void main(){\n' +
  '  float d = length(vUv * 2.0 - 1.0);\n' +
  '  float a = 1.0 - smoothstep(mix(0.5, 0.12, vSoft.x), 1.0, d);\n' +
  '  if (vSoft.x > 0.5) {\n' +
  '    float n = texture2D(tNoise, vUv * 0.33 + vSoft.y * vec2(3.7, 6.1)).g * 0.62 + texture2D(tNoise, vUv * 1.07 + vSoft.y * vec2(5.3, 2.9)).b * 0.38;\n' +
  '    a *= clamp(0.25 + 1.5 * n, 0.0, 1.25);\n' +
  '  }\n' +
  '  a *= vCol.a;\n' +
  '  if (a < 0.004) discard;\n' +
  '  #ifdef ADDITIVE\n  gl_FragColor = vec4(vCol.rgb * a, 1.0);\n  #else\n  gl_FragColor = vec4(vCol.rgb, a);\n  #endif' + GLSL_OUT +
  '}\n';

function ParticleSystem(max, lit, back, additive, fadeIn, fadeMode, order) {
  this.max = max; this.n = 0;
  this.fadeIn = fadeIn;       // 수명의 이 비율 동안 서서히 나타남 (0이면 바로)
  this.fadeMode = fadeMode;   // 사라지는 곡선: 0 보통, 1 빨리
  this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
  this.col = new Float32Array(max * 4); this.misc = new Float32Array(max * 4);
  this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
  this.size0 = new Float32Array(max); this.size1 = new Float32Array(max);
  this.alpha0 = new Float32Array(max); this.grav = new Float32Array(max);
  this.drag = new Float32Array(max); this.spin = new Float32Array(max); this.floorY = new Float32Array(max);

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
  this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3); this.aPos.setUsage(THREE.DynamicDrawUsage);
  this.aVel = new THREE.InstancedBufferAttribute(this.vel, 3); this.aVel.setUsage(THREE.DynamicDrawUsage);
  this.aCol = new THREE.InstancedBufferAttribute(this.col, 4); this.aCol.setUsage(THREE.DynamicDrawUsage);
  this.aMisc = new THREE.InstancedBufferAttribute(this.misc, 4); this.aMisc.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', this.aPos); geo.setAttribute('iVel', this.aVel);
  geo.setAttribute('iCol', this.aCol); geo.setAttribute('iMisc', this.aMisc);
  geo.instanceCount = 0;
  this.geo = geo;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: SUN_DIR }, uLit: { value: lit }, uBack: { value: back }, uFogDensity: uFog, tNoise: { value: texNoise } },
    vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  if (additive) mat.defines = { ADDITIVE: 1 };
  this.mesh = new THREE.Mesh(geo, mat);
  this.mesh.frustumCulled = false;
  this.mesh.renderOrder = order;
  scene.add(this.mesh);
}

// 입자 하나를 풀에서 꺼내 쓴다. 풀이 가득 차면 그냥 버린다
// 가벼운 모드(기기가 버거울 때 자동): 작은 입자는 절반만 만든다. 큰 섬광·폭발 중심(size1 6 이상)은 그대로
let FX_LITE = LITE_ON;
ParticleSystem.prototype.spawn = function (x, y, z, vx, vy, vz, life, size0, size1, r, g, b, alpha, grav, drag, spin, stretch, soft, floorY) {
  if (this.n >= this.max) return;
  if (FX_LITE && size1 < 6 && Math.random() < 0.5) return;
  const i = this.n++, i3 = i * 3, i4 = i * 4;
  this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
  this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
  this.col[i4] = r; this.col[i4 + 1] = g; this.col[i4 + 2] = b; this.col[i4 + 3] = this.fadeIn > 0 ? 0 : alpha;
  this.misc[i4] = size0; this.misc[i4 + 1] = rnd() * TAU; this.misc[i4 + 2] = stretch;
  this.misc[i4 + 3] = (soft > 0.98 ? 0.98 : soft) + ((rnd() * 16) | 0);
  this.life[i] = life; this.maxLife[i] = life; this.size0[i] = size0; this.size1[i] = size1;
  this.alpha0[i] = alpha; this.grav[i] = grav; this.drag[i] = drag; this.spin[i] = spin; this.floorY[i] = floorY;
};

ParticleSystem.prototype.move = function (s, d) {
  const s3 = s * 3, d3 = d * 3, s4 = s * 4, d4 = d * 4;
  const pos = this.pos, vel = this.vel, col = this.col, misc = this.misc;
  pos[d3] = pos[s3]; pos[d3 + 1] = pos[s3 + 1]; pos[d3 + 2] = pos[s3 + 2];
  vel[d3] = vel[s3]; vel[d3 + 1] = vel[s3 + 1]; vel[d3 + 2] = vel[s3 + 2];
  col[d4] = col[s4]; col[d4 + 1] = col[s4 + 1]; col[d4 + 2] = col[s4 + 2]; col[d4 + 3] = col[s4 + 3];
  misc[d4] = misc[s4]; misc[d4 + 1] = misc[s4 + 1]; misc[d4 + 2] = misc[s4 + 2]; misc[d4 + 3] = misc[s4 + 3];
  this.life[d] = this.life[s]; this.maxLife[d] = this.maxLife[s]; this.size0[d] = this.size0[s]; this.size1[d] = this.size1[s];
  this.alpha0[d] = this.alpha0[s]; this.grav[d] = this.grav[s]; this.drag[d] = this.drag[s]; this.spin[d] = this.spin[s];
  this.floorY[d] = this.floorY[s];
};

// 중력을 받아 포물선으로 떨어지고 점점 투명해진다. 수면(floorY) 아래로 내려간 물방울은 사라진다
ParticleSystem.prototype.update = function (dt, windX, windZ) {
  const pos = this.pos, vel = this.vel, col = this.col, misc = this.misc;
  const life = this.life, maxLife = this.maxLife, s0 = this.size0, s1 = this.size1, a0 = this.alpha0;
  const grav = this.grav, drag = this.drag, spin = this.spin, floorY = this.floorY;
  const fadeIn = this.fadeIn, fadeMode = this.fadeMode;
  let n = this.n, i = 0;
  while (i < n) {
    const i3 = i * 3, i4 = i * 4;
    const l = life[i] - dt;
    if (l <= 0 || (pos[i3 + 1] < floorY[i] && vel[i3 + 1] < 0)) {
      n--;
      if (i !== n) this.move(n, i);
      continue;
    }
    life[i] = l;
    let k = 1 - drag[i] * dt;
    if (k < 0) k = 0;
    const vx = vel[i3] * k + windX * (1 - k);
    const vy = vel[i3 + 1] * k - grav[i] * dt;
    const vz = vel[i3 + 2] * k + windZ * (1 - k);
    vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
    pos[i3] += vx * dt; pos[i3 + 1] += vy * dt; pos[i3 + 2] += vz * dt;
    const t = 1 - l / maxLife[i];
    const rest = 1 - t;
    let a = a0[i] * rest * (fadeMode === 1 ? rest : Math.sqrt(rest));
    if (fadeIn > 0 && t < fadeIn) a *= t / fadeIn;
    col[i4 + 3] = a;
    misc[i4] = s0[i] + (s1[i] - s0[i]) * Math.sqrt(t);
    misc[i4 + 1] += spin[i] * dt;
    i++;
  }
  this.n = n;
  this.geo.instanceCount = n;
  this.aPos.updateRange.offset = 0; this.aPos.updateRange.count = n * 3; this.aPos.needsUpdate = true;
  this.aVel.updateRange.offset = 0; this.aVel.updateRange.count = n * 3; this.aVel.needsUpdate = true;
  this.aCol.updateRange.offset = 0; this.aCol.updateRange.count = n * 4; this.aCol.needsUpdate = true;
  this.aMisc.updateRange.offset = 0; this.aMisc.updateRange.count = n * 4; this.aMisc.needsUpdate = true;
};

ParticleSystem.prototype.clear = function () { this.n = 0; this.geo.instanceCount = 0; };

let spraySys = null, mistSys = null, smokeSys = null, fireSys = null;
let TR_K = 1;                    // 예광탄 밝기 배율 (밤에는 밝게)
const _envBase = [];
// 배경에 맞춰 연기·물보라 밝기와 예광탄 밝기를 바꾼다
function envParticles(E) {
  const list = [smokeSys, mistSys, spraySys];
  for (let i = 0; i < list.length; i++) {
    const sys = list[i];
    if (!sys) continue;
    const u = sys.mesh.material.uniforms;
    if (!_envBase[i]) _envBase[i] = [u.uLit.value.clone(), u.uBack.value.clone()];
    u.uLit.value.copy(_envBase[i][0]).multiplyScalar(E.smoke);
    u.uBack.value.copy(_envBase[i][1]).multiplyScalar(E.smoke * (E.stars ? 0.3 : 1));
  }
  TR_K = E.tracer;
  if (tracerMat) applyTracerStyle();
}

function initParticles() {
  const q = CONFIG.quality;
  // 물은 하늘빛과 햇빛을 받는 흰색, 해 쪽으로 보면 역광으로 금빛이 돈다
  smokeSys = new ParticleSystem(q.maxSmoke, new THREE.Vector3(1, 1, 1), new THREE.Vector3(0.5, 0.36, 0.22), false, 0.1, 0, 10);
  mistSys = new ParticleSystem(q.maxMist, new THREE.Vector3(0.84, 0.88, 0.94), new THREE.Vector3(1.7, 1.2, 0.72), false, 0.12, 0, 11);
  spraySys = new ParticleSystem(q.maxSpray, new THREE.Vector3(0.90, 0.94, 1.0), new THREE.Vector3(2.4, 1.75, 1.05), false, 0, 0, 12);
  fireSys = new ParticleSystem(q.maxFire, new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0), true, 0, 0, 13);
}

/* ---------- 효과 묶음 ---------- */
// 카메라에서 멀수록 입자를 줄인다
function lodAt(x, z) {
  const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.sqrt(dx * dx + dz * dz);
  return (d < 180 ? 1 : (d > 700 ? 0.25 : 1 - 0.75 * (d - 180) / 520)) * CONFIG.quality.effectScale;
}

// 기관총탄이 물에 맞았을 때: 작은 물방울이 튄다
function fxSplashSmall(x, y, z, k) {
  const n = (4 + 6 * k) | 0;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, sp = rr(0.6, 3.4);
    spraySys.spawn(x, y + 0.05, z, Math.cos(a) * sp, rr(4, 11), Math.sin(a) * sp,
      rr(0.45, 0.9), rr(0.13, 0.3), 0.06, 1, 1, 1, rr(0.7, 1), 18, 0.5, 0, 0.05, 0, y - 0.3);
  }
  spraySys.spawn(x, y + 0.5, z, 0, rr(3.5, 6), 0, rr(0.35, 0.6), 0.5, 1.5, 1, 1, 1, 0.75, 14, 1.0, rr(-2, 2), 0, 0.7, -100);
  mistSys.spawn(x, y + 0.4, z, rr(-0.5, 0.5), rr(1.4, 2.8), rr(-0.5, 0.5),
    rr(0.5, 0.9), 0.7, 2.6, 1, 1, 1, 0.5, 1.5, 1.4, rr(-1, 1), 0, 0.9, -100);
  foamDecal(x, z, 0.35, 1.4, 1.7, 0.85, 0, 0.5);
}

// 포탄이 물에 떨어졌을 때: 높은 물기둥이 솟았다가 물방울로 흩어진다
function fxWaterColumn(x, z, s, t) {
  const y = waveHeight(x, z, t), k = lodAt(x, z), rs = Math.sqrt(s);
  // 가운데로 치솟는 물줄기
  let n = (120 * s * k) | 0;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, rad = rnd() * 1.7 * s, sp = rr(0.4, 4.6) * s;
    spraySys.spawn(x + Math.cos(a) * rad, y + rnd() * 2, z + Math.sin(a) * rad, Math.cos(a) * sp, rr(13, 37) * rs, Math.sin(a) * sp,
      rr(1.7, 3.1), rr(0.3, 0.85), 0.16, 1, 1, 1, rr(0.8, 1), 21, 0.25, 0, 0.03, 0, y - 0.5);
  }
  // 기둥의 몸통: 흰 물덩이를 촘촘히 쌓아 올린다
  n = (64 * s * k + 8) | 0;
  for (let i = 0; i < n; i++) {
    const f = i / n;
    spraySys.spawn(x + rr(-1.3, 1.3) * s, y + 0.6 + f * 5 * s, z + rr(-1.3, 1.3) * s, rr(-1.8, 1.8), rr(10, 31) * (0.4 + 0.6 * f) * rs, rr(-1.8, 1.8),
      rr(1.2, 2.5), rr(1.4, 2.3) * s, rr(3.0, 4.8) * s, 1, 1, 1, rr(0.85, 1), 17, 0.5, rr(-1.5, 1.5), 0, 0.72, -100);
  }
  // 기둥을 감싸고 오래 남는 물안개
  n = (26 * s * k + 6) | 0;
  for (let i = 0; i < n; i++) {
    const f = i / n;
    mistSys.spawn(x + rr(-1.4, 1.4) * s, y + 1.2 + f * 6 * s, z + rr(-1.4, 1.4) * s, rr(-1.3, 1.3), rr(7, 22) * (0.45 + f) * rs, rr(-1.3, 1.3),
      rr(1.7, 3.3), rr(2.6, 4.0) * s, rr(7, 11.5) * s, 1, 1, 1, rr(0.75, 1), 8.5, 0.9, rr(-0.8, 0.8), 0, 0.92, -100);
  }
  // 바닥에서 옆으로 퍼지는 물보라 고리
  n = (56 * s * k) | 0;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, sp = rr(6, 16) * rs, ca = Math.cos(a), sa = Math.sin(a);
    spraySys.spawn(x + ca * 1.2 * s, y + 0.2, z + sa * 1.2 * s, ca * sp, rr(3, 10), sa * sp,
      rr(0.7, 1.4), rr(0.22, 0.6), 0.1, 1, 1, 1, rr(0.75, 1), 17, 0.6, 0, 0.04, 0, y - 0.4);
  }
  foamDecal(x, z, 2.5 * s, 9 * s, 5.5, 1.25, 0, 0.45);
  foamDecal(x, z, 4 * s, 19 * s, 4.2, 0.9, 0.72, 0.22);
}

// 폭발: 섬광, 불덩이, 불티, 검은 연기
function fxExplosion(x, y, z, s) {
  const rs = Math.sqrt(s);
  fireSys.spawn(x, y + 1, z, 0, 0, 0, 0.16, 8 * s, 17 * s, 10, 7.5, 4.5, 1, 0, 0, 0, 0, 0.6, -100);
  let n = (18 * s + 5) | 0;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, e = rr(0.05, 1), ce = Math.sqrt(1 - e * e), dx = Math.cos(a) * ce, dz = Math.sin(a) * ce, sp = rr(3, 13) * s;
    fireSys.spawn(x + dx * s, y + 0.8 + e * s, z + dz * s, dx * sp, e * sp + 2, dz * sp,
      rr(0.5, 1.1), rr(1.8, 3.2) * s, rr(4.5, 7.5) * s, rr(3.4, 5.2), rr(1.2, 2.2), rr(0.22, 0.55), 1, -3, 2.2, rr(-2, 2), 0, 0.85, -100);
  }
  n = (32 * s) | 0;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, e = rr(0.05, 1), ce = Math.sqrt(1 - e * e), sp = rr(14, 42) * rs;
    fireSys.spawn(x, y + 1, z, Math.cos(a) * ce * sp, e * sp + 6, Math.sin(a) * ce * sp,
      rr(0.5, 1.3), rr(0.16, 0.34), 0.06, 7, 3.8, 1.1, 1, 20, 0.6, 0, 0.03, 0.1, y - 1.5);
  }
  n = (14 * s + 4) | 0;
  for (let i = 0; i < n; i++) {
    const g = rr(0.03, 0.12);
    smokeSys.spawn(x + rr(-1.5, 1.5) * s, y + rr(0.5, 2.5), z + rr(-1.5, 1.5) * s, rr(-2.5, 2.5), rr(3, 9), rr(-2.5, 2.5),
      rr(2.2, 4.4), rr(2, 3.4) * s, rr(7, 12) * s, g, g, g, rr(0.6, 0.85), -1.4, 0.8, rr(-0.7, 0.7), 0, 0.9, -100);
  }
  n = (28 * s) | 0;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, sp = rr(5, 13) * rs, ca = Math.cos(a), sa = Math.sin(a);
    spraySys.spawn(x + ca * 2 * s, y, z + sa * 2 * s, ca * sp, rr(3, 10), sa * sp,
      rr(0.7, 1.4), rr(0.2, 0.5), 0.1, 1, 1, 1, rr(0.7, 1), 17, 0.6, 0, 0.04, 0, y - 1.2);
  }
  foamDecal(x, z, 3 * s, 12 * s, 5, 1.0, 0, 0.4);
}

// 함포 발사: 포구 화염과 연기
function fxMuzzleCannon(x, y, z, dx, dy, dz, s) {
  fireSys.spawn(x + dx * 0.8, y + dy * 0.8, z + dz * 0.8, dx * 4, dy * 4, dz * 4, 0.11, 2.8 * s, 5.6 * s, 10, 7, 3.2, 1, 0, 0, 0, 0, 0.5, -100);
  for (let i = 0; i < 8; i++) {
    const sp = rr(18, 46);
    fireSys.spawn(x + dx * 0.5, y + dy * 0.5, z + dz * 0.5, dx * sp + rr(-3, 3), dy * sp + rr(-3, 3), dz * sp + rr(-3, 3),
      rr(0.1, 0.22), rr(0.9, 1.4) * s, rr(2.0, 2.9) * s, 6.5, 3.2, 0.9, 1, 0, 4, rr(-2, 2), 0, 0.7, -100);
  }
  for (let i = 0; i < 10; i++) {
    const sp = rr(16, 40);
    fireSys.spawn(x, y, z, dx * sp + rr(-9, 9), dy * sp + rr(-4, 9), dz * sp + rr(-9, 9),
      rr(0.25, 0.6), rr(0.12, 0.22), 0.05, 7, 3.8, 1.1, 1, 16, 1.2, 0, 0.03, 0.1, -100);
  }
  for (let i = 0; i < 11; i++) {
    const sp = rr(3, 15), g = rr(0.42, 0.62);
    smokeSys.spawn(x + dx * rr(0.3, 1.6), y + dy * rr(0.3, 1.6), z + dz * rr(0.3, 1.6), dx * sp + rr(-2.5, 2.5), dy * sp + rr(0, 3), dz * sp + rr(-2.5, 2.5),
      rr(1.2, 2.6), rr(0.8, 1.3) * s, rr(3.6, 5.6) * s, g, g, g * 0.97, rr(0.4, 0.58), -0.5, 1.7, rr(-0.9, 0.9), 0, 0.9, -100);
  }
}

// 기관총 총구 화염
function fxMuzzleMG(x, y, z, dx, dy, dz) {
  fireSys.spawn(x + dx * 0.35, y + dy * 0.35, z + dz * 0.35, dx * 7, dy * 7, dz * 7, 0.055, 0.7, 1.3, 8, 5, 1.7, 1, 0, 0, 0, 0, 0.3, -100);
}

// 탄이 선체에 맞았을 때 튀는 불티
function fxHitSpark(x, y, z) {
  fireSys.spawn(x, y, z, 0, 0, 0, 0.08, 0.9, 1.9, 9, 6, 2.6, 1, 0, 0, 0, 0, 0.4, -100);
  for (let i = 0; i < 6; i++) {
    fireSys.spawn(x, y, z, rr(-11, 11), rr(1, 12), rr(-11, 11), rr(0.18, 0.42), rr(0.1, 0.18), 0.04, 7, 4, 1.3, 1, 22, 0.8, 0, 0.035, 0.1, -100);
  }
  const g = rr(0.1, 0.2);
  smokeSys.spawn(x, y, z, rr(-1, 1), rr(1, 2.5), rr(-1, 1), rr(0.5, 0.9), 0.5, 1.7, g, g, g, 0.5, -0.5, 1.5, rr(-1, 1), 0, 0.9, -100);
}

// 장갑에 튕길 때: 밝은 불티가 더 많이, 더 멀리 튄다
function fxArmorSpark(x, y, z) {
  fireSys.spawn(x, y, z, 0, 0, 0, 0.06, 1.0, 2.6, 10, 9, 5, 1, 0, 0, 0, 0, 0.5, -100);
  for (let i = 0; i < 7; i++) {
    fireSys.spawn(x, y, z, rr(-20, 20), rr(4, 18), rr(-20, 20), rr(0.22, 0.4), rr(0.1, 0.16), 0.03, 10, 8, 4, 1, 24, 0.8, 0, 0.03, 0.1, -100);
  }
}

/* ==========================================================================
 * 탄 — 기관총 예광탄. 풀에서 꺼내 쓰고, 한 프레임에 지나간 선분으로 충돌을 본다
 * ========================================================================== */
const BUL_MAX = CONFIG.quality.maxBullets;
let bulN = 0;
const bulPos = new Float32Array(BUL_MAX * 3), bulVel = new Float32Array(BUL_MAX * 3);
const bulLife = new Float32Array(BUL_MAX), bulAge = new Float32Array(BUL_MAX), bulDmg = new Float32Array(BUL_MAX);
const bulAuto = new Uint8Array(BUL_MAX);     // 1 = 강화 카드 자동 무기(포탑·드론·아군 고속정)가 쏜 탄: 명중 표시 없음
let BUL_AUTO = 0;
const bulOwn = new Uint8Array(BUL_MAX);      // 0 = 플레이어가 쏜 탄, 1 = 적이 쏜 탄
const bulTgt = new Array(BUL_MAX).fill(null); // 락온 명중 탄이 따라가는 적 (없으면 null)
let tracerGeo = null, tracerPos = null, tracerTint = null, tracerAPos = null, tracerATint = null, tracerMat = null;
const TR_MAX = BUL_MAX + 48;          // 기관총 탄 + 포탄 (꼬리 + 빛점)

function initTracers() {
  tracerPos = new Float32Array(TR_MAX * 12);
  tracerTint = new Float32Array(TR_MAX * 4);
  const uv = new Float32Array(TR_MAX * 8), idx = new Uint16Array(TR_MAX * 6);
  for (let i = 0; i < TR_MAX; i++) {
    const u = i * 8, k = i * 6, v = i * 4;
    uv[u] = 0; uv[u + 1] = 0; uv[u + 2] = 1; uv[u + 3] = 0; uv[u + 4] = 1; uv[u + 5] = 1; uv[u + 6] = 0; uv[u + 7] = 1;
    idx[k] = v; idx[k + 1] = v + 1; idx[k + 2] = v + 2; idx[k + 3] = v; idx[k + 4] = v + 2; idx[k + 5] = v + 3;
  }
  tracerGeo = new THREE.BufferGeometry();
  tracerAPos = new THREE.BufferAttribute(tracerPos, 3); tracerAPos.setUsage(THREE.DynamicDrawUsage);
  tracerATint = new THREE.BufferAttribute(tracerTint, 1); tracerATint.setUsage(THREE.DynamicDrawUsage);
  tracerGeo.setAttribute('position', tracerAPos);
  tracerGeo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
  tracerGeo.setAttribute('aTint', tracerATint);
  tracerGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  tracerGeo.setDrawRange(0, 0);
  // aTint: 0 내 탄, 1 적 탄, 2 내 포탄, 3 적 포탄
  tracerMat = new THREE.ShaderMaterial({
    uniforms: { uC0: { value: new THREE.Vector3() }, uC1: { value: new THREE.Vector3() }, uC2: { value: new THREE.Vector3() }, uC3: { value: new THREE.Vector3() },
      uCore: { value: 5 }, uHalo: { value: 1.5 } },
    vertexShader:
      'attribute vec2 aUv;\nattribute float aTint;\nvarying vec2 vUv;\nvarying float vTint;\n' +
      'void main(){\n  vUv = aUv;\n  vTint = aTint;\n  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);\n}\n',
    fragmentShader:
      'uniform vec3 uC0;\nuniform vec3 uC1;\nuniform vec3 uC2;\nuniform vec3 uC3;\nuniform float uCore;\nuniform float uHalo;\n' +
      'varying vec2 vUv;\nvarying float vTint;\n' +
      'void main(){\n' +
      '  vec3 col = vTint < 0.5 ? uC0 : (vTint < 1.5 ? uC1 : (vTint < 2.5 ? uC2 : uC3));\n' +
      '  float across = 1.0 - abs(vUv.x * 2.0 - 1.0);\n' +
      '  float along = vUv.y;\n' +
      '  float a = pow(across, uHalo) * (0.12 + 0.88 * along * along) * smoothstep(1.0, 0.9, along);\n' +
      '  vec3 c = col * a + vec3(uCore) * pow(across, 6.0) * along * along * along;\n' +
      '  gl_FragColor = vec4(c, 1.0);' + GLSL_OUT +
      '}\n',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  applyTracerStyle();
  const mesh = new THREE.Mesh(tracerGeo, tracerMat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 14;
  scene.add(mesh);
}

// CONFIG.tracer 값을 셰이더에 반영한다 (런타임에 스타일을 바꿀 때도 호출)
function applyTracerStyle() {
  const T = CONFIG.tracer, U = tracerMat.uniforms;
  U.uC0.value.fromArray(T.mgP).multiplyScalar(TR_K); U.uC1.value.fromArray(T.mgE).multiplyScalar(TR_K);
  U.uC2.value.fromArray(T.shellP).multiplyScalar(TR_K); U.uC3.value.fromArray(T.shellE).multiplyScalar(TR_K);
  U.uCore.value = T.core; U.uHalo.value = T.halo * (TR_K > 1 ? 1 + (TR_K - 1) * 0.8 : 1);
}

// 포탄 예광제 빛점: 보통 섞기(알파)로 그려서 밝은 하늘 앞에서도 색이 하얗게 날아가지 않는다
let glowGeo = null, glowPos = null, glowTint = null, glowAPos = null, glowATint = null, trN = 0;
function initShellGlow() {
  const N = 24;
  glowPos = new Float32Array(N * 12); glowTint = new Float32Array(N * 4);
  const uv = new Float32Array(N * 8), idx = new Uint16Array(N * 6);
  for (let i = 0; i < N; i++) {
    const u = i * 8, k = i * 6, v = i * 4;
    uv[u] = 0; uv[u + 1] = 0; uv[u + 2] = 1; uv[u + 3] = 0; uv[u + 4] = 1; uv[u + 5] = 1; uv[u + 6] = 0; uv[u + 7] = 1;
    idx[k] = v; idx[k + 1] = v + 1; idx[k + 2] = v + 2; idx[k + 3] = v; idx[k + 4] = v + 2; idx[k + 5] = v + 3;
  }
  glowGeo = new THREE.BufferGeometry();
  glowAPos = new THREE.BufferAttribute(glowPos, 3); glowAPos.setUsage(THREE.DynamicDrawUsage);
  glowATint = new THREE.BufferAttribute(glowTint, 1); glowATint.setUsage(THREE.DynamicDrawUsage);
  glowGeo.setAttribute('position', glowAPos);
  glowGeo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
  glowGeo.setAttribute('aTint', glowATint);
  glowGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  glowGeo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader:
      'attribute vec2 aUv;\nattribute float aTint;\nvarying vec2 vUv;\nvarying float vTint;\n' +
      'void main(){\n  vUv = aUv;\n  vTint = aTint;\n  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);\n}\n',
    fragmentShader:
      'varying vec2 vUv;\nvarying float vTint;\n' +
      'void main(){\n' +
      '  float r = length(vUv * 2.0 - 1.0);\n' +
      '  float g = max(1.0 - r, 0.0);\n' +
      '  vec3 col = vTint < 0.5 ? vec3(1.0, 0.16, 0.05) : vec3(0.2, 1.0, 0.28);\n' +
      '  vec3 core = vTint < 0.5 ? vec3(1.0, 0.72, 0.5) : vec3(0.75, 1.0, 0.7);\n' +
      '  float a = clamp(g * g * 1.6, 0.0, 1.0);\n' +
      '  gl_FragColor = vec4(mix(col, core, pow(g, 3.0)), a);\n' +
      '}\n',
    transparent: true, depthWrite: false
  });
  const mesh = new THREE.Mesh(glowGeo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 15;
  scene.add(mesh);
}
function glowSprite(n, px, py, pz, size, tint) {
  if (n >= 24) return;
  const p = n * 12, q = n * 4, e = camera.matrixWorld.elements;
  const rx = e[0] * size, ry = e[1] * size, rz = e[2] * size, ux = e[4] * size, uy = e[5] * size, uz = e[6] * size;
  glowPos[p] = px - rx - ux; glowPos[p + 1] = py - ry - uy; glowPos[p + 2] = pz - rz - uz;
  glowPos[p + 3] = px + rx - ux; glowPos[p + 4] = py + ry - uy; glowPos[p + 5] = pz + rz - uz;
  glowPos[p + 6] = px + rx + ux; glowPos[p + 7] = py + ry + uy; glowPos[p + 8] = pz + rz + uz;
  glowPos[p + 9] = px - rx + ux; glowPos[p + 10] = py - ry + uy; glowPos[p + 11] = pz - rz + uz;
  glowTint[q] = tint; glowTint[q + 1] = tint; glowTint[q + 2] = tint; glowTint[q + 3] = tint;
}

// 빛줄기 하나: 머리(px,py,pz)에서 진행 방향 반대로 len만큼 꼬리를 늘인, 카메라를 향하는 띠
function tracerQuad(n, px, py, pz, vx, vy, vz, len, wMul, tint, cx, cy, cz) {
  const T = CONFIG.tracer, p = n * 12, q = n * 4;
  const sp = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
  const ux = vx / sp, uy = vy / sp, uz = vz / sp;
  const tx = px - ux * len, ty = py - uy * len, tz = pz - uz * len;
  const ex = cx - px, ey = cy - py, ez = cz - pz;
  let sx = uy * ez - uz * ey, sy = uz * ex - ux * ez, sz = ux * ey - uy * ex;
  const sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
  const w = Math.max(T.minWidth, Math.sqrt(ex * ex + ey * ey + ez * ez) * T.width) * wMul * (0.6 + 0.4 * TR_K) / sl;
  sx *= w; sy *= w; sz *= w;
  tracerPos[p] = tx - sx; tracerPos[p + 1] = ty - sy; tracerPos[p + 2] = tz - sz;
  tracerPos[p + 3] = tx + sx; tracerPos[p + 4] = ty + sy; tracerPos[p + 5] = tz + sz;
  tracerPos[p + 6] = px + sx; tracerPos[p + 7] = py + sy; tracerPos[p + 8] = pz + sz;
  tracerPos[p + 9] = px - sx; tracerPos[p + 10] = py - sy; tracerPos[p + 11] = pz - sz;
  tracerTint[q] = tint; tracerTint[q + 1] = tint; tracerTint[q + 2] = tint; tracerTint[q + 3] = tint;
}

function bulletSpawn(x, y, z, vx, vy, vz, life, dmg, owner, tgt) {
  if (bulN >= BUL_MAX) return;
  const i = bulN++, i3 = i * 3;
  bulPos[i3] = x; bulPos[i3 + 1] = y; bulPos[i3 + 2] = z;
  bulVel[i3] = vx; bulVel[i3 + 1] = vy; bulVel[i3 + 2] = vz;
  bulLife[i] = life; bulAge[i] = 0; bulDmg[i] = dmg; bulOwn[i] = owner; bulTgt[i] = tgt || null; bulAuto[i] = BUL_AUTO;
}

// 선분과 상자의 충돌. 맞으면 선분 위의 위치(0~1), 아니면 -1
function segBox(x0, y0, z0, x1, y1, z1, hx, ymin, ymax, hz) {
  let t0 = 0, t1 = 1, d, a, b, tmp;
  d = x1 - x0;
  if (d > -1e-8 && d < 1e-8) { if (x0 < -hx || x0 > hx) return -1; }
  else {
    a = (-hx - x0) / d; b = (hx - x0) / d;
    if (a > b) { tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return -1;
  }
  d = y1 - y0;
  if (d > -1e-8 && d < 1e-8) { if (y0 < ymin || y0 > ymax) return -1; }
  else {
    a = (ymin - y0) / d; b = (ymax - y0) / d;
    if (a > b) { tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return -1;
  }
  d = z1 - z0;
  if (d > -1e-8 && d < 1e-8) { if (z0 < -hz || z0 > hz) return -1; }
  else {
    a = (-hz - z0) / d; b = (hz - z0) / d;
    if (a > b) { tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return -1;
  }
  return t0;
}

// 선분이 보트(선체를 감싼 상자)에 맞는지. reach는 선분 길이에 따른 여유
function segBoat(b, ax, ay, az, bx, by, bz, reach, pad) {
  const M = b.M;
  const mx = (ax + bx) * 0.5 - b.x, mz = (az + bz) * 0.5 - b.z;
  const hl = M.L * 0.5 + 0.4 + pad;
  const far = hl + reach;
  if (mx * mx + mz * mz > far * far) return -1;
  const sh = Math.sin(b.heading), ch = Math.cos(b.heading);
  const rx0 = ax - b.x, rz0 = az - b.z, rx1 = bx - b.x, rz1 = bz - b.z;
  return segBox(rx0 * ch - rz0 * sh, ay - b.y, rx0 * sh + rz0 * ch, rx1 * ch - rz1 * sh, by - b.y, rx1 * sh + rz1 * ch,
    M.B * 0.5 + 0.25 + pad, -0.9 - pad, M.topY + pad, hl);
}

function bulletsUpdate(dt, t) {
  const g = CONFIG.mg.gravity;
  let i = 0;
  while (i < bulN) {
    const i3 = i * 3;
    const ox = bulPos[i3], oy = bulPos[i3 + 1], oz = bulPos[i3 + 2];
    let vx = bulVel[i3], vz = bulVel[i3 + 2];
    let vy = bulVel[i3 + 1] - g * dt;
    const tg = bulTgt[i];
    if (tg !== null && tg.alive) {
      // 락온 명중 탄: 표적의 선체 한가운데를 향해 방향만 바꾼다 (속도는 그대로)
      const sp = Math.sqrt(vx * vx + bulVel[i3 + 1] * bulVel[i3 + 1] + vz * vz);
      const qx = tg.x - ox, qy = tg.y + 0.9 - oy, qz = tg.z - oz, ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
      vx = qx / ql * sp; vy = qy / ql * sp; vz = qz / ql * sp;
      bulVel[i3] = vx; bulVel[i3 + 2] = vz;
    }
    const nx = ox + vx * dt, ny = oy + vy * dt, nz = oz + vz * dt;
    let gone = false;
    if (bulOwn[i] === 0) {
      HM = bulAuto[i] === 0;
      for (let e = 0; e < enemies.length; e++) {
        const b = enemies[e];
        if (!b.alive || b.submerged) continue;
        const th = segBoat(b, ox, oy, oz, nx, ny, nz, 9, 0);
        if (th >= 0) {
          bulletHitBoat(b, ox + (nx - ox) * th, oy + (ny - oy) * th, oz + (nz - oz) * th, bulDmg[i], true, ox - vx, oz - vz);
          gone = true;
          break;
        }
      }
      if (!gone && bulletVsMissiles(ox, oy, oz, nx, ny, nz)) gone = true;     // 보스 미사일 요격
      if (!gone && bulletVsMines(ox, oy, oz, nx, ny, nz)) gone = true;        // 적 기뢰
      if (!gone && airs.length && airBullet(ox, oy, oz, nx, ny, nz, bulDmg[i])) gone = true;   // 헬기·드론
      HM = false;
    } else {
      if (player.alive) {
        const th = segBoat(player, ox, oy, oz, nx, ny, nz, 9, 0);
        if (th >= 0) {
          bulletHitBoat(player, ox + (nx - ox) * th, oy + (ny - oy) * th, oz + (nz - oz) * th, bulDmg[i], false, ox - vx, oz - vz);
          gone = true;
        }
      }
      const sp = Special.supply;
      if (!gone && sp && sp.alive) {
        const th = segBoat(sp, ox, oy, oz, nx, ny, nz, 9, 0);
        if (th >= 0) { bulletHitBoat(sp, ox + (nx - ox) * th, oy + (ny - oy) * th, oz + (nz - oz) * th, bulDmg[i], false, ox - vx, oz - vz); gone = true; }
      }
    }
    if (!gone && (ISLES.length + REEFS.length) && (ny < 70 || oy < 70) && isleSeg(ox, oy, oz, nx, ny, nz)) { isleBulletFx(false); gone = true; }   // 섬·바위: 돌 조각이 튄다
    if (!gone && ny < wvMax() + 0.6 && !(tg !== null && tg.alive) && !(bulOwn[i] === 0 && vy >= 0)) {      // 락온 명중 탄, 수평으로 쭉 나가는 내 탄은 파도 끝에 걸리지 않는다
      const h = waveHeight(nx, nz, t);
      if (ny < h) {
        const k = lodAt(nx, nz);
        fxSplashSmall(nx, h, nz, k);
        Sound.playAt('splash', nx, nz, 0.5, rr(0.85, 1.3));
        gone = true;
      }
    }
    const life = bulLife[i] - dt;
    if (gone || life <= 0) {
      const l = --bulN;
      if (i !== l) {
        const l3 = l * 3;
        bulPos[i3] = bulPos[l3]; bulPos[i3 + 1] = bulPos[l3 + 1]; bulPos[i3 + 2] = bulPos[l3 + 2];
        bulVel[i3] = bulVel[l3]; bulVel[i3 + 1] = bulVel[l3 + 1]; bulVel[i3 + 2] = bulVel[l3 + 2];
        bulLife[i] = bulLife[l]; bulAge[i] = bulAge[l]; bulDmg[i] = bulDmg[l]; bulOwn[i] = bulOwn[l]; bulTgt[i] = bulTgt[l]; bulAuto[i] = bulAuto[l];
      }
      bulTgt[l] = null;
      continue;
    }
    bulPos[i3] = nx; bulPos[i3 + 1] = ny; bulPos[i3 + 2] = nz;
    bulVel[i3 + 1] = vy;
    bulLife[i] = life; bulAge[i] += dt;
    i++;
  }

  // 예광탄: 카메라를 향하는 길쭉한 빛줄기로 그린다
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, T = CONFIG.tracer;
  for (i = 0; i < bulN; i++) {
    const i3 = i * 3, vx = bulVel[i3], vy = bulVel[i3 + 1], vz = bulVel[i3 + 2];
    const sp = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    // 1인칭: 내 탄은 눈앞 25m 안에서는 안 그리고, 그 밖도 조금 가늘게 (시야가 덜 번쩍이게)
    let wm = 1;
    if (bulOwn[i] === 0 && Cam.fpE > 0.5) { const ex = bulPos[i3] - cx, ey = bulPos[i3 + 1] - cy, ez = bulPos[i3 + 2] - cz; wm = ex * ex + ey * ey + ez * ez < 625 ? 0 : 0.75; }
    tracerQuad(i, bulPos[i3], bulPos[i3 + 1], bulPos[i3 + 2], vx, vy, vz, Math.min(sp * T.len, bulAge[i] * sp + 0.6), wm, bulOwn[i], cx, cy, cz);
  }
  trN = bulN;
}

// 포탄 빛: 포탄이 움직인 뒤(shellsUpdate 다음)에 그려야 탄두와 빛이 어긋나지 않는다
// 가늘고 짧은 꼬리는 예광탄 시스템에, 꽁무니 예광제 빛점은 보통 섞기(밝은 하늘에서도 빨갛게 보이게)로 따로 그린다
function shellTracers() {
  const T = CONFIG.tracer, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  let n = trN, g = 0;
  for (let k = 0; k < SHELL_MAX; k++) {
    const s = shells[k];
    if (!s.on) continue;
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz) || 1, own = s.owner === 0;
    const bx = s.x - s.vx / sp * 0.5 * s.scale, by = s.y - s.vy / sp * 0.5 * s.scale, bz = s.z - s.vz / sp * 0.5 * s.scale;   // 탄 꽁무니
    if (T.shellWidth > 0 && n < TR_MAX) tracerQuad(n++, bx, by, bz, s.vx, s.vy, s.vz, sp * T.shellLen * s.scale, T.shellWidth * s.scale, own ? 2 : 3, cx, cy, cz);
    const dx = bx - cx, dy = by - cy, dz = bz - cz;
    glowSprite(g++, bx, by, bz, Math.max(T.shellGlowMin, Math.sqrt(dx * dx + dy * dy + dz * dz) * T.shellGlow) * s.scale * (0.6 + 0.4 * TR_K), own ? 0 : 1);
  }
  tracerGeo.setDrawRange(0, n * 6);
  tracerAPos.updateRange.offset = 0; tracerAPos.updateRange.count = n * 12; tracerAPos.needsUpdate = true;
  tracerATint.updateRange.offset = 0; tracerATint.updateRange.count = n * 4; tracerATint.needsUpdate = true;
  glowGeo.setDrawRange(0, g * 6);
  glowAPos.updateRange.offset = 0; glowAPos.updateRange.count = g * 12; glowAPos.needsUpdate = true;
  glowATint.updateRange.offset = 0; glowATint.updateRange.count = g * 4; glowATint.needsUpdate = true;
}
