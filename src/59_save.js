
/* ==========================================================================
   저장: 웨이브가 시작될 때마다 이 기기(브라우저)에 자동 저장하고, 같은 내용을 코드로도 만든다
   코드를 다른 기기에 넣으면 같은 진행 상황에서 이어 간다. 기록(최고 웨이브·총 격파·판 수)도 함께 남는다
   ========================================================================== */
const SAVE_KEY = 'gr_boat_run_v1', REC_KEY = 'gr_boat_rec_v1', CODE_PFX = 'GR1-';
const Rec = { best: { easy: 0, normal: 0, hard: 0 }, kills: 0, runs: 0, lv: 1, xp: 0 };
const SET_KEY = 'gr_boat_set_v1';
const Setg = { d: 'normal', e: 'sunset', a: 1, v: 0, m: 2, lo: 0 };   // 설정: 난이도·배경·락온·시점·음악(0 끔 1 작게 2 크게)
const SaveSt = { code: '', counted: 0 };          // code: 마지막으로 만든 저장 코드, counted: 기록에 이미 더한 이번 판 격파 수

function lsGet(k) { try { return window.localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch { /* 저장 불가: 코드는 그대로 쓸 수 있다 */ } }
function lsDel(k) { try { window.localStorage.removeItem(k); } catch { /* 무시 */ } }

function recLoad() {
  try { const r = JSON.parse(lsGet(REC_KEY) || 'null'); if (r) recMerge(r); } catch { /* 깨진 기록은 무시 */ }
}
// 다른 기기 기록과 합친다: 최고 웨이브는 큰 쪽, 격파·판 수도 큰 쪽 (같은 기록을 두 번 더하지 않게)
function recMerge(r) {
  if (!r) return;
  for (const k of ['easy', 'normal', 'hard']) Rec.best[k] = Math.max(Rec.best[k], (r.best && +r.best[k]) || 0);
  Rec.kills = Math.max(Rec.kills, +r.kills || 0); Rec.runs = Math.max(Rec.runs, +r.runs || 0);
  const lv = +r.lv || 1, xp = +r.xp || 0;                          // 레벨은 더 높은 쪽
  if (lv > Rec.lv || (lv === Rec.lv && xp > Rec.xp)) { Rec.lv = lv; Rec.xp = xp; }
  // 업적·통계·페인트·스킨: 깬 업적과 가진 스킨은 합치고, 통계와 페인트는 큰 쪽
  metaInit();
  if (r.ach) for (const k in r.ach) Rec.ach[k] = 1;
  if (r.st) for (const k in r.st) Rec.st[k] = Math.max(Rec.st[k] || 0, +r.st[k] || 0);
  if (Array.isArray(r.skins)) for (const k of r.skins) if (Rec.skins.indexOf(k) < 0 && SKINS.find(q => q.id === k)) Rec.skins.push(k);
  if (r.paint != null) Rec.paint = Math.max(Rec.paint, +r.paint || 0);
  if (r.skin && Rec.skins.indexOf(r.skin) >= 0) Rec.skin = r.skin;
}

/* ---------- 레벨: 격파·웨이브 클리어로 경험치, 레벨이 오를수록 적이 세지고 판 시작 포인트가 늘어난다 ---------- */
function lvNeed(lv) { const L = CONFIG.level; return L.base + L.step * (lv - 1); }
function lvMul() { return 1 + CONFIG.level.enemyPer * (Rec.lv - 1); }        // 적 체력·데미지 배율
function lvStartPts() { return CONFIG.level.startPts * (Rec.lv - 1); }
function xpGain(n) {
  if (Game.state !== 'play' && Game.state !== 'cards') return;
  Rec.xp += n;
  let up = 0;
  while (Rec.xp >= lvNeed(Rec.lv)) { Rec.xp -= lvNeed(Rec.lv); Rec.lv++; up++; }
  if (up) {
    Hud.banner('레벨 업! Lv.' + Rec.lv, '적이 ' + Math.round(CONFIG.level.enemyPer * 100 * up) + '% 강해집니다 · 다음 판 시작 포인트 +' + CONFIG.level.startPts * up);
    Sound.play('pickup', 0.8, 1.5, 0); Sound.play('ping', 0.7, 1.3, 0);
  }
  recSave();
}

/* ---------- 설정 저장 ---------- */
function setgSave() {
  Setg.d = Game.diffKey; Setg.e = Game.envKey; Setg.a = assistOn ? 1 : 0; Setg.v = Cam.view || 0;
  lsSet(SET_KEY, JSON.stringify(Setg));
}
function setgApply(o) {
  if (!o) return;
  if (CONFIG.difficulty[o.d]) Setg.d = o.d;
  if (CONFIG.env[o.e]) Setg.e = o.e;
  Setg.a = o.a ? 1 : 0; Setg.v = o.v ? 1 : 0;
  if (o.m === 0 || o.m === 1 || o.m === 2) Setg.m = o.m;
  if (o.lo === 1) Setg.lo = 1;
}
// 시작할 때 (화면 만들기 전에): 저장된 설정을 게임에 반영
function setgLoad() {
  try { setgApply(JSON.parse(lsGet(SET_KEY) || 'null')); } catch { /* 깨진 설정은 무시 */ }
  Game.diffKey = Setg.d; Game.envKey = Setg.e; assistOn = !!Setg.a;
}
function recSave() { lsSet(REC_KEY, JSON.stringify(Rec)); }
// 이번 판에서 아직 기록에 안 더한 격파 수와 지금 웨이브를 기록에 반영한다
function recTouch() {
  if (kills > SaveSt.counted) { Rec.kills += kills - SaveSt.counted; SaveSt.counted = kills; }
  Rec.best[Game.diffKey] = Math.max(Rec.best[Game.diffKey] || 0, round);
  recSave();
}

// 웨이브 시작 시점의 진행 상황
function runSnapshot() {
  const P = player;
  return {
    v: 1, d: Game.diffKey, w: round, k: kills, hp: Math.round(P.hp * 10) / 10, mh: Math.round(P.maxHp * 10) / 10,
    pt: Skill.pts, sr: Skill.r, sh: Skill.ship, af: Skill.autoFlare ? 1 : 0, td: Skill.topDown ? 1 : 0,
    mi: Game.missiles, fl: Game.flares, it: Game.items.slice(), sk: Game.skipped.slice(), sm: Game.smokes, is: isleSeed,
    un: Upg.n, up: Upg.picks, uh: Upg.history.slice(), ul: Upg.lives, us: Upg.second, ush: Upg.shieldHp,
    rec: Rec, set: { d: Game.diffKey, e: Game.envKey, a: assistOn ? 1 : 0, v: Cam.view || 0 }
  };
}
function toCode(o) {
  const s = JSON.stringify(o);
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;   // 오타·잘린 코드 확인용
  const b = btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return CODE_PFX + b + '.' + (h % 46656).toString(36);
}
function fromCode(code) {
  code = String(code || '').replace(/\s+/g, '');
  if (code.indexOf(CODE_PFX) !== 0) return null;
  const parts = code.slice(CODE_PFX.length).split('.');
  if (parts.length !== 2) return null;
  try {
    let b = parts[0].replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    const s = decodeURIComponent(escape(atob(b)));
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    if ((h % 46656).toString(36) !== parts[1]) return null;
    const o = JSON.parse(s);
    return o && o.v === 1 && o.w >= 1 && CONFIG.difficulty[o.d] ? o : null;
  } catch { return null; }
}

// 웨이브 시작마다: 기록을 갱신하고, 이어하기 저장과 코드를 새로 만든다
function saveRun() {
  if (!player.alive) return;
  recTouch();
  const o = runSnapshot();
  SaveSt.code = toCode(o);
  lsSet(SAVE_KEY, SaveSt.code);
}
// 판이 끝나면(침몰) 이어하기 저장은 지운다. 기록은 남는다
function endRun() {
  recTouch();
  lsDel(SAVE_KEY); SaveSt.code = '';
}

// 저장된 진행 상황으로 판을 다시 차린다 (그 웨이브 시작부터)
function loadRun(o) {
  recMerge(o.rec); recSave();
  if (o.set) { setgApply(o.set); selectEnv(Setg.e, true); if (assistOn !== !!Setg.a) toggleAssist(); }
  selectDiff(o.d);
  beginGame(true);
  clearEnemies();
  const P = player;
  Skill.r = o.sr || {}; Skill.pts = o.pt || 0; Skill.ship = o.sh || 0; Skill.autoFlare = !!o.af; Skill.topDown = !!o.td;
  Upg.n = o.un || {}; Upg.picks = o.up || 0; Upg.history.length = 0; (o.uh || []).forEach(function (x) { Upg.history.push(x); });
  Upg.lives = o.ul || 0; Upg.second = o.us || 0; Upg.shieldHp = o.ush || 0;
  for (let i = 0; i < un('ally'); i++) upgSpawnAlly();
  upgApply();
  P.maxHp = o.mh || P.maxHp; P.hp = Math.min(P.maxHp, o.hp || P.maxHp);
  Game.missiles = o.mi || 0; Game.flares = o.fl || 0; Game.smokes = o.sm || 0;
  if (o.is) islesBuild(o.is);
  skinApply(Rec.skin); metaBadge();
  Game.items.length = 0; (o.it || []).forEach(function (x) { if (ITEM_NAMES[x]) Game.items.push(x); });
  Game.skipped.length = 0; (o.sk || []).forEach(function (x) { Game.skipped.push(x); });
  kills = o.k || 0; SaveSt.counted = kills;
  startRound(o.w);
  Cam.view = Setg.v; viewBtnText();
  Hud.toast('웨이브 ' + o.w + '부터 이어 갑니다');
}

/* ---------- 처음 화면: 이어하기 / 코드 입력 / 기록 ---------- */
function saveUiRender() {
  const code = lsGet(SAVE_KEY), o = code ? fromCode(code) : null;
  $('cont').classList.toggle('off', !o);
  $('start-cta').classList.toggle('off', !!o);       // 이어할 판이 있으면 화면을 눌러 바로 새로 시작하지 않는다
  if (o) $('cont-info').textContent = '웨이브 ' + o.w + ' · ' + CONFIG.difficulty[o.d].label;
  const B = Rec.best;
  $('rec').innerHTML = '<b class="lvb">Lv.' + Rec.lv + '</b> 경험치 ' + Rec.xp + ' / ' + lvNeed(Rec.lv) + (Rec.lv > 1 ? ' · 적 +' + Math.round((lvMul() - 1) * 100) + '% · 시작 포인트 ' + lvStartPts() : '') + '<br>' + ((Rec.runs || Rec.kills)
    ? '최고 웨이브 <b>쉬움 ' + B.easy + '</b> · <b>보통 ' + B.normal + '</b> · <b>어려움 ' + B.hard + '</b> &nbsp; 총 격파 <b>' + Rec.kills + '</b> &nbsp; 판 수 <b>' + Rec.runs + '</b>'
    : '');
}
function startFromMenu(fn) {
  if (Game.state !== 'menu' && Game.state !== 'result') return;
  if (Touch.on && isPortrait()) return;
  Sound.init();
  if (Touch.on) goLandscape(); else requestLock();
  fn();
}
function initSaveUi() {
  recLoad();
  const stop = function (e) { e.stopPropagation(); };
  for (const id of ['cont', 'code-row', 'rec']) { $(id).addEventListener('click', stop); $(id).addEventListener('touchstart', stop, { passive: true }); }
  $('cont-yes').addEventListener('click', function () {
    const o = fromCode(lsGet(SAVE_KEY));
    if (o) startFromMenu(function () { loadRun(o); });
  });
  $('cont-new').addEventListener('click', function () { startFromMenu(function () { beginGame(); }); });
  const go = function () {
    const o = fromCode($('code-in').value);
    if (!o) { $('code-msg').textContent = '코드가 맞지 않습니다. 다시 확인해 주세요'; return; }
    $('code-msg').textContent = '';
    startFromMenu(function () { loadRun(o); });
  };
  $('code-go').addEventListener('click', go);
  $('code-in').addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') go(); });
  $('code-in').addEventListener('keyup', stop);
  // 일시정지 메뉴: 저장 코드 보기·복사
  $('code-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    $('code-out').value = SaveSt.code || '아직 저장된 웨이브가 없습니다';
    $('code-box').classList.remove('off');
    $('copy-msg').textContent = '';
  });
  $('code-box').addEventListener('click', stop);
  $('code-box').addEventListener('touchstart', stop, { passive: true });
  $('code-close').addEventListener('click', function () { $('code-box').classList.add('off'); });
  $('code-copy').addEventListener('click', function () {
    const t = $('code-out'), done = function () { $('copy-msg').textContent = '복사했습니다'; };
    t.focus(); t.select();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(done, function () { try { document.execCommand('copy'); done(); } catch { $('copy-msg').textContent = '길게 눌러 직접 복사해 주세요'; } });
    else { try { document.execCommand('copy'); done(); } catch { $('copy-msg').textContent = '길게 눌러 직접 복사해 주세요'; } }
  });
  saveUiRender();
}
