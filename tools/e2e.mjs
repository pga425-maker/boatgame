import fs from 'fs';
import { ROOT, loadModule, CHROME } from './env.mjs';
const require = loadModule;
const { chromium } = require('playwright');
const three = fs.readFileSync(ROOT + '/vendor/three.min.js');
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
async function run(file, W, H, touch) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push('[error] ' + m.text()); });
  await page.route('**/three.min.js', r => r.fulfill({ body: three, contentType: 'application/javascript' }));
  await page.goto('file://' + file);
  await page.waitForTimeout(1500);
  return { page, logs, ctx };
}
// 1) 배포본: 시작 화면 → 배경 선택 → 출항
{
  const { page, logs, ctx } = await run(ROOT + '/index.html', 1100, 620, false);
  for (const k of ['day', 'night', 'storm', 'sunset']) { await page.click(`[data-env="${k}"]`); await page.waitForTimeout(300); }
  await page.click('[data-diff="hard"]');
  await page.mouse.click(560, 60);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: ROOT + '/shots/e2e_dist.png' });
  console.log('dist:', logs.join('\n') || 'NO ERRORS');
  await ctx.close();
}
// 2) 테스트본: 실제 흐름 (웨이브 정리 → 카드 → 고르기 → 일시정지 목록 → 죽음 → 결과 → 다시)
{
  const { page, logs, ctx } = await run(ROOT + '/tools/test.html', 1100, 620, false);
  await page.mouse.click(560, 60);
  await page.waitForTimeout(1500);
  for (let w = 0; w < 4; w++) {
    await page.evaluate(() => { const d = __dbg; for (const e of d.enemies) if (e.alive) { e.submerged = false; e.subDepth = 0; e.rageT = 0; d.damageBoat(e, 1e6, d.player.x, d.player.z, true); } });
    await page.evaluate(() => { const d = __dbg; for (let k = 0; k < 200 && d.Game.state === 'play'; k++) d.advance(1, 1 / 30); });
    const st = await page.evaluate(() => __dbg.Game.state);
    if (st !== 'cards') { console.log('no cards at wave', w + 1, st, await page.evaluate(() => [__dbg.roundState, __dbg.enemies.filter(e => e.alive).length])); break; }
    for (let k = 0; k < 40; k++) { await page.waitForTimeout(200); if (await page.evaluate(() => __dbg.Cards.picking)) break; }
    if (w === 1) await page.screenshot({ path: ROOT + '/shots/e2e_cards_w2.png' });
    await page.keyboard.press(String(1 + (w % 3)));
    for (let k = 0; k < 20; k++) { await page.waitForTimeout(200); if (await page.evaluate(() => __dbg.Game.state) === 'play') break; }
    const r = await page.evaluate(() => [__dbg.Game.state, __dbg.round, __dbg.Upg.history.join(',')]);
    console.log('wave', w + 1, st, JSON.stringify(r));
    await page.evaluate(() => { const d = __dbg; for (let k = 0; k < 400 && d.roundState === 1; k++) d.advance(1, 1 / 30); });
  }
  await page.evaluate(() => __dbg.pauseGame());
  await page.waitForTimeout(400);
  console.log('pause:', await page.evaluate(() => [__dbg.Game.state, document.getElementById('pause-cards').textContent]));
  await page.screenshot({ path: ROOT + '/shots/e2e_pause.png' });
  await page.mouse.click(550, 300);
  await page.waitForTimeout(800);
  await page.evaluate(() => { const d = __dbg; d.Upg.lives = 0; d.Upg.second = 0; d.damageBoat(d.player, 1e6, d.player.x + 5, d.player.z, false); });
  await page.waitForTimeout(6000);
  console.log('result:', await page.evaluate(() => [__dbg.Game.state, document.getElementById('r-wave').textContent]));
  await page.screenshot({ path: ROOT + '/shots/e2e_result.png' });
  console.log('flow:', logs.join('\n') || 'NO ERRORS');
  await ctx.close();
}
// 3) 폰 가로 화면: 카드 화면 터치
{
  const { page, logs, ctx } = await run(ROOT + '/tools/test.html', 844, 390, true);
  await page.tap('#start');
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const d = __dbg; for (const e of d.enemies) if (e.alive) { e.submerged = false; d.damageBoat(e, 1e6, d.player.x, d.player.z, true); } });
  for (let k = 0; k < 40; k++) { await page.waitForTimeout(250); if (await page.evaluate(() => __dbg.Game.state) === 'cards') break; }
  for (let k = 0; k < 40; k++) { await page.waitForTimeout(200); if (await page.evaluate(() => __dbg.Cards.picking)) break; }
  await page.screenshot({ path: ROOT + '/shots/e2e_phone_cards.png' });
  await page.tap('#cd-row .cd-card >> nth=2');
  await page.waitForTimeout(1200);
  console.log('phone:', await page.evaluate(() => [__dbg.Game.state, __dbg.Upg.history.join(',')]), logs.join('\n') || 'NO ERRORS');
  await page.screenshot({ path: ROOT + '/shots/e2e_phone_play.png' });
  await ctx.close();
}
await browser.close();
