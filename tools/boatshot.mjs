// 내 배 모델 확인용: 가까이에서 여러 각도, 스킨 전체(SKINS 배열 전부), 폰 화면, 저사양 모드를 찍는다
// 사용: node tools/boatshot.mjs <접두어> [html 경로]   → shots/<접두어>_*.png
import fs from 'fs';
import { ROOT, loadModule, CHROME } from './env.mjs';
const require = loadModule;
const { chromium } = require('playwright');
const three = fs.readFileSync(ROOT + '/vendor/three.min.js');
const pre = process.argv[2] || 'boat';
const file = process.argv[3] || ROOT + '/tools/test.html';
const out = n => ROOT + `/shots/${pre}_${n}.png`;
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const allLogs = [];

// 배 기준 좌표(+Z 뱃머리, +X 좌현)로 카메라 위치와 바라볼 점을 준다
const ANGLES = {
  front: [[8.5, 4.2, 13], [0, 1.4, 1.2]],
  side: [[15, 2.6, 0.3], [0, 1.3, 0.3]],
  side2: [[-15, 2.6, 0.3], [0, 1.3, 0.3]],
  rear: [[-8.5, 5, -13], [0, 1.4, -1.2]],
  top: [[4, 15, 1], [0, 0.5, 0]]
};

async function openPage(W, H, touch, lite) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on('pageerror', e => allLogs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') allLogs.push('[console] ' + m.text()); });
  await page.addInitScript(lo => { try { localStorage.clear(); if (lo) localStorage.setItem('gr_boat_set_v1', JSON.stringify({ lo: 1 })); } catch {} }, lite);
  await page.route('**/three.min.js', r => r.fulfill({ body: three, contentType: 'application/javascript' }));
  await page.goto('file://' + file); await page.waitForTimeout(1800);
  await page.evaluate(() => { const d = __dbg; d.CONFIG.quality.adaptive = false; d.beginGame(); d.advance(180, 1 / 60); d.clearEnemies && d.clearEnemies(); d.advance(30, 1 / 60); });
  await page.waitForTimeout(500);
  return { ctx, page };
}
// 게임을 멈추고(window.__hold) 카메라를 배 기준 위치에 둔다. 계기판 등 화면 글자는 숨긴다
async function pose(page, a, fov) {
  await page.evaluate(([cp, lp, fov]) => {
    window.__hold = true;
    const d = __dbg, r = d.player.root, cam = d.camera;
    document.querySelectorAll('body > *:not(canvas)').forEach(e => { if (e.tagName !== 'SCRIPT') e.style.visibility = 'hidden'; });
    r.updateMatrixWorld(true);
    const p = new THREE.Vector3(cp[0], cp[1], cp[2]).applyMatrix4(r.matrixWorld), t = new THREE.Vector3(lp[0], lp[1], lp[2]).applyMatrix4(r.matrixWorld);
    cam.position.copy(p); cam.up.set(0, 1, 0); cam.lookAt(t); cam.fov = fov; cam.updateProjectionMatrix();
  }, [a[0], a[1], fov]);
  await page.waitForTimeout(450);
}

// 1) PC 가까이: 기본 회색으로 네 각도 + 실제 게임 화면
{
  const { ctx, page } = await openPage(1280, 720, false, false);
  await page.screenshot({ path: out('pc_game') });
  await page.evaluate(() => __dbg.skinApply('base'));
  for (const k in ANGLES) { await pose(page, ANGLES[k], 38); await page.screenshot({ path: out('pc_' + k) }); }
  // 2) 스킨 전체 (SKINS 배열 순서대로)
  const ids = await page.evaluate(() => __dbg.SKINS.map(s => s.id));
  for (let i = 0; i < ids.length; i++) {
    await page.evaluate(id => __dbg.skinApply(id), ids[i]);
    await pose(page, ANGLES.front, 38);
    await page.screenshot({ path: out('skin_' + String(i).padStart(2, '0') + '_' + ids[i]), clip: { x: 160, y: 40, width: 960, height: 600 } });
  }
  console.log('skins', ids.length, ids.join(','));
  await ctx.close();
}
// 3) 폰 화면 (게임 화면 + 가까이)
{
  const { ctx, page } = await openPage(844, 390, true, false);
  await page.screenshot({ path: out('ph_game') });
  await pose(page, ANGLES.front, 42); await page.screenshot({ path: out('ph_front') });
  await ctx.close();
}
// 4) 저사양 모드 (설정에 저장된 상태로 새로 연 것과 같다)
{
  const { ctx, page } = await openPage(1280, 720, false, true);
  const lo = await page.evaluate(() => document.body.classList.contains('lite'));
  console.log('lite mode', lo);
  await page.screenshot({ path: out('lo_game') });
  await pose(page, ANGLES.front, 38); await page.screenshot({ path: out('lo_front') });
  await ctx.close();
}
await browser.close();
console.log(allLogs.join('\n') || 'NO ERRORS');
