#!/bin/sh
# 테스트용 사본: 내부 상태를 들여다볼 수 있는 디버그 훅을 넣는다 (배포본에는 들어가지 않음)
set -e
cd "$(dirname "$0")/.."
./build.sh >/dev/null
python3 - <<'PY'
s=open('index.html',encoding='utf-8').read()
hook = """window.__dbg = { CONFIG: CONFIG, Game: Game, Cam: Cam, Input: Input, Aim: Aim, Sound: Sound, Hud: Hud, enemies: enemies, WV: WV,
  get player() { return player; }, get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; },
  get simTime() { return simTime; }, get kills() { return kills; }, get round() { return round; }, get bulN() { return bulN; },
  get cannonT() { return cannonT; }, set cannonT(v) { cannonT = v; },
  sys: function () { return { spray: spraySys.n, mist: mistSys.n, smoke: smokeSys.n, fire: fireSys.n, decals: decalN, stamps: stampN }; },
  waveHeight: waveHeight, fxWaterColumn: fxWaterColumn, fxExplosion: fxExplosion, damageBoat: damageBoat, bulletHitBoat: bulletHitBoat, bossSalvo: bossSalvo, applyTracerStyle: applyTracerStyle, Fcs: Fcs, pauseGame: pauseGame, shells: shells, bulletSpawn: bulletSpawn, shellSpawn: shellSpawn, fireCannon: fireCannon, startRound: startRound,
  shells: shells, pixelRatio: function () { return pixelRatio; },
  advance: function (n, dt) { for (let i = 0; i < n; i++) { simTime += dt; update(dt); } },
  Upg: Upg, CARDS: CARDS, upgOffer: upgOffer, upgPick: upgPick, upgApply: upgApply, upgReset: upgReset, get roundState() { return roundState; }, Cards: Cards, chooseCard: chooseCard, openCards: openCards, cardDesc: cardDesc, psys: function () { return [smokeSys, mistSys, spraySys]; }, selectEnv: selectEnv, applyEnv: applyEnv, hazTest: { drop: enemyMineDrop }, eMines: eMines, torps: torps, beginGame: beginGame, clearEnemies: clearEnemies, useItemNow: useItem, setAssist: function (v) { assistOn = v; }, rollItem: rollItem,
  aiUpdate: aiUpdate, missiles: missiles, Lock: Lock, SPECS: SPECS, crates: crates, spawnCrate: spawnCrate, useItem: useItem, mineList: mineList, iproj: iproj, foamRT: function () { return foamRT; }, boatPool: boatPool, spawnEnemy: spawnEnemy, segBoat: segBoat, bombers: bombers, iproj: iproj, mineList: mineList, oceanUniforms: function () { return oceanUniforms; }, Skill: Skill, skillBuy: skillBuy, skillAutoBuy: skillAutoBuy, skillRender: skillRender, shipTry: shipTry, selectDiff: selectDiff, xpGain: xpGain, lvMul: lvMul, lvNeed: lvNeed, Setg: Setg, saveRun: saveRun, loadRun: loadRun, fromCode: fromCode, toCode: toCode, SaveSt: SaveSt, Rec: Rec, saveUiRender: saveUiRender, showResult: showResult, runSnapshot: runSnapshot, shipRateAt: shipRateAt, wrapAngle: wrapAngle, launchMissile: launchMissile, shopBuy: shopBuy, flareAuto: flareAuto, missiles: missiles, upgAutoShot: upgAutoShot, bulletsUpdate: bulletsUpdate, flares: flares, deployFlare: deployFlare, updateFcs: updateFcs, updateAim: updateAim, ISLES: ISLES, REEFS: REEFS, Special: Special, specialStart: specialStart, specialAfterSpawn: specialAfterSpawn, specialEnd: specialEnd, specialPick: specialPick, airs: airs, airSpawn: airSpawn, airWave: airWave, damageAir: damageAir, smokeDeploy: smokeDeploy, smkClouds: smkClouds, smokeBlocks: smokeBlocks, canSeePlayer: canSeePlayer, achCheck: achCheck, skinApply: skinApply, skinSel: skinSel, SKINS: SKINS, ACH: ACH, Music: Music, isleSeg: isleSeg, islesBuild: islesBuild, debrisBurst: debrisBurst, isleBulletFx: isleBulletFx, ISLE_HIT: ISLE_HIT, metaOpen: metaOpen, smokeWall: function () { return smokeWall; }, rockets: rockets, deployFlare: deployFlare, isleH: isleH, get isleSeed() { return isleSeed; }, debCount: function () { return debN; } };
boot();
})();"""
s=s.replace("  if (Game.state !== 'pause' && Game.state !== 'cards') {", "  if (Game.state !== 'pause' && Game.state !== 'cards' && !window.__hold) {")
assert "window.__hold" in s
assert s.count("boot();\n})();")==1
s=s.replace("boot();\n})();",hook)
open('tools/test.html','w',encoding='utf-8').write(s)
PY
echo built test.html
