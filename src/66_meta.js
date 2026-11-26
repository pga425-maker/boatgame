
/* ==========================================================================
 * 업적 · 페인트 · 스킨 — 판이 끝나도 남는다 (기록과 함께 저장 코드에도 들어간다)
 * 업적: 깨면 포인트(지금 판) 또는 페인트, 몇몇은 스킨을 준다
 * 페인트: 격파·웨이브 클리어로 모은다. 모은 페인트로 내 배 스킨을 연다
 * ========================================================================== */
const ACH = [
  { id: 'k1', name: '첫 격침', desc: '적을 처음으로 격파', rw: { paint: 20 }, v: () => totKills(), n: 1 },
  { id: 'k100', name: '백전노장', desc: '적 100척 격파 (누적)', rw: { paint: 60 }, v: () => totKills(), n: 100 },
  { id: 'k500', name: '바다의 지배자', desc: '적 500척 격파 (누적)', rw: { paint: 150 }, v: () => totKills(), n: 500 },
  { id: 'w5', name: '다섯 번째 파도', desc: '한 판에 웨이브 5 도달', rw: { pts: 30 }, v: () => achWave(), n: 5 },
  { id: 'w10', name: '열 번째 파도', desc: '한 판에 웨이브 10 도달', rw: { paint: 80 }, v: () => achWave(), n: 10 },
  { id: 'w20', name: '끝없는 바다', desc: '한 판에 웨이브 20 도달', rw: { skin: 'gold' }, v: () => achWave(), n: 20 },
  { id: 'boss1', name: '기함 격침', desc: '적 기함을 처음 격파', rw: { paint: 50 }, v: () => stv('bossKill'), n: 1 },
  { id: 'mgBoss', name: '기관총의 신', desc: '기관총만으로 적 기함 격파', rw: { paint: 120 }, v: () => stv('mgBoss'), n: 1 },
  { id: 'flare10', name: '속임수의 달인', desc: '플레어로 적 미사일 10발 따돌리기 (누적)', rw: { pts: 40 }, v: () => stv('flareDecoy'), n: 10 },
  { id: 'noHit', name: '무결점 항해', desc: '피해 없이 웨이브 하나 클리어', rw: { paint: 60 }, v: () => stv('noHit'), n: 1 },
  { id: 'up10', name: '10강 달성', desc: '배 강화 +10', rw: { paint: 80 }, v: () => Math.max(stv('shipMax'), Skill.ship), n: 10 },
  { id: 'up20', name: '20강 달성', desc: '배 강화 +20', rw: { skin: 'chrome' }, v: () => Math.max(stv('shipMax'), Skill.ship), n: 20 },
  { id: 'lv10', name: '베테랑 함장', desc: '레벨 10 달성', rw: { paint: 100 }, v: () => Rec.lv, n: 10 },
  { id: 'nuke', name: '핵 단추', desc: '핵폭탄 사용', rw: { pts: 30 }, v: () => stv('nuke'), n: 1 },
  { id: 'smoke5', name: '보이지 않는 배', desc: '연막탄 5번 사용 (누적)', rw: { paint: 40 }, v: () => stv('smokeUse'), n: 5 },
  { id: 'heli1', name: '헬기 격추', desc: '공격 헬기 처음 격추', rw: { pts: 30 }, v: () => stv('heliKill'), n: 1 },
  { id: 'drone30', name: '드론 사냥꾼', desc: '자폭 드론 30대 격추 (누적)', rw: { paint: 60 }, v: () => stv('droneKill'), n: 30 },
  { id: 'decoy10', name: '불꽃놀이', desc: '플레어로 드론 10대 속이기 (누적)', rw: { paint: 40 }, v: () => stv('droneDecoy'), n: 10 },
  { id: 'reef', name: '암초 조심', desc: '적을 섬·암초에 부딪혀 격침', rw: { paint: 40 }, v: () => stv('reefKill'), n: 1 },
  { id: 'fog', name: '안개 속 사냥', desc: '짙은 안개 웨이브 클리어', rw: { paint: 40 }, v: () => stv('sp_fog'), n: 1 },
  { id: 'night', name: '야간 생존', desc: '야간 기습 웨이브 클리어', rw: { paint: 50 }, v: () => stv('sp_night'), n: 1 },
  { id: 'escort', name: '호위 성공', desc: '보급선을 끝까지 지키기', rw: { pts: 40 }, v: () => stv('escortOk'), n: 1 },
  { id: 'storm', name: '폭풍 항해', desc: '폭풍 웨이브 클리어', rw: { paint: 40 }, v: () => stv('sp_storm'), n: 1 }
];
// 스킨: p 무늬 번호(셰이더), c 색들, cost 페인트 (ach: 그 업적 보상으로만)
const SKINS = [
  { id: 'base', name: '기본 회색', cat: '단색', cost: 0, p: 0, c: [0x78838c] },
  { id: 'white', name: '순백', cat: '단색', cost: 30, p: 1, c: [0xe6eaed] },
  { id: 'black', name: '올블랙', cat: '단색', cost: 30, p: 1, c: [0x1e2024] },
  { id: 'red', name: '레드', cat: '단색', cost: 30, p: 1, c: [0xa8241d] },
  { id: 'navy', name: '네이비', cat: '단색', cost: 30, p: 1, c: [0x1f3a66] },
  { id: 'olive', name: '올리브', cat: '단색', cost: 30, p: 1, c: [0x4d5b33] },
  { id: 'purple', name: '퍼플', cat: '단색', cost: 30, p: 1, c: [0x553585] },
  { id: 'dazzle', name: '다즐 위장', cat: '위장', cost: 80, p: 2, c: [0x15171a, 0xeef0f1, 0x5d7c96] },
  { id: 'ms32', name: 'Measure 32', cat: '위장', cost: 80, p: 3, c: [0x1b1d20, 0x67747f, 0xaab4bb] },
  { id: 'wa', name: '웨스턴 어프로치', cat: '위장', cost: 80, p: 4, c: [0xe7ecee, 0x7f9bb2, 0x86a596] },
  { id: 'baltic', name: '발트 줄무늬', cat: '위장', cost: 90, p: 5, c: [0xb6bdc2, 0x14161a, 0xf0f2f2] },
  { id: 'digital', name: '디지털 위장', cat: '멋진', cost: 110, p: 9, c: [0x27303b, 0x485667, 0x6c7f92, 0x161b22] },
  { id: 'neon', name: '네온 라인', cat: '멋진', cost: 140, p: 6, c: [0x121317, 0x1fe4ff, 0xff38ec] },
  { id: 'flame', name: '불꽃', cat: '멋진', cost: 140, p: 7, c: [0x141414, 0xff3a10, 0xffb21a] },
  { id: 'chrome', name: '크롬 실버', cat: '멋진', cost: 0, ach: 'up20', p: 8, c: [0xd8dfe5] },
  { id: 'gold', name: '금색', cat: '멋진', cost: 0, ach: 'w20', p: 8, c: [0xd8a93c] },
  { id: 'pink', name: '파스텔 핑크', cat: '귀여운', cost: 60, p: 10, c: [0xf3a9c6, 0xfff7fb] },
  { id: 'duck', name: '고무오리', cat: '귀여운', cost: 60, p: 11, c: [0xffcf2e, 0xff8a1a] },
  { id: 'shark', name: '상어 입', cat: '귀여운', cost: 70, p: 12, c: [0x6f7d88, 0xc8302e, 0xffffff] },
  { id: 'dots', name: '땡땡이', cat: '귀여운', cost: 60, p: 13, c: [0x86cfe6, 0xffffff] }
];
// 카드에 보여 줄 견본 그림 (CSS)
const SKIN_CSS = {
  base: 'linear-gradient(160deg,#8a959d,#5f6a72)',
  dazzle: 'repeating-linear-gradient(118deg,#15171a 0 10px,#eef0f1 10px 18px,#5d7c96 18px 26px,#15171a 26px 30px)',
  ms32: 'conic-gradient(from 30deg at 35% 60%,#1b1d20 0 25%,#67747f 0 48%,#aab4bb 0 63%,#1b1d20 0 80%,#67747f 0)',
  wa: 'radial-gradient(circle at 30% 40%,#7f9bb2 0 22%,transparent 23%),radial-gradient(circle at 70% 65%,#86a596 0 20%,transparent 21%),#e7ecee',
  baltic: 'linear-gradient(90deg,#14161a 0 14%,transparent 14% 86%,#14161a 86%),repeating-linear-gradient(115deg,#b6bdc2 0 12px,#14161a 12px 18px,#f0f2f2 18px 22px)',
  digital: 'conic-gradient(#27303b 0 25%,#485667 0 50%,#6c7f92 0 75%,#161b22 0) 0 0/12px 12px',
  neon: 'linear-gradient(180deg,transparent 46%,#1fe4ff 46% 52%,transparent 52%),repeating-linear-gradient(60deg,transparent 0 14px,#ff38ec 14px 16px,transparent 16px 30px),#121317',
  flame: 'radial-gradient(ellipse at 90% 100%,#ffb21a 0 22%,#ff3a10 40%,transparent 62%),#141414',
  chrome: 'linear-gradient(135deg,#f4f7f9 0%,#9aa6ae 40%,#eef2f5 55%,#7d8a93 100%)',
  gold: 'linear-gradient(135deg,#ffe28a 0%,#b9852a 42%,#ffd56a 58%,#8a5f17 100%)',
  pink: 'linear-gradient(180deg,#fff7fb 0 38%,#f3a9c6 38%)',
  duck: 'radial-gradient(circle at 82% 50%,#ff8a1a 0 12%,transparent 13%),#ffcf2e',
  shark: 'linear-gradient(170deg,transparent 52%,#c8302e 52% 66%,transparent 66%),radial-gradient(circle at 68% 34%,#fff 0 5%,#111 6% 8%,transparent 9%),#6f7d88',
  dots: 'radial-gradient(circle,#fff 0 28%,transparent 30%) 0 0/16px 16px,#86cfe6'
};
const AchSt = { queue: [], showT: 0 };
function stv(k) { return (Rec.st && Rec.st[k]) || 0; }
function totKills() { return Rec.kills + Math.max(0, kills - SaveSt.counted); }
function achWave() { return Game.state === 'menu' ? 0 : round; }

function metaInit() {
  if (!Rec.ach) Rec.ach = {};
  if (!Rec.st) Rec.st = {};
  if (!Rec.skins) Rec.skins = ['base'];
  if (Rec.paint == null) Rec.paint = 0;
  if (!Rec.skin) Rec.skin = 'base';
}
function achStat(k, n) { metaInit(); Rec.st[k] = (Rec.st[k] || 0) + n; achCheck(); }
function achSet(k, v) { metaInit(); if (v > (Rec.st[k] || 0)) Rec.st[k] = v; achCheck(); }
function paintGain(n) { metaInit(); Rec.paint += n; Game.paintRun = (Game.paintRun || 0) + n; }
// 새로 깬 업적이 있는지
function achCheck() {
  metaInit();
  let any = false;
  for (const A of ACH) {
    if (Rec.ach[A.id]) continue;
    if (A.v() < A.n) continue;
    Rec.ach[A.id] = 1; any = true;
    let msg = '';
    if (A.rw.paint) { Rec.paint += A.rw.paint; msg = '페인트 +' + A.rw.paint; }
    if (A.rw.pts) { Skill.pts += A.rw.pts; msg = '포인트 +' + A.rw.pts; }
    if (A.rw.skin) { if (Rec.skins.indexOf(A.rw.skin) < 0) Rec.skins.push(A.rw.skin); msg = '스킨 「' + skinById(A.rw.skin).name + '」'; }
    AchSt.queue.push({ name: A.name, msg: msg });
  }
  if (any) { recSave(); metaBadge(); }
}
function achUpdate(dt) {
  const el = $('ach-pop');
  if (AchSt.showT > 0) { AchSt.showT -= dt; if (AchSt.showT <= 0) el.classList.remove('on'); return; }
  if (!AchSt.queue.length) return;
  const q = AchSt.queue.shift();
  el.innerHTML = '<i class="ach-ic">★</i><div><span>업적 달성</span><b>' + q.name + '</b><em>' + q.msg + '</em></div>';
  el.classList.add('on'); AchSt.showT = 3.4;
  Sound.play('pickup', 0.7, 1.6, 0);
}
// 일시정지에서 강화처럼 게임이 멈춘 동안에도 알림을 띄운다
let achRealT = 0;
function achTick(now) { const dt = achRealT ? Math.min(0.1, (now - achRealT) / 1000) : 0; achRealT = now; if (Game.state !== 'play') achUpdate(dt); }

/* ---------- 스킨 ---------- */
function skinById(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
const SkinU = { uSkinP: { value: 0 }, uC0: { value: new THREE.Color() }, uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() } };
function skinApply(id) {
  const S = skinById(id), c = S.c;
  SkinU.uSkinP.value = S.p;
  SkinU.uC0.value.set(c[0]).convertSRGBToLinear(); SkinU.uC1.value.set(c[1] || c[0]).convertSRGBToLinear();
  SkinU.uC2.value.set(c[2] || c[1] || c[0]).convertSRGBToLinear(); SkinU.uC3.value.set(c[3] || c[0]).convertSRGBToLinear();
}
// 내 배 재질: 보통 배 재질 + 스킨 무늬 (정점의 aPaint가 칠할 곳, 배 기준 위치로 무늬를 그린다)
function skinMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide });
  mat.onBeforeCompile = function (sh) {
    sh.uniforms.uBoatFog = uBoatFog;
    for (const k in SkinU) sh.uniforms[k] = SkinU[k];
    sh.vertexShader = 'attribute float aPaint;\nvarying float vPaint;\nvarying vec3 vLp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPaint = aPaint; vLp = position;');
    sh.fragmentShader = 'uniform float uBoatFog;\nuniform float uSkinP;\nuniform vec3 uC0;\nuniform vec3 uC1;\nuniform vec3 uC2;\nuniform vec3 uC3;\nvarying float vPaint;\nvarying vec3 vLp;\n' + SKIN_GLSL +
      sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n vec3 skEm = vec3(0.0); float skMet = -1.0;\n if (vPaint > 0.5 && uSkinP > 0.5) diffuseColor.rgb = skinCol(vLp, vPaint, vColor, skEm, skMet);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n if (skMet >= 0.0) metalnessFactor = skMet;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n if (skMet >= 0.0) roughnessFactor = 0.32;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += skEm;')
        .replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace('gl_FragColor.rgb = mix(', 'fogFactor *= uBoatFog;\n\tgl_FragColor.rgb = mix('));
  };
  return mat;
}
const SKIN_GLSL = [
  'float skH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
  'float skN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(mix(skH(i), skH(i + vec3(1,0,0)), f.x), mix(skH(i + vec3(0,1,0)), skH(i + vec3(1,1,0)), f.x), f.y),',
  '             mix(mix(skH(i + vec3(0,0,1)), skH(i + vec3(1,0,1)), f.x), mix(skH(i + vec3(0,1,1)), skH(i + vec3(1,1,1)), f.x), f.y), f.z); }',
  'bool skIs(float k){ return abs(uSkinP - k) < 0.5; }',
  'vec3 skinCol(vec3 p, float part, vec3 vc, inout vec3 em, inout float met){',
  '  float lum = dot(vc, vec3(0.3, 0.59, 0.11)), sh = clamp(lum / 0.22, 0.8, 1.3);',
  '  bool sup = part > 1.5;',
  '  vec3 c = uC0;',
  '  if (skIs(1.0)) { c = sup ? mix(uC0, vec3(1.0), 0.1) : uC0; }',
  '  else if (skIs(2.0)) {',                                 // 다즐: 구역마다 각도가 다른 날카로운 띠
  '    float s = floor(p.z / 2.6 + 10.0), a = (skH(vec3(s, 1.0, 2.0)) - 0.5) * 2.4 + 0.6;',
  '    float w = (p.z * sin(a) + p.y * cos(a) + p.x * 0.15) * 1.5 + skH(vec3(s, 3.0, 4.0)) * 3.0, b = mod(floor(w), 3.0);',
  '    c = b < 0.5 ? uC0 : (b < 1.5 ? uC1 : uC2);',
  '  } else if (skIs(3.0)) {',                               // Measure 32: 비스듬한 다각형 조각
  '    vec2 q = vec2(p.z * 0.34 + p.y * 0.3, p.y * 0.55 - p.z * 0.12 + p.x * 0.2);',
  '    float r = skH(vec3(floor(q), 7.0));',
  '    c = r < 0.38 ? uC0 : (r < 0.72 ? uC1 : uC2);',
  '  } else if (skIs(4.0)) {',                               // 웨스턴 어프로치: 흰 바탕에 부드러운 청회·녹회 얼룩
  '    float n = skN(p * vec3(0.5, 0.8, 0.32) + 3.0);',
  '    c = n > 0.64 ? uC2 : (n > 0.5 ? uC1 : uC0);',
  '  } else if (skIs(5.0)) {',                               // 발트 줄무늬: 검은 함수·함미, 흑백 사선 줄, 흰 가짜 물결
  '    float az = abs(p.z);',
  '    if (az > 5.0) c = uC1;',
  '    else { float f = fract((p.z + p.y * 0.75) * 0.42); c = f < 0.2 ? uC1 : (f < 0.3 ? uC2 : uC0); }',
  '    if (!sup && az > 3.6 && az < 5.6 && p.y < 0.15 + (az - 3.6) * 0.55 && p.y > -0.4) c = uC2;',
  '  } else if (skIs(6.0)) {',                               // 네온: 무광 검정에 빛나는 선
  '    c = uC0;',
  '    float l1 = abs(p.y - 0.95), l2 = fract(p.z * 0.22 + abs(p.y - 0.4) * 0.55);',
  '    if (!sup && l1 < 0.05) { c = uC1; em = uC1 * 2.4; }',
  '    else if (!sup && l2 < 0.035) { c = uC2; em = uC2 * 2.0; }',
  '    else if (sup && fract(p.y * 1.4) < 0.07) { c = uC1; em = uC1 * 1.6; }',
  '  } else if (skIs(7.0)) {',                               // 불꽃: 뱃머리에서 뒤로 뻗는 불길
  '    float n = skN(vec3(p.z * 0.9, p.y * 1.6, p.x * 0.5)), t = (p.z + 1.5) / 8.0, h = (p.y + 0.6) / 2.4;',
  '    float f = t * 1.15 - h * 0.55 + (n - 0.5) * 0.55;',
  '    if (f > 0.3) { c = mix(uC1, uC2, smoothstep(0.3, 0.85, f)); em = c * 0.35; } else c = uC0;',
  '  } else if (skIs(8.0)) { float g = 0.85 + 0.3 * smoothstep(0.2, 1.6, p.y) ; c = uC0 * g; met = 0.5; em = uC0 * 0.16; }',          // 금속 (크롬·금)
  '  else if (skIs(9.0)) {',                                 // 디지털 위장: 각진 픽셀 덩어리
  '    vec3 q = floor(p * 2.4);',
  '    float r = skH(q) * 0.45 + skN(floor(p * 0.9) + 0.5) * 0.85, k = floor(clamp(r / 1.3, 0.0, 0.999) * 4.0);',
  '    c = k < 0.5 ? uC0 : (k < 1.5 ? uC1 : (k < 2.5 ? uC2 : uC3));',
  '  } else if (skIs(10.0)) { c = sup ? uC1 : uC0; }',
  '  else if (skIs(11.0)) { c = sup ? mix(uC0, vec3(1.0), 0.15) : uC0; if (!sup && p.z > 5.6) c = uC1; }',
  '  else if (skIs(12.0)) {',                                // 상어 입: 뱃머리 옆에 이빨 달린 빨간 입과 눈
  '    c = uC0;',
  '    if (!sup) {',
  '      float u = (p.z - 3.4) / 3.2, yc = 0.62 + u * 0.12, hw = 0.5 * pow(clamp(u, 0.0, 1.0), 0.7);',
  '      float dy = abs(p.y - yc);',
  '      if (u > 0.0 && u < 1.0 && dy < hw) {',
  '        c = uC1;',
  '        float edge = hw - dy, tooth = abs(fract(p.z * 3.2) - 0.5) * 2.0;',
  '        if (edge < 0.16 * (1.0 - tooth) + 0.02) c = uC2;',
  '      }',
  '      vec2 e = vec2(p.z - 3.1, p.y - 1.15);',
  '      float ed = length(e);',
  '      if (ed < 0.2) c = ed < 0.1 ? vec3(0.02) : uC2;',
  '      if (p.y < 0.2) c = mix(uC0, vec3(0.92), 0.6);',
  '    }',
  '  } else if (skIs(13.0)) {',                              // 땡땡이
  '    vec3 q = fract(p * 1.25) - 0.5;',
  '    c = length(q) < 0.27 ? uC1 : uC0;',
  '  }',
  '  return c * sh;',
  '}'
].join('\n') + '\n';

function skinSel(id) {
  metaInit();
  const S = skinById(id);
  if (Rec.skins.indexOf(id) >= 0) { Rec.skin = id; skinApply(id); recSave(); Sound.play('ping', 0.5, 1.4, 0); return true; }
  if (S.ach) { Sound.play('dry', 0.5, 1, 0); return false; }
  if (Rec.paint < S.cost) { Sound.play('dry', 0.5, 1, 0); return false; }
  Rec.paint -= S.cost; Rec.skins.push(id); Rec.skin = id; skinApply(id); recSave();
  Sound.play('pickup', 0.7, 1.2, 0);
  return true;
}

/* ---------- 화면: 업적 목록 · 스킨 고르기 (처음 화면 창과 일시정지 탭이 같은 그림을 쓴다) ---------- */
function achHtml() {
  metaInit();
  let done = 0;
  for (const A of ACH) if (Rec.ach[A.id]) done++;
  let h = '<div class="mt-head"><b>업적</b><span>' + done + ' / ' + ACH.length + '</span><div class="mt-bar"><i style="width:' + Math.round(done / ACH.length * 100) + '%"></i></div></div><div class="ach-grid">';
  for (const A of ACH) {
    const ok = !!Rec.ach[A.id], v = Math.min(A.n, A.v()), rw = A.rw.paint ? '페인트 ' + A.rw.paint : (A.rw.pts ? '포인트 ' + A.rw.pts : '스킨 ' + skinById(A.rw.skin).name);
    h += '<div class="ach' + (ok ? ' ok' : '') + '"><i class="ach-ic">' + (ok ? '★' : '☆') + '</i><div class="ach-tx"><b>' + A.name + '</b><span>' + A.desc + '</span>' +
      (ok ? '' : (A.n > 1 ? '<div class="ach-pr"><i style="width:' + Math.round(v / A.n * 100) + '%"></i></div>' : '')) + '</div><em>' + (ok ? '달성' : rw) + '</em></div>';
  }
  return h + '</div>';
}
function skinHtml() {
  metaInit();
  let h = '<div class="mt-head"><b>스킨</b><span class="paint">페인트 <b>' + Rec.paint + '</b></span><span class="dim">격파 +1 · 기함 +8 · 웨이브 클리어 +3 · 업적</span></div>';
  for (const cat of ['단색', '위장', '멋진', '귀여운']) {
    h += '<div class="sk-cat">' + cat + '</div><div class="skin-grid">';
    for (const S of SKINS) {
      if (S.cat !== cat) continue;
      const own = Rec.skins.indexOf(S.id) >= 0, on = Rec.skin === S.id, bg = SKIN_CSS[S.id] || ('#' + S.c[0].toString(16).padStart(6, '0'));
      const btn = on ? '사용 중' : (own ? '사용' : (S.ach ? '업적 보상' : S.cost + ' 페인트'));
      const dis = on || (!own && (S.ach || Rec.paint < S.cost));
      h += '<div class="skin' + (on ? ' on' : '') + (own ? ' own' : '') + '"><div class="skin-sw" style="background:' + bg + '"></div><b>' + S.name + '</b>' +
        '<button type="button" class="skin-go" data-skin="' + S.id + '"' + (dis ? ' disabled' : '') + '>' + btn + '</button></div>';
    }
    h += '</div>';
  }
  return h;
}
function metaBadge() {
  metaInit();
  let done = 0; for (const A of ACH) if (Rec.ach[A.id]) done++;
  const a = $('btn-ach'), s = $('btn-skin');
  if (a) a.innerHTML = '업적 <b>' + done + '/' + ACH.length + '</b>';
  if (s) s.innerHTML = '스킨 <b>페인트 ' + Rec.paint + '</b>';
}
function metaOpen(tab) {
  $('meta').classList.remove('off'); metaTab(tab);
}
function metaTab(tab) {
  $('meta').dataset.tab = tab;
  const bs = $('meta').querySelectorAll('.mt-tabs button');
  for (let i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].dataset.mt === tab);
  $('meta-body').innerHTML = tab === 'skin' ? skinHtml() : achHtml();
}
function initMetaUi() {
  metaInit(); skinApply(Rec.skin); metaBadge();
  const stop = function (e) { e.stopPropagation(); };
  $('btn-ach').addEventListener('click', function (e) { e.stopPropagation(); metaOpen('ach'); });
  $('btn-skin').addEventListener('click', function (e) { e.stopPropagation(); metaOpen('skin'); });
  $('meta').addEventListener('click', function (e) {
    e.stopPropagation();
    const t = e.target.closest('.mt-tabs button'); if (t) { metaTab(t.dataset.mt); return; }
    if (e.target.closest('.mt-close') || e.target === $('meta')) { $('meta').classList.add('off'); metaBadge(); return; }
    const s = e.target.closest('.skin-go'); if (s) { skinSel(s.dataset.skin); metaTab('skin'); metaBadge(); }
  });
  for (const id of ['btn-ach', 'btn-skin', 'meta']) { $(id).addEventListener('touchstart', stop, { passive: true }); $(id).addEventListener('mousedown', stop); }
  $('pane-skin').addEventListener('click', function (e) { e.stopPropagation(); const s = e.target.closest('.skin-go'); if (s) { skinSel(s.dataset.skin); skillRender(); } });
  $('pane-ach').addEventListener('click', function (e) { e.stopPropagation(); });
  for (const id of ['pane-skin', 'pane-ach']) $(id).addEventListener('touchstart', stop, { passive: true });
}
