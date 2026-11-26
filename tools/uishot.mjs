// UI 시안 확인용: 처음 화면, 전투 중 계기, 일시정지(상점·강화), 결과 화면을 PC·폰에서 찍는다
// 사용: node tools/uishot.mjs <접두어> [html 경로]
import fs from 'fs';
import { ROOT, loadModule, CHROME } from './env.mjs';
const require = loadModule;
const { chromium } = require('playwright');
const three = fs.readFileSync(ROOT + '/vendor/three.min.js');
const pre = process.argv[2] || 'ui';
const file = process.argv[3] || ROOT + '/tools/test.html';
fs.mkdirSync(ROOT + '/shots', { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, W, H, touch] of [['pc', 1280, 720, false], ['ph', 844, 390, true]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(); const logs = [];
  page.on('pageerror', e => logs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ body: three, contentType: 'application/javascript' }));
  await page.goto('file://' + file); await page.waitForTimeout(1800);
  await page.evaluate(() => { try { localStorage.clear(); } catch {} const d = __dbg; d.Rec.best.normal = 14; d.Rec.kills = 231; d.Rec.runs = 9; d.Rec.lv = 7; d.Rec.xp = 120; d.saveUiRender && d.saveUiRender(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: ROOT + `/shots/${pre}_${name}_start.png` });
  await page.evaluate(() => { const d = __dbg; d.beginGame(); d.advance(240, 1 / 60); d.Game.missiles = 4; d.Game.flares = 12; d.Game.items = ['cluster', 'emp']; });
  await page.waitForTimeout(900);
  await page.screenshot({ path: ROOT + `/shots/${pre}_${name}_hud.png` });
  await page.evaluate(() => { const d = __dbg; d.Skill.pts = 240; d.pauseGame(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: ROOT + `/shots/${pre}_${name}_tree.png` });
  const tap = s => touch ? page.tap(s, { force: true }) : page.click(s, { force: true });
  await tap('#pz-tabs [data-tab="shop"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: ROOT + `/shots/${pre}_${name}_shop.png` });
  await tap('#pz-tabs [data-tab="up"]'); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelectorAll('.up-glow').forEach(e => { e.style.animationPlayState = 'paused'; }));
  await page.screenshot({ path: ROOT + `/shots/${pre}_${name}_up.png` });
  await page.evaluate(() => { const d = __dbg; d.Game.state = 'play'; document.getElementById('pause').classList.add('off'); d.showResult(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: ROOT + `/shots/${pre}_${name}_result.png` });
  console.log(name, logs.join('\n') || 'NO ERRORS');
  await ctx.close();
}
await browser.close();
