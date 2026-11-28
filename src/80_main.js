
/* ==========================================================================
 * 입력, 카메라, 조준, 게임 진행
 * ========================================================================== */
const Input = {
  fwd: false, back: false, left: false, right: false, boost: false, space: false, lmb: false, rmb: false, missileReq: false, itemReq: false, itemSlot: 0, flareReq: false, smokeReq: false,
  mdx: 0, mdy: 0, mx: window.innerWidth * 0.5, my: window.innerHeight * 0.5,
  locked: false,        // 지금 Pointer Lock으로 마우스가 고정돼 있는지
  everLocked: false     // 이 환경에서 Pointer Lock이 한 번이라도 됐는지
};

// state: menu(시작 화면) → play ↔ pause → dying(격침 연출) → result(결과 화면)
const Game = { cardT: 0, envKey: 'sunset', slowT: 0, state: 'menu', diffKey: 'normal', items: [], shieldT: 0, boost: CONFIG.boost.max, bonus: 0, missiles: 0, flares: 0, flareT: 0, kSteer: 0, boostOn: false, boostIdle: 9, pendingResume: false, resumeAskT: 0, pausedAt: 0, deathT: 0, lockFails: 0, skipped: [], skipArmT: 0, skipBtnArm: false, smokes: 0, smokeCD: 0, smokeAutoT: 0, paintRun: 0, waveHurt: false };

const Cam = {
  yaw: 0, pitch: CONFIG.camera.pitch,   // 조준 방향 (월드 기준)
  view: 0, blend: 0,                    // view: 0 = 3인칭, 1 = 1인칭. blend가 서서히 따라가며 두 시점을 섞는다
  trauma: 0, fov: CONFIG.camera.fov, idleT: 0, follow: 0,
  px: 0, py: 0, pz: 0, dist: CONFIG.camera.distance,
  rightX: -1, rightZ: 0, fwdX: 0, fwdZ: 1
};
const Aim = { x: 0, y: 0, z: 100, seaX: 0, seaZ: 100, onEnemy: false, dx: 0, dy: 0, dz: 1, mgX: 0, mgY: 0, mgZ: 100, mis: null };
function DIFF() { return CONFIG.difficulty[Game.diffKey]; }
let assistOn = CONFIG.lock.enabled;     // 락온 켜짐 여부 (T 키)
// 락온 상태: cand 조준 원 안의 적, prog 진행(0~1), target 락온 완료된 적. 나머지는 화면 표시용
const Lock = { cand: null, prog: 0, target: null, boxOn: false, bx: 0, by: 0, bs: 1, mgOn: false, mx: 0, my: 0 };
const _lv = new THREE.Vector3();
const Fcs = { target: null };            // 사격 컴퓨터가 겨누는 적 (락온하지 않았을 때 조준점 아래의 배)
let aimRingLocked = false;
const RING_GOLD = sRGB(0xffc267), RING_RED = sRGB(0xff4a3a);

const START_HEADING = -0.61;            // 처음 뱃머리 방향: 해가 오른쪽 앞에 보인다
const WIND_X = 5.5, WIND_Z = 2.2;       // 연기가 흘러가는 바람
const _cA = new THREE.Vector3(), _cB = new THREE.Vector3(), _cC = new THREE.Vector3();

function requestLock() {
  const c = renderer.domElement;
  if (!c.requestPointerLock) return;
  try {
    const p = c.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(noop);   // 막힌 환경이면 조용히 커서 조준 방식으로 계속한다
  } catch (err) { /* 위와 같음 */ }
}
function noop() {}

function updateCursor() {
  renderer.domElement.classList.toggle('nocursor', Game.state === 'play' && !Input.locked && !Touch.on);
}

function clearInput() {
  Input.fwd = Input.back = Input.left = Input.right = Input.boost = Input.space = Input.lmb = Input.rmb = Input.missileReq = Input.itemReq = Input.flareReq = Input.smokeReq = false;
  Input.mdx = 0; Input.mdy = 0;
  touchRelease();
}

/* ---------- 터치 조작: 왼쪽 조이스틱, 오른쪽 버튼, 그 밖의 화면은 끌어서 조준 ---------- */
const LOOK_MAX = 5;
const Touch = {
  on: false, lastT: -1e9,
  joyId: -1, joyCX: 0, joyCY: 0, joyR: 60, jx: 0, jy: 0,      // jx 오른쪽 +, jy 아래쪽 + (-1 ~ 1)
  fireId: -1, fire: false, cannonId: -1, cannon: false, cannonTap: false, boostId: -1, boost: false, missileTap: false, flareTap: false,
  lookN: 0, lookId: new Int32Array(LOOK_MAX), lookX: new Float32Array(LOOK_MAX), lookY: new Float32Array(LOOK_MAX),
  el: null
};

function setTouchMode(on) {
  if (Touch.on === on) return;
  Touch.on = on;
  document.body.classList.toggle('touch', on);
  touchRelease();
  updateCursor();
}

function touchRelease() {
  Touch.joyId = -1; Touch.jx = 0; Touch.jy = 0;
  Touch.fireId = -1; Touch.fire = false; Touch.cannonId = -1; Touch.cannon = false; Touch.cannonTap = false;
  Touch.boostId = -1; Touch.boost = false; Touch.missileTap = false; Touch.flareTap = false; Touch.lookN = 0;
  const E = Touch.el;
  if (!E) return;
  E.joy.style.transform = ''; E.knob.style.transform = '';
  E.joy.classList.remove('on'); E.fire.classList.remove('on'); E.cannon.classList.remove('on'); E.boost.classList.remove('on');
}

function lookAdd(id, x, y) {
  if (Touch.lookN >= LOOK_MAX) return;
  const i = Touch.lookN++;
  Touch.lookId[i] = id; Touch.lookX[i] = x; Touch.lookY[i] = y;
}
function lookRemove(id) {
  for (let i = 0; i < Touch.lookN; i++) {
    if (Touch.lookId[i] !== id) continue;
    const l = --Touch.lookN;
    Touch.lookId[i] = Touch.lookId[l]; Touch.lookX[i] = Touch.lookX[l]; Touch.lookY[i] = Touch.lookY[l];
    return;
  }
}

// 조이스틱: 왼쪽 아래 구역을 누르면 그 자리로 받침이 옮겨 와서 잡힌다
function joyStart(id, x, y) {
  const E = Touch.el, r = E.joy.getBoundingClientRect();
  const R = r.width * 0.5, hx = r.left + R, hy = r.top + R;
  const cx = clamp(x, R + 6, window.innerWidth - R - 6), cy = clamp(y, R + 6, window.innerHeight - R - 6);
  Touch.joyId = id; Touch.joyR = R; Touch.joyCX = cx; Touch.joyCY = cy;
  E.joy.style.transform = 'translate(' + (cx - hx).toFixed(1) + 'px,' + (cy - hy).toFixed(1) + 'px)';
  E.joy.classList.add('on');
  joyMove(x, y);
}
function joyMove(x, y) {
  let dx = (x - Touch.joyCX) / Touch.joyR, dy = (y - Touch.joyCY) / Touch.joyR;
  const m = Math.sqrt(dx * dx + dy * dy);
  if (m > 1) { dx /= m; dy /= m; }
  Touch.el.knob.style.transform = 'translate(' + (dx * Touch.joyR).toFixed(1) + 'px,' + (dy * Touch.joyR).toFixed(1) + 'px)';
  const dz = CONFIG.touch.deadZone, mm = Math.min(m, 1);
  if (mm < dz) { Touch.jx = 0; Touch.jy = 0; return; }
  const k = (mm - dz) / (1 - dz) / mm;
  Touch.jx = dx * mm * k; Touch.jy = dy * mm * k;
}
function joyEnd() {
  Touch.joyId = -1; Touch.jx = 0; Touch.jy = 0;
  Touch.el.joy.style.transform = ''; Touch.el.knob.style.transform = '';
  Touch.el.joy.classList.remove('on');
}

function onTouchStart(e) {
  Touch.lastT = performance.now();
  if (!Touch.on) setTouchMode(true);
  if (Game.state !== 'play') return;          // 시작·일시정지·결과 화면은 보통 클릭처럼 동작한다
  e.preventDefault();
  if (!player.alive) return;
  const W = window.innerWidth, H = window.innerHeight, E = Touch.el;
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i], id = t.identifier, x = t.clientX, y = t.clientY;
    const btn = t.target && t.target.closest ? t.target.closest('[data-tb]') : null;
    const kind = btn ? btn.getAttribute('data-tb') : '';
    if (kind === 'fire') { Touch.fireId = id; Touch.fire = true; E.fire.classList.add('on'); lookAdd(id, x, y); }
    else if (kind === 'cannon') { Touch.cannonId = id; Touch.cannon = true; Touch.cannonTap = true; E.cannon.classList.add('on'); lookAdd(id, x, y); }
    else if (kind === 'boost') { Touch.boostId = id; Touch.boost = true; E.boost.classList.add('on'); }
    else if (kind === 'missile') { Touch.missileTap = true; lookAdd(id, x, y); }
    else if (kind === 'flare') { Touch.flareTap = true; lookAdd(id, x, y); }
    else if (kind === 'smoke') { Input.smokeReq = true; lookAdd(id, x, y); }
    else if (kind === 'item') { Input.itemReq = true; Input.itemSlot = +btn.getAttribute('data-slot') || 0; }
    else if (kind === 'view') toggleView();
    else if (kind === 'assist') toggleAssist();
    else if (kind === 'pause') { pauseGame(); return; }
    else if (kind === 'lite') { liteToggle(); return; }
    else if (Touch.joyId < 0 && x < W * CONFIG.touch.joystickZone && y > H * 0.4) joyStart(id, x, y);
    else lookAdd(id, x, y);                    // 버튼이 없는 곳은 어디든 끌어서 조준
  }
}

function onTouchMove(e) {
  Touch.lastT = performance.now();
  if (Game.state !== 'play') return;
  e.preventDefault();
  const k = CONFIG.touch.lookSensitivity / CONFIG.camera.sensitivity;
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i], id = t.identifier, x = t.clientX, y = t.clientY;
    if (id === Touch.joyId) { joyMove(x, y); continue; }
    for (let j = 0; j < Touch.lookN; j++) {
      if (Touch.lookId[j] !== id) continue;
      Input.mdx += (x - Touch.lookX[j]) * k; Input.mdy += (y - Touch.lookY[j]) * k;
      Touch.lookX[j] = x; Touch.lookY[j] = y;
      break;
    }
  }
}

function onTouchEnd(e) {
  Touch.lastT = performance.now();
  if (Game.state === 'play') e.preventDefault();
  const E = Touch.el;
  for (let i = 0; i < e.changedTouches.length; i++) {
    const id = e.changedTouches[i].identifier;
    if (id === Touch.joyId) joyEnd();
    if (id === Touch.fireId) { Touch.fireId = -1; Touch.fire = false; E.fire.classList.remove('on'); }
    if (id === Touch.cannonId) { Touch.cannonId = -1; Touch.cannon = false; E.cannon.classList.remove('on'); }
    if (id === Touch.boostId) { Touch.boostId = -1; Touch.boost = false; E.boost.classList.remove('on'); }
    lookRemove(id);
  }
}

function isPortrait() { return window.innerHeight > window.innerWidth; }

// 터치 기기에서 시작할 때: 되는 환경이면 전체 화면으로 바꾸고 가로로 고정한다 (안 되면 그냥 넘어간다)
function goLandscape() {
  const el = document.documentElement;
  try {
    const f = el.requestFullscreen || el.webkitRequestFullscreen;
    if (f && !document.fullscreenElement && !document.webkitFullscreenElement) {
      const p = f.call(el);
      if (p && typeof p.then === 'function') p.then(lockLandscape, noop);
      else lockLandscape();
    } else lockLandscape();
  } catch (err) { /* 전체 화면이 막힌 환경 */ }
}
function lockLandscape() {
  try {
    const o = screen.orientation;
    if (o && o.lock) { const p = o.lock('landscape'); if (p && typeof p.catch === 'function') p.catch(noop); }
  } catch (err) { /* 방향 고정이 안 되는 환경 */ }
}

function selectDiff(k) {
  if (!CONFIG.difficulty[k]) return;
  Game.diffKey = k; setgSave();
  const db = document.querySelectorAll('[data-diff]');
  for (let i = 0; i < db.length; i++) db[i].classList.toggle('sel', db[i].getAttribute('data-diff') === k);
  Sound.play('tick', 0.4, 1, 0);
}

// 배경 고르기 (게임 시작 전에만). 시작 화면 뒤 바다에 바로 보인다
function selectEnv(k, quiet) {
  if (!CONFIG.env[k]) return;
  Game.envKey = k; setgSave();
  applyEnv(k);
  const eb = document.querySelectorAll('[data-env]');
  for (let i = 0; i < eb.length; i++) eb[i].classList.toggle('sel', eb[i].getAttribute('data-env') === k);
  if (!quiet) Sound.play('tick', 0.4, 1, 0);
}

function toggleAssist() {
  assistOn = !assistOn; setgSave();
  if (!assistOn) lockReset();
  Hud.toast(assistOn ? '락온 켜짐' : '락온 꺼짐');
  $('assist-btn').textContent = '락온: ' + (assistOn ? '켜짐' : '꺼짐');
  Sound.play('tick', 0.4, assistOn ? 1.2 : 0.8, 0);
}

function toggleView() {
  if ((Game.state === 'play' || Game.state === 'pause') && player.alive) { Cam.view = 1 - Cam.view; setgSave(); }
  viewBtnText();
}
// 저사양 모드 켜기·끄기: 해상도 상한·입자·배경 효과·블러는 바로, 나머지는 새로 고침 뒤
function liteToggle() {
  LITE_ON = !LITE_ON; Setg.lo = LITE_ON ? 1 : 0; setgSave();
  liteApply(true);
}
function liteApply(say) {
  const q = CONFIG.quality, L = CONFIG.liteQuality;
  q.maxPixelRatio = LITE_ON ? L.maxPixelRatio : QBASE.maxPixelRatio;
  q.effectScale = LITE_ON ? L.effectScale : QBASE.effectScale;
  q.effectRange = LITE_ON ? L.effectRange : QBASE.effectRange;
  FX_LITE = LITE_ON;
  perfCeil = 99;
  const pr = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio);
  if (LITE_ON ? pixelRatio > pr : pixelRatio < pr) { pixelRatio = pr; renderer.setPixelRatio(pixelRatio); }
  document.body.classList.toggle('lite', LITE_ON);
  if (rainMesh) rainMesh.geometry.setDrawRange(0, LITE_ON ? RAIN_N : RAIN_N * 2);      // 비는 절반만
  const t = '저사양 모드 ' + (LITE_ON ? '켜짐' : '꺼짐');
  for (const id of ['lite-btn', 'lite-btn2', 'lite-btn3']) { const el = $(id); if (el) { el.classList.toggle('on', LITE_ON); el.querySelector('b').textContent = LITE_ON ? 'ON' : 'OFF'; } }
  if (say) Hud.toast(t + (LITE_ON ? ' · 새로 고침하면 바다·입자 수까지 가벼워집니다' : ''));
}
function musicBtnText() { $('music-btn').textContent = '음악: ' + ['꺼짐', '작게', '크게'][Setg.m == null ? 2 : Setg.m]; }
function viewBtnText() { $('view-btn').textContent = '시점: ' + (Cam.view ? '1인칭' : '3인칭'); }

/* ---------- 웨이브 스킵: 지금 웨이브를 끝내고 다음 웨이브로 (보상 없음, 실수 방지로 두 번 눌러야 한다) ---------- */
function doSkip() {
  if (round <= 0) return;
  if (roundState === 0) Game.skipped.push(round);        // 싸우던 웨이브만 기록 (이미 다 잡고 대기 중이면 기록 안 함)
  Game.cardT = 0;
  const was = round;
  clearEnemies();
  for (let i = 0; i < MIS_MAX; i++) { const ms = missiles[i]; if (ms.on && ms.owner === 1) { ms.on = false; ms.mesh.visible = false; ms.target = null; } }
  for (let i = 0; i < SHELL_MAX; i++) { const sh = shells[i]; if (sh.on && sh.owner !== 0) { sh.on = false; sh.mesh.visible = false; } }
  Lock.target = null; Fcs.target = null;
  startRound(was + 1);
  Hud.toast('웨이브 ' + was + ' 스킵');
}
// 키보드 N: 2.5초 안에 한 번 더 누르면 넘긴다
function requestSkip() {
  if (Game.state !== 'play' || round <= 0) return;
  if (Game.skipArmT > 0) { Game.skipArmT = 0; doSkip(); return; }
  Game.skipArmT = 2.5;
  Hud.toast('N을 한 번 더 누르면 웨이브 ' + round + '을 넘깁니다');
}
// 일시정지 화면 버튼: 한 번 누르면 확인 문구, 한 번 더 누르면 넘긴다
function onSkipBtn() {
  if (Game.state !== 'pause' || round <= 0) return;
  const b = $('skip-btn');
  if (!Game.skipBtnArm) { Game.skipBtnArm = true; b.textContent = '정말 넘길까요? 한 번 더 누르세요'; b.classList.add('arm'); return; }
  const was = round;
  doSkip();
  Game.skipBtnArm = false; b.textContent = '웨이브 스킵'; b.classList.remove('arm');
  $('pause-msg').textContent = '웨이브 ' + was + '을 넘겼습니다. ' + (Touch.on ? '화면을 누르면 이어서 합니다.' : '화면을 클릭하면 이어서 합니다.');
}

function pauseGame() {
  if (Game.state !== 'play') return;
  Game.state = 'pause'; Game.pausedAt = performance.now(); Game.pendingResume = false;
  clearInput();
  $('pause-msg').textContent = isPortrait() && Touch.on ? '화면을 가로로 돌린 뒤 계속하기를 누르면 이어서 합니다.' : '계속하기를 누르거나 메뉴 바깥을 ' + (Touch.on ? '누르면' : '클릭하면') + ' 이어서 합니다.';
  Game.skipBtnArm = false; $('skip-btn').textContent = '웨이브 스킵'; $('skip-btn').classList.remove('arm');
  viewBtnText(); musicBtnText(); Skill.sel = null; skillRender();
  $('pause-cards').innerHTML = upgOwnedText();
  $('pause').classList.remove('off');
  Sound.pause(true);
  updateCursor();
}

function resumeNow() {
  if (Game.state !== 'pause') return;
  Game.state = 'play'; Game.pendingResume = false;
  $('pause').classList.add('off');
  Sound.pause(false);
  lastT = performance.now();
  updateCursor();
}

function onPauseClick() {
  if (Game.state !== 'pause') return;
  Sound.init();
  if (Touch.on) {
    if (!isPortrait()) { goLandscape(); resumeNow(); }      // 터치 기기는 마우스 고정 없이 바로 이어 간다 (전체 화면이 풀렸으면 다시 전체 화면으로)
    return;
  }
  requestLock();
  if (Input.everLocked && Game.lockFails < 2) {
    // 마우스 고정을 쓰던 환경: 다시 고정된 뒤에 이어 간다
    if (Input.locked) resumeNow();
    else { Game.pendingResume = true; Game.resumeAskT = performance.now(); }
  } else resumeNow();      // 고정이 안 되는 환경(또는 거듭 실패한 경우)에서는 커서 조준 방식으로 바로 이어 간다
}

function onEscape() {
  if (Game.state === 'play') {
    if (!Input.locked) pauseGame();      // 고정 상태에서는 브라우저가 고정을 풀고, 그때 일시정지된다
  } else if (Game.state === 'pause' && !Input.everLocked && performance.now() - Game.pausedAt > 250) resumeNow();
}

function onKey(e, down) {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': Input.fwd = down; break;
    case 'KeyS': case 'ArrowDown': Input.back = down; break;
    case 'KeyA': case 'ArrowLeft': Input.left = down; break;
    case 'KeyD': case 'ArrowRight': Input.right = down; break;
    case 'ShiftLeft': case 'ShiftRight': Input.boost = down; break;
    case 'Space': Input.space = down; break;
    case 'KeyV': if (down && !e.repeat) toggleView(); break;
    case 'KeyQ': if (down && !e.repeat) Input.missileReq = true; break;
    case 'KeyE': if (down && !e.repeat) { Input.itemReq = true; Input.itemSlot = 0; } break;
    case 'KeyR': if (down && !e.repeat) { Input.itemReq = true; Input.itemSlot = 1; } break;
    case 'KeyG': if (down && !e.repeat) { Input.itemReq = true; Input.itemSlot = 2; } break;
    case 'KeyF': if (down && !e.repeat) Input.flareReq = true; break;
    case 'KeyC': if (down && !e.repeat) Input.smokeReq = true; break;
    case 'KeyL': if (down && !e.repeat) liteToggle(); break;
    case 'KeyK': if (down && !e.repeat && Game.state === 'play') { if (document.pointerLockElement) document.exitPointerLock(); pauseGame(); } break;     // 스킬 트리는 일시정지 화면에
    case 'KeyT': if (down && !e.repeat && (Game.state === 'play' || Game.state === 'pause')) toggleAssist(); break;
    case 'KeyN': if (down && !e.repeat) requestSkip(); break;
    case 'Escape': if (down && !e.repeat) onEscape(); break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
    case 'Numpad1': case 'Numpad2': case 'Numpad3': case 'Numpad4': case 'Numpad5':
      if (down && !e.repeat && Game.state === 'cards') chooseCard(+e.code.slice(-1) - 1);
      break;
    default: return;
  }
  if (Game.state === 'play') e.preventDefault();
}

function bindEvents() {
  document.addEventListener('keydown', function (e) { onKey(e, true); });
  document.addEventListener('keyup', function (e) { onKey(e, false); });
  document.addEventListener('mousemove', function (e) {
    // 터치한 지 한참 뒤에 진짜 마우스가 움직이면 마우스 조작으로 돌아간다
    if (Touch.on && !TOUCH_DEVICE && performance.now() - Touch.lastT > 1500 && (e.movementX || e.movementY)) setTouchMode(false);
    if (Input.locked) {
      Input.mdx += clamp(e.movementX || 0, -250, 250);
      Input.mdy += clamp(e.movementY || 0, -250, 250);
    } else { Input.mx = e.clientX; Input.my = e.clientY; }
  });
  document.addEventListener('mousedown', function (e) {
    if (Game.state !== 'play') return;
    if (e.button === 0) Input.lmb = true; else if (e.button === 2) Input.rmb = true;
    e.preventDefault();
  });
  document.addEventListener('mouseup', function (e) {
    if (e.button === 0) Input.lmb = false; else if (e.button === 2) Input.rmb = false;
  });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });   // 우클릭 메뉴 막기
  document.addEventListener('pointerlockchange', function () {
    const on = document.pointerLockElement === renderer.domElement;
    Input.locked = on;
    if (on) {
      Input.everLocked = true; Input.mdx = 0; Input.mdy = 0; Game.lockFails = 0;
      if (Game.state === 'pause') resumeNow();          // 다시 고정됐으면 이어 간다 (고정 중에는 클릭이 덮개 화면에 닿지 않는다)
    } else if (Game.state === 'play') pauseGame();    // 마우스 고정이 풀리면 일시정지
    updateCursor();
  });
  document.addEventListener('pointerlockerror', noop);
  window.addEventListener('blur', function () { clearInput(); pauseGame(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { clearInput(); pauseGame(); } });
  window.addEventListener('resize', onResize);
  document.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });
  document.addEventListener('touchcancel', onTouchEnd, { passive: false });
  $('start').addEventListener('click', function () {
    if (Game.state !== 'menu') return;
    if (!$('cont').classList.contains('off')) return;       // 이어할 판이 있으면 버튼으로 고른다
    if (Touch.on && isPortrait()) return;       // 세로 화면에서는 가로로 돌려 달라는 안내만 보인다
    Sound.init();        // 오디오는 첫 클릭(터치) 이후에 시작한다
    if (Touch.on) goLandscape(); else requestLock();
    beginGame();
  });
  $('pause').addEventListener('click', onPauseClick);
  // 폰에서 전체 화면이 풀리면(뒤로 가기, 화면 끝 쓸기 등) 일시정지한다. 화면을 누르면 다시 전체 화면으로 이어 간다
  const onFsChange = function () {
    if (Touch.on && !document.fullscreenElement && !document.webkitFullscreenElement && Game.state === 'play') pauseGame();
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  const db = document.querySelectorAll('[data-diff]');
  for (let i = 0; i < db.length; i++) db[i].addEventListener('click', function (e) { e.stopPropagation(); selectDiff(this.getAttribute('data-diff')); });
  const eb = document.querySelectorAll('[data-env]');
  for (let i = 0; i < eb.length; i++) eb[i].addEventListener('click', function (e) { e.stopPropagation(); selectEnv(this.getAttribute('data-env')); });
  $('change-diff').addEventListener('click', function (e) {
    e.stopPropagation();
    if (Game.state !== 'result') return;
    clearEnemies(); shellsClear(); missilesClear(); flaresClear(); hazardsClear(); itemsClear(); lockReset();
    player.reset(0, 0, START_HEADING, simTime);
    $('result').classList.add('off'); $('hud').classList.add('off'); $('start').classList.remove('off');
    Game.state = 'menu'; saveUiRender();
    updateCursor();
  });
  initSkillsUi();
  initSaveUi();
  initMetaUi();
  $('pz').addEventListener('click', function (e) { e.stopPropagation(); });
  $('resume-btn').addEventListener('click', function (e) { e.stopPropagation(); onPauseClick(); });
  $('view-btn').addEventListener('click', function (e) { e.stopPropagation(); toggleView(); });
  $('view-btn').addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
  $('assist-btn').addEventListener('click', function (e) { e.stopPropagation(); toggleAssist(); });
  $('skip-btn').addEventListener('click', function (e) { e.stopPropagation(); onSkipBtn(); });
  $('music-btn').addEventListener('click', function (e) { e.stopPropagation(); Setg.m = ((Setg.m == null ? 2 : Setg.m) + 2) % 3; musicBtnText(); setgSave(); });
  for (const id of ['lite-btn', 'lite-btn2', 'lite-btn3']) {
    $(id).addEventListener('click', function (e) { e.stopPropagation(); if (!TOUCH_DEVICE || id !== 'lite-btn') liteToggle(); });
    $(id).addEventListener('mousedown', function (e) { e.stopPropagation(); });
  }
  $('lite-btn2').addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
  $('lite-btn3').addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
  liteApply(false);
  $('music-btn').addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
  $('skip-btn').addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
  $('assist-btn').addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
  $('restart').addEventListener('click', function (e) {
    e.stopPropagation();
    if (Game.state !== 'result') return;
    Sound.init();
    if (Touch.on) goLandscape(); else requestLock();
    beginGame();
  });
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  uHbRes.value.set(2 / w, 2 / h);
  if (Touch.on && Game.state === 'play' && h > w) pauseGame();     // 세로로 돌리면 멈춘다
}

/* ---------- 플레이어 조작 ---------- */
function playerControl(dt) {
  const P = player, B = CONFIG.boost;
  let thr = (Input.fwd ? 1 : 0) - (Input.back ? 1 : 0);
  // 키보드 A/D: 타가 서서히 꺾이고 떼면 빨리 돌아온다
  const kT = (Input.left ? 1 : 0) - (Input.right ? 1 : 0), PC = CONFIG.player;
  const kRate = (kT !== 0 && kT * Game.kSteer >= 0) ? 1 / PC.steerRamp : 1 / PC.steerReturn;
  Game.kSteer = approach(Game.kSteer, kT, kRate * dt);
  let steer = Game.kSteer;
  if (kT !== 0 && !Input.back && thr === 0) thr = 1;          // A/D만 눌러도 앞으로 가속하며 돈다 (S를 누르면 후진이 우선)
  if (Touch.joyId >= 0) {
    // 조이스틱: 위로 밀면 가속, 아래로 후진, 좌우로 선회 (밀어낸 만큼, 가운데 근처는 덜 민감하게)
    thr = clamp(thr - Touch.jy * CONFIG.touch.throttleGain, -1, 1);
    const jx = Touch.jx, ax = jx < 0 ? -jx : jx, sc = CONFIG.touch.steerCurve;
    if (thr >= 0) thr = Math.max(thr, Math.min(1, ax * CONFIG.touch.throttleGain));   // 옆으로만 밀어도 앞으로 가속
    steer = clamp(steer - jx * (1 - sc + sc * ax), -1, 1);
  }
  P.inThrottle = thr;
  P.inSteer = steer;
  // 부스트: 게이지를 쓰고, 멈추면 잠시 뒤 다시 찬다
  const was = Game.boostOn;
  const canKeep = Game.boost > 0 || Game.bonus > 0, canStart = Game.boost >= B.minToStart || Game.bonus > 0;
  if ((Input.boost || Touch.boost) && thr > 0 && (was ? canKeep : canStart)) {
    Game.boostOn = true; Game.boostIdle = 0;
    // 기본 게이지를 먼저 쓰고, 다 떨어지면 노란 추가 게이지(초 단위)를 쓴다
    let use = B.drainPerSec * dt;
    if (Game.boost > 0) { const u = Math.min(Game.boost, use); Game.boost -= u; use -= u; }
    if (use > 0) Game.bonus = Math.max(0, Game.bonus - use / B.drainPerSec);
  } else {
    Game.boostOn = false; Game.boostIdle += dt;
    if (Game.boostIdle > B.regenDelay) Game.boost = Math.min(B.max, Game.boost + B.regenPerSec * dt);
  }
  if (Game.boostOn && !was) Sound.play('boost', 0.5, 1, 0);
  P.boosting = Game.boostOn;
}

function playerWeapons(dt) {
  const P = player, C = CONFIG.cannon, G = CONFIG.mg;
  const dx = Aim.seaX - P.x, dz = Aim.seaZ - P.z, dist = Math.sqrt(dx * dx + dz * dz);
  const T = Math.max(dist / C.shellSpeed, C.minFlight);
  P.aimWeapons(Aim.seaX, Aim.seaZ, Aim.mgX, Aim.mgZ, Math.atan2(0.5 * C.gravity * T, C.shellSpeed), dt);   // 포탑이 조준 방향을 따라 돈다

  // 기관총: 누르고 있는 동안 연사, 탄약 무한
  mgTimer -= dt;
  if (Input.lmb || Touch.fire) {
    while (mgTimer <= 0) {
      mgTimer += 1 / (G.rate * (Upg.frenzyOn > 0 ? CONFIG.cards.v.frenzyMg : 1) * upgOverMul());   // 강화 카드 '폭주'·'과충전' 중에는 연사가 빨라진다
      P.mgMuzzle.getWorldPosition(_v2);
      let tx = Aim.mgX, ty = Aim.mgY, tz = Aim.mgZ;
      const lt = Lock.target;
      if (!Aim.mis && !lt && !Aim.onEnemy) {
        // 락온 안 했고 조준선이 적에 닿지 않으면: 바라보는 방향으로 일직선 (아래를 봐도 바다에 꽂히지 않게 수평 이하로는 안 내려감)
        const dyc = Aim.dy < 0 ? 0 : Aim.dy, hl = Math.sqrt(Aim.dx * Aim.dx + Aim.dz * Aim.dz) || 1, R = G.range;
        tx = _v2.x + Aim.dx / hl * R; ty = _v2.y + dyc * R; tz = _v2.z + Aim.dz / hl * R;
        // 조준선이 총구 높이에 닿는 점을 정확히 지나가게 쏜다 (탄은 여전히 일직선)
        const cyp = camera.position.y, ph = _v2.y;
        if (Aim.dy < -1e-4 && cyp > ph) {
          const dd = (cyp - ph) / -Aim.dy;
          if (dd > 12 && dd < R * 1.2) { tx = camera.position.x + Aim.dx * dd; ty = ph; tz = camera.position.z + Aim.dz * dd; }
        }
      } else {
        const ex = tx - _v2.x, ey = ty - _v2.y, ez = tz - _v2.z;
        if (ex * ex + ey * ey + ez * ez < 90) {             // 조준점이 총구에 너무 가까우면 바라보는 방향으로 쏜다
          tx = camera.position.x + Aim.dx * 250; ty = camera.position.y + Aim.dy * 250; tz = camera.position.z + Aim.dz * 250;
        }
      }
      for (let ln = 0; ln <= un('lines'); ln++) {           // 강화 카드 '기관총 두 줄': 한 줄 더 (데미지는 줄어듦)
        const j = ln ? 1.4 : 0, gd = G.damage * (ln ? CONFIG.cards.v.lineMul : 1);
        mgShot(P, lt, tx + rr(-j, j), ty, tz + rr(-j, j), gd, j);
      }
      Sound.play('mg', 0.42, rr(0.94, 1.08), 0);
      Cam.trauma = Math.min(1, Cam.trauma + G.shake * (Cam.fpE > 0.5 ? 0.2 : 1));   // 1인칭은 흔들림을 크게 줄인다
    }
  } else if (mgTimer < 0) mgTimer = 0;

  // 함포: 우클릭 또는 스페이스. 조준점이 가리키는 바다 지점으로 포물선을 그리며 날아간다
  if (cannonT > 0) {
    cannonT -= dt;
    if (cannonT <= 0) { cannonT = 0; Sound.play('reload', 0.5, 1, 0); }
  } else if (Input.rmb || Input.space || Touch.cannon || Touch.cannonTap) {
    const rv = Upg.revengeReady ? 1 + CONFIG.cards.v.revenge * un('revenge') : 1;   // 강화 카드 '복수의 일격'
    Upg.revengeReady = false;
    cannonShot(P, C.damage * rv, 0, C.recoil);
    for (let k = 0; k < un('twin'); k++) cannonShot(P, C.damage * CONFIG.cards.v.twinMul, 3, 0);   // 강화 카드 '쌍포'
    if (un('rail') && ++Upg.railN % CONFIG.cards.v.railEvery === 0) upgRail(P);                // 강화 카드 '레일건'
    cannonT = Math.max(CONFIG.cards.cap.reloadMin || 0, C.reload * (Upg.frenzyOn > 0 ? 0.5 : 1) / upgOverMul());     // '폭주'·'과충전' 중에는 장전이 빨라진다
    Cam.trauma = Math.min(1, Cam.trauma + 0.55);
  }
  Touch.cannonTap = false;      // 아주 짧게 톡 친 것도 한 번은 쏘게 하되, 장전 중에 친 것은 쌓아 두지 않는다

  // 미사일: Q 또는 미사일 버튼. 격파할 때마다 한 발씩 얻는다
  if (Input.missileReq || Touch.missileTap) {
    if (Game.missiles > 0 && missileCD <= 0) {
      if (launchMissile()) {
        Game.missiles--; missileCD = CONFIG.missile.cooldown / upgOverMul();
        for (let k = 0; k < un('misDouble'); k++) if (rnd() < CONFIG.cards.v.misDoubleP) launchMissile();      // 강화 카드: 확률로 다른 적에게 한 발 더
      }
    } else if (Game.missiles <= 0) Sound.play('dry', 0.5, 1, 0);
  }
  Input.missileReq = false; Touch.missileTap = false;
  // 플레어: F 또는 플레어 버튼. 격파할 때마다 2개씩 쌓이고, 한 번 쓰면 1초 뒤에 다시
  if (Game.flareT > 0) Game.flareT -= dt;
  if (Input.flareReq || Touch.flareTap) deployFlare();
  else flareAuto();
  Input.flareReq = false; Touch.flareTap = false;
  // 연막탄: C 또는 연막 버튼 (늘 5발씩)
  if (Input.smokeReq) smokeDeploy(false);
  Input.smokeReq = false;
  // 아이템: E 또는 아이템 버튼
  if (Input.itemReq) useItem(Input.itemSlot);
  Input.itemReq = false;
}


// 기관총 한 발: 락온이면 명중률만큼 따라가는 탄, 사격 컴퓨터 표적이 있으면 예측 지점으로, 아니면 조준한 곳으로
function mgShot(P, lt, tx, ty, tz, dmg, j) {
  const G = CONFIG.mg;
  if (Aim.mis) { fireMG(P, tx, ty, tz, G.speed, G.spread, dmg, 0, G.range / G.speed, null); return; }   // 적 미사일을 겨누는 중: 보정 없이 똑바로
  const ft = Fcs.target;
  if (lt) {
    // 락온 상태: 명중 확률만큼은 표적을 따라가는 탄, 나머지는 리드 지점에서 조금 빗나가게
    const life = (Math.max(G.range, Math.hypot(lt.x - P.x, lt.z - P.z) + 60)) / G.speed;     // 락온 거리까지 닿도록
    if (rnd() < CONFIG.lock.hitChance) fireMG(P, tx, ty, tz, G.speed, 0, dmg, 0, life, lt);
    else { const a = rnd() * TAU, r = rr(3, 5); fireMG(P, tx + Math.cos(a) * r, ty + rr(-1, 2), tz + Math.sin(a) * r, G.speed, G.spread, dmg, 0, G.range / G.speed, null); }
  } else if (ft) {
    // 사격 컴퓨터: 조준점 아래의 배가 갈 자리를 계산해서 쏜다. 명중 확률만큼은 탄이 그 배를 따라가 맞고, 나머지는 조금 빗나간다
    predictBoat(ft, _v2.x, _v2.z, G.speed, 1, 0); Pred.x += rr(-j, j); Pred.z += rr(-j, j);
    const life = (Math.max(G.range, Math.hypot(ft.x - P.x, ft.z - P.z) + 60)) / G.speed;
    if (rnd() < CONFIG.fcs.hitChance) fireMG(P, Pred.x, ft.y + 1, Pred.z, G.speed, 0, dmg, 0, life, ft);
    else { const a = rnd() * TAU, r = rr(3, 5); fireMG(P, Pred.x + Math.cos(a) * r, ft.y + 1 + rr(-1, 2), Pred.z + Math.sin(a) * r, G.speed, G.spread, dmg, 0, life, null); }
  } else fireMG(P, tx, ty, tz, G.speed, G.spread, dmg, 0, G.range / G.speed, null);
}

// 함포 한 발 (j: 조준점을 살짝 흩뜨리는 거리, 쌍포의 추가 포탄용)
function cannonShot(P, dmg, j, recoil) {
  const C = CONFIG.cannon;
  const lt = Lock.target;
  const gb = CONFIG.cards.v.guided * un('guided'), cap = CONFIG.cards.cap.acc || 1;   // 강화 카드 '유도 포탄'
  if (lt && rnd() < Math.min(cap, CONFIG.lock.hitChance + gb)) fireCannon(P, Aim.seaX + rr(-j, j), Aim.seaZ + rr(-j, j), C.shellSpeed, C.gravity, dmg, dmg * C.splashK, C.radius, 0, recoil, 1.0, lt);
  else if (lt) {
    // 빗나가는 포탄: 리드 지점 옆으로 비껴 떨어진다 (폭발 범위 피해는 들어갈 수 있다)
    const a = rnd() * TAU, r = rr(7, 10);
    fireCannon(P, Aim.seaX + Math.cos(a) * r, Aim.seaZ + Math.sin(a) * r, C.shellSpeed, C.gravity, dmg, dmg * C.splashK, C.radius, 0, recoil, 1.0, null);
  } else if (Fcs.target) {
    // 사격 컴퓨터: 포탄이 떨어질 때 배가 있을 자리로 쏜다. 명중 확률만큼은 포탄이 그 배를 따라가 맞고, 나머지는 옆으로 비껴 떨어진다
    const ft = Fcs.target;
    predictBoat(ft, P.x, P.z, C.shellSpeed, 1, C.minFlight); Pred.x += rr(-j, j); Pred.z += rr(-j, j);
    if (rnd() < Math.min(cap, CONFIG.fcs.hitChance + gb)) fireCannon(P, Pred.x, Pred.z, C.shellSpeed, C.gravity, dmg, dmg * C.splashK, C.radius, 0, recoil, 1.0, ft);
    else {
      // 빗나가는 포탄: 사격선의 왼쪽이나 오른쪽으로 배 길이보다 멀리 떨어진다 (앞뒤로 빗나가면 낮게 떨어지는 포물선 끝이 선체에 걸린다)
      const lx = Pred.x - P.x, lz = Pred.z - P.z, ll = Math.sqrt(lx * lx + lz * lz) || 1, side = rnd() < 0.5 ? 1 : -1, r = ft.M.L * 0.5 + rr(5, 8);
      fireCannon(P, Pred.x + lz / ll * r * side, Pred.z - lx / ll * r * side, C.shellSpeed, C.gravity, dmg, dmg * C.splashK, C.radius, 0, recoil, 1.0, null);
    }
  } else fireCannon(P, Aim.seaX + rr(-j, j), Aim.seaZ + rr(-j, j), C.shellSpeed, C.gravity, dmg, dmg * C.splashK, C.radius, 0, recoil, 1.0, null);
}

/* ---------- 움직이는 보트의 앞날 위치 예측 ----------
 * 지금 속도와 선회 속도가 그대로 이어진다고 보고, 포탄이 도착하는 시간 뒤의 위치를 구한다.
 * 도착 시간은 예측한 위치까지의 거리로 다시 정해지므로 몇 번 되풀이해 맞춘다 */
const Pred = { x: 0, z: 0, t: 0 };
function predictBoat(b, fromX, fromZ, speed, k, minT) {
  const w = b.yawRate;
  let px = b.x, pz = b.z, T = 0;
  for (let it = 0; it < 4; it++) {
    const dx = px - fromX, dz = pz - fromZ;
    T = clamp(Math.sqrt(dx * dx + dz * dz) / speed, minT, 7) * k;
    let S, Cc;
    if (w > -1e-4 && w < 1e-4) { S = T; Cc = 0; }
    else { S = Math.sin(w * T) / w; Cc = (1 - Math.cos(w * T)) / w; }
    px = b.x + b.vx * S + b.vz * Cc;
    pz = b.z - b.vx * Cc + b.vz * S;
  }
  Pred.x = px; Pred.z = pz; Pred.t = T;
}

/* ---------- 락온: 화면 조준 원 안에 적을 1초 두면 락온, 크게 벗어나면 풀림 ---------- */
function lockReset() { Lock.cand = null; Lock.prog = 0; Lock.target = null; Lock.boxOn = false; Lock.mgOn = false; }

// 월드 위치의 화면 좌표를 _lv에 넣는다. 카메라 뒤에 있으면 false
function screenOf(x, y, z) {
  _lv.set(x, y, z).project(camera);
  if (_lv.z > 1 || _lv.z < -1) return false;
  _lv.x = (_lv.x * 0.5 + 0.5) * window.innerWidth;
  _lv.y = (-_lv.y * 0.5 + 0.5) * window.innerHeight;
  return true;
}

function updateLock(dt) {
  const L = CONFIG.lock, P = player;
  Lock.boxOn = false; Lock.mgOn = false;
  if (!assistOn || !P.alive || Game.state !== 'play') { Lock.cand = null; Lock.prog = 0; Lock.target = null; return; }
  let cx = window.innerWidth * 0.5, cy = window.innerHeight * 0.5;
  if (!Input.locked && !Touch.on) { cx = Input.mx; cy = Input.my; }
  const pxPerM = window.innerHeight * 0.5 / Math.tan(camera.fov * Math.PI / 360);
  // 이미 락온된 적: 죽거나 멀어지거나 조준점에서 크게 벗어나면 풀린다
  const t = Lock.target;
  if (t) {
    const d = Math.max(Math.hypot(t.x - P.x, t.z - P.z), 1);
    if (!t.alive || t.submerged || d > L.range * 1.15 || !screenOf(t.x, t.y + 1, t.z) || Math.hypot(_lv.x - cx, _lv.y - cy) > L.breakPx + t.M.L * 0.5 / d * pxPerM) lockReset();
  }
  if (!Lock.target) {
    // 조준 원 안(배가 크게 보이면 그만큼 넓게)에서 조준점에 가장 가까운 적
    const R = Touch.on ? L.radiusPxTouch : L.radiusPx;
    let best = null, bd = 1e9;
    for (let i = 0; i < enemies.length; i++) {
      const b = enemies[i];
      if (!b.alive || b.submerged) continue;
      const d = Math.hypot(b.x - P.x, b.z - P.z);
      if (d > L.range || !screenOf(b.x, b.y + 1, b.z)) continue;
      const sd = Math.hypot(_lv.x - cx, _lv.y - cy), reach = R + b.M.L * 0.35 / Math.max(d, 1) * pxPerM;
      if (sd < reach && sd < bd) { bd = sd; best = b; }
    }
    if (best && best === Lock.cand) {
      Lock.prog += dt / L.time;
      if (Lock.prog >= 1) { Lock.prog = 1; Lock.target = best; }
    } else { Lock.cand = best; Lock.prog = 0; }
  }
  // 화면 표시: 적 마커와 기관총 리드 마커
  const show = Lock.target || Lock.cand;
  if (show && screenOf(show.x, show.y + 1, show.z)) {
    const d = Math.max(Math.hypot(show.x - camera.position.x, show.z - camera.position.z), 1);
    Lock.boxOn = true; Lock.bx = _lv.x; Lock.by = _lv.y;
    Lock.bs = clamp(show.M.L * 0.75 / d * pxPerM / 40, 0.6, 3);
  }
  if (Lock.target) {
    predictBoat(Lock.target, P.x, P.z, CONFIG.mg.speed, 1, 0);
    if (screenOf(Pred.x, Lock.target.y + 1, Pred.z)) { Lock.mgOn = true; Lock.mx = _lv.x; Lock.my = _lv.y; }
  }
}

/* ---------- 사격 컴퓨터: 락온하지 않았을 때 조준점이 올라가 있는 적을 찾는다 ----------
 * 배 윤곽(크기만큼)에 조금의 여유(radiusPx)를 더한 범위 안이면 그 배를 겨눈 것으로 본다 */
function updateFcs() {
  const P = player, F = CONFIG.fcs;
  Fcs.target = null;
  if (!P.alive || Game.state !== 'play' || Lock.target) return;
  let cx = window.innerWidth * 0.5, cy = window.innerHeight * 0.5;
  if (!Input.locked && !Touch.on) { cx = Input.mx; cy = Input.my; }
  const R = Touch.on ? F.radiusPxTouch : F.radiusPx;
  const pxPerM = window.innerHeight * 0.5 / Math.tan(camera.fov * Math.PI / 360);
  let best = null, bd = 1e9;
  for (let i = 0; i < enemies.length; i++) {
    const b = enemies[i];
    if (!b.alive || b.submerged) continue;
    const d = Math.hypot(b.x - P.x, b.z - P.z);
    if (d > CONFIG.lock.range || !screenOf(b.x, b.y + 1, b.z)) continue;
    const sd = Math.hypot(_lv.x - cx, _lv.y - cy), reach = R + b.M.L * 0.35 / Math.max(d, 1) * pxPerM;
    if (sd < reach && sd < bd) { bd = sd; best = b; }
  }
  Fcs.target = best;
}

/* ---------- 조준: 조준점(화면 중앙 또는 커서)이 가리키는 곳을 찾는다 ---------- */
function updateAim() {
  const C = CONFIG.cannon, P = player;
  let nx = 0, ny = 0;
  if (!Input.locked && !Touch.on) { nx = Input.mx / window.innerWidth * 2 - 1; ny = 1 - Input.my / window.innerHeight * 2; }
  _v1.set(nx, ny, 0.5).unproject(camera);
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  let dx = _v1.x - ox, dy = _v1.y - oy, dz = _v1.z - oz;
  const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= dl; dy /= dl; dz /= dl;
  Aim.dx = dx; Aim.dy = dy; Aim.dz = dz;
  const FAR = 900, ex = ox + dx * FAR, ey = oy + dy * FAR, ez = oz + dz * FAR;
  // 조준선이 적 보트에 닿으면 그 보트를 겨눈다
  let best = 2, target = null;
  for (let i = 0; i < enemies.length; i++) {
    const b = enemies[i];
    if (!b.alive || b.submerged) continue;
    const th = segBoat(b, ox, oy, oz, ex, ey, ez, FAR, 0.3);
    if (th >= 0 && th < best) { best = th; target = b; }
  }
  const tSea = dy < -0.003 ? -oy / dy : 1e9;     // 조준선이 수면과 만나는 거리
  if (target && best * FAR < tSea) {
    const d = best * FAR;
    Aim.x = ox + dx * d; Aim.y = oy + dy * d; Aim.z = oz + dz * d;
    // 적을 직접 겨눴을 때는 포탄이 날아가는 동안 적이 움직일 곳을 앞서 겨눠 준다 (도는 중이면 도는 길을 따라)
    Aim.seaX = target.x; Aim.seaZ = target.z;       // 락온 전에는 적이 지금 있는 곳을 겨눈다
    Aim.onEnemy = true;
  } else if (tSea < FAR) {
    Aim.x = ox + dx * tSea; Aim.y = 0; Aim.z = oz + dz * tSea;
    Aim.seaX = Aim.x; Aim.seaZ = Aim.z; Aim.onEnemy = false;
  } else {
    // 수평선 위를 보고 있으면 그 방향의 최대 사거리 지점
    Aim.x = ex; Aim.y = ey; Aim.z = ez; Aim.onEnemy = false;
    const hl = Math.sqrt(dx * dx + dz * dz) || 1;
    Aim.seaX = P.x + dx / hl * C.maxRange; Aim.seaZ = P.z + dz / hl * C.maxRange;
  }
  // 락온 완료: 포탑과 기관총이 적의 예상 위치(리드)를 겨눈다
  Aim.mgX = Aim.x; Aim.mgY = Aim.y; Aim.mgZ = Aim.z;
  const lt = Lock.target;
  if (lt) {
    const G = CONFIG.mg;
    predictBoat(lt, P.x, P.z, G.speed, 1, 0);
    Aim.mgX = Pred.x; Aim.mgZ = Pred.z; Aim.mgY = lt.y + 1.0;
    predictBoat(lt, P.x, P.z, C.shellSpeed, C.leadAssist, C.minFlight);
    Aim.seaX = Pred.x; Aim.seaZ = Pred.z;
    Aim.onEnemy = true;
  }
  // 함포 사거리 제한
  const rx = Aim.seaX - P.x, rz = Aim.seaZ - P.z, rd = Math.sqrt(rx * rx + rz * rz) || 1;
  const cl = clamp(rd, C.minRange, C.maxRange);
  if (cl !== rd) { Aim.seaX = P.x + rx / rd * cl; Aim.seaZ = P.z + rz / rd * cl; }
  // 조준점 바로 옆에 적 미사일이 있으면: 그동안 기관총은 락온·사격 컴퓨터 보정 없이 조준점이 가리키는 그 미사일 거리로 똑바로 쏜다
  // (미사일 쪽으로 휘어 주지는 않는다. 요격은 직접 맞혀야 한다. 함포는 그대로)
  Aim.mis = null;
  const I = CONFIG.intercept;
  let sx = window.innerWidth * 0.5, sy = window.innerHeight * 0.5;
  if (!Input.locked && !Touch.on) { sx = Input.mx; sy = Input.my; }
  let bd = Touch.on ? I.aimPxTouch : I.aimPx, bt = 0;
  for (let i = 0; i < MIS_MAX; i++) {
    const m = missiles[i];
    if (!m.on || m.owner !== 1) continue;
    const t = (m.x - ox) * dx + (m.y - oy) * dy + (m.z - oz) * dz;     // 조준선을 따라 잰 미사일까지 거리
    if (t < 5 || t > CONFIG.mg.range || !screenOf(m.x, m.y, m.z)) continue;
    const sd = Math.hypot(_lv.x - sx, _lv.y - sy);
    if (sd < bd) { bd = sd; bt = t; Aim.mis = m; }
  }
  if (Aim.mis) { Aim.mgX = ox + dx * bt; Aim.mgY = oy + dy * bt; Aim.mgZ = oz + dz * bt; }
}

/* ---------- 카메라: 3인칭과 1인칭을 매 프레임 둘 다 계산해서 섞는다 ---------- */
function updateCamera(dt) {
  const C = CONFIG.camera, P = player, st = Game.state;
  const playing = st === 'play' && P.alive;
  let turned = false;
  if (playing) {
    if (Input.locked || Touch.on) {
      // 마우스 고정 방식과 터치: 마우스 움직임(화면을 끈 거리)이 곧 조준 방향
      if (Input.mdx !== 0 || Input.mdy !== 0) {
        Cam.yaw -= Input.mdx * C.sensitivity; Cam.pitch -= Input.mdy * C.sensitivity; turned = true;
      }
    } else {
      // 커서 조준 방식: 커서가 화면 좌우 끝으로 갈수록 시점이 그쪽으로 돈다
      const nx = Input.mx / window.innerWidth * 2 - 1, ax = nx < 0 ? -nx : nx;
      if (ax > C.edgeZone) {
        const k = Math.min((ax - C.edgeZone) / (1 - C.edgeZone), 1);
        Cam.yaw -= (nx < 0 ? -1 : 1) * k * k * C.edgeTurnRate * dt; turned = true;
      }
      Cam.pitch = damp(Cam.pitch, lerp(C.pitch, -0.05, Cam.blend), 6, dt);
    }
  } else if (st === 'menu') {
    Cam.yaw += dt * 0.11; Cam.pitch = damp(Cam.pitch, -0.13, 2, dt);
  } else if (!P.alive) {
    Cam.yaw += dt * 0.16; Cam.pitch = damp(Cam.pitch, -0.3, 1.5, dt);     // 격침 뒤: 잔해 주위를 천천히 돈다
  }
  Input.mdx = 0; Input.mdy = 0;
  // 마우스를 멈추고 사격도 하지 않으면 시점이 선체 회전을 따라간다 (조준 중에는 방향이 고정된다)
  if (turned || Input.lmb || Touch.fire) Cam.idleT = 0; else Cam.idleT += dt;
  const fT = playing && Cam.idleT > C.followHullDelay ? 1 : 0;
  Cam.follow = damp(Cam.follow, fT, fT > Cam.follow ? C.followHullRate : 6, dt);   // 따라가기는 천천히 시작하고, 마우스를 움직이면 바로 멈춘다
  if (playing) Cam.yaw += P.yawRate * dt * Cam.follow;
  Cam.yaw = wrapAngle(Cam.yaw);

  // 시점 전환: 0.55초에 걸쳐 부드럽게 넘어간다
  if (Cam.blend < Cam.view) Cam.blend = Math.min(Cam.view, Cam.blend + dt / 0.55);
  else if (Cam.blend > Cam.view) Cam.blend = Math.max(Cam.view, Cam.blend - dt / 0.55);
  const e = smooth01(Cam.blend);
  Cam.pitch = clamp(Cam.pitch, lerp(-0.62, -0.55, e), lerp(0.22, 0.45, e));
  const cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch), sy = Math.sin(Cam.yaw), cy = Math.cos(Cam.yaw);
  const dx = sy * cp, dy = sp, dz = cy * cp;
  const spN = P.spN;

  // 3인칭: 보트 뒤 위쪽. 보트 위치를 조금 늦게 따라가서 가속하면 보트가 앞으로 치고 나간다
  Cam.px = damp(Cam.px, P.x, C.followPos, dt); Cam.pz = damp(Cam.pz, P.z, C.followPos, dt);
  Cam.py = damp(Cam.py, P.y + C.height, C.followHeight, dt);
  Cam.dist = damp(Cam.dist, C.distance + 2.5 * Math.min(spN, 1.5) + (P.boosting ? 1.5 : 0) + (P.alive ? 0 : 9), 3, dt);
  const c3x = Cam.px - dx * Cam.dist, c3z = Cam.pz - dz * Cam.dist;
  let c3y = Cam.py - dy * Cam.dist;
  const wh = waveHeight(c3x, c3z, simTime) + 1.3;       // 카메라가 물에 잠기지 않게
  if (c3y < wh) c3y = wh;
  _cA.set(c3x, c3y, c3z);
  _cB.set(c3x + dx, c3y + dy, c3z + dz);
  _m1.lookAt(_cA, _cB, UP);
  _q1.setFromRotationMatrix(_m1);

  // 1인칭: 조종석 눈높이. 보트와 함께 오르내리고, 선체가 기운 만큼 수평선도 기운다
  if (e > 0) {
    P.eye.getWorldPosition(_v1);
    const me = P.root.matrixWorld.elements;
    _v2.set(me[4], me[5], me[6]);                                     // 갑판이 향하는 위쪽
    _v3.set(_v2.x * 0.75, 0.25 + _v2.y * 0.75, _v2.z * 0.75).normalize();
    const tilt = -(_v2.x * sy + _v2.z * cy) * 0.5;
    _cC.set(_v1.x + dx, _v1.y + dy + tilt * cp, _v1.z + dz);
    _m1.lookAt(_v1, _cC, _v3);
    _q2.setFromRotationMatrix(_m1);
    _q1.slerp(_q2, e);
    _cA.lerp(_v1, e);
  }
  camera.position.copy(_cA);
  camera.quaternion.copy(_q1);

  // 흔들림: 빠를수록 잘게 떨리고(부스트 중 더 강하게), 포격과 피격 때 크게 흔들린다
  Cam.trauma = Math.max(0, Cam.trauma - dt * 1.5);
  const t = simTime;
  const buzz = playing ? spN * spN * 0.003 + (P.boosting ? 0.0042 : 0) : 0;
  const amp = (Cam.trauma * Cam.trauma * 0.045 + buzz) * C.shake * (REDUCED_MOTION ? 0.3 : 1);
  if (amp > 0) {
    const n1 = Math.sin(t * 37.1 + 1.3) * 0.6 + Math.sin(t * 61.7 + 4.1) * 0.4;
    const n2 = Math.sin(t * 41.3 + 2.7) * 0.6 + Math.sin(t * 67.9 + 0.5) * 0.4;
    const n3 = Math.sin(t * 29.9 + 5.1) * 0.6 + Math.sin(t * 53.3 + 3.3) * 0.4;
    _e1.set(n1 * amp, n2 * amp, n3 * amp * 0.7);
    _q3.setFromEuler(_e1);
    camera.quaternion.multiply(_q3);
    camera.position.y += n2 * amp * 2.2;
  }

  // 시야각: 빠를수록 넓어지고 부스트 중에는 더 넓어진다
  const fovT = lerp(C.fov, C.fovFirstPerson, e) + (P.alive ? C.fovSpeedAdd * Math.min(spN, 1) + (P.boosting ? C.fovBoostAdd : 0) : 0);
  Cam.fov = damp(Cam.fov, fovT, 3.2, dt);
  if (Cam.fov - camera.fov > 0.01 || camera.fov - Cam.fov > 0.01) { camera.fov = Cam.fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
  Cam.fwdX = sy; Cam.fwdZ = cy; Cam.rightX = -cy; Cam.rightZ = sy;

  // 1인칭에서는 시야를 가리는 조종실과 지붕 위 장비를 숨기고 뱃머리와 포신만 남긴다
  Cam.fpE = e;                                        // 1인칭 정도(0~1): 기관총 효과를 줄이는 데 쓴다
  const show = !(e > 0.5 && P.alive);
  if (P.cabin.visible !== show) { P.cabin.visible = show; P.mgMesh.visible = show; if (P.radar) P.radar.visible = show; }   // 뒤 마스트 회전 레이더도 함께 숨긴다
  if (P.launcher && P.launcher.visible !== show) P.launcher.visible = show;   // 격납고 지붕 위 발사대: 1인칭으로 뒤를 볼 때 시야를 가린다 (따로 확인해 새 게임에서도 어긋나지 않게)
}

/* ---------- 게임 진행 ---------- */
// cont: 저장에서 이어 갈 때 (판 수를 세지 않고, 첫 웨이브는 불러오는 쪽이 시작한다)
function beginGame(cont) {
  if (!cont) { Rec.runs++; recSave(); }
  SaveSt.counted = 0; $('code-box').classList.add('off');
  specialClear(); clearEnemies(); shellsClear(); missilesClear(); flaresClear(); hazardsClear(); lockReset(); itemsClear(); smokeClear(); islesClear();
  if (!cont) islesBuild((Math.random() * 4294967295) >>> 0);       // 판마다 새 섬·암초 (이어하기는 저장된 바다를 다시 만든다)
  bulN = 0; decalN = 0;
  spraySys.clear(); mistSys.clear(); smokeSys.clear(); fireSys.clear();
  skillReset(); upgReset();
  if (!cont) Skill.pts = lvStartPts();                 // 레벨 보상: 판 시작 포인트
  Game.cardT = 0; closeCards(true);
  player.reset(0, 0, START_HEADING, simTime);
  kills = 0; round = 0; roundState = 0; mgTimer = 0; cannonT = 0;
  Game.smokes = 0; Game.paintRun = 0; Game.boost = CONFIG.boost.max; Game.bonus = 0; Game.missiles = 0; Game.flares = CONFIG.flare.start; Game.flareT = 0; Game.kSteer = 0; Game.skipped.length = 0; Game.skipArmT = 0; Game.skipBtnArm = false; Game.boostOn = false; Game.boostIdle = 9; Game.pendingResume = false;
  Cam.yaw = START_HEADING; Cam.pitch = CONFIG.camera.pitch; Cam.view = Setg.v; viewBtnText(); Cam.blend = 0; Cam.trauma = 0; Cam.idleT = 0; Cam.follow = 0;
  Cam.px = 0; Cam.pz = 0; Cam.py = player.y + CONFIG.camera.height; Cam.dist = CONFIG.camera.distance;
  clearInput();
  Hud.reset();
  $('start').classList.add('off'); $('result').classList.add('off'); $('pause').classList.add('off');
  $('hud').classList.remove('off');
  Game.state = 'play';
  lastT = performance.now();
  if (!cont) startRound(1);
  updateCursor();
}

// 체력이 0이 되면: 폭발하고 가라앉는 연출 뒤 결과 화면
function onPlayerDeath() {
  Game.state = 'dying'; Game.deathT = 4.8;
  Cam.view = 0;
  clearInput();
  updateCursor();
}

function showResult() {
  Game.state = 'result';
  endRun();
  $('r-kills').textContent = kills;
  $('r-wave').textContent = round;
  $('r-skip').textContent = Game.skipped.length ? Game.skipped.join(', ') : '없음';
  $('r-diff').textContent = DIFF().label;
  $('r-paint').textContent = '+' + (Game.paintRun || 0);
  metaBadge();
  $('hud').classList.add('off');
  $('result').classList.remove('off');
  if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  updateCursor();
  $('restart').focus();
}

function update(dt) {
  const t = simTime, st = Game.state, P = player;
  uTime.value = t;

  // 1) 플레이어 조작
  if (st === 'play' && P.alive) playerControl(dt);
  else if (st === 'menu') { P.inThrottle = 0.62; P.inSteer = 0.14; P.boosting = false; }   // 시작 화면: 천천히 원을 그리며 항해
  else { P.inThrottle = 0; P.inSteer = 0; P.boosting = false; }

  // 2) 적 AI
  shootersNow = 0;
  for (let i = 0; i < enemies.length; i++) {
    const b = enemies[i];
    if (b.alive && b.ai.burstLeft > 0) shootersNow++;
  }
  for (let i = 0; i < enemies.length; i++) {
    const b = enemies[i];
    if (b.alive) aiUpdate(b, dt);
  }

  // 3) 물리 (플레이어와 적이 같은 계산을 쓴다)
  const fxk = CONFIG.quality.effectScale;
  P.lod = fxk;
  if (!P.gone) P.step(dt, t);
  const cx0 = camera.position.x, cz0 = camera.position.z, er = CONFIG.quality.effectRange, EG = CONFIG.enlarge;
  for (let i = 0; i < enemies.length; i++) {
    const b = enemies[i];
    if (b.gone) continue;
    const dx = b.x - cx0, dz = b.z - cz0, d = Math.sqrt(dx * dx + dz * dz);
    b.lod = (d < 140 ? 1 : (d > er ? 0 : 1 - (d - 140) / (er - 140))) * fxk;
    if (b.subDepth > 2) b.lod = 0;                            // 잠수한 잠수함: 물보라 없음
    const ek = d <= EG.near ? 0 : (d >= EG.far ? 1 : (d - EG.near) / (EG.far - EG.near));
    b.setVisScale(1 + ((EG.max[b.kind] || 1) - 1) * ek);      // 멀리 있는 적은 크게 보이게
    b.step(dt, t);
    if (b.subDepth > 0) b.root.position.y -= b.subDepth * b.vs;   // 물속으로 내려간다 (커진 만큼 더 깊이)
  }
  collideBoats();
  if (P.alive) isleCollide(P, dt);
  for (let i = 0; i < enemies.length; i++) isleCollide(enemies[i], dt);
  specialPhys(dt, t);

  // 4) 카메라  5) 조준과 사격
  updateCamera(dt);
  if (st === 'play' && P.alive) { updateLock(dt); updateFcs(); updateAim(); playerWeapons(dt); }
  else { lockReset(); Aim.onEnemy = false; }

  // 6) 탄과 포탄
  bulletsUpdate(dt, t);
  shellsUpdate(dt, t);
  shellTracers();
  missilesUpdate(dt, t);
  airUpdate(dt, t);
  flaresUpdate(dt);
  smokeUpdate(dt);
  islesUpdate(dt);
  specialUpdate(dt);
  skillUpdate(dt);
  hazardsUpdate(dt, t);
  itemsUpdate(dt, t);
  upgUpdate(dt);

  // 7) 수면의 거품과 물보라
  foamBegin(camera.position.x + Cam.fwdX * foamHalf * 0.35, camera.position.z + Cam.fwdZ * foamHalf * 0.35);
  if (!P.gone) {
    P.emitWater(dt, t, fxk);
    if (!P.alive) {
      P.emitBurn(dt, fxk);
      if (P.sinkT > P.sinkDur + 0.4) P.retire();
    }
  } else if (P.wake.count > 0) P.wake.update(P.x, P.z, 0, 1, 0, P.M.L, P.M.B, t, false);
  for (let i = enemies.length - 1; i >= 0; i--) {
    const b = enemies[i];
    if (b.gone) {
      // 가라앉은 뒤에도 항적이 다 사라질 때까지 두었다가 풀로 돌려보낸다
      b.wake.update(b.x, b.z, 0, 1, 0, b.M.L, b.M.B, t, false);
      if (b.wake.count === 0) {
        enemies[i] = enemies[enemies.length - 1];
        enemies.pop();
        boatPool[b.kind].push(b);
      }
      continue;
    }
    b.emitWater(dt, t, b.lod);
    if (!b.alive) {
      b.emitBurn(dt, b.lod > 0.35 ? b.lod : 0.35);
      if (b.sinkT > b.sinkDur + 0.4) { foamDecal(b.x, b.z, 3, 10, 6, 0.9, 0, 0.5); b.retire(); }
    }
  }
  specialEmit(dt, t);
  foamDecalsUpdate(dt);
  weatherUpdate(dt);

  // 8) 파티클
  spraySys.update(dt, 0, 0);
  mistSys.update(dt, WIND_X * 0.4, WIND_Z * 0.4);
  smokeSys.update(dt, WIND_X, WIND_Z);
  fireSys.update(dt, 0, 0);

  // 9) 웨이브 진행과 격침 처리
  if (Game.skipArmT > 0) Game.skipArmT -= dt;
  if (st === 'play') {
    if (roundState === 0) {
      if (round > 0 && enemiesAlive() === 0) {
        roundState = 1; roundTimer = CONFIG.rounds.nextDelay;
        xpGain(CONFIG.level.xpWave);                              // 웨이브 클리어 경험치
        paintGain(CONFIG.paint.wave);
        if (!Game.waveHurt) achStat('noHit', 1);
        Hud.banner('해역 확보', '다음 적 함대가 다가옵니다');
        specialEnd(true);
        if (CONFIG.cards.enabled) Game.cardT = CARD_DELAY;     // 잠깐 뒤 강화 카드
      }
    } else {
      if (Game.cardT > 0) { Game.cardT -= dt; if (Game.cardT <= 0 && P.alive) openCards(); }
      roundTimer -= dt;
      if (roundTimer <= 0) startRound(round + 1);
    }
  } else if (st === 'dying') {
    Game.deathT -= dt;
    if (Game.deathT <= 0) showResult();
  }

  // 10) 화면 표시와 엔진음
  healthBarsUpdate();
  if (st === 'play' && P.alive) {
    const ready = cannonT <= 0, sc = CONFIG.cannon.radius * 0.5 * (ready ? 1 + 0.04 * Math.sin(t * 6) : 0.8);
    aimRing.visible = true;
    aimRing.position.set(Aim.seaX, waveHeight(Aim.seaX, Aim.seaZ, t) + 0.35, Aim.seaZ);
    aimRing.scale.set(sc, 1, sc);
    aimRing.material.opacity = ready ? 0.62 : 0.22;
    const lk = !!Lock.target;
    if (lk !== aimRingLocked) { aimRingLocked = lk; aimRing.material.color.copy(lk ? RING_RED : RING_GOLD); }
  } else aimRing.visible = false;
  if (st !== 'menu') Hud.update(dt);
  achUpdate(dt);
  Sound.engine(dt, P.spN, P.throttle, P.boosting, st === 'play' && P.alive);
}

/* ---------- 프레임 속도에 맞춰 해상도를 자동 조절 ---------- */
let perfAcc = 0, perfFrames = 0, perfBad = 0, perfGood = 0, perfCeil = 99, perfWarm = 0, liteBad = 0, liteGood = 0;

function adaptQuality(dt) {
  perfAcc += dt; perfFrames++;
  if (perfAcc < 1) return;
  const fps = perfFrames / perfAcc, q = CONFIG.quality;
  perfAcc = 0; perfFrames = 0;
  Hud.fps = fps;
  if (!q.adaptive || Game.state === 'pause' || ++perfWarm < 4) return;   // 시작 직후 몇 초는 세지 않는다
  const top = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio, perfCeil);
  // 해상도를 최저까지 낮췄는데도 3초 연속 느리면 가벼운 모드: 작은 입자 절반, 항적·거품 맵은 두 프레임에 한 번
  if (LITE_ON) FX_LITE = true;                                       // 저사양 모드를 켜 두면 늘 가볍게
  else if (fps < 45 && pixelRatio <= q.minPixelRatio + 0.01) { liteGood = 0; if (!FX_LITE && ++liteBad >= 3) { FX_LITE = true; liteBad = 0; } }
  else if (fps > 57) { liteBad = 0; if (FX_LITE && ++liteGood >= 8) { FX_LITE = false; liteGood = 0; } }   // 8초 넉넉하면 원래대로
  else { liteBad = 0; liteGood = 0; }
  if (fps < 50) {
    perfGood = 0;
    if (++perfBad >= 2 && pixelRatio > q.minPixelRatio) {      // 2초 연속으로 느리면 해상도를 낮춘다
      perfCeil = pixelRatio * 0.97;
      pixelRatio = Math.max(q.minPixelRatio, pixelRatio * (fps < 36 ? 0.8 : 0.9));
      renderer.setPixelRatio(pixelRatio);
      perfBad = 0;
    }
  } else {
    perfBad = 0;
    if (fps > 57 && pixelRatio < top - 0.01 && ++perfGood >= 5) {   // 여유가 계속 있으면 조금씩 되돌린다
      pixelRatio = Math.min(top, pixelRatio * 1.08);
      renderer.setPixelRatio(pixelRatio);
      perfGood = 0;
    }
  }
}

let lastT = 0, nextT = 0, foamSkip = false;

function frame(now) {
  requestAnimationFrame(frame);
  // 60프레임 제한: 90·120Hz 화면에서도 초당 maxFps번만 그린다 (남는 화면 갱신은 건너뜀)
  const FR = 1000 / CONFIG.quality.maxFps;
  if (now < nextT - 1.5) return;
  nextT = now - nextT > FR * 2 ? now + FR : nextT + FR;
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (!(dt > 0)) dt = 0.001;
  if (dt > 0.25) dt = 0.25;
  adaptQuality(dt);
  Music.update();
  achTick(now);
  if (Game.state !== 'pause' && Game.state !== 'cards') {      // 일시정지·카드 화면에서는 게임이 멈춘다 (화면은 그대로 그린다)
    let sdt = dt > 1 / 30 ? 1 / 30 : dt;        // 너무 느린 프레임은 물리가 튀지 않게 잘라 낸다
    if (Game.slowT > 0) { Game.slowT -= sdt; sdt *= 0.3; }   // 두 번째 기회: 잠깐 슬로모션
    simTime += sdt;
    update(sdt);
  } else if (Game.pendingResume && !Input.locked && now - Game.resumeAskT > 1200) {
    // 브라우저가 Esc 직후에는 마우스 고정을 잠깐 막는다. 한 번 더 클릭하면 된다
    Game.pendingResume = false; Game.lockFails++;
    $('pause-msg').textContent = '마우스 고정을 기다리고 있습니다. 화면을 한 번 더 클릭해 주세요.';
  }
  oceanUniforms.uCenter.value.set(camera.position.x, camera.position.z);   // 바다 메쉬가 카메라를 따라다닌다
  oceanUniforms.uPix.value = 2 * Math.tan(camera.fov * Math.PI / 360) / (window.innerHeight * pixelRatio);
  foamSkip = FX_LITE && !foamSkip;
  if (!foamSkip) foamRender();
  renderer.render(scene, camera);
}

function boot() {
  try { initRenderer(); }
  catch (err) {
    fatal('이 브라우저에서 WebGL을 시작할 수 없습니다. 하드웨어 가속이 켜져 있는지 확인해 주세요.');
    return;
  }
  makeTextures();
  makeSky();
  initFoam();
  makeOcean();
  initParticles();
  initTracers();
  initShellGlow();
  initShells();
  initMissiles();
  initFlares();
  initHazards();
  initBoatAssets();
  initIsles();
  initSmoke();
  initAir();
  initItems();          // 보트 재질을 쓰므로 그 뒤에
  initHealthBars();
  initAimRing();
  initRain();
  player = new Boat('player');
  player.reset(0, 0, START_HEADING, 0);
  islesBuild((Math.random() * 4294967295) >>> 0);
  Cam.yaw = START_HEADING + 0.55; Cam.pitch = -0.13;
  Cam.px = 0; Cam.pz = 0; Cam.py = player.y + CONFIG.camera.height;
  Hud.init();
  setgLoad();                // 저장된 설정(난이도·배경·락온·시점)
  selectDiff(Game.diffKey);
  selectEnv(Game.envKey, true);
  Touch.el = { joy: $('t-joy'), knob: $('t-knob'), fire: $('t-fire'), cannon: $('t-cannon'), boost: $('t-boost'), missile: $('t-missile'), flare: $('t-flare'), smoke: $('t-smoke') };
  setTouchMode(TOUCH_DEVICE);
  bindEvents();
  $('assist-btn').textContent = '락온: ' + (assistOn ? '켜짐' : '꺼짐');
  onResize();
  lastT = performance.now();
  requestAnimationFrame(frame);
}

boot();
})();
