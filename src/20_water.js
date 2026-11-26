
/* ==========================================================================
 * 렌더러와 장면
 * ========================================================================== */
let renderer = null, scene = null, camera = null;
let pixelRatio = 1;
const SUN_DIR = new THREE.Vector3();          // 해를 향하는 단위 벡터
const SUN_FLAT = new THREE.Vector2();         // 해의 수평 방향 (그림자 계산용)
const uTime = { value: 0 };                   // 여러 셰이더가 함께 쓰는 시간
const uFog = { value: CONFIG.ocean.fogDensity };
// 배경마다 바뀌는 하늘·바다 색 (하늘 돔과 바다 셰이더가 같은 값을 쓴다)
const ENV_U = {
  uHor0: { value: new THREE.Vector3() }, uHor1: { value: new THREE.Vector3() }, uMid0: { value: new THREE.Vector3() }, uMid1: { value: new THREE.Vector3() },
  uZen: { value: new THREE.Vector3() }, uGlow: { value: new THREE.Vector3() }, uSkyFlash: { value: 0 },
  uDisc: { value: new THREE.Vector3() }, uCloudD: { value: new THREE.Vector3() }, uCloudL: { value: new THREE.Vector3() }, uCloudG: { value: new THREE.Vector3() },
  uCov: { value: new THREE.Vector3() }, uStars: { value: 0 }, uWaterK: { value: new THREE.Vector3(1, 1, 1) }, uFoamK: { value: 1 }
};
let sunLight = null, hemiLight = null, ENV = null;

function initRenderer() {
  const canvas = $('game');
  renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: CONFIG.quality.antialias !== false && (window.devicePixelRatio || 1) < 1.6, alpha: false, stencil: false, powerPreference: 'high-performance'
  });
  pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.quality.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.render.exposure;

  // 해의 방향: 방위는 북(-Z)에서 시계 방향, 동쪽이 +X
  const br = CONFIG.sun.bearingDeg * Math.PI / 180, el = CONFIG.sun.elevationDeg * Math.PI / 180;
  SUN_DIR.set(Math.sin(br) * Math.cos(el), Math.sin(el), -Math.cos(br) * Math.cos(el)).normalize();
  SUN_FLAT.set(SUN_DIR.x, SUN_DIR.z).normalize();

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(0.62, 0.64, 0.66), CONFIG.ocean.fogDensity);
  camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.35, 7000);
  camera.position.set(0, 8, -20);

  // 태양 방향에 맞춘 조명: 낮게 뜬 따뜻한 직사광 + 하늘과 바다에서 오는 주변광
  sunLight = new THREE.DirectionalLight(new THREE.Color(1.0, 0.80, 0.56), 2.7);
  sunLight.position.copy(SUN_DIR).multiplyScalar(200);
  scene.add(sunLight);
  hemiLight = new THREE.HemisphereLight(new THREE.Color(0.52, 0.64, 0.86), new THREE.Color(0.05, 0.12, 0.16), 0.95);
  scene.add(hemiLight);
}

// 배경 바꾸기: 해(달)의 방향, 빛, 안개, 하늘·바다 색, 파도 높이, 연기 밝기, 예광탄 밝기를 한꺼번에 바꾼다
function applyEnv(key) {
  const E = CONFIG.env[key] || CONFIG.env.sunset;
  ENV = E;
  const br = E.sun[0] * Math.PI / 180, el = E.sun[1] * Math.PI / 180;
  SUN_DIR.set(Math.sin(br) * Math.cos(el), Math.sin(el), -Math.cos(br) * Math.cos(el)).normalize();
  SUN_FLAT.set(SUN_DIR.x, SUN_DIR.z).normalize();
  if (sunLight) { sunLight.color.setRGB(E.light[0], E.light[1], E.light[2]); sunLight.intensity = E.light[3]; sunLight.position.copy(SUN_DIR).multiplyScalar(200); }
  if (hemiLight) { hemiLight.color.setRGB(E.hemi[0], E.hemi[1], E.hemi[2]); hemiLight.groundColor.setRGB(E.hemi[3], E.hemi[4], E.hemi[5]); hemiLight.intensity = E.hemi[6]; }
  if (renderer) renderer.toneMappingExposure = E.exposure;
  if (scene && scene.fog) scene.fog.color.setRGB(E.fog[0], E.fog[1], E.fog[2]);
  uFog.value = E.fog[3];
  if (scene && scene.fog) scene.fog.density = E.fog[3];
  const U = ENV_U;
  U.uHor0.value.fromArray(E.hor0); U.uHor1.value.fromArray(E.hor1); U.uMid0.value.fromArray(E.mid0); U.uMid1.value.fromArray(E.mid1);
  U.uZen.value.fromArray(E.zen); U.uGlow.value.fromArray(E.glow); U.uDisc.value.fromArray(E.disc);
  U.uCloudD.value.fromArray(E.cloud, 0); U.uCloudL.value.fromArray(E.cloud, 3); U.uCloudG.value.fromArray(E.cloud, 6);
  U.uCov.value.fromArray(E.cov); U.uStars.value = E.stars; U.uWaterK.value.fromArray(E.water); U.uFoamK.value = E.foam;
  if (oceanUniforms) oceanUniforms.uSunCol.value.fromArray(E.sunCol);
  WAMP = E.wave; uWaveAmp.value = E.wave;
  if (typeof envParticles === 'function') envParticles(E);
  if (typeof envBoats === 'function') envBoats(E);
}

/* ==========================================================================
 * 텍스처 — 전부 canvas에 직접 그린다 (외부 이미지 없음)
 * ========================================================================== */
let texWater = null, texNoise = null;

function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 이어 붙여도 경계가 보이지 않는 프랙탈 노이즈 (0~1)
function tileFbm(S, basePeriod, octaves, gain, ridged, rng) {
  const out = new Float32Array(S * S);
  let amp = 1, period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    const tab = new Float32Array(period * period);
    for (let i = 0; i < tab.length; i++) tab[i] = rng();
    const sc = period / S;
    for (let y = 0; y < S; y++) {
      const fy = y * sc, y0 = Math.floor(fy);
      let ty = fy - y0; ty = ty * ty * (3 - 2 * ty);
      const ya = (y0 % period) * period, yb = ((y0 + 1) % period) * period;
      for (let x = 0; x < S; x++) {
        const fx = x * sc, x0 = Math.floor(fx);
        let tx = fx - x0; tx = tx * tx * (3 - 2 * tx);
        const xa = x0 % period, xb = (x0 + 1) % period;
        let v = lerp(lerp(tab[ya + xa], tab[ya + xb], tx), lerp(tab[yb + xa], tab[yb + xb], tx), ty);
        if (ridged) v = 1 - Math.abs(v * 2 - 1);
        out[y * S + x] += v * amp;
      }
    }
    amp *= gain; period *= 2;
  }
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < out.length; i++) { if (out[i] < lo) lo = out[i]; if (out[i] > hi) hi = out[i]; }
  const inv = 1 / (hi - lo);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) * inv;
  return out;
}

// 세포 무늬(거품 그물): 가장 가까운 두 점까지 거리의 차
function tileWorley(S, cells, rng) {
  const n = cells * cells, px = new Float32Array(n), py = new Float32Array(n);
  for (let i = 0; i < n; i++) { px[i] = rng(); py[i] = rng(); }
  const out = new Float32Array(S * S), sc = cells / S;
  for (let y = 0; y < S; y++) {
    const fy = y * sc, cy = Math.floor(fy);
    for (let x = 0; x < S; x++) {
      const fx = x * sc, cx = Math.floor(fx);
      let d1 = 9, d2 = 9;
      for (let j = -1; j <= 1; j++) {
        const gy = cy + j, wy = ((gy % cells) + cells) % cells;
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i, wx = ((gx % cells) + cells) % cells, id = wy * cells + wx;
          const ddx = gx + px[id] - fx, ddy = gy + py[id] - fy, d = ddx * ddx + ddy * ddy;
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
      }
      out[y * S + x] = Math.sqrt(d2) - Math.sqrt(d1);
    }
  }
  return out;
}

function fieldsToTexture(S, r, g, b) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  for (let i = 0, p = 0; i < S * S; i++, p += 4) {
    d[p] = r[i] * 255; d[p + 1] = g[i] * 255; d[p + 2] = b[i] * 255; d[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function makeTextures() {
  // 물 텍스처: R,G = 잔물결 노멀, B = 거품 무늬
  const S = 512, rng = makeRng(20261112);
  const h1 = tileFbm(S, 8, 5, 0.55, false, rng), h2 = tileFbm(S, 16, 4, 0.5, true, rng);
  const hf = new Float32Array(S * S);
  for (let i = 0; i < hf.length; i++) hf[i] = h1[i] * 0.6 + h2[i] * 0.4;
  const gx = new Float32Array(S * S), gy = new Float32Array(S * S);
  let sum = 0;
  for (let y = 0; y < S; y++) {
    const yu = ((y + S - 1) % S) * S, yd = ((y + 1) % S) * S, yc = y * S;
    for (let x = 0; x < S; x++) {
      const xl = (x + S - 1) % S, xr = (x + 1) % S;
      const a = hf[yc + xl] - hf[yc + xr], b = hf[yu + x] - hf[yd + x];
      gx[yc + x] = a; gy[yc + x] = b; sum += a * a + b * b;
    }
  }
  const k = 1 / (2.6 * Math.sqrt(sum / (2 * S * S)));
  for (let i = 0; i < gx.length; i++) {
    gx[i] = clamp(0.5 + 0.5 * gx[i] * k, 0, 1);
    gy[i] = clamp(0.5 + 0.5 * gy[i] * k, 0, 1);
  }
  const w1 = tileWorley(S, 11, rng), w2 = tileWorley(S, 26, rng), fb = tileFbm(S, 4, 5, 0.55, false, rng);
  const fo = new Float32Array(S * S);
  for (let i = 0; i < fo.length; i++) {
    const n1 = 1 - smooth01(w1[i] / 0.20), n2 = 1 - smooth01(w2[i] / 0.26);
    fo[i] = clamp(n1 * 0.70 + n2 * 0.42 + fb[i] * 0.62 - 0.27, 0, 1);
  }
  texWater = fieldsToTexture(S, gx, gy, fo);

  // 범용 노이즈: R = 큰 덩어리(구름, 물빛 얼룩), G = 중간, B = 잘게 갈라진 무늬
  const T = 256, rng2 = makeRng(977);
  texNoise = fieldsToTexture(T, tileFbm(T, 4, 6, 0.5, false, rng2), tileFbm(T, 8, 5, 0.55, false, rng2), tileFbm(T, 16, 4, 0.5, true, rng2));
}

/* ==========================================================================
 * 하늘 — 셰이더 그라데이션, 태양, 구름
 * ========================================================================== */
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uSunDir: { value: SUN_DIR }, tNoise: { value: texNoise }, uTime: uTime }, ENV_U),
    vertexShader:
      'varying vec3 vDir;\n' +
      'void main(){\n' +
      '  vDir = position;\n' +
      '  vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);\n' +
      '  gl_Position = p.xyww;\n' +
      '}\n',
    fragmentShader:
      'uniform vec3 uSunDir;\nuniform sampler2D tNoise;\nuniform float uTime;\nvarying vec3 vDir;\n' +
      'uniform vec3 uDisc;\nuniform vec3 uCloudD;\nuniform vec3 uCloudL;\nuniform vec3 uCloudG;\nuniform vec3 uCov;\nuniform float uStars;\n' + GLSL_SKY +
      'float cloudField(vec2 uv){\n' +
      '  return texture2D(tNoise, uv * 0.11).r * 0.56 + texture2D(tNoise, uv * 0.27 + 0.31).g * 0.29 + texture2D(tNoise, uv * 0.71 + 0.67).r * 0.15;\n' +
      '}\n' +
      'void main(){\n' +
      '  vec3 d = normalize(vDir);\n' +
      '  vec3 col = skyBase(d);\n' +
      '  float mu = max(dot(d, uSunDir), 0.0);\n' +
      '  col += uDisc * (smoothstep(0.99985, 0.99994, mu) * 46.0 + pow(mu, 1500.0) * 5.0);\n' +
      // 별: 하늘을 잘게 나눈 칸마다 하나씩, 드물게 반짝인다 (밤에만)
      '  if (uStars > 0.0 && d.y > 0.02) {\n' +
      '    vec3 sc = floor(d * 420.0);\n' +
      '    float h = fract(sin(dot(sc, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n' +
      '    float tw = 0.6 + 0.4 * sin(uTime * 3.0 + h * 60.0);\n' +
      '    col += vec3(0.8, 0.85, 1.0) * uStars * step(0.9965, h) * tw * smoothstep(0.02, 0.25, d.y) * 1.6;\n' +
      '  }\n' +
      '  if (d.y > 0.012) {\n' +
      '    vec2 uv = d.xz / (d.y + 0.10) + uTime * vec2(0.0034, 0.0012);\n' +
      '    float n = cloudField(uv);\n' +
      '    float dens = smoothstep(uCov.x, uCov.y, n) * smoothstep(0.012, 0.20, d.y);\n' +
      '    float n2 = cloudField(uv + normalize(uSunDir.xz) * 0.10);\n' +
      '    float lit = clamp(0.55 + (n - n2) * 4.0, 0.0, 1.0);\n' +
      '    vec3 cc = mix(uCloudD, uCloudL, lit);\n' +
      '    cc = mix(cc, uCloudG, pow(mu, 10.0) * 0.55);\n' +
      '    cc += vec3(0.7, 0.75, 0.9) * uSkyFlash * 0.8;\n' +
      '    col = mix(col, cc, dens * uCov.z);\n' +
      '  }\n' +
      '  gl_FragColor = vec4(col, 1.0);' + GLSL_OUT +
      '}\n',
    side: THREE.BackSide, depthTest: false, depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  scene.add(mesh);
}

/* ==========================================================================
 * 거품 맵 — 항적, 포탄이 떨어진 자리, 보트 그림자를 위에서 내려다본 그림으로 그려 두고
 * 바다 셰이더가 읽어서 수면에 입힌다. 수면 굴곡을 그대로 따라가므로 물에 붙어 보인다
 * ========================================================================== */
let foamRT = null, foamScene = null, foamCam = null, wakeMat = null;
let foamCX = 0, foamCZ = 0;
const foamHalf = CONFIG.quality.foamMapRange * 0.5;
const uFoamClip = { value: new THREE.Vector3(0, 0, 1) };   // 거품 맵을 그릴 때: 중심 x, 중심 z, 1/반폭
const uFoamRect = { value: new THREE.Vector3(0, 0, 1) };   // 바다에서 읽을 때: 중심 x, 중심 z, 1/폭

const STAMP_MAX = 220;
let stampN = 0, stampPos = null, stampPar = null, stampGeo = null, stampAPos = null, stampAPar = null;

const DECAL_MAX = 90;
let decalN = 0;
const decalX = new Float32Array(DECAL_MAX), decalZ = new Float32Array(DECAL_MAX);
const decalR0 = new Float32Array(DECAL_MAX), decalR1 = new Float32Array(DECAL_MAX);
const decalAge = new Float32Array(DECAL_MAX), decalLife = new Float32Array(DECAL_MAX);
const decalInt = new Float32Array(DECAL_MAX), decalInner = new Float32Array(DECAL_MAX), decalSoft = new Float32Array(DECAL_MAX);

function initFoam() {
  const size = CONFIG.quality.foamMapSize;
  foamRT = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false
  });
  foamRT.texture.generateMipmaps = false;
  foamScene = new THREE.Scene();
  foamCam = new THREE.Camera();

  wakeMat = new THREE.ShaderMaterial({
    uniforms: { uClip: uFoamClip },
    vertexShader:
      'attribute vec2 aFoam;\nuniform vec3 uClip;\nvarying vec2 vFoam;\n' +
      'void main(){\n  vFoam = aFoam;\n  gl_Position = vec4((position.xz - uClip.xy) * uClip.z, 0.0, 1.0);\n}\n',
    fragmentShader:
      'varying vec2 vFoam;\n' +
      'void main(){\n  float e = sin(clamp(vFoam.y, 0.0, 1.0) * 3.14159265);\n  gl_FragColor = vec4(vFoam.x * sqrt(e), 0.0, 0.0, 1.0);\n}\n',
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide
  });

  // 도장: 원이나 고리 모양 거품, 보트 그림자
  stampPos = new Float32Array(STAMP_MAX * 12);
  stampPar = new Float32Array(STAMP_MAX * 16);
  const uv = new Float32Array(STAMP_MAX * 8), idx = new Uint16Array(STAMP_MAX * 6);
  for (let i = 0; i < STAMP_MAX; i++) {
    const u = i * 8, k = i * 6, v = i * 4;
    uv[u] = -1; uv[u + 1] = -1; uv[u + 2] = 1; uv[u + 3] = -1; uv[u + 4] = 1; uv[u + 5] = 1; uv[u + 6] = -1; uv[u + 7] = 1;
    idx[k] = v; idx[k + 1] = v + 1; idx[k + 2] = v + 2; idx[k + 3] = v; idx[k + 4] = v + 2; idx[k + 5] = v + 3;
  }
  stampGeo = new THREE.BufferGeometry();
  stampAPos = new THREE.BufferAttribute(stampPos, 3); stampAPos.setUsage(THREE.DynamicDrawUsage);
  stampAPar = new THREE.BufferAttribute(stampPar, 4); stampAPar.setUsage(THREE.DynamicDrawUsage);
  stampGeo.setAttribute('position', stampAPos);
  stampGeo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
  stampGeo.setAttribute('aPar', stampAPar);
  stampGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  stampGeo.setDrawRange(0, 0);
  const stampMat = new THREE.ShaderMaterial({
    uniforms: { uClip: uFoamClip },
    vertexShader:
      'attribute vec2 aUv;\nattribute vec4 aPar;\nuniform vec3 uClip;\nvarying vec2 vUv;\nvarying vec4 vPar;\n' +
      'void main(){\n  vUv = aUv;\n  vPar = aPar;\n  gl_Position = vec4((position.xz - uClip.xy) * uClip.z, 0.0, 1.0);\n}\n',
    fragmentShader:
      'varying vec2 vUv;\nvarying vec4 vPar;\n' +
      'void main(){\n' +
      '  float d = length(vUv);\n' +
      '  float a = vPar.x * (1.0 - smoothstep(1.0 - vPar.z, 1.0, d)) * smoothstep(vPar.y - vPar.z, vPar.y + 0.0001, d);\n' +
      '  gl_FragColor = mix(vec4(a, 0.0, 0.0, 1.0), vec4(0.0, a, 0.0, 1.0), vPar.w);\n' +
      '}\n',
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide
  });
  const stampMesh = new THREE.Mesh(stampGeo, stampMat);
  stampMesh.frustumCulled = false;
  foamScene.add(stampMesh);
}

// 프레임 시작: 거품 맵의 중심을 카메라 앞쪽에 둔다. 텍셀 단위로 맞춰 움직여야 거품이 흔들리지 않는다
function foamBegin(cx, cz) {
  const texel = CONFIG.quality.foamMapRange / CONFIG.quality.foamMapSize;
  foamCX = Math.round(cx / texel) * texel;
  foamCZ = Math.round(cz / texel) * texel;
  stampN = 0;
}

// (ax, az) 방향으로 hx, 그 수직 방향으로 hz 크기의 도장을 찍는다. channel 0 = 거품, 1 = 그림자
function foamStamp(x, z, ax, az, hx, hz, intensity, inner, soft, channel) {
  if (stampN >= STAMP_MAX) return;
  const reach = foamHalf + hx + hz;
  if (x - foamCX > reach || foamCX - x > reach || z - foamCZ > reach || foamCZ - z > reach) return;
  const p = stampN * 12, q = stampN * 16;
  const bx = -az, bz = ax;
  stampPos[p] = x - ax * hx - bx * hz; stampPos[p + 2] = z - az * hx - bz * hz;
  stampPos[p + 3] = x + ax * hx - bx * hz; stampPos[p + 5] = z + az * hx - bz * hz;
  stampPos[p + 6] = x + ax * hx + bx * hz; stampPos[p + 8] = z + az * hx + bz * hz;
  stampPos[p + 9] = x - ax * hx + bx * hz; stampPos[p + 11] = z - az * hx + bz * hz;
  for (let k = 0; k < 16; k += 4) {
    stampPar[q + k] = intensity; stampPar[q + k + 1] = inner; stampPar[q + k + 2] = soft; stampPar[q + k + 3] = channel;
  }
  stampN++;
}

// 한동안 남으면서 퍼지고 옅어지는 거품 (포탄 낙하 지점, 폭발 자리 등)
function foamDecal(x, z, r0, r1, life, intensity, inner, soft) {
  if (decalN >= DECAL_MAX) return;
  const i = decalN++;
  decalX[i] = x; decalZ[i] = z; decalR0[i] = r0; decalR1[i] = r1; decalAge[i] = 0; decalLife[i] = life;
  decalInt[i] = intensity; decalInner[i] = inner; decalSoft[i] = soft;
}

function foamDecalsUpdate(dt) {
  let i = 0;
  while (i < decalN) {
    const age = decalAge[i] + dt;
    if (age >= decalLife[i]) {
      const l = --decalN;
      if (i !== l) {
        decalX[i] = decalX[l]; decalZ[i] = decalZ[l]; decalR0[i] = decalR0[l]; decalR1[i] = decalR1[l]; decalAge[i] = decalAge[l];
        decalLife[i] = decalLife[l]; decalInt[i] = decalInt[l]; decalInner[i] = decalInner[l]; decalSoft[i] = decalSoft[l];
      }
      continue;
    }
    decalAge[i] = age;
    const k = age / decalLife[i];
    const r = decalR0[i] + (decalR1[i] - decalR0[i]) * Math.sqrt(k);
    foamStamp(decalX[i], decalZ[i], 1, 0, r, r, decalInt[i] * Math.pow(1 - k, 1.3), decalInner[i], decalSoft[i], 0);
    i++;
  }
}

function foamRender() {
  stampGeo.setDrawRange(0, stampN * 6);
  stampAPos.updateRange.offset = 0; stampAPos.updateRange.count = stampN * 12; stampAPos.needsUpdate = true;
  stampAPar.updateRange.offset = 0; stampAPar.updateRange.count = stampN * 16; stampAPar.needsUpdate = true;
  uFoamClip.value.set(foamCX, foamCZ, 1 / foamHalf);
  uFoamRect.value.set(foamCX, foamCZ, 1 / CONFIG.quality.foamMapRange);
  renderer.setRenderTarget(foamRT);
  renderer.render(foamScene, foamCam);
  renderer.setRenderTarget(null);
}

/* ---------- 항적: 보트가 지나간 자리를 마디로 기억해 두고 띠로 그린다 ---------- */
const WAKE_N = 84;

function Wake() {
  const N = WAKE_N;
  this.sx = new Float32Array(N); this.sz = new Float32Array(N);   // 선미 위치
  this.bx = new Float32Array(N); this.bz = new Float32Array(N);   // 뱃머리 위치
  this.lx = new Float32Array(N); this.lz = new Float32Array(N);   // 옆 방향
  this.str = new Float32Array(N); this.spd = new Float32Array(N);
  this.born = new Float64Array(N);
  this.head = -1; this.count = 0; this.lastX = 0; this.lastZ = 0;
  const nv = (N + 1) * 6;
  this.pos = new Float32Array(nv * 3);
  this.foam = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) this.foam[i * 2 + 1] = i & 1;      // 띠의 가로 좌표 (0 또는 1)
  const idx = new Uint16Array(N * 18);
  let p = 0;
  for (let s = 0; s < N; s++) {
    const a = s * 6, b = (s + 1) * 6;
    for (let k = 0; k < 6; k += 2) {                               // 띠 세 줄: 왼쪽 가지, 가운데, 오른쪽 가지
      idx[p++] = a + k; idx[p++] = a + k + 1; idx[p++] = b + k;
      idx[p++] = a + k + 1; idx[p++] = b + k + 1; idx[p++] = b + k;
    }
  }
  this.geo = new THREE.BufferGeometry();
  this.aPos = new THREE.BufferAttribute(this.pos, 3); this.aPos.setUsage(THREE.DynamicDrawUsage);
  this.aFoam = new THREE.BufferAttribute(this.foam, 2); this.aFoam.setUsage(THREE.DynamicDrawUsage);
  this.geo.setAttribute('position', this.aPos);
  this.geo.setAttribute('aFoam', this.aFoam);
  this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
  this.geo.setDrawRange(0, 0);
  this.mesh = new THREE.Mesh(this.geo, wakeMat);
  this.mesh.frustumCulled = false;
  this.mesh.visible = false;
  foamScene.add(this.mesh);
}

Wake.prototype.clear = function () {
  this.head = -1; this.count = 0; this.mesh.visible = false;
};

// 마디 하나를 정점 여섯 개로 풀어 쓴다. age가 클수록 넓어지고 옅어진다
Wake.prototype.put = function (v, sx, sz, bx, bz, lx, lz, str, spd, age, beam) {
  const P = this.pos, F = this.foam, p = v * 18, f = v * 12;
  // 가운데: 프로펠러가 휘저은 흰 물거품
  const tc = 7.5 + 5.5 * str;
  const ic = age < tc ? str * 1.15 * Math.pow(1 - age / tc, 1.6) : 0;
  const wc = beam * 0.40 + 1.15 * Math.pow(age, 0.72);
  // 양옆 가지: 뱃머리가 가른 물결이 V자로 퍼져 나간다
  const ta = 2.0 + 2.4 * str;
  const ia = age < ta ? str * 0.9 * Math.pow(1 - age / ta, 1.5) * Math.min(1, age * 4 + 0.25) : 0;
  const off = beam * 0.36 + spd * 0.30 * Math.pow(age, 0.88);
  const wa = 0.45 + 0.85 * age;
  const o1 = off + wa * 0.5, o2 = off - wa * 0.5;
  P[p] = bx + lx * o1; P[p + 2] = bz + lz * o1;
  P[p + 3] = bx + lx * o2; P[p + 5] = bz + lz * o2;
  P[p + 6] = sx + lx * wc; P[p + 8] = sz + lz * wc;
  P[p + 9] = sx - lx * wc; P[p + 11] = sz - lz * wc;
  P[p + 12] = bx - lx * o2; P[p + 14] = bz - lz * o2;
  P[p + 15] = bx - lx * o1; P[p + 17] = bz - lz * o1;
  F[f] = ia; F[f + 2] = ia; F[f + 4] = ic; F[f + 6] = ic; F[f + 8] = ia; F[f + 10] = ia;
  return v + 1;
};

Wake.prototype.update = function (x, z, sh, ch, speed, len, beam, t, emit) {
  const N = WAKE_N;
  const sternX = x - sh * len * 0.47, sternZ = z - ch * len * 0.47;
  const bowX = x + sh * len * 0.30, bowZ = z + ch * len * 0.30;
  const str = emit ? clamp(speed / 26, 0, 1.35) : 0;
  if (emit && speed > 0.8) {
    const ddx = sternX - this.lastX, ddz = sternZ - this.lastZ;
    const gap = Math.max(2.4, speed * 0.105);
    if (this.count === 0 || ddx * ddx + ddz * ddz > gap * gap) {
      const h = this.head = (this.head + 1) % N;
      this.sx[h] = sternX; this.sz[h] = sternZ; this.bx[h] = bowX; this.bz[h] = bowZ;
      this.lx[h] = ch; this.lz[h] = -sh; this.str[h] = str; this.spd[h] = speed; this.born[h] = t;
      this.lastX = sternX; this.lastZ = sternZ;
      if (this.count < N) this.count++;
    }
  }
  while (this.count > 0) {
    const o = (this.head - this.count + 1 + N * 2) % N;
    if (t - this.born[o] > 14) this.count--; else break;
  }
  if (this.count === 0) { this.mesh.visible = false; return; }
  let v = this.put(0, sternX, sternZ, bowX, bowZ, ch, -sh, str, speed, 0, beam);
  for (let j = 0; j < this.count; j++) {
    const i = (this.head - j + N * 2) % N;
    v = this.put(v, this.sx[i], this.sz[i], this.bx[i], this.bz[i], this.lx[i], this.lz[i], this.str[i], this.spd[i], t - this.born[i], beam);
  }
  this.geo.setDrawRange(0, this.count * 18);
  this.aPos.updateRange.offset = 0; this.aPos.updateRange.count = v * 18; this.aPos.needsUpdate = true;
  this.aFoam.updateRange.offset = 0; this.aFoam.updateRange.count = v * 12; this.aFoam.needsUpdate = true;
  this.mesh.visible = true;
};

/* ==========================================================================
 * 바다 — ShaderMaterial로 직접 만든다
 * 메쉬는 카메라를 중심으로 한 원판이고, 가까울수록 촘촘하고 수평선 쪽으로 갈수록 성기다
 * ========================================================================== */
let oceanUniforms = null;

function buildOceanGeometry(rings, sectors, r0, r1) {
  const nv = 1 + rings * sectors;
  const pos = new Float32Array(nv * 3);
  const growth = Math.pow(r1 / r0, 1 / (rings - 1));
  let r = r0, p = 3;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sectors; j++) {
      const a = j / sectors * TAU;
      pos[p++] = Math.cos(a) * r; pos[p++] = 0; pos[p++] = Math.sin(a) * r;
    }
    r *= growth;
  }
  const nIdx = (sectors + (rings - 1) * sectors * 2) * 3;
  const idx = nv > 65535 ? new Uint32Array(nIdx) : new Uint16Array(nIdx);
  let k = 0;
  for (let j = 0; j < sectors; j++) { idx[k++] = 0; idx[k++] = 1 + (j + 1) % sectors; idx[k++] = 1 + j; }
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < sectors; j++) {
      const a = 1 + i * sectors + j, b = 1 + i * sectors + (j + 1) % sectors;
      const c = a + sectors, d = b + sectors;
      idx[k++] = a; idx[k++] = b; idx[k++] = c;
      idx[k++] = b; idx[k++] = d; idx[k++] = c;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

function makeOcean() {
  const q = CONFIG.quality;
  oceanUniforms = {
    uTime: uTime,
    uCenter: { value: new THREE.Vector2() },
    uSunDir: { value: SUN_DIR },
    uSunCol: { value: new THREE.Vector3(3.2, 2.35, 1.5) },
    tWater: { value: texWater },
    tNoise: { value: texNoise },
    tFoamMap: { value: foamRT.texture },
    uFoamRect: uFoamRect,
    uFogDensity: uFog,
    uWaveAmp: uWaveAmp,
    uPix: { value: 0.001 },    // 픽셀 한 칸의 시야각 (매 프레임 갱신)
    uNuke: { value: new THREE.Vector4(0, 0, 1, 0) }   // 핵폭탄 자리 바다가 초록빛으로: x, z, 반경, 세기
  };
  Object.assign(oceanUniforms, ENV_U);
  const vs =
    'uniform float uTime;\nuniform vec2 uCenter;\nvarying vec2 vP0;\nvarying vec3 vWorld;\n' + glslWaveDisp() +
    'void main(){\n' +
    '  vec2 p0 = position.xz + uCenter;\n' +
    '  vec3 wp = vec3(p0.x, 0.0, p0.y) + waveDisp(p0, uTime, length(position.xz));\n' +
    '  vP0 = p0;\n' +
    '  vWorld = wp;\n' +
    '  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);\n' +
    '}\n';
  const fs = `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform sampler2D tWater;
uniform sampler2D tNoise;
uniform sampler2D tFoamMap;
uniform vec3 uFoamRect;
uniform float uFogDensity;
uniform float uPix;
varying vec2 vP0;
varying vec3 vWorld;
uniform vec3 uWaterK;
uniform float uFoamK;
uniform vec4 uNuke;
${GLSL_SKY}
${glslWaveShade()}
void main(){
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;

  // 픽셀 한 칸이 덮는 수면 크기. 멀수록, 스치듯 볼수록 커진다
  float fp = dist * uPix * pow(1.0 / max(V.y, 0.02), 0.70);

  vec3 N; float jac; float vr; float hgt;
  waveShade(vP0, uTime, fp, N, jac, vr, hgt);

  // 잔물결: 크기와 흐르는 방향이 다른 노멀맵 두 겹
  vec2 uvw = vWorld.xz;
  vec2 r1 = texture2D(tWater, uvw * 0.131 + uTime * vec2(0.023, 0.015)).rg;
  vec2 r2 = texture2D(tWater, uvw * 0.047 - uTime * vec2(0.012, 0.019)).rg;
  N.xz += (r1 + r2 - 1.0) * 0.24 * max(N.y, 0.25);
  vr += 0.003 * smoothstep(0.05, 0.7, fp);
  N = normalize(N);
  float nv = dot(N, V);
  if (nv < 0.04) { N = normalize(N + V * (0.04 - nv)); nv = max(dot(N, V), 0.0); }

  // 프레넬: 스치듯 볼수록(멀리 볼수록) 하늘이 비친다. 거친 바다는 완전한 거울이 되지 않는다
  float sig = sqrt(vr);
  float fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0 * exp(-2.69 * sig)) / (1.0 + 22.7 * pow(sig, 1.5));
  vec3 R = reflect(-V, N);
  R.y = abs(R.y) + 0.02;
  vec3 refl = skyBase(normalize(R));

  // 태양 반사 반짝임. 픽셀보다 작은 파도는 거칠기로 바꿔 넣어 멀리서는 길게 번진다
  vec3 Hh = normalize(V + uSunDir);
  float nh = max(dot(N, Hh), 0.0);
  float a2 = clamp(0.0009 + vr * 1.2, 0.0009, 0.3);
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159265 * dd * dd);
  float vh = max(dot(V, Hh), 0.0);
  float fsn = 0.02 + 0.98 * pow(1.0 - vh, 5.0);
  float spec = min(D * fsn * 0.25 / max(nv, 0.14), 28.0) * step(0.0, dot(N, uSunDir));

  // 거품 맵: R = 항적과 물거품, G = 보트 그림자
  vec2 fuv = (uvw - uFoamRect.xy) * uFoamRect.z + 0.5;
  vec4 fm = texture2D(tFoamMap, fuv);
  vec2 fe = abs(fuv - 0.5) * 2.0;
  float edge = 1.0 - smoothstep(0.88, 1.0, max(fe.x, fe.y));
  float wake = min(fm.r, 1.5) * edge;
  float shadow = min(fm.g, 1.0) * edge;

  // 물빛: 깊은 곳은 짙은 남색, 파도 꼭대기와 얕은 곳은 빛이 비쳐 청록색
  float hn = clamp(hgt * ${gf(1.6 / WV.maxAmp)} * 0.5 + 0.5, 0.0, 1.0);
  float toSun = clamp(dot(-V, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  float crest = smoothstep(0.42, 0.95, hn);
  float shoal = smoothstep(0.50, 0.80, texture2D(tNoise, uvw * 0.0013).r);
  float scat = 0.11 + 0.70 * crest * (0.25 + 0.75 * toSun * toSun * toSun) + 0.22 * shoal + 0.10 * nv * nv + 0.55 * smoothstep(0.0, 0.9, wake);
  vec3 body = (vec3(0.005, 0.028, 0.055) + vec3(0.020, 0.185, 0.215) * scat) * uWaterK;

  vec3 col = mix(body, refl, fres);
  col *= 1.0 - 0.5 * shadow;
  col += uSunCol * spec * (1.0 - shadow);

  // 흰 거품: 파도 꼭대기가 뭉치는 곳(야코비안이 작은 곳)과 항적
  float cap = 1.0 - smoothstep(0.56, 0.80, jac);
  float ft = texture2D(tWater, uvw * 0.19 + uTime * vec2(0.008, 0.005)).b * 0.6 + texture2D(tWater, uvw * 0.058 - uTime * vec2(0.004, 0.006)).b * 0.4;
  float foamAmt = clamp(cap * 0.9 + wake, 0.0, 1.5);
  float foam = clamp((foamAmt - (1.0 - ft) * 0.80) * 2.6, 0.0, 1.0);
  vec3 foamCol = vec3(0.70, 0.76, 0.83) * uFoamK + uSunCol * (0.07 + 0.16 * max(dot(N, uSunDir), 0.0));
  foamCol *= 1.0 - 0.45 * shadow;
  col = mix(col, foamCol, foam * 0.93);

  // 안개: 수평선이 하늘과 같은 색으로 이어진다
  float fd = dist * uFogDensity;
  float fog = 1.0 - exp(-fd * fd);
  col = mix(col, skyBase(vec3(-V.x, 0.0, -V.z)), fog);

  // 핵폭탄: 반경 안 바다가 방사능처럼 초록빛으로 빛나다가 천천히 돌아온다
  if (uNuke.w > 0.001) {
    float nd = length(vWorld.xz - uNuke.xy);
    float nk = uNuke.w * (1.0 - smoothstep(uNuke.z * 0.78, uNuke.z, nd));
    float pul = 0.75 + 0.25 * sin(uTime * 2.2 - nd * 0.025);
    vec3 glow = vec3(0.22, 2.3, 0.55) * (0.6 + 0.6 * crest + 0.5 * foam) * pul;
    col = mix(col, glow, clamp(nk, 0.0, 1.0) * 0.9);   // 안개보다 뒤에: 멀리서도 빛나 보이게
  }


  gl_FragColor = vec4(col, 1.0);${GLSL_OUT}
}
`;
  const mat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms, vertexShader: vs, fragmentShader: fs, side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(buildOceanGeometry(q.oceanRings, q.oceanSectors, 2.0, 4200), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  scene.add(mesh);
}

/* ==========================================================================
 * 날씨: 폭풍일 때 비와 번개
 * ========================================================================== */
const RAIN_N = 1400;
let rainMesh = null, rainPos = null, boltT = 6, thunderT = -1;
function initRain() {
  rainPos = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) { const j = i * 6; rainPos[j] = rr(-60, 60); rainPos[j + 1] = rr(0, 50); rainPos[j + 2] = rr(-60, 60); }
  const g = new THREE.BufferGeometry();
  const a = new THREE.BufferAttribute(rainPos, 3); a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', a);
  rainMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(0.75, 0.80, 0.88), transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
  rainMesh.frustumCulled = false; rainMesh.visible = false; rainMesh.renderOrder = 18;
  scene.add(rainMesh);
}
function weatherUpdate(dt) {
  const E = ENV;
  if (!rainMesh || !E) return;
  rainMesh.visible = !!E.rain;
  if (E.rain) {
    // 카메라를 둘러싼 상자 안에서 빗줄기가 비스듬히 떨어지고, 바닥에 닿으면 위로 되돌아간다
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, vx = -6, vy = -34, vz = 3, L = 0.045;
    for (let i = 0; i < RAIN_N; i++) {
      const j = i * 6;
      let x = rainPos[j] + vx * dt, y = rainPos[j + 1] + vy * dt, z = rainPos[j + 2] + vz * dt;
      if (y < cy - 25 || x < cx - 60 || x > cx + 60 || z < cz - 60 || z > cz + 60) { x = cx + rr(-60, 60); y = cy + rr(5, 30); z = cz + rr(-60, 60); }
      rainPos[j] = x; rainPos[j + 1] = y; rainPos[j + 2] = z;
      rainPos[j + 3] = x - vx * L; rainPos[j + 4] = y - vy * L; rainPos[j + 5] = z - vz * L;
    }
    rainMesh.geometry.attributes.position.needsUpdate = true;
  }
  // 번개: 가끔 하늘이 번쩍이고 조금 뒤 천둥
  const U = ENV_U.uSkyFlash;
  if (U.value > 0) U.value = Math.max(0, U.value - dt * 3.5);
  if (E.lightning) {
    boltT -= dt;
    if (boltT <= 0) {
      boltT = rr(7, 18);
      U.value = 1; flash(0.35, 0.85, 0.9, 1);
      thunderT = rr(0.5, 1.6);
    }
    if (thunderT > 0) { thunderT -= dt; if (thunderT <= 0) Sound.play('explosion', 0.55, 0.32, 0); }
  }
}
