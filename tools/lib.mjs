import fs from 'fs';
import { ROOT, loadModule, CHROME } from './env.mjs';
const require = loadModule;
const { chromium } = require('playwright');
const three = fs.readFileSync(ROOT + '/vendor/three.min.js');
export async function open(opts = {}) {
  const W = opts.W || 960, H = opts.H || 540;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'].concat(opts.args || []) });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: opts.dpr || 1 });
  const logs = [];
  page.on('console', m => { const t = m.text(); if (!/GPU stall due to ReadPixels/.test(t)) logs.push('[' + m.type() + '] ' + t); });
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));
  await page.route('**/three.min.js', r => r.fulfill({ body: three, contentType: 'application/javascript' }));
  await page.goto('file://' + (opts.file || ROOT + '/tools/test.html'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__dbg.CONFIG.quality.adaptive = false; });
  return { browser, page, logs };
}
export async function shot(page, name, wait = 700) { await page.waitForTimeout(wait); await page.screenshot({ path: name }); }
export const adv = (page, n, dt = 1 / 60) => page.evaluate(([n, dt]) => window.__dbg.advance(n, dt), [n, dt]);
