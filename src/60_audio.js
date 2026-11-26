
/* ==========================================================================
 * 효과음 — 전부 Web Audio API로 직접 합성한다 (사운드 파일 없음)
 * 첫 클릭 때 init()이 불리면서 시작된다
 * ========================================================================== */
const Sound = {
  ctx: null, master: null, sfx: null, ready: false, buf: {}, eng: null, engT: 0,
  last: { mg: -1, mgEnemy: -1, cannon: -1, explosion: -1, splash: -1, splashBig: -1, slam: -1, clank: -1, ping: -1, hurt: -1, tick: -1, kill: -1, reload: -1, horn: -1, boost: -1, missile: -1, dry: -1, pickup: -1, emp: -1, nuke: -1, flare: -1, pop: -1, puff: -1 },
  // 같은 소리가 너무 촘촘히 겹치지 않도록 하는 최소 간격(초)
  gap: { mg: 0.03, mgEnemy: 0.05, cannon: 0.05, explosion: 0.08, splash: 0.06, splashBig: 0.1, slam: 0.15, clank: 0.05, ping: 0.07, hurt: 0.12, tick: 0.04, kill: 0.1, reload: 0.1, horn: 0.5, boost: 0.3, missile: 0.1, dry: 0.2, pickup: 0.2, emp: 0.3, nuke: 0.5, flare: 0.2, pop: 0.3, puff: 0.05 },

  init: function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (err) { this.ctx = null; return; }
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master = ctx.createGain(); this.master.gain.value = CONFIG.audio.master;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = CONFIG.audio.effects; this.sfx.connect(this.master);
    this.makeBuffers();
    this.makeEngine();
    this.ready = true;
    if (ctx.state === 'suspended') ctx.resume();
  },

  synth: function (dur, fn) {
    const sr = this.ctx.sampleRate, n = Math.floor(dur * sr), b = this.ctx.createBuffer(1, n, sr);
    fn(b.getChannelData(0), n, sr);
    return b;
  },

  makeBuffers: function () {
    const B = this.buf;
    // 기관총: 날카로운 파열음 + 짧은 저음
    B.mg = this.synth(0.2, function (d, n, sr) {
      let lp = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        lp += (w - lp) * 0.5;
        ph += TAU * (70 + 190 * Math.exp(-t * 40)) / sr;
        d[i] = Math.tanh(((w - lp) * Math.exp(-t * 95) * 0.9 + lp * Math.exp(-t * 36) * 1.2 + Math.sin(ph) * Math.exp(-t * 28) * 0.9) * 1.5) * 0.7;
      }
    });
    B.mgEnemy = B.mg;
    // 함포: 깊게 내려가는 저음 + 묵직한 잡음 + 순간적인 타격음
    B.cannon = this.synth(1.7, function (d, n, sr) {
      let lp = 0, lp2 = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        lp += (w - lp) * (0.015 + 0.5 * Math.exp(-t * 10));
        lp2 += (lp - lp2) * 0.35;
        ph += TAU * (36 + 90 * Math.exp(-t * 12)) / sr;
        d[i] = Math.tanh((Math.sin(ph) * Math.exp(-t * 3.4) * 1.3 + lp2 * Math.exp(-t * 4.8) * 2.6 + (w - lp) * Math.exp(-t * 60) * 0.7) * 1.7) * 0.85;
      }
    });
    // 폭발: 길게 우르릉거리는 저음
    B.explosion = this.synth(2.8, function (d, n, sr) {
      let lp = 0, br = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        lp += (w - lp) * (0.01 + 0.35 * Math.exp(-t * 5));
        br = (br + w * 0.05) * 0.996;
        ph += TAU * (28 + 60 * Math.exp(-t * 8)) / sr;
        d[i] = Math.tanh((Math.sin(ph) * Math.exp(-t * 2.6) * 1.2 + lp * Math.exp(-t * 2.4) * 2.8 + br * Math.exp(-t * 1.5) * 1.6 + (w - lp) * Math.exp(-t * 45) * 0.6) * 1.6) * 0.9;
      }
    });
    // 작은 물 튀는 소리
    B.splash = this.synth(0.38, function (d, n, sr) {
      let lp = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        lp += (w - lp) * 0.28;
        ph += TAU * (160 + 420 * Math.exp(-t * 22)) / sr;
        d[i] = ((w - lp) * 0.75 + lp * 0.5) * (1 - Math.exp(-t * 500)) * Math.exp(-t * 15) * 0.9 + Math.sin(ph) * Math.exp(-t * 30) * 0.25;
      }
    });
    // 물기둥: 쏴 하고 솟았다가 물방울이 후두둑 떨어진다
    B.splashBig = this.synth(2.4, function (d, n, sr) {
      let lp = 0, ph = 0, pat = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        lp += (w - lp) * (0.05 + 0.45 * Math.exp(-t * 1.6));
        const env = Math.min(1, t / 0.035) * Math.exp(-t * 2.3);
        ph += TAU * (34 + 40 * Math.exp(-t * 9)) / sr;
        if (t > 0.5 && Math.random() < 0.0035) pat = Math.random() * 2 - 1;
        pat *= 0.93;
        const tail = t > 0.5 ? Math.min(1, (t - 0.5) * 3) * Math.exp(-(t - 0.5) * 1.8) : 0;
        d[i] = Math.tanh((lp * env * 2.2 + (w - lp) * env * 0.5 + Math.sin(ph) * Math.exp(-t * 6) * 0.9 + pat * tail * 0.8) * 1.3) * 0.8;
      }
    });
    // 선체가 파도를 내리칠 때
    B.slam = this.synth(0.9, function (d, n, sr) {
      let lp = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        lp += (w - lp) * 0.12;
        ph += TAU * (44 + 30 * Math.exp(-t * 14)) / sr;
        d[i] = Math.tanh((lp * Math.min(1, t / 0.01) * Math.exp(-t * 6.5) * 2.4 + (w - lp) * Math.exp(-t * 12) * 0.35 + Math.sin(ph) * Math.exp(-t * 11) * 0.9) * 1.3) * 0.8;
      }
    });
    // 탄이 선체에 맞는 금속음
    B.clank = this.synth(0.22, function (d, n, sr) {
      for (let i = 0; i < n; i++) {
        const t = i / sr, e = Math.exp(-t * 34);
        d[i] = (Math.sin(TAU * 1730 * t) * 0.4 + Math.sin(TAU * 2615 * t) * 0.3 + Math.sin(TAU * 3490 * t) * 0.2 + Math.sin(TAU * 5120 * t) * 0.12) * e +
          (Math.random() * 2 - 1) * Math.exp(-t * 300) * 0.5;
      }
    });
    // 장갑에 튕기는 "팅": 높은 금속 울림이 짧게 남고 음이 살짝 내려간다
    B.ping = this.synth(0.32, function (d, n, sr) {
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        ph += TAU * (3300 - 900 * (1 - Math.exp(-t * 18))) / sr;
        d[i] = (Math.sin(ph) * 0.55 + Math.sin(ph * 1.51) * 0.22) * Math.exp(-t * 13) + (Math.random() * 2 - 1) * Math.exp(-t * 400) * 0.45;
      }
    });
    // 피격음: 둔탁한 충격
    B.hurt = this.synth(0.4, function (d, n, sr) {
      let lp = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        lp += (w - lp) * 0.12;
        ph += TAU * (52 + 95 * Math.exp(-t * 18)) / sr;
        d[i] = Math.tanh((Math.sin(ph) * Math.exp(-t * 11) * 1.3 + lp * Math.exp(-t * 22) * 2.5) * 1.5) * 0.85;
      }
    });
    // 명중 표시음
    B.tick = this.synth(0.06, function (d, n, sr) {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(TAU * 2300 * t) * Math.exp(-t * 95) * 0.6; }
    });
    // 격파 알림음
    B.kill = this.synth(0.45, function (d, n, sr) {
      for (let i = 0; i < n; i++) {
        const t = i / sr, t2 = t - 0.11;
        let v = (Math.sin(TAU * 880 * t) + 0.3 * Math.sin(TAU * 1760 * t)) * Math.exp(-t * 14);
        if (t2 > 0) v += (Math.sin(TAU * 1320 * t2) + 0.3 * Math.sin(TAU * 2640 * t2)) * Math.exp(-t2 * 8);
        d[i] = v * 0.4;
      }
    });
    // 함포 장전 완료: 철컥
    B.reload = this.synth(0.2, function (d, n, sr) {
      for (let i = 0; i < n; i++) {
        const t = i / sr, t2 = t - 0.085;
        let v = (Math.random() * 2 - 1) * Math.exp(-t * 180) * 0.7 + Math.sin(TAU * 310 * t) * Math.exp(-t * 60) * 0.5;
        if (t2 > 0) v += (Math.random() * 2 - 1) * Math.exp(-t2 * 150) * 0.8 + Math.sin(TAU * 520 * t2) * Math.exp(-t2 * 70) * 0.5;
        d[i] = v * 0.7;
      }
    });
    // 웨이브 시작: 뱃고동
    B.horn = this.synth(1.5, function (d, n, sr) {
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let v = 0;
        for (let h = 1; h <= 7; h++) v += Math.sin(TAU * 98 * h * t) / h * 0.6 + Math.sin(TAU * 146.8 * h * t + 0.5) / h * 0.4;
        lp += (v - lp) * 0.09;
        d[i] = lp * Math.min(1, t / 0.09) * Math.min(1, (1.5 - t) / 0.35) * 0.55;
      }
    });
    // 부스트: 치솟는 바람 소리
    B.boost = this.synth(0.9, function (d, n, sr) {
      let low = 0, band = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, f = 2 * Math.sin(Math.PI * (300 + 2600 * t / 0.9) / sr);
        low += f * band;
        band += f * ((Math.random() * 2 - 1) - low - 0.7 * band);
        d[i] = band * Math.sin(Math.PI * t / 0.9) * 0.5;
      }
    });
    // 미사일 발사: 쉬익 하고 멀어지는 로켓 소리
    B.missile = this.synth(1.8, function (d, n, sr) {
      let lp = 0, lp2 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        lp += (w - lp) * (0.08 + 0.3 * Math.exp(-t * 2));
        lp2 += (lp - lp2) * 0.3;
        const env = Math.min(1, t / 0.04) * Math.exp(-t * 1.6);
        d[i] = Math.tanh(((w - lp) * 0.55 + lp2 * 1.6) * env * 1.4 + Math.sin(TAU * 60 * t) * Math.exp(-t * 18) * 0.6) * 0.8;
      }
    });
    // 플레어: 퍽퍽 터지며 연달아 튀어나오는 소리 + 타들어 가는 쉬익 소리
    B.flare = this.synth(1.4, function (d, n, sr) {
      let lp = 0, hp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        lp += (w - lp) * 0.2; hp = w - lp;
        let pop = 0;
        for (let k = 0; k < 6; k++) { const tk = t - k * 0.09; if (tk > 0) pop += Math.exp(-tk * 55) * (Math.sin(TAU * 140 * tk) * 0.7 + lp * 1.4); }
        const hiss = hp * Math.min(1, t / 0.08) * Math.exp(-t * 2.2) * 0.35;
        d[i] = Math.tanh((pop + hiss) * 1.6) * 0.75;
      }
    });
    // 아이템 획득: 올라가는 세 음
    B.pickup = this.synth(0.6, function (d, n, sr) {
      const f = [660, 880, 1320];
      for (let i = 0; i < n; i++) {
        const t = i / sr, k = Math.min(2, Math.floor(t / 0.11)), tt = t - k * 0.11;
        d[i] = (Math.sin(TAU * f[k] * t) + 0.3 * Math.sin(TAU * f[k] * 2 * t)) * Math.exp(-tt * 9) * 0.35;
      }
    });
    // EMP: 지지직 하며 꺼지는 전기 소리
    B.emp = this.synth(1.2, function (d, n, sr) {
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        ph += TAU * (900 * Math.exp(-t * 3) + 60) / sr;
        const buzz = Math.sign(Math.sin(ph)) * 0.3 + (Math.random() * 2 - 1) * (Math.random() < 0.08 ? 0.8 : 0.1);
        d[i] = buzz * Math.exp(-t * 2.5) * 0.6;
      }
    });
    // 핵폭탄: 아주 낮고 긴 굉음
    B.nuke = this.synth(5.5, function (d, n, sr) {
      let lp = 0, lp2 = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1;
        lp += (w - lp) * (0.006 + 0.2 * Math.exp(-t * 3));
        lp2 += (lp - lp2) * 0.2;
        ph += TAU * (22 + 40 * Math.exp(-t * 2)) / sr;
        d[i] = Math.tanh((Math.sin(ph) * Math.exp(-t * 0.9) * 1.4 + lp2 * Math.exp(-t * 0.7) * 5 + (w - lp) * Math.exp(-t * 20) * 0.8) * 1.6) * 0.95;
      }
    });
    // 연막탄 발사: 퐁퐁퐁 (발사기에서 연달아 튀어나가는 둔한 소리)
    B.pop = this.synth(0.7, function (d, n, sr) {
      for (let i = 0; i < n; i++) {
        const t = i / sr; let v = 0;
        for (let k = 0; k < 5; k++) { const tk = t - k * 0.09; if (tk > 0) v += Math.sin(TAU * (150 - 60 * Math.min(1, tk * 12)) * tk) * Math.exp(-tk * 30) * 0.9 + (Math.random() * 2 - 1) * Math.exp(-tk * 90) * 0.35; }
        d[i] = Math.tanh(v * 1.3) * 0.7;
      }
    });
    // 연막탄 터짐: 팡 하고 쉬익 퍼지는 소리
    B.puff = this.synth(1.6, function (d, n, sr) {
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = Math.random() * 2 - 1; lp += (w - lp) * 0.08;
        d[i] = Math.tanh((Math.sin(TAU * (90 - 40 * Math.min(1, t * 8)) * t) * Math.exp(-t * 18) * 1.2 + (w - lp) * Math.exp(-t * 40) * 0.6 + lp * Math.min(1, t * 20) * Math.exp(-t * 2.2) * 1.6) * 1.2) * 0.75;
      }
    });
    // 탄이 없을 때: 딸깍
    B.dry = this.synth(0.08, function (d, n, sr) {
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 220) * 0.6 + Math.sin(TAU * 900 * t) * Math.exp(-t * 120) * 0.3; }
    });
    // 물 가르는 소리용 반복 잡음 (끝과 처음이 이어지도록 겹쳐 섞는다)
    B.noise = this.synth(2.2, function (d, n, sr) {
      const fade = Math.floor(sr * 0.25), raw = new Float32Array(n + fade);
      let lp = 0;
      for (let i = 0; i < raw.length; i++) { const w = Math.random() * 2 - 1; lp += (w - lp) * 0.2; raw[i] = lp * 1.6 + w * 0.25; }
      for (let i = 0; i < n; i++) d[i] = i < fade ? raw[i] * (i / fade) + raw[n + i] * (1 - i / fade) : raw[i];
    });
  },

  // 엔진: 톱니파 여러 개를 겹치고 저역 필터를 건다. 속도에 따라 음높이와 필터가 올라간다
  makeEngine: function () {
    const ctx = this.ctx, e = {};
    e.out = ctx.createGain(); e.out.gain.value = 0; e.out.connect(this.master);
    e.lp = ctx.createBiquadFilter(); e.lp.type = 'lowpass'; e.lp.frequency.value = 300; e.lp.Q.value = 1.3; e.lp.connect(e.out);
    e.am = ctx.createGain(); e.am.gain.value = 1; e.am.connect(e.lp);
    e.o1 = ctx.createOscillator(); e.o1.type = 'sawtooth';
    e.o2 = ctx.createOscillator(); e.o2.type = 'square';
    e.o3 = ctx.createOscillator(); e.o3.type = 'sawtooth';
    const g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain();
    g1.gain.value = 0.5; g2.gain.value = 0.38; g3.gain.value = 0.16;
    e.o1.connect(g1); e.o2.connect(g2); e.o3.connect(g3);
    g1.connect(e.am); g2.connect(e.am); g3.connect(e.am);
    e.lfo = ctx.createOscillator(); e.lfo.type = 'sine'; e.lfo.frequency.value = 9;      // 덜덜거리는 떨림
    const lg = ctx.createGain(); lg.gain.value = 0.28;
    e.lfo.connect(lg); lg.connect(e.am.gain);
    e.noise = ctx.createBufferSource(); e.noise.buffer = this.buf.noise; e.noise.loop = true;
    e.bp = ctx.createBiquadFilter(); e.bp.type = 'bandpass'; e.bp.frequency.value = 700; e.bp.Q.value = 0.7;
    e.ng = ctx.createGain(); e.ng.gain.value = 0;
    e.noise.connect(e.bp); e.bp.connect(e.ng); e.ng.connect(this.master);
    e.o1.start(); e.o2.start(); e.o3.start(); e.lfo.start(); e.noise.start();
    this.eng = e;
  },

  // 속도에 따라 음높이가 변하는 엔진음. 초당 20번만 갱신한다
  engine: function (dt, spN, throttle, boost, on) {
    if (!this.ready) return;
    this.engT += dt;
    if (this.engT < 0.05) return;
    this.engT = 0;
    const e = this.eng, now = this.ctx.currentTime, vol = CONFIG.audio.engine;
    const load = clamp(0.35 * (throttle < 0 ? -throttle : throttle) + 0.65 * spN, 0, 1.6);
    const f = 38 + 62 * load + (boost ? 16 : 0);
    e.o1.frequency.setTargetAtTime(f, now, 0.07);
    e.o2.frequency.setTargetAtTime(f * 0.5, now, 0.07);
    e.o3.frequency.setTargetAtTime(f * 1.51, now, 0.07);
    e.lfo.frequency.setTargetAtTime(7 + 16 * load, now, 0.1);
    e.lp.frequency.setTargetAtTime(260 + 1300 * load * load + (boost ? 500 : 0), now, 0.1);
    e.out.gain.setTargetAtTime(on ? vol * (0.16 + 0.26 * load) : 0, now, 0.12);
    e.bp.frequency.setTargetAtTime(500 + 1500 * spN, now, 0.15);
    e.ng.gain.setTargetAtTime(on ? vol * 0.5 * Math.min(spN * spN, 1.6) : 0, now, 0.15);
  },

  play: function (name, vol, rate, pan) {
    if (!this.ready) return;
    const ctx = this.ctx, b = this.buf[name];
    if (!b) return;
    const now = ctx.currentTime;
    if (now - this.last[name] < this.gap[name]) return;
    this.last[name] = now;
    const src = ctx.createBufferSource();
    src.buffer = b; src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p); p.connect(this.sfx);
    } else g.connect(this.sfx);
    src.start();
  },

  // 월드 위치에서 나는 소리: 멀수록 작게, 카메라 기준 좌우로 나눠 들린다
  playAt: function (name, x, z, vol, rate) {
    if (!this.ready) return;
    const dx = x - camera.position.x, dz = z - camera.position.z, d2 = dx * dx + dz * dz;
    const v = vol / (1 + d2 / 16900);
    if (v < 0.012) return;
    const d = Math.sqrt(d2) || 1;
    this.play(name, v, rate, clamp((dx * Cam.rightX + dz * Cam.rightZ) / d, -1, 1) * 0.75 * Math.min(1, d / 12));
  },

  pause: function (p) {
    if (!this.ctx) return;
    const r = p ? this.ctx.suspend() : this.ctx.resume();
    if (r && typeof r.catch === 'function') r.catch(noop);
  }
};
