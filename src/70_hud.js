
/* ==========================================================================
 * 화면 표시 — 값이 바뀔 때만 DOM을 고친다
 * ========================================================================== */
const KNOTS = 1.94384;
const COMPASS_LABELS = [];
(function () {
  const card = { 0: '북', 90: '동', 180: '남', 270: '서' };
  for (let d = 0; d < 360; d += 15) COMPASS_LABELS.push(card[d] || (d < 100 ? '0' + d : '' + d));
})();

let bossRef = null;      // 지금 살아 있는 보스 (없으면 null)

const Hud = {
  el: null, mm: null, cp: null, mapT: 0, textT: 0, fpsT: 0, fps: 0,
  hitT: 0, killT: 0, vig: 0, bannerT: 0, warnOn: false,
  ddX: new Float32Array(4), ddZ: new Float32Array(4), ddT: new Float32Array(4), ddEl: [], ddNext: 0,
  // 마지막으로 화면에 쓴 값
  lHp: -1, lHpBar: -1, lBoost: -1, lSpeed: -1, lKills: -1, lLeft: -1, lWave: -1, lCannon: -2, lReload: -1,
  lBossOn: false, lBossHp: -1, lItems: '', lDiff: '',
  lBonus: -1, lBonusOn: -1, lMis: -1, rewardT: 0, toastT: 0, lAssist: -1, lLockP: -1, lBoxOn: false, lBoxLocked: false, lMgOn: false,
  lView: -1, lMode: -1, lXClass: '', lVig: -1, lCx: -9999, lCy: -9999, lBoostOn: false, lLow: false, lDead: false,

  init: function () {
    this.el = {
      hud: $('hud'), hp: $('h-hp'), hpbar: $('h-hpbar'), boostbar: $('h-boostbar'), speed: $('h-speed'), speedBox: $('i-speed'),
      view: $('h-view'), cannon: $('h-cannon'), cannonbar: $('h-cannonbar'), kills: $('h-kills'), left: $('h-left'), wave: $('h-wave'),
      xhair: $('xhair'), tCannon: $('t-cannon'), tBoost: $('t-boost'),
      items: $('h-items'), lv: $('h-lv'), tSlots: document.querySelectorAll('#t-items .tslot'), diff: $('h-diff'),
      bossbar: $('bossbar'), bosshp: $('h-bosshp'), bossfill: $('h-bossbar'),
      toast: $('toast'), tAssist: $('t-assist'), lock: $('x-lock'), lkBox: $('lk-box'), lkMg: $('lk-mg'),
      bonusWrap: $('h-bonuswrap'), bonus: $('h-bonus'), bonusbar: $('h-bonusbar'), missile: $('h-missile'), flare: $('h-flare'), skill: $('h-skill'), tPause: $('t-pause'), tSk: $('t-skbadge'), tFlare: $('t-flare'), tFcount: $('t-fcount'),
      tBonus: $('t-bonus'), tMissile: $('t-missile'), tMcount: $('t-mcount'), vignette: $('vignette'), warn: $('warn'), banner: $('banner'), fps: $('h-fps'), mode: $('h-aimmode'),
      smoke: $('h-smoke'), tSmoke: $('t-smoke'), tScount: $('t-scount')
    };
    const dd = $('dmgdir').children;
    for (let i = 0; i < dd.length; i++) this.ddEl.push(dd[i]);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const m = $('minimap'); m.width = 176 * dpr; m.height = 176 * dpr;
    this.mm = m.getContext('2d'); this.mm.scale(dpr, dpr);
    const c = $('compass'); c.width = 420 * dpr; c.height = 40 * dpr;
    this.cp = c.getContext('2d'); this.cp.scale(dpr, dpr);
    if (!CONFIG.quality.showFps) this.el.fps.classList.add('off');
    const box = $('emarks');
    for (let i = 0; i < EM_MAX; i++) {
      const el = document.createElement('div'); el.className = 'em';
      const ic = document.createElement('i'), tb = document.createElement('b');
      el.appendChild(ic); el.appendChild(tb); box.appendChild(el);
      emPool.push({ el: el, i: ic, b: tb, on: false, boss: false, txt: '', cls: '' });
    }
  },

  reset: function () {
    this.hitT = 0; this.killT = 0; this.vig = 0;
    for (let i = 0; i < 4; i++) { this.ddT[i] = 0; this.ddEl[i].style.opacity = '0'; }
  },

  // 명중 표시: 조준점 가운데 점이 빨갛게 커지고 X자가 잠깐 뜨며 소리가 난다. 격파하면 바깥 원까지 빨갛게
  hit: function (kill) {
    if (kill) this.killT = 0.5;
    else { this.hitT = 0.25; Sound.play('tick', 0.32, rr(0.95, 1.1), 0); }
  },

  toast: function (msg) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('on');
    this.toastT = 1.4;
  },

  // 격파 보상을 받으면 노란 게이지가 잠깐 반짝인다
  reward: function () {
    this.rewardT = 0.6;
    this.el.bonusWrap.classList.add('flash');
  },

  // 피격: 화면 가장자리가 붉어지고, 맞은 방향에 표시가 뜬다
  hurt: function (sx, sz, amount) {
    this.vig = Math.min(1, this.vig + 0.22 + amount / 30);
    const i = this.ddNext; this.ddNext = (i + 1) % 4;
    this.ddX[i] = sx; this.ddZ[i] = sz; this.ddT[i] = 1.2;
    Sound.play('hurt', Math.min(0.9, 0.4 + amount / 40), rr(0.9, 1.1), 0);
    Cam.trauma = Math.min(1, Cam.trauma + 0.1 + amount / 60);
  },

  banner: function (title, sub) {
    const b = this.el.banner;
    b.textContent = title;
    const s = document.createElement('small');
    s.textContent = sub;
    b.appendChild(s);
    b.classList.add('on');
    this.bannerT = 3.2;
  },

  update: function (dt) {
    const E = this.el, P = player, playing = Game.state === 'play';
    // 체력
    const hp = Math.ceil(P.hp);
    if (hp !== this.lHp) { this.lHp = hp; E.hp.textContent = hp; }
    const hb = Math.round(P.hp / P.maxHp * 100);
    if (hb !== this.lHpBar) { this.lHpBar = hb; E.hpbar.style.transform = 'scaleX(' + hb / 100 + ')'; }
    const low = P.hp < P.maxHp * 0.3;
    if (low !== this.lLow) { this.lLow = low; E.hpbar.classList.toggle('low', low); }
    // 부스트 게이지
    const bb = Math.round(Game.boost / CONFIG.boost.max * 100);
    if (bb !== this.lBoost) { this.lBoost = bb; E.boostbar.style.transform = 'scaleX(' + bb / 100 + ')'; if (!(Game.boost <= 0 && Game.bonus > 0)) E.tBoost.style.setProperty('--p', bb); }
    // 아이템과 난이도
    // 레벨과 경험치
    const lvs = 'Lv.' + Rec.lv + ' (' + Rec.xp + '/' + lvNeed(Rec.lv) + ')';
    if (lvs !== this.lLv) {
      this.lLv = lvs; E.lv.textContent = lvs;
      $('h-lvs').textContent = Rec.lv;                                     // 왼쪽 위 (PC·폰 모두)
      $('h-xp').style.width = Math.round(Rec.xp / lvNeed(Rec.lv) * 100) + '%';
    }
    // 아이템 칸: 칸마다 이름을 따로 (PC는 E·R·G 키와 함께, 폰은 칸 버튼)
    const nH = CONFIG.items.maxHeld, it = nH + ':' + Game.items.join(',');
    if (it !== this.lItems) {
      this.lItems = it;
      const KEYS = ['E', 'R', 'G'];
      let h = '';
      for (let k = 0; k < nH; k++) h += (k ? '  ' : '') + '<span class="key">' + KEYS[k] + '</span> ' + (Game.items[k] ? ITEM_NAMES[Game.items[k]] : '<span style="opacity:.45">빈 칸</span>');
      E.items.innerHTML = h;
      for (let k = 0; k < E.tSlots.length; k++) {
        const el = E.tSlots[k], on = !!Game.items[k];
        el.style.display = k < nH ? '' : 'none';
        el.textContent = on ? ITEM_NAMES[Game.items[k]] : '빈 칸';
        el.classList.toggle('empty', !on);
      }
    }
    if (DIFF().label !== this.lDiff) { this.lDiff = DIFF().label; E.diff.textContent = this.lDiff; }
    // 보스 체력바
    let boss = null;
    for (let i = 0; i < enemies.length; i++) if (enemies[i].alive && enemies[i].kind === 'boss') { boss = enemies[i]; break; }
    bossRef = boss;
    const sup = !boss && Special.supply && Special.supply.alive && !Special.supply.sailAway ? Special.supply : null, bbar = boss || sup;
    if (!!bbar !== this.lBossOn) { this.lBossOn = !!bbar; E.bossbar.classList.toggle("off", !bbar); }
    const rage = !!(boss && boss.enraged), bk = sup ? 2 : (rage ? 1 : 0);
    if (bk !== this.lRage) { this.lRage = bk; E.bossbar.classList.toggle('rage', rage); E.bossbar.classList.toggle('ally', !!sup); E.bossbar.querySelector('.lbl').textContent = sup ? '아군 보급선 · 지켜 주세요' : (rage ? '적 기함 · 격노' : '적 기함'); }
    if (sup) { const bh = Math.ceil(sup.hp); if (bh !== this.lBossHp) { this.lBossHp = bh; E.bosshp.textContent = bh; E.bossfill.style.transform = 'scaleX(' + clamp(sup.hp / sup.maxHp, 0, 1) + ')'; } }
    if (boss) {
      const bh = Math.ceil(boss.hp);
      if (bh !== this.lBossHp) { this.lBossHp = bh; E.bosshp.textContent = bh; E.bossfill.style.transform = 'scaleX(' + clamp(boss.hp / boss.maxHp, 0, 1) + ')'; }
    }
    // 노란 추가 부스트
    const bs = Math.round(Game.bonus * 10);
    if (bs !== this.lBonus) {
      this.lBonus = bs;
      E.bonus.textContent = (bs / 10).toFixed(1) + '초';
      E.bonusbar.style.transform = 'scaleX(' + Math.min(Game.bonus / CONFIG.boost.bonusBarFull, 1) + ')';
      E.bonusWrap.classList.toggle('empty', bs <= 0);
      E.tBonus.textContent = bs > 0 ? '+' + Math.ceil(Game.bonus) : '';
    }
    const usingBonus = Game.boost <= 0 && Game.bonus > 0 ? 1 : 0;
    if (usingBonus !== this.lBonusOn) { this.lBonusOn = usingBonus; E.tBoost.classList.toggle('bonus', usingBonus === 1); if (usingBonus) E.tBoost.style.setProperty('--p', 100); }
    if (this.rewardT > 0) { this.rewardT -= dt; if (this.rewardT <= 0) E.bonusWrap.classList.remove('flash'); }
    const as = assistOn ? 1 : 0;
    if (as !== this.lAssist) { this.lAssist = as; E.tAssist.classList.toggle('dim', !as); }
    // 락온: 조준 원이 1초 동안 빨갛게 차오르고, 다 차면 적에게 빨간 마커와 기관총 리드 마커가 붙는다
    const lp = Lock.target ? 100 : Math.round(Lock.prog * 100);
    if (lp !== this.lLockP) { this.lLockP = lp; E.lock.setAttribute('stroke-dashoffset', 100 - lp); }
    const boxOn = Lock.boxOn && playing;
    if (boxOn !== this.lBoxOn) { this.lBoxOn = boxOn; E.lkBox.classList.toggle('on', boxOn); }
    if (boxOn) {
      E.lkBox.style.transform = 'translate(' + Lock.bx.toFixed(1) + 'px,' + Lock.by.toFixed(1) + 'px) scale(' + Lock.bs.toFixed(2) + ')';
      const lk = !!Lock.target;
      if (lk !== this.lBoxLocked) { this.lBoxLocked = lk; E.lkBox.classList.toggle('locked', lk); }
    }
    const mgOn = Lock.mgOn && playing;
    if (mgOn !== this.lMgOn) { this.lMgOn = mgOn; E.lkMg.classList.toggle('on', mgOn); }
    if (mgOn) E.lkMg.style.transform = 'translate(' + Lock.mx.toFixed(1) + 'px,' + Lock.my.toFixed(1) + 'px)';
    this.updateMarks(playing);
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) E.toast.classList.remove('on'); }
    // 미사일 수
    if (Game.missiles !== this.lMis) {
      this.lMis = Game.missiles;
      E.missile.textContent = Game.missiles + '발';
      E.missile.classList.toggle('has', Game.missiles > 0);
      E.tMcount.textContent = Game.missiles;
      E.tMissile.classList.toggle('empty', Game.missiles <= 0);
    }
    // 플레어 수
    // 스킬 포인트: 찍을 수 있는 단계가 있으면 강조
    const skc = skillCheapest(), ska = skc > 0 && Skill.pts >= skc, skk = Skill.pts * 2 + (ska ? 1 : 0);
    if (skk !== this.lSk) {
      this.lSk = skk;
      E.skill.textContent = Skill.pts + '점';
      E.skill.classList.toggle('has', ska);
      E.tSk.textContent = Skill.pts;
      E.tPause.classList.toggle('sk', ska);
    }
    // 연막탄 수
    if (Game.smokes !== this.lSmk) {
      this.lSmk = Game.smokes;
      E.smoke.textContent = Game.smokes + '발';
      E.smoke.classList.toggle('has', Game.smokes >= CONFIG.smoke.per);
      E.tScount.textContent = Game.smokes;
      E.tSmoke.classList.toggle('empty', Game.smokes < CONFIG.smoke.per);
    }
    // 플레어 수와 다시 쓰기까지 남은 시간
    const fr = Game.flareT > 0 ? Math.ceil(Game.flareT * 10) : 0, fk = Game.flares * 100 + fr;
    if (fk !== this.lFl) {
      this.lFl = fk;
      E.flare.textContent = Game.flares + '개';
      E.flare.classList.toggle('has', Game.flares > 0 && !fr);
      E.tFcount.textContent = Game.flares;
      E.tFlare.style.setProperty('--p', fr ? Math.round(100 - fr * 10 / CONFIG.flare.cooldown) : 100);
      E.tFlare.classList.toggle('empty', Game.flares <= 0 || !!fr);
    }
    if (P.boosting !== this.lBoostOn) { this.lBoostOn = P.boosting; E.speedBox.classList.toggle('boost', P.boosting); }
    // 속도계 (초당 10번)
    this.textT += dt;
    if (this.textT > 0.1) {
      this.textT = 0;
      const kn = Math.round(Math.sqrt(P.vx * P.vx + P.vz * P.vz) * KNOTS);
      if (kn !== this.lSpeed) { this.lSpeed = kn; E.speed.textContent = kn; }
    }
    // 함포 재장전
    const rl = cannonT <= 0 ? 100 : Math.round((1 - cannonT / CONFIG.cannon.reload) * 100);
    if (rl !== this.lReload) {
      this.lReload = rl;
      E.cannonbar.style.transform = 'scaleX(' + rl / 100 + ')';
      E.tCannon.style.setProperty('--p', rl);
      E.tCannon.classList.toggle('ready', rl >= 100);
    }
    const cs = cannonT <= 0 ? -1 : Math.ceil(cannonT * 10);
    if (cs !== this.lCannon) {
      this.lCannon = cs;
      E.cannon.textContent = cs < 0 ? '발사 준비' : '장전 ' + (cs / 10).toFixed(1) + '초';
      E.cannon.classList.toggle('ready', cs < 0);
    }
    // 격파 수, 남은 적, 웨이브
    if (kills !== this.lKills) { this.lKills = kills; E.kills.textContent = kills; }
    const left = enemiesAlive();
    if (left !== this.lLeft) { this.lLeft = left; E.left.textContent = left; }
    if (round !== this.lWave) { this.lWave = round; E.wave.textContent = round < 10 ? '0' + round : '' + round; }
    const vk = Cam.view + (Touch.on ? 2 : 0);
    if (vk !== this.lView) { this.lView = vk; E.view.textContent = (Cam.view ? '1인칭' : '3인칭') + ' 시점'; }
    const mode = Input.locked ? 1 : 0;
    if (mode !== this.lMode) {
      this.lMode = mode;
      E.mode.textContent = mode ? '조준: 마우스 고정' : '조준: 커서가 가리키는 곳 · 화면 좌우 끝에서 시점 회전';
    }

    if (!P.alive !== this.lDead) { this.lDead = !P.alive; E.hud.classList.toggle('dead', this.lDead); }
    // 조준점: 커서 조준 방식에서는 커서를 따라다닌다
    let cx = 0, cy = 0;
    if (!Input.locked && !Touch.on && playing) { cx = Math.round(Input.mx - window.innerWidth * 0.5); cy = Math.round(Input.my - window.innerHeight * 0.5); }
    if (cx !== this.lCx || cy !== this.lCy) { this.lCx = cx; this.lCy = cy; E.xhair.style.transform = 'translate(' + cx + 'px,' + cy + 'px)'; }
    if (this.hitT > 0) this.hitT -= dt;
    if (this.killT > 0) this.killT -= dt;
    const xc = (Lock.target ? 'locked ' : '') + (this.killT > 0 ? 'killing' : (this.hitT > 0 ? 'hitting' : ''));
    if (xc !== this.lXClass) { this.lXClass = xc; E.xhair.className = xc; }

    // 피격 효과
    if (this.vig > 0) this.vig = Math.max(0, this.vig - dt * 1.4);
    let vg = this.vig;
    if (low && P.alive) vg = Math.max(vg, 0.22 + 0.12 * Math.sin(simTime * 5));
    vg = Math.round(vg * 50) / 50;
    if (vg !== this.lVig) { this.lVig = vg; E.vignette.style.opacity = vg; }
    for (let i = 0; i < 4; i++) {
      if (this.ddT[i] <= 0) continue;
      this.ddT[i] -= dt;
      const el = this.ddEl[i];
      if (this.ddT[i] <= 0) { el.style.opacity = '0'; continue; }
      const dx = this.ddX[i] - P.x, dz = this.ddZ[i] - P.z;
      const ang = Math.atan2(dx * Cam.rightX + dz * Cam.rightZ, dx * Cam.fwdX + dz * Cam.fwdZ);
      el.style.transform = 'rotate(' + ang.toFixed(2) + 'rad)';
      el.style.opacity = Math.min(1, this.ddT[i] * 1.6).toFixed(2);
    }

    // 바다 경계 경고
    const wm = HALF - CONFIG.world.warnMargin;
    const warn = playing && P.alive && (P.x > wm || P.x < -wm || P.z > wm || P.z < -wm);
    if (warn !== this.warnOn) { this.warnOn = warn; E.warn.classList.toggle('on', warn); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) E.banner.classList.remove('on'); }

    this.mapT += dt;
    if (this.mapT > 0.033) { this.mapT = 0; this.drawMinimap(); this.drawCompass(); }
    this.fpsT += dt;
    if (this.fpsT > 0.5) {
      this.fpsT = 0;
      if (CONFIG.quality.showFps) E.fps.textContent = 'FPS ' + Math.round(this.fps) + ' · 해상도 ' + Math.round(pixelRatio * 100) + '%';
    }
  },

  // 화면 적 표시: 멀리 있는 적은 위치에 삼각형과 거리, 화면 밖 적은 가장자리에 그쪽을 가리키는 화살표
  updateMarks: function (playing) {
    const W = window.innerWidth, H = window.innerHeight, P = player, far = CONFIG.radar.markFrom;
    const hw = W * 0.5 - 34, hh = H * 0.5 - 34;
    let n = 0;
    if (playing) {
      camera.updateMatrixWorld();
      const hideR = Special.kind === 'fog' ? 320 : (Special.kind === 'night' ? 480 : 1e9);
      const nE = enemies.length;
      for (let i = 0; i < nE + airs.length && n < EM_MAX; i++) {
        const e = i < nE ? enemies[i] : airs[i - nE];
        if (!e.alive || e.submerged) continue;
        const d = Math.hypot(e.x - P.x, e.z - P.z), ty = e.y + (e.air ? 3 : e.M.topY + 2);
        if (d > hideR || (e.kind === 'drone' && d > 700)) continue;
        _emV.set(e.x, ty, e.z).project(camera);
        const on = _emV.z < 1 && _emV.x > -1 && _emV.x < 1 && _emV.y > -1 && _emV.y < 1;
        if (on && d < far) continue;            // 가까이 보이는 적은 체력바로 충분하다
        const M = emPool[n++];
        let x, y, ang, tx, tyy;
        if (on) {
          x = (_emV.x * 0.5 + 0.5) * W; y = (-_emV.y * 0.5 + 0.5) * H;
          ang = Math.PI / 2; tx = 0; tyy = -24;
        } else {
          _emV.set(e.x, ty, e.z).applyMatrix4(camera.matrixWorldInverse);
          let dx = _emV.x, dy = -_emV.y;
          if (_emV.z > 0 && Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = 1;
          const l = Math.sqrt(dx * dx + dy * dy) || 1; dx /= l; dy /= l;
          if (Touch.on) {
            // 폰·태블릿: 가장자리에는 버튼이 있어서 조준점 둘레의 고리에 화살표를 놓는다 (거리는 바깥쪽)
            const t = Math.min(W, H) * 0.28;
            x = W * 0.5 + dx * t; y = H * 0.5 + dy * t; tx = dx * 26; tyy = dy * 20;
          } else {
            const t = Math.min(hw / Math.max(Math.abs(dx), 1e-4), hh / Math.max(Math.abs(dy), 1e-4));
            x = W * 0.5 + dx * t; y = H * 0.5 + dy * t; tx = -dx * 26; tyy = -dy * 22;
          }
          ang = Math.atan2(dy, dx);
        }
        if (!M.on) { M.on = true; M.el.classList.add('on'); }
        const boss = e.kind === 'boss', cls = e.air ? 'air' : (d > CONFIG.mg.range ? 'far' : '');     // 사거리 밖은 회색, 하늘 적은 하늘색
        if (boss !== M.boss) { M.boss = boss; M.el.classList.toggle('boss', boss); }
        if (cls !== M.cls) { if (M.cls) M.el.classList.remove(M.cls); if (cls) M.el.classList.add(cls); M.cls = cls; }
        M.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        M.i.style.transform = 'rotate(' + ang.toFixed(3) + 'rad)';      // 삼각형: 화면 안이면 아래(적)를, 화면 밖이면 그 방향을 가리킨다
        M.b.style.transform = 'translate(-50%,-50%) translate(' + tx.toFixed(1) + 'px,' + tyy.toFixed(1) + 'px)';
        const txt = (e.air ? (e.kind === 'heli' ? '헬기 ' : '드론 ') : '') + (d >= 1000 ? (d / 1000).toFixed(1) + 'km' : (Math.round(d / 10) * 10) + 'm');
        if (txt !== M.txt) { M.txt = txt; M.b.textContent = txt; }
      }
      // 날아오는 적 미사일 경보: 주황 삼각형 + "미사일" (화면 밖이면 그쪽 방향)
      for (let i = 0; i < MIS_MAX && n < EM_MAX; i++) {
        const m = missiles[i];
        if (!m.on || m.owner !== 1) continue;
        const d = Math.hypot(m.x - P.x, m.z - P.z);
        _emV.set(m.x, m.y + 1.5, m.z).project(camera);
        const on = _emV.z < 1 && _emV.x > -1 && _emV.x < 1 && _emV.y > -1 && _emV.y < 1;
        const M = emPool[n++];
        let x, y, ang, tx, tyy;
        if (on) { x = (_emV.x * 0.5 + 0.5) * W; y = (-_emV.y * 0.5 + 0.5) * H; ang = Math.PI / 2; tx = 0; tyy = -24; }
        else {
          _emV.set(m.x, m.y, m.z).applyMatrix4(camera.matrixWorldInverse);
          let dx = _emV.x, dy = -_emV.y;
          const l = Math.sqrt(dx * dx + dy * dy) || 1; dx /= l; dy /= l;
          if (Touch.on) { const t = Math.min(W, H) * 0.28; x = W * 0.5 + dx * t; y = H * 0.5 + dy * t; tx = dx * 30; tyy = dy * 22; }
          else { const t = Math.min(hw / Math.max(Math.abs(dx), 1e-4), hh / Math.max(Math.abs(dy), 1e-4)); x = W * 0.5 + dx * t; y = H * 0.5 + dy * t; tx = -dx * 30; tyy = -dy * 24; }
          ang = Math.atan2(dy, dx);
        }
        if (!M.on) { M.on = true; M.el.classList.add('on'); }
        if (M.boss) { M.boss = false; M.el.classList.remove('boss'); }
        if (M.cls !== 'mis') { if (M.cls) M.el.classList.remove(M.cls); M.el.classList.add('mis'); M.cls = 'mis'; }
        M.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        M.i.style.transform = 'rotate(' + ang.toFixed(3) + 'rad)';
        M.b.style.transform = 'translate(-50%,-50%) translate(' + tx.toFixed(1) + 'px,' + tyy.toFixed(1) + 'px)';
        const txt = '미사일 ' + (Math.round(d / 10) * 10) + 'm';
        if (txt !== M.txt) { M.txt = txt; M.b.textContent = txt; }
      }
    }
    for (let i = n; i < EM_MAX; i++) { const M = emPool[i]; if (M.on) { M.on = false; M.el.classList.remove('on'); } }
  },

  // 레이더 미니맵: 진한 바탕에 초록 레이더. 내 배가 가운데, 화면이 보는 방향이 위
  // 표시 방식(CONFIG.radar.icons): 'side' 옆모습 실루엣, 'nato' 나토 군사 기호, 'top' 위에서 본 실루엣
  drawMinimap: function () {
    const c = this.mm, S = 176, cx = S * 0.5, cy = S * 0.5, RR = S * 0.5 - 6, RG = CONFIG.radar.range, k = RR / RG;
    const fx = Cam.fwdX, fz = Cam.fwdZ, rx = Cam.rightX, rz = Cam.rightZ, px0 = player.x, pz0 = player.z;
    const G = '70,235,95', now = performance.now() / 1000, ST = CONFIG.radar.icons;
    const toR = function (x, z) { const dx = x - px0, dz = z - pz0; _mm.x = cx + (dx * rx + dz * rz) * k; _mm.y = cy - (dx * fx + dz * fz) * k; };
    const rotOf = function (h) { const hs = Math.sin(h), hc = Math.cos(h); return Math.atan2(hs * rx + hc * rz, hs * fx + hc * fz); };
    c.clearRect(0, 0, S, S);
    c.save();
    // 레이더 화면: 검은 바탕에 초록 동심원 네 겹과 십자선
    c.beginPath(); c.arc(cx, cy, RR + 3, 0, TAU); c.closePath();
    c.fillStyle = 'rgba(0,5,2,0.9)'; c.fill();
    c.clip();
    c.strokeStyle = 'rgba(' + G + ',0.75)'; c.lineWidth = 1.2;
    for (let q = 1; q <= 4; q++) { c.beginPath(); c.arc(cx, cy, RR * q / 4.2, 0, TAU); c.stroke(); }
    c.beginPath(); c.moveTo(cx - RR - 3, cy); c.lineTo(cx + RR + 3, cy); c.moveTo(cx, cy - RR - 3); c.lineTo(cx, cy + RR + 3); c.stroke();
    // 내 사거리 고리 (흐린 노란 점선): 이 안의 적은 지금 쏠 수 있다
    const rr0 = CONFIG.mg.range * k;
    c.strokeStyle = 'rgba(255,194,103,0.45)'; c.lineWidth = 1; c.setLineDash(DASH34);
    c.beginPath(); c.arc(cx, cy, rr0, 0, TAU); c.stroke(); c.setLineDash(NODASH);
    // 바다 경계
    c.strokeStyle = 'rgba(255,194,103,0.3)'; c.lineWidth = 1;
    c.beginPath();
    toR(-HALF, -HALF); c.moveTo(_mm.x, _mm.y);
    toR(HALF, -HALF); c.lineTo(_mm.x, _mm.y);
    toR(HALF, HALF); c.lineTo(_mm.x, _mm.y);
    toR(-HALF, HALF); c.lineTo(_mm.x, _mm.y);
    c.closePath(); c.stroke();
    // 섬: 짙은 초록 윤곽, 암초: 작은 점들
    for (let i = 0; i < ISLES.length; i++) {
      const I = ISLES[i];
      if (Math.abs(I.x - px0) > RG + I.r * 1.4 || Math.abs(I.z - pz0) > RG + I.r * 1.4) continue;
      c.beginPath();
      for (let q = 0; q <= 24; q++) { const a = q / 24 * TAU, R = isleRad(I, a); toR(I.x + Math.cos(a) * R, I.z + Math.sin(a) * R); if (q) c.lineTo(_mm.x, _mm.y); else c.moveTo(_mm.x, _mm.y); }
      c.closePath(); c.fillStyle = 'rgba(' + G + ',0.22)'; c.fill(); c.strokeStyle = 'rgba(' + G + ',0.85)'; c.lineWidth = 1.2; c.stroke();
    }
    c.fillStyle = 'rgba(' + G + ',0.7)';
    for (let i = 0; i < REEFS.length; i++) {
      const rf = REEFS[i];
      if (Math.abs(rf.x - px0) > RG + rf.R || Math.abs(rf.z - pz0) > RG + rf.R) continue;
      for (let q = 0; q < rf.rocks.length; q++) { toR(rf.rocks[q].x, rf.rocks[q].z); c.fillRect(_mm.x - 0.8, _mm.y - 0.8, 1.6, 1.6); }
      toR(rf.x, rf.z); c.strokeStyle = 'rgba(' + G + ',0.4)'; c.setLineDash(DASH23); c.beginPath(); c.arc(_mm.x, _mm.y, rf.R * k, 0, TAU); c.stroke(); c.setLineDash(NODASH);
    }
    // 내 연막
    for (let i = 0; i < smkClouds.length; i++) { const sc = smkClouds[i]; if (!sc.on) continue; toR(sc.x, sc.z); c.fillStyle = 'rgba(210,225,215,0.22)'; c.beginPath(); c.arc(_mm.x, _mm.y, sc.R * k, 0, TAU); c.fill(); }
    c.restore();
    c.strokeStyle = 'rgba(' + G + ',0.95)'; c.lineWidth = 2.2;
    c.beginPath(); c.arc(cx, cy, RR + 2.5, 0, TAU); c.stroke();
    c.lineJoin = 'round'; c.lineCap = 'round';
    // 범위 밖이면 가장자리 안쪽으로 당겨서 작게 그린다 (sc = 크기 배율)
    const place = function () {
      const dx = _mm.x - cx, dy = _mm.y - cy, dd = Math.sqrt(dx * dx + dy * dy), lim = RR - 9;
      if (dd <= lim) return 1;
      _mm.x = cx + dx / dd * lim; _mm.y = cy + dy / dd * lim; return 0.62;
    };
    // 보급 상자
    for (let i = 0; i < crates.length; i++) {
      const cr = crates[i]; if (!cr.on) continue;
      toR(cr.x, cr.z); const sc = place();
      radarCrate(c, ST, _mm.x, _mm.y, sc);
    }
    // 적 함정
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]; if (!e.alive || e.submerged) continue;
      if (Special.kind === 'night' && Math.hypot(e.x - px0, e.z - pz0) > 700) continue;      // 야간 기습: 불 끈 적은 가까워야 잡힌다
      toR(e.x, e.z); const sc = place(), x0 = _mm.x, y0 = _mm.y;
      // 적: 살짝 빛나는 빨간 점, 기함은 더 큰 원. 나를 쫓는 적은 진하게, 아직 못 본 적은 흐리게, 격노한 기함은 깜빡인다
      let al = e.ai.state !== 0 ? 1 : 0.5;
      if (e.enraged) al *= 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 10));
      radarDot(c, x0, y0, (e.kind === 'boss' ? 5.5 : 2.6) * (sc < 1 ? 0.8 : 1), al, e.kind === 'boss', now + i);
    }
    // 하늘 적: 빨간 세모 (헬기는 크게, 드론은 작게). 진행 방향을 가리킨다
    for (let i = 0; i < airs.length; i++) {
      const a = airs[i]; if (!a.alive) continue;
      if (Special.kind === 'night' && Math.hypot(a.x - px0, a.z - pz0) > 700) continue;
      toR(a.x, a.z); const sc = place(), r = (a.kind === 'heli' ? 5 : 3) * sc, ang = Math.atan2(a.vx * rx + a.vz * rz, a.vx * fx + a.vz * fz);
      c.save(); c.translate(_mm.x, _mm.y); c.rotate(ang);
      // 빛 번짐(shadowBlur) 대신 크고 옅은 세모를 한 번 더 그린다 (저사양에서 훨씬 가볍다)
      c.fillStyle = 'rgba(255,70,50,0.28)';
      c.beginPath(); c.moveTo(0, -r * 2.1); c.lineTo(r * 1.65, r * 1.6); c.lineTo(-r * 1.65, r * 1.6); c.closePath(); c.fill();
      c.fillStyle = a.kind === 'heli' ? 'rgba(255,90,70,1)' : 'rgba(255,140,90,0.95)';
      c.beginPath(); c.moveTo(0, -r * 1.3); c.lineTo(r, r); c.lineTo(-r, r); c.closePath(); c.fill();
      c.restore();
    }
    // 보급선: 초록 네모, 목적지는 점선 고리
    if (Special.supply && Special.supply.alive) {
      const b = Special.supply; toR(b.x, b.z); const sc = place();
      c.fillStyle = 'rgba(120,255,160,1)'; c.fillRect(_mm.x - 4 * sc, _mm.y - 4 * sc, 8 * sc, 8 * sc);
      if (Special.dest && !b.sailAway) { toR(Special.dest.x, Special.dest.z); place(); c.strokeStyle = 'rgba(120,255,160,0.8)'; c.setLineDash(DASH22); c.beginPath(); c.arc(_mm.x, _mm.y, 5, 0, TAU); c.stroke(); c.setLineDash(NODASH); }
    }
    // 아군 고속정: 초록색
    for (let i = 0; i < allies.length; i++) {
      const a = allies[i]; if (!a.alive) continue;
      toR(a.x, a.z); const sc = place();
      c.fillStyle = 'rgba(150,255,170,0.95)'; c.beginPath(); c.arc(_mm.x, _mm.y, 2.6 * sc, 0, TAU); c.fill();
    }
    // 미사일: 적 미사일은 깜빡인다
    const blink = 0.65 + 0.35 * Math.sin(now * 12);
    for (let i = 0; i < MIS_MAX; i++) {
      const m = missiles[i]; if (!m.on) continue;
      toR(m.x, m.z); const sc = place();
      const own = m.owner === 0;
      radarMissile(c, ST, own, _mm.x, _mm.y, Math.atan2(m.vx * rx + m.vz * rz, m.vx * fx + m.vz * fz), sc, own ? 0.75 : blink);
    }
    // 나: 가운데 점 + 뱃머리 방향 직선 (나토 기호에서는 파란 원)
    const hr = rotOf(player.heading), ex = cx + Math.sin(hr) * 17, ey = cy - Math.cos(hr) * 17;
    const meCol = 'rgba(120,255,140,1)';
    c.strokeStyle = 'rgba(2,20,10,0.9)'; c.lineWidth = 4.5;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = meCol; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(ex, ey); c.stroke();
    c.fillStyle = meCol; c.strokeStyle = 'rgba(2,20,10,0.9)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy, 4, 0, TAU); c.fill(); c.stroke();
    c.lineCap = 'butt';
    const nx = -rz, ny = fz;
    c.fillStyle = 'rgba(' + G + ',0.8)'; c.font = '700 10px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('북', cx + nx * (RR - 9), cy + ny * (RR - 9));
    c.fillStyle = 'rgba(' + G + ',0.5)'; c.font = '9px sans-serif'; c.textAlign = 'left';
    c.fillText((RG / 1000).toFixed(1) + 'km', 2, S - 6);
  },

  // 방위 눈금: 바라보는 방향이 가운데, 아래 삼각형은 뱃머리 방향
  drawCompass: function () {
    const c = this.cp, W = 420, H = 40, ppd = 3.1;
    c.clearRect(0, 0, W, H);
    const bearing = ((180 - Cam.yaw * 180 / Math.PI) % 360 + 360) % 360;
    c.strokeStyle = 'rgba(238,246,247,0.8)';
    c.fillStyle = 'rgba(238,246,247,0.9)';
    c.lineWidth = 1.2;
    c.font = '600 12px sans-serif';
    c.textAlign = 'center';
    // 글씨 그림자(shadowBlur) 대신 어두운 테두리 글씨를 먼저 깐다
    c.beginPath();
    const d0 = Math.ceil((bearing - 66) / 5) * 5;
    c.lineWidth = 3; c.strokeStyle = 'rgba(4,10,20,0.55)';
    for (let d = d0; d <= bearing + 66; d += 5) {
      if (((d % 15) + 15) % 15 !== 0) continue;
      c.strokeText(COMPASS_LABELS[(((d % 360) + 360) % 360) / 15], W * 0.5 + (d - bearing) * ppd, 14);
    }
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(238,246,247,0.8)';
    for (let d = d0; d <= bearing + 66; d += 5) {
      const x = W * 0.5 + (d - bearing) * ppd;
      const major = ((d % 15) + 15) % 15 === 0;
      c.moveTo(x, 20); c.lineTo(x, major ? 31 : 26);
      if (major) c.fillText(COMPASS_LABELS[(((d % 360) + 360) % 360) / 15], x, 14);
    }
    c.stroke();
    c.fillStyle = '#ffc267';
    c.beginPath();
    c.moveTo(W * 0.5, 22); c.lineTo(W * 0.5 - 5, 36); c.lineTo(W * 0.5 + 5, 36);
    c.closePath();
    c.fill();
    const hb = ((180 - player.heading * 180 / Math.PI) % 360 + 360) % 360;
    let off = hb - bearing;
    if (off > 180) off -= 360; else if (off < -180) off += 360;
    if (off > -64 && off < 64) {
      const x = W * 0.5 + off * ppd;
      c.strokeStyle = '#5fe0c8';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x - 5, 38); c.lineTo(x, 30); c.lineTo(x + 5, 38);
      c.stroke();
    }
  }
};

const DASH23 = [2, 3], DASH22 = [2, 2], DASH34 = [3, 4], NODASH = [];

/* ---------- 적 체력바: 적 위에 떠 있는 막대. WebGL로 한꺼번에 그린다 ---------- */
const HB_MAX = 24;
let hbGeo = null, hbCenter = null, hbData = null, hbACenter = null, hbAData = null;
const uHbRes = { value: new THREE.Vector2(1, 1) };

function initHealthBars() {
  hbCenter = new Float32Array(HB_MAX * 12);
  hbData = new Float32Array(HB_MAX * 8);
  const corner = new Float32Array(HB_MAX * 8), idx = new Uint16Array(HB_MAX * 6);
  for (let i = 0; i < HB_MAX; i++) {
    const u = i * 8, k = i * 6, v = i * 4;
    corner[u] = -1; corner[u + 1] = -1; corner[u + 2] = 1; corner[u + 3] = -1; corner[u + 4] = 1; corner[u + 5] = 1; corner[u + 6] = -1; corner[u + 7] = 1;
    idx[k] = v; idx[k + 1] = v + 1; idx[k + 2] = v + 2; idx[k + 3] = v; idx[k + 4] = v + 2; idx[k + 5] = v + 3;
  }
  hbGeo = new THREE.BufferGeometry();
  hbACenter = new THREE.BufferAttribute(hbCenter, 3); hbACenter.setUsage(THREE.DynamicDrawUsage);
  hbAData = new THREE.BufferAttribute(hbData, 2); hbAData.setUsage(THREE.DynamicDrawUsage);
  hbGeo.setAttribute('position', hbACenter);
  hbGeo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  hbGeo.setAttribute('aData', hbAData);
  hbGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  hbGeo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uRes: uHbRes },
    vertexShader:
      'attribute vec2 aCorner;\nattribute vec2 aData;\nuniform vec2 uRes;\nvarying vec2 vUv;\nvarying vec2 vData;\n' +
      'void main(){\n' +
      '  vec4 p = projectionMatrix * viewMatrix * vec4(position, 1.0);\n' +
      '  p.xy += aCorner * vec2(27.0, 3.5) * uRes * p.w;\n' +      // 화면에서 항상 같은 크기
      '  gl_Position = p;\n  vUv = aCorner * 0.5 + 0.5;\n  vData = aData;\n}\n',
    fragmentShader:
      'varying vec2 vUv;\nvarying vec2 vData;\n' +
      'void main(){\n' +
      '  bool fill = vUv.x < vData.x;\n' +
      '  vec3 c = fill ? vec3(1.0, 0.29, 0.23) : vec3(0.02, 0.07, 0.10);\n' +
      '  float a = fill ? 0.95 : 0.6;\n' +
      '  if (vUv.x < 0.02 || vUv.x > 0.98 || vUv.y < 0.15 || vUv.y > 0.85) { c = vec3(0.93, 0.96, 0.97); a = 0.8; }\n' +
      '  gl_FragColor = vec4(c, a * vData.y);\n}\n',
    transparent: true, depthTest: false, depthWrite: false
  });
  const mesh = new THREE.Mesh(hbGeo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 50;
  scene.add(mesh);
}


// 레이더 함정 아이콘. rot = 레이더 위에서 뱃머리 방향(위 = 0), sc = 크기 배율
// 레이더 위 적 표시: 가운데가 밝고 둘레가 은은하게 번지는 빨간 점 (기함은 큰 원에 테두리)
function radarDot(c, x, y, r, al, big, ph) {
  const pulse = 0.85 + 0.15 * Math.sin(ph * 3);
  const g = c.createRadialGradient(x, y, 0, x, y, r * 2.6);
  g.addColorStop(0, 'rgba(255,190,170,' + al + ')'); g.addColorStop(0.3, 'rgba(255,50,35,' + al + ')');
  g.addColorStop(0.55, 'rgba(255,30,20,' + 0.35 * al * pulse + ')'); g.addColorStop(1, 'rgba(255,20,10,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.6, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,60,40,' + al + ')'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  if (big) { c.strokeStyle = 'rgba(255,120,100,' + al + ')'; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.stroke(); }
}
function radarMissile(c, st, own, x, y, ang, sc, al) {
  c.save(); c.translate(x, y); c.globalAlpha = al;
  const col = own ? 'rgba(235,245,255,1)' : 'rgba(255,60,40,1)';
  if (st === 'nato') {
    // 나토 기호: 공중 표적 = 위쪽 반 마름모 + 진행 방향 선
    c.strokeStyle = col; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-5 * sc, 1); c.lineTo(0, -4.5 * sc); c.lineTo(5 * sc, 1); c.stroke();
    c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -1); c.lineTo(Math.sin(ang) * 11 * sc, -1 - Math.cos(ang) * 11 * sc); c.stroke();
    c.restore(); return;
  }
  // 실루엣: 가는 몸통, 뾰족한 머리, 꼬리 날개, 분사 불꽃
  c.rotate(ang); c.scale(sc, sc);
  c.fillStyle = 'rgba(255,200,90,0.9)';
  c.beginPath(); c.moveTo(-1.2, 5.5); c.lineTo(0, 9.5 + Math.random() * 1.5); c.lineTo(1.2, 5.5); c.closePath(); c.fill();
  c.fillStyle = col; c.strokeStyle = 'rgba(10,10,10,0.85)'; c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(0, -7.5); c.lineTo(1.3, -4.8); c.lineTo(1.3, 3.2); c.lineTo(3.2, 5.6); c.lineTo(1.1, 5.2); c.lineTo(-1.1, 5.2); c.lineTo(-3.2, 5.6); c.lineTo(-1.3, 3.2); c.lineTo(-1.3, -4.8); c.closePath();
  c.stroke(); c.fill();
  c.restore();
}

// 레이더 보급 상자: 노란 상자 (나토 기호에서는 노란 네모)
function radarCrate(c, st, x, y, sc) {
  c.save(); c.translate(x, y); c.scale(sc, sc);
  if (st === 'nato') { c.strokeStyle = 'rgba(255,194,103,1)'; c.lineWidth = 2; c.strokeRect(-4.5, -4.5, 9, 9); c.restore(); return; }
  c.fillStyle = 'rgba(255,194,103,1)'; c.strokeStyle = 'rgba(60,35,5,0.95)'; c.lineWidth = 1;
  c.fillRect(-5, -4, 10, 8); c.strokeRect(-5, -4, 10, 8);
  c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.moveTo(0, -4); c.lineTo(0, 4); c.stroke();
  c.restore();
}
const EM_MAX = 24, emPool = [], _emV = new THREE.Vector3(), _mm = { x: 0, y: 0 };

function healthBarsUpdate() {
  let n = 0;
  const cx = camera.position.x, cz = camera.position.z;
  for (let i = 0; i < enemies.length && n < HB_MAX; i++) {
    const b = enemies[i];
    if (!b.alive) continue;
    const dx = b.x - cx, dz = b.z - cz, d = Math.sqrt(dx * dx + dz * dz);
    if (d > 800) continue;
    const a = d < 640 ? 1 : 1 - (d - 640) / 160, r = b.hp / b.maxHp;
    const p = n * 12, q = n * 8, y = b.y + b.M.topY + 1.5;
    for (let k = 0; k < 4; k++) {
      hbCenter[p + k * 3] = b.x; hbCenter[p + k * 3 + 1] = y; hbCenter[p + k * 3 + 2] = b.z;
      hbData[q + k * 2] = r; hbData[q + k * 2 + 1] = a;
    }
    n++;
  }
  hbGeo.setDrawRange(0, n * 6);
  hbACenter.updateRange.offset = 0; hbACenter.updateRange.count = n * 12; hbACenter.needsUpdate = true;
  hbAData.updateRange.offset = 0; hbAData.updateRange.count = n * 8; hbAData.needsUpdate = true;
}

/* ---------- 함포 탄착 표시: 조준점이 가리키는 바다 위의 고리 ---------- */
let aimRing = null;

function initAimRing() {
  const geo = new THREE.RingGeometry(0.93, 1.0, 56);
  geo.rotateX(-Math.PI / 2);
  aimRing = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: sRGB(0xffc267), transparent: true, opacity: 0.6, depthTest: false, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide
  }));
  aimRing.renderOrder = 15;
  aimRing.visible = false;
  scene.add(aimRing);
}
