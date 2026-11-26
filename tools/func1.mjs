// 새 기능 확인: 섬·암초, 특수 웨이브, 헬기·드론, 연막탄, 업적·스킨, 음악
import { open, adv } from './lib.mjs';
const { browser, page, logs } = await open({ W: 1280, H: 720 });
const R = {};
await page.evaluate(() => { localStorage.clear(); const d = __dbg; d.beginGame(); });
R.isles = await page.evaluate(() => [__dbg.ISLES.length, __dbg.REEFS.length, __dbg.ISLES.map(I => Math.round(Math.hypot(I.x, I.z)))]);
await adv(page, 300);
R.w1 = await page.evaluate(() => ({ en: __dbg.enemies.length, airs: __dbg.airs.length, st: __dbg.Game.state }));
// 특수 웨이브 넷 다 돌려 본다
R.sp = {};
for (const k of ['fog', 'night', 'storm', 'escort']) {
  R.sp[k] = await page.evaluate((k) => {
    const d = __dbg; d.clearEnemies();
    d.specialStart(k); d.startRound(6);    // 보스 웨이브 아님? 6은 보스 → 7
    return null;
  }, k);
  const r = await page.evaluate((k) => {
    const d = __dbg; d.specialEnd(false); d.clearEnemies();
    // startRound 안에서 고르므로 확률을 1로, 마지막 것 제외 규칙을 피해 순서대로
    d.CONFIG.special.p = 1; d.Special.last = null;
    const orig = Math.random; let tries = 0, got = null;
    while (tries++ < 30) { d.startRound(7); if (d.Special.kind === k) { got = k; break; } d.specialEnd(false); d.clearEnemies(); d.Special.last = null; }
    return { got: got, en: d.enemies.length, airs: d.airs.length, sup: !!d.Special.supply, fog: d.scene.fog.density };
  }, k);
  await adv(page, 240);
  r.after = await page.evaluate(() => ({ st: __dbg.Game.state, alive: __dbg.player.alive, hp: Math.round(__dbg.player.hp), sup: __dbg.Special.supply ? Math.round(__dbg.Special.supply.hp) : null, bul: __dbg.bulN }));
  R.sp[k] = r;
}
// 하늘 적: 헬기·드론을 가까이 띄우고 진행
R.air = await page.evaluate(() => {
  const d = __dbg, P = d.player; d.specialEnd(false); d.clearEnemies(); d.CONFIG.special.p = 0;
  P.hp = P.maxHp = 5000;
  d.airSpawn('heli', P.x + 300, P.z + 200, 6); d.airWave(8, P.x + 600, P.z, false);
  return d.airs.length;
});
await adv(page, 600);
R.air2 = await page.evaluate(() => { const d = __dbg; return { airs: d.airs.filter(a => a.alive).map(a => a.kind + ':' + Math.round(a.y) + ':' + Math.round(Math.hypot(a.x - d.player.x, a.z - d.player.z))), hp: Math.round(d.player.hp), rockets: d.rockets.filter(r => r.on).length }; });
// 연막: 5발 쏘고 구름이 생기는지, 시선을 가리는지
R.smoke = await page.evaluate(() => { const d = __dbg; d.Game.smokes = 12; const ok = d.smokeDeploy(false); return { ok: ok, left: d.Game.smokes }; });
await adv(page, 300);
R.smoke2 = await page.evaluate(() => { const d = __dbg, P = d.player, cl = d.smkClouds.filter(c => c.on); const c = cl[0];
  return { clouds: cl.length, R: c ? Math.round(c.R) : 0, dist: c ? Math.round(Math.hypot(c.x - P.x, c.z - P.z)) : 0, parts: d.smokeWall().n,
    block: c ? d.smokeBlocks(P.x, P.z, c.x + (c.x - P.x) * 0.5, c.z + (c.z - P.z) * 0.5) : null }; });
// 4발이면 안 나감
R.smoke3 = await page.evaluate(() => { const d = __dbg; d.Game.smokes = 4; d.Game.smokeCD = 0; return d.smokeDeploy(false); });
// 위기 자동
R.auto = await page.evaluate(() => { const d = __dbg, P = d.player; P.maxHp = 100; P.hp = 20; d.Game.smokes = 5; d.Game.smokeCD = 0; d.Game.smokeAutoT = 0; d.advance(30, 1 / 60); return { left: d.Game.smokes }; });
// 업적·스킨
R.meta = await page.evaluate(() => { const d = __dbg; d.Rec.paint = 500; const a = d.skinSel('dazzle'), b = d.skinSel('gold'); return { a: a, b: b, paint: d.Rec.paint, skin: d.Rec.skin, ach: Object.keys(d.Rec.ach || {}).length }; });
// 섬에 탄이 맞는지
R.isleHit = await page.evaluate(() => { const d = __dbg, I = d.ISLES[0]; return d.isleSeg(I.x - I.r * 2, 5, I.z, I.x, 5, I.z); });
// 음악
R.music = await page.evaluate(() => { const d = __dbg; try { d.Sound.init(); d.Music.update(); return d.Music.mode; } catch (e) { return String(e); } });
console.log(JSON.stringify(R, null, 0));
console.log(logs.filter(l => /error/i.test(l)).slice(0, 10).join('\n') || 'NO ERRORS');
await browser.close();
