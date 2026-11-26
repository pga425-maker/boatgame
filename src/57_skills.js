/* ---------- 스킬 트리 ----------
 * 적을 격파할 때마다 포인트(일반 적 4점, 기함 15점)를 받는다. 일시정지(Esc·K·폰 일시정지 버튼)하면 나오는 나무 모양 트리에서 쓴다.
 * 나무(선체·기관총·함포·미사일·엔진)마다 아래 뿌리에서 시작해 두 갈래로 뻗고, 큰 마디에서 모였다가 맨 위 궁극 스킬 두 개로 끝난다.
 * 작은 마디는 이어진 앞 마디를 1단계라도 찍으면 열리고, 큰 마디는 앞 마디를 끝까지 찍어야 열린다. 포인트와 스킬은 그 판에서만 유지된다 */
const Skill = { pts: 0, r: {}, sel: null, ship: 0, tab: 'tree', autoFlare: false, topDown: false, fx: null, fxN: 0, bought: null };

function skillNodes() { const out = []; const T = CONFIG.skills.trees; for (let i = 0; i < T.length; i++) for (let j = 0; j < T[i].nodes.length; j++) out.push([T[i], T[i].nodes[j]]); return out; }
function skillNode(id) { const T = CONFIG.skills.trees; for (let i = 0; i < T.length; i++) for (let j = 0; j < T[i].nodes.length; j++) if (T[i].nodes[j].id === id) return [T[i], T[i].nodes[j]]; return null; }

function skillReset() { Skill.pts = 0; Skill.r = {}; Skill.sel = null; Skill.ship = 0; Skill.tab = 'tree'; Skill.autoFlare = false; Skill.topDown = false; }
function skillGain(boss) { Skill.pts += boss ? CONFIG.skills.perBoss : CONFIG.skills.perKill; }
// 찍은 마디들의 효과 합 (field: hp, armor, killHeal, regen, mg, mgRate, mgRange, cn, reload, blast, mis, misMax, misDrop, misBlast, speed, accel, turn, boost, boostRegen, rev, boostSpd)
function skillSum(field) {
  let s = 0;
  const T = CONFIG.skills.trees;
  for (let i = 0; i < T.length; i++) for (let j = 0; j < T[i].nodes.length; j++) {
    const n = T[i].nodes[j], k = Skill.r[n.id] || 0;
    if (k && n.fx[field]) s += n.fx[field] * k;
  }
  if (field === 'mg' || field === 'mis') s += Skill.ship * CONFIG.skills.ship.per;     // 배 강화
  return s;
}
// 열렸는지: 뿌리는 늘 열림, 큰 마디는 앞 마디 하나를 끝까지, 작은 마디는 앞 마디 하나를 1단계라도
function skillOpen(n, tree) {
  if (!n.req || !n.req.length) return true;
  for (let i = 0; i < n.req.length; i++) {
    const p = tree.nodes.find(q => q.id === n.req[i]), k = Skill.r[p.id] || 0;
    if (n.big ? k >= p.max : k >= 1) return true;
  }
  return false;
}
function skillCanBuy(tree, n) { return (Skill.r[n.id] || 0) < n.max && skillOpen(n, tree) && Skill.pts >= n.cost; }
// 지금 찍을 수 있는 가장 싼 단계의 값 (없으면 0)
function skillCheapest() {
  let c = 0;
  const all = skillNodes();
  for (let i = 0; i < all.length; i++) { const [t, n] = all[i]; if ((Skill.r[n.id] || 0) < n.max && skillOpen(n, t) && (!c || n.cost < c)) c = n.cost; }
  return c;
}
function skillBuy(id) {
  const tn = skillNode(id);
  if (!tn) return false;
  const [t, n] = tn;
  if (!skillCanBuy(t, n)) return false;
  Skill.pts -= n.cost; Skill.r[id] = (Skill.r[id] || 0) + 1;
  if (n.fx.hp) { player.maxHp += n.fx.hp; player.hp += n.fx.hp; }
  upgApply();
  return true;
}
// 봇·시험용: 찍을 수 있는 가장 싼 단계 하나
function skillAutoBuy() {
  let best = null;
  const all = skillNodes();
  for (let i = 0; i < all.length; i++) { const [t, n] = all[i]; if (skillCanBuy(t, n) && (!best || n.cost < best.cost)) best = n; }
  return best ? skillBuy(best.id) : false;
}
// 자동 수리 (선체)
function skillUpdate(dt) {
  const r = skillSum('regen'), P = player;
  if (r > 0 && P.alive && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + r * dt);
}

// ---- 화면 ----
const SK_ICON = {
  hp: '<path d="M12 20s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.6 12 20 12 20z"/>',
  armor: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  killHeal: '<path d="M12 20s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.6 12 20 12 20z"/><path d="M12 11v5M9.5 13.5h5"/>',
  regen: '<path d="M15 4a4 4 0 0 0-4.6 5.4L4 15.8 6.2 18l6.4-6.4A4 4 0 0 0 18 7l-2.4 2.4-2-2z"/>',
  mg: '<path d="M6 18V9l1.5-3L9 9v9zM11 18V9l1.5-3L14 9v9zM16 18V9l1.5-3L19 9v9z"/>',
  mgRate: '<path d="M9 18V9l1.5-3L12 9v9zM14 18V9l1.5-3L17 9v9z"/><path d="M3 9h3M3 13h3M3 17h3"/>',
  mgRange: '<circle cx="12" cy="12" r="6"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  cn: '<path d="M4 16l10-8 4 4-8 10z"/><circle cx="17.5" cy="6.5" r="2.5"/>',
  reload: '<path d="M19 12a7 7 0 1 1-2-4.9"/><path d="M19 4v4h-4"/>',
  blast: '<path d="M12 3l2 5 5-2-2 5 4 2-5 2 1 5-5-3-3 4-1-5-5 1 3-4-4-3 5-1-1-5 4 3z"/>',
  mis: '<path d="M5 19l3-3m0 0l8-8 3-1-1 3-8 8m-2-2l2 2M7 13l-2 1 2 2M11 17l-1 2-2-2"/>',
  misMax: '<path d="M4 18l3-3m0 0l7-7 3-1-1 3-7 7m-2-2l2 2"/><path d="M18 14v6M15 17h6"/>',
  misDrop: '<path d="M4 9l8-4 8 4v8l-8 4-8-4z"/><path d="M4 9l8 4 8-4M12 13v8"/>',
  misBlast: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  speed: '<path d="M5 6l6 6-6 6M12 6l6 6-6 6"/>',
  accel: '<path d="M6 18L18 6M9 6h9v9"/>',
  turn: '<path d="M6 19V11a5 5 0 0 1 5-5h7"/><path d="M15 3l3 3-3 3"/>',
  boost: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  boostRegen: '<path d="M13 4L7 13h5l-1 6 6-9h-5z"/><path d="M20 12a8 8 0 0 1-8 8"/>',
  rev: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  boostSpd: '<path d="M12 3c2 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>'
};
const SK_LOCK = '<svg class="sklk" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
function skFx(n) {
  const k = Object.keys(n.fx)[0], v = n.fx[k], P = x => Math.round(x * 1000) / 10;
  return ({
    hp: '최대 체력 +' + v, armor: '받는 피해 -' + P(v) + '%', killHeal: '격파할 때 회복 +' + v, regen: '자동 수리 초당 ' + v,
    mg: '기관총 데미지 +' + P(v) + '%', mgRate: '기관총 연사 +' + P(v) + '%', mgRange: '기관총 사거리 +' + P(v) + '%',
    cn: '함포 데미지 +' + P(v) + '%', reload: '함포 장전 시간 -' + P(v) + '%', blast: '함포 폭발 범위 +' + P(v) + '%',
    mis: '미사일 데미지 +' + P(v) + '%', misMax: '미사일 최대 보유 +' + v + '발', misDrop: '미사일이 나올 확률 +' + P(v) + '%p', misBlast: '미사일 폭발 범위 +' + P(v) + '%',
    speed: '최고 속도 +' + P(v) + '%', accel: '가속 +' + P(v) + '%', turn: '선회 +' + P(v) + '%', boost: '부스트 게이지 +' + P(v) + '%',
    boostRegen: '부스트 충전 +' + P(v) + '%', rev: '후진 속도 +' + P(v) + '%', boostSpd: '부스트 속도 +' + P(v) + '%'
  })[k] || '';
}
function skillRender() {
  const T = CONFIG.skills.trees, top = 9, bot = 91, rows = 4;
  const Y = r => bot - (bot - top) * r / rows;
  $('sk-pts').textContent = Skill.pts;
  let h = '';
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    let spent = 0; for (let j = 0; j < t.nodes.length; j++) spent += (Skill.r[t.nodes[j].id] || 0) * t.nodes[j].cost;
    h += '<div class="skt" style="--c:' + t.color + '"><div class="skt-name">' + t.name + (spent ? ' <span>' + spent + '점</span>' : '') + '</div><div class="skt-area"><svg class="skt-lines" viewBox="0 0 100 100" preserveAspectRatio="none">';
    for (let j = 0; j < t.nodes.length; j++) {
      const n = t.nodes[j];
      if (!n.req) continue;
      for (let q = 0; q < n.req.length; q++) {
        const p = t.nodes.find(z => z.id === n.req[q]);
        const on = (Skill.r[n.id] || 0) > 0 && (Skill.r[p.id] || 0) > 0;
        h += '<line x1="' + p.x * 100 + '" y1="' + Y(p.row) + '" x2="' + n.x * 100 + '" y2="' + Y(n.row) + '" class="' + (on ? 'on' : '') + '"/>';
      }
    }
    h += '</svg>';
    for (let j = 0; j < t.nodes.length; j++) {
      const n = t.nodes[j], k = Skill.r[n.id] || 0, open = skillOpen(n, t);
      const st = k >= n.max ? 'full' : (k > 0 ? 'part' : (open ? 'open' : 'lock'));
      const can = skillCanBuy(t, n);
      const ic = SK_ICON[Object.keys(n.fx)[0]] || '';
      h += '<button type="button" class="skn ' + st + (n.big ? ' big' : '') + (n.ult ? ' ult' : '') + (can ? ' can' : '') + (Skill.sel === n.id ? ' sel' : '') + '" data-id="' + n.id + '" style="left:' + n.x * 100 + '%;top:' + Y(n.row) + '%">' +
        '<svg viewBox="0 0 24 24">' + ic + '</svg>' + (st === 'lock' && n.big ? SK_LOCK : '') + '<b class="rk">' + k + '/' + n.max + '</b></button>';
    }
    h += '</div></div>';
  }
  $('sk-trees').innerHTML = h;
  $('pz-lv').textContent = Rec.lv; $('pz-xp').textContent = '경험치 ' + Rec.xp + ' / ' + lvNeed(Rec.lv);
  skillInfo();
  shopRender();
  upRender();
  tabsRender();
}
function skillInfo() {
  const el = $('sk-info');
  if (!Skill.sel) { el.innerHTML = '<span class="dim">마디를 누르면 효과가 보이고, 한 번 더 누르거나 [찍기]를 누르면 찍혀요. 큰 마디는 앞 마디를 끝까지 찍어야 열려요</span>'; return; }
  const [t, n] = skillNode(Skill.sel), k = Skill.r[n.id] || 0, open = skillOpen(n, t), can = skillCanBuy(t, n);
  let why = '';
  if (k >= n.max) why = '다 찍음';
  else if (!open) why = n.big ? '앞 마디를 끝까지 찍어야 열림' : '앞 마디를 먼저 찍어야 열림';
  else if (Skill.pts < n.cost) why = '포인트 부족';
  el.innerHTML = '<b style="color:' + t.color + '">' + t.name + ' · ' + n.name + (n.ult ? ' ★' : '') + '</b> <span>' + k + '/' + n.max + '단계</span> <span class="fx">' + skFx(n) + (n.max > 1 ? ' (단계마다)' : '') + '</span>' +
    (k < n.max ? ' <button type="button" class="cta sk-buy"' + (can ? '' : ' disabled') + '>' + (why || '찍기') + ' · ' + n.cost + '점</button>' : ' <span class="dim">' + why + '</span>');
}
function skillClick(id) {
  if (Skill.sel === id) {
    if (skillBuy(id)) Sound.play('pickup', 0.6, 1.1, 0);
    else Sound.play('dry', 0.5, 1, 0);
  } else Skill.sel = id;
  skillRender();
}
function initSkillsUi() {
  $('sk-trees').addEventListener('click', function (e) {
    e.stopPropagation();
    const b = e.target.closest('.skn');
    if (b) skillClick(b.dataset.id);
  });
  $('sk-info').addEventListener('click', function (e) {
    e.stopPropagation();
    if (e.target.closest('.sk-buy') && Skill.sel) { if (skillBuy(Skill.sel)) Sound.play('pickup', 0.6, 1.1, 0); else Sound.play('dry', 0.5, 1, 0); skillRender(); }
  });
  $('pz-tabs').addEventListener('click', function (e) {
    e.stopPropagation();
    const b = e.target.closest('button');
    if (!b) return;
    Skill.tab = b.dataset.tab; Sound.play('ping', 0.35, 1.4, 0); skillRender();
  });
  $('pane-shop').addEventListener('click', function (e) {
    e.stopPropagation();
    const b = e.target.closest('.shc-buy');
    if (b) { shopBuy(b.dataset.id); skillRender(); }
  });
  $('pane-up').addEventListener('click', function (e) {
    e.stopPropagation();
    if (e.target.closest('.up-go')) { shipTry(); skillRender(); }
  });
  for (const id of ['sk-trees', 'sk-info', 'pz-tabs', 'pane-shop', 'pane-up', 'pane-skin', 'pane-ach']) $(id).addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
}

// ---- 일시정지 메뉴 탭: 스킬 트리 · 상점 · 강화 ----
function tabsRender() {
  const t = Skill.tab || 'tree';
  const bs = $('pz-tabs').querySelectorAll('button');
  for (let i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].dataset.tab === t);
  $('pane-tree').style.display = t === 'tree' ? '' : 'none';
  $('pane-shop').style.display = t === 'shop' ? '' : 'none';
  $('pane-up').style.display = t === 'up' ? '' : 'none';
  $('pane-skin').style.display = t === 'skin' ? '' : 'none';
  $('pane-ach').style.display = t === 'ach' ? '' : 'none';
  if (t === 'skin') $('pane-skin').innerHTML = skinHtml();
  if (t === 'ach') $('pane-ach').innerHTML = achHtml();
}

// ---- 배 강화 ----
// 한 번에 10점. 성공하면 +1강: 기관총 데미지·미사일 데미지 +3%, 최대 체력 +3% (지금 최대 체력 기준). 최대 10강. 실패하면 포인트만 잃는다
function shipRateAt(n) { const S = CONFIG.skills.ship, R = S.rates; return n < R.length ? R[n] : Math.max(S.min, S.after - S.step * (n - R.length)); }
function shipRate() { return shipRateAt(Skill.ship); }
function shipTry() {
  const S = CONFIG.skills.ship;
  if (Skill.pts < S.cost) { Sound.play('dry', 0.5, 1, 0); return null; }
  Skill.pts -= S.cost;
  const ok = rnd() < shipRate();
  if (ok) {
    Skill.ship++;
    achSet('shipMax', Skill.ship);
    const add = Math.max(1, Math.round(player.maxHp * S.per));
    player.maxHp += add; player.hp += add;
    upgApply();
    Sound.play('pickup', 0.8, 1.35, 0); Sound.play('ping', 0.6, 1.2, 0);
  } else Sound.play('clank', 0.7, 0.7, 0);
  Skill.fx = ok ? 'win' : 'lose'; Skill.fxN = (Skill.fxN || 0) + 1;
  shipFx(ok);
  return ok;
}
// 강화 단계별 카드 색 (회색 → 동 → 은 → 금 → 보라 → 빨강 → 검붉은)
function shipTier(n) { return n >= 20 ? 't7' : n >= 15 ? 't6' : n >= 10 ? 't5' : n >= 8 ? 't4' : n >= 5 ? 't3' : n >= 1 ? 't2' : 't1'; }
// 성공·실패 연출: 화면 가운데 큰 글자와 빛줄기, 실패하면 패널이 흔들린다
function shipFx(ok) {
  const el = $('sk-fx');
  el.className = '';
  el.innerHTML = ok
    ? '<div class="sf-rays"></div><div class="sf-burst"></div><div class="sf-txt">강화 성공<b class="' + shipTier(Skill.ship) + '">+' + Skill.ship + '</b><span>기관총 · 선체 · 미사일 +' + Math.round(Skill.ship * CONFIG.skills.ship.per * 100) + '%</span></div>'
    : '<div class="sf-txt">강화 실패<b>+' + Skill.ship + '</b><span>단계 유지 · 포인트 ' + CONFIG.skills.ship.cost + '점 소모</span></div>';
  void el.offsetWidth;
  el.className = ok ? 'win' : 'lose';
  clearTimeout(shipFx.t);
  shipFx.t = setTimeout(function () { el.className = ''; }, 1700);
  if (!ok) { const pz = $('pz'); pz.classList.remove('shake'); void pz.offsetWidth; pz.classList.add('shake'); }
}
const UP_SHIP = '<svg viewBox="0 0 120 70"><path d="M8 40 L104 40 L96 52 Q60 58 20 52 Z" fill="currentColor" opacity=".95"/><path d="M34 40 L38 28 L70 28 L76 40 Z" fill="currentColor" opacity=".75"/><path d="M46 28 L48 18 L60 18 L62 28 Z" fill="currentColor" opacity=".6"/><path d="M60 22 L84 19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M2 58 Q30 54 60 60 T118 58" stroke="currentColor" stroke-width="2" fill="none" opacity=".45"/></svg>';
function upRender() {
  const S = CONFIG.skills.ship, n = Skill.ship, mx = false, pct = v => Math.round(v * 100);
  const cur = pct(n * S.per), nxt = pct((n + 1) * S.per), rate = pct(shipRate());
  const hpNext = Math.round(player.maxHp + Math.max(1, Math.round(player.maxHp * S.per)));
  let h = '<div class="up-card ' + shipTier(n) + (Skill.fx ? ' fx-' + Skill.fx : '') + '"><div class="up-glow"></div><div class="up-lv">+' + n + '</div><div class="up-ship">' + UP_SHIP + '</div><div class="up-name">내 배</div></div>';
  h += '<div class="up-side"><div class="up-title">배 강화 <span>' + (mx ? '최대 강화' : '+' + n + ' → +' + (n + 1)) + '</span></div>';
  h += '<table class="up-tb"><tr><td>기관총 데미지</td><td>+' + cur + '%</td><td>' + (mx ? '' : '→ <b>+' + nxt + '%</b>') + '</td></tr>' +
    '<tr><td>유도미사일 데미지</td><td>+' + cur + '%</td><td>' + (mx ? '' : '→ <b>+' + nxt + '%</b>') + '</td></tr>' +
    '<tr><td>선체 최대 체력</td><td>' + Math.round(player.maxHp) + '</td><td>' + (mx ? '' : '→ <b>' + hpNext + '</b>') + '</td></tr></table>';
  if (!mx) h += '<div class="up-rate"><span>성공 확률</span><div class="up-bar"><i style="width:' + rate + '%"></i></div><b>' + rate + '%</b></div>';
  h += '<div class="up-steps">';
  const i0 = Math.max(0, n - 4);                                   // 지금 단계 앞뒤로 10칸
  for (let i = i0; i < i0 + 10; i++) h += '<span class="' + (i < n ? 'ok' : i === n ? 'now' : '') + '">+' + (i + 1) + '<i>' + pct(shipRateAt(i)) + '%</i></span>';
  h += '</div>';
  h += mx ? '<div class="up-max">최대 강화 달성</div>'
    : '<button type="button" class="up-go"' + (Skill.pts < S.cost ? ' disabled' : '') + '>강화하기<span>' + S.cost + 'P</span></button>';
  h += '<div class="up-note">실패하면 단계는 그대로이고 포인트만 사라집니다</div></div>';
  $('pane-up').innerHTML = h;
  Skill.fx = null;
}

// ---- 포인트 상점 ----
const SHOP_ICON = {
  cluster: '<circle cx="12" cy="7" r="3" fill="currentColor"/><circle cx="6" cy="15" r="2" fill="currentColor"/><circle cx="12" cy="17" r="2" fill="currentColor"/><circle cx="18" cy="15" r="2" fill="currentColor"/><path d="M12 10 L7 13 M12 10 V15 M12 10 L17 13" stroke="currentColor" stroke-width="1.2" stroke-dasharray="1.5 1.5"/>',
  torpedo: '<path d="M3 12 Q4 9.5 8 9.5 H18 L21 12 L18 14.5 H8 Q4 14.5 3 12 Z" fill="currentColor"/><path d="M5 8 L6.5 10 M5 16 L6.5 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2 19 Q7 17 12 19 T22 19" stroke="currentColor" stroke-width="1.3" fill="none" opacity=".6"/>',
  mines: '<circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21 M5.6 5.6 L7.8 7.8 M16.2 16.2 L18.4 18.4 M5.6 18.4 L7.8 16.2 M16.2 7.8 L18.4 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  emp: '<path d="M13 2 L5 13 H11 L10 22 L19 10 H13 Z" fill="currentColor"/>',
  repair: '<path d="M14.5 5.5 a4 4 0 0 0 4.9 4.9 L11 18.8 a2 2 0 0 1-2.8 0 l-2-2 a2 2 0 0 1 0-2.8 L14.6 5.6 Z" fill="currentColor"/><path d="M4 4 L9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  missile: '<path d="M4 20 L14 10 M14 10 L19 5 L20 4 L19 9 L14 10 Z M9 11 L6 10 L4 12 L7 13 M13 15 L14 18 L12 20 L11 17" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  shield: '<path d="M12 3 L20 6 V12 Q20 18 12 21 Q4 18 4 12 V6 Z" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M8.5 12 L11 14.5 L15.5 9.5" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  barrage: '<path d="M2 11 L12 6 L22 11 L19 12.5 L17 11.5 L15 13 L12 11.5 L9 13 L7 11.5 L5 12.5 Z" fill="currentColor"/><path d="M8 16 v3 M12 15 v4 M16 16 v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  nuke: '<circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 10 L9 4.8 A8 8 0 0 1 15 4.8 Z M13.7 13 L19.7 13 A8 8 0 0 1 16.7 18.2 Z M10.3 13 L7.3 18.2 A8 8 0 0 1 4.3 13 Z" fill="currentColor"/>',
  topdown: '<path d="M12 3 V13 M9 6 L12 3 L15 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M17 9 Q20 13 15 19" stroke="currentColor" stroke-width="1.6" fill="none" stroke-dasharray="2 2"/><path d="M3 17 Q6 15.5 9 17 T15 17 T21 17" stroke="currentColor" stroke-width="1.4" fill="none" opacity=".7"/><path d="M8 20.5 H13 L14 19.5 L13 18.5 H8 Z" fill="currentColor"/>',
  smoke1: '<circle cx="9" cy="13" r="4.5" fill="currentColor" opacity=".55"/><circle cx="15" cy="11" r="5" fill="currentColor" opacity=".8"/><circle cx="12" cy="16" r="3.5" fill="currentColor"/>',
  smoke5: '<circle cx="6" cy="14" r="3.5" fill="currentColor" opacity=".5"/><circle cx="11" cy="10" r="4.5" fill="currentColor" opacity=".75"/><circle cx="17" cy="12" r="4.5" fill="currentColor" opacity=".9"/><circle cx="12" cy="16" r="3.5" fill="currentColor"/><path d="M3 20 H21" stroke="currentColor" stroke-width="1.4" opacity=".6"/>',
  autoflare: '<circle cx="12" cy="13" r="2.4" fill="currentColor"/><path d="M12 9 V4 M8.5 10.5 L5 7 M15.5 10.5 L19 7 M7.5 14 H3 M16.5 14 H21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5 20 Q12 16 19 20" stroke="currentColor" stroke-width="1.4" fill="none" opacity=".6"/>'
};
const SHOP_PERM = { autoflare: 'autoFlare', topdown: 'topDown' };     // 영구 상품 → Skill에 켜지는 값
const SHOP_DESC = {
  cluster: '조준한 곳(1.5km 안) 350m에 자탄 15발을 흩뿌립니다',
  torpedo: '어뢰 6발이 가까운 적부터 쫓아가 들이받습니다',
  mines: '적이 몰려갈 길목에 기뢰 12개를 깝니다',
  emp: '700m 안 적을 10초 동안 마비시킵니다',
  repair: '체력 60을 회복하고 15초 동안 무적이 됩니다',
  smoke1: '연막탄 1발 (C 키·연막 버튼은 5발씩 씁니다)',
  smoke5: '연막탄 5발 묶음 · 한 번 펼칠 수 있습니다',
  missile: '유도미사일을 바로 2발 채웁니다',
  shield: '쓰면 15초 동안 어떤 공격도 받지 않습니다',
  barrage: '적이 몰린 해역에 B-2가 폭탄과 미사일을 퍼붓습니다',
  nuke: '조준한 곳에 B-2가 핵폭탄을 떨어뜨립니다 (600m)',
  autoflare: '적 미사일이 250m 안에 오면 플레어가 저절로 나갑니다',
  topdown: '모든 미사일이 적 위로 내리꽂힙니다. 잠수함도 맞고 데미지 +30%'
};
function shopWhy(it) {
  if (it.perm) return Skill[SHOP_PERM[it.id]] ? '보유 중' : (Skill.pts < it.cost ? '포인트 부족' : '');
  if (Skill.pts < it.cost) return '포인트 부족';
  if (it.smoke) return '';
  if (it.id === 'missile') { if (Game.missiles >= CONFIG.missile.maxAmmo) return '미사일 가득'; }
  else if (Game.items.length >= CONFIG.items.maxHeld) return '아이템 칸 가득';
  return '';
}
function shopBuy(id) {
  const it = CONFIG.skills.shop.find(q => q.id === id);
  if (!it || shopWhy(it)) { Sound.play('dry', 0.5, 1, 0); return false; }
  Skill.pts -= it.cost;
  if (it.id === 'missile') Game.missiles = Math.min(CONFIG.missile.maxAmmo, Game.missiles + it.n);
  else if (it.smoke) Game.smokes += it.smoke;
  else if (it.perm) Skill[SHOP_PERM[it.id]] = true;
  else Game.items.push(it.id);
  Skill.bought = it.id;
  Sound.play('pickup', 0.6, 1.1, 0);
  return true;
}
function shopRender() {
  let h = '<div class="shc-grid">';
  for (const it of CONFIG.skills.shop) {
    const why = shopWhy(it), own = why === '보유 중';
    h += '<div class="shc' + (it.perm ? ' perm' : '') + (own ? ' own' : '') + (Skill.bought === it.id ? ' got' : '') + '"><div class="shc-tag">' + (it.perm ? '영구' : (it.smoke ? '연막' : '소모품')) + '</div>' +
      '<svg class="shc-ic" viewBox="0 0 24 24">' + (SHOP_ICON[it.id] || '') + '</svg><div class="shc-name">' + it.name + '</div><div class="shc-desc">' + (SHOP_DESC[it.id] || '') + '</div>' +
      '<button type="button" class="shc-buy" data-id="' + it.id + '"' + (why ? ' disabled' : '') + '>' + (own ? '보유 중' : it.cost + 'P') + '</button>' +
      (why && !own ? '<div class="shc-why">' + why + '</div>' : '') + '</div>';
  }
  h += '</div><div class="shc-foot">아이템 칸 ' + Game.items.length + '/' + CONFIG.items.maxHeld + ' · 유도미사일 ' + Game.missiles + '/' + CONFIG.missile.maxAmmo + ' · 연막탄 ' + Game.smokes + '발 · 산 아이템은 빈 칸에 들어갑니다</div>';
  $('pane-shop').innerHTML = h;
  Skill.bought = null;
}
