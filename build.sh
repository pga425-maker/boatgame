#!/bin/sh
# src/ 조각 파일들을 순서대로 이어 붙여 배포용 index.html 하나를 만든다 (GitHub Pages가 이 파일을 그대로 보여 준다)
set -e
cd "$(dirname "$0")"
cat src/00_head.html src/10_core.js src/20_water.js src/30_particles.js src/40_boats.js src/50_combat.js src/55_items.js src/56_flares.js src/57_skills.js src/58_upgrades.js src/59_save.js src/60_audio.js src/61_music.js src/62_isles.js src/63_smoke.js src/64_air.js src/65_special.js src/66_meta.js src/70_hud.js src/80_main.js src/99_tail.html > index.html
wc -c index.html | awk '{print "index.html bytes:", $1}'
