
/* ==========================================================================
 * 배경음악 — Web Audio로 직접 연주한다 (음원 파일 없음)
 * calm: 평소 잔잔한 해상 음악 · boss: 보스전 북소리 · rage: 격노하면 더 빠르고 거칠게
 * 16분음표 단위로 0.2초 앞까지 미리 예약해 박자가 흔들리지 않게 한다
 * ========================================================================== */
const Music = {
  out: null, mode: 'off', want: 'off', step: 0, nextT: 0, bar: 0, buf: {}, vol: [0, 0.45, 1],
  // 진행: 마디마다 화음 (근음 MIDI 번호, 단조/장조)
  prog: {
    calm: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']],        // Am F C G
    boss: [[50, 'm'], [50, 'm'], [46, 'M'], [48, 'M']],        // Dm Dm Bb C
    rage: [[50, 'm'], [51, 'M'], [50, 'm'], [49, 'M']]         // Dm Eb Dm Db (불안하게)
  },
  bpm: { calm: 78, boss: 118, rage: 148 },

  init: function () {
    const S = Sound;
    if (!S.ready || this.out) return;
    const ctx = S.ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(S.master);
    this.rev = ctx.createConvolver(); this.rev.buffer = this.makeVerb(ctx); this.revG = ctx.createGain(); this.revG.gain.value = 0.35;
    this.rev.connect(this.revG); this.revG.connect(this.out);
    const B = this.buf;
    B.kick = S.synth(0.7, function (d, n, sr) {           // 큰북 (타이코): 낮게 꺼지는 울림 + 가죽 치는 소리
      let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; ph += TAU * (46 + 90 * Math.exp(-t * 22)) / sr; d[i] = Math.tanh(Math.sin(ph) * Math.exp(-t * 6) * 1.8 + (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.4) * 0.9; }
    });
    B.snare = S.synth(0.35, function (d, n, sr) {
      let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, w = Math.random() * 2 - 1; lp += (w - lp) * 0.5; d[i] = ((w - lp) * 0.9 * Math.exp(-t * 18) + Math.sin(TAU * 190 * t) * Math.exp(-t * 30) * 0.5) * 0.7; }
    });
    B.hat = S.synth(0.08, function (d, n, sr) {
      let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, w = Math.random() * 2 - 1; lp += (w - lp) * 0.6; d[i] = (w - lp) * Math.exp(-t * 70) * 0.5; }
    });
    B.swell = S.synth(1.2, function (d, n, sr) {           // 파도 같은 숨소리 (잔잔할 때)
      let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, w = Math.random() * 2 - 1; lp += (w - lp) * 0.04; d[i] = lp * Math.sin(Math.PI * t / 1.2) * 1.6; }
    });
  },
  makeVerb: function (ctx) {
    const sr = ctx.sampleRate, n = Math.floor(sr * 2.4), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  },
  hz: function (m) { return 440 * Math.pow(2, (m - 69) / 12); },
  chord: function (root, q) { return [root, root + (q === 'm' ? 3 : 4), root + 7]; },

  // 신스 음 하나: 파형 여러 개를 겹쳐 저역 필터를 지나게 한다
  note: function (t, midi, dur, o) {
    const ctx = Sound.ctx, g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = o.cut || 1200; f.Q.value = o.q || 0.7;
    const a = o.a || 0.01, peak = o.v || 0.1, rel = o.r || 0.2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel)); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    f.connect(g); g.connect(this.out); if (o.wet) { const w = ctx.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(this.rev); }
    const det = o.det || [0];
    for (let i = 0; i < det.length; i++) {
      const os = ctx.createOscillator(); os.type = o.type || 'sawtooth';
      os.frequency.value = this.hz(midi); os.detune.value = det[i];
      os.connect(f); os.start(t); os.stop(t + dur + 0.05);
    }
    if (o.sweep) { f.frequency.setValueAtTime(o.cut * 0.3, t); f.frequency.exponentialRampToValueAtTime(o.cut, t + Math.min(dur, o.sweep)); }
  },
  hit: function (t, name, v, rate) {
    const ctx = Sound.ctx, s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = this.buf[name]; s.playbackRate.value = rate || 1; g.gain.value = v;
    s.connect(g); g.connect(this.out); s.start(t);
  },

  // 한 칸(16분음표) 연주
  play16: function (t, mode, s, len) {
    const P = this.prog[mode], ch = P[this.bar % 4], notes = this.chord(ch[0], ch[1]), beat = s % 16, barLen = len * 16;
    if (mode === 'calm') {
      if (beat === 0) {
        for (let i = 0; i < 3; i++) this.note(t, notes[i], barLen, { type: 'sawtooth', det: [-7, 7], cut: 700, a: 1.2, r: 1.2, v: 0.035, wet: 0.8 });
        this.note(t, ch[0] - 12, barLen, { type: 'sine', a: 0.6, r: 0.8, v: 0.09 });
        if (this.bar % 2 === 0) this.hit(t, 'swell', 0.05, 1);
      }
      if (beat % 4 === 0) {        // 맑은 아르페지오: 4분음표마다 한 음, 한 옥타브 위
        const seq = [0, 1, 2, 1], m = notes[seq[(beat / 4) | 0]] + 12 + ((beat === 12 && this.bar % 2) ? 12 : 0);
        this.note(t, m, len * 3, { type: 'triangle', cut: 3000, a: 0.005, r: len * 2.5, v: 0.05, wet: 1 });
      }
      return;
    }
    const rage = mode === 'rage';
    // 저음: 8분음표로 근음을 몰아친다
    if (beat % 2 === 0) this.note(t, ch[0] - 24 + (beat === 14 ? 7 : 0), len * 1.6, { type: 'sawtooth', det: [0, 9], cut: rage ? 900 : 600, q: 4, a: 0.005, r: 0.08, v: 0.08, sweep: 0.06 });
    // 현악 스타카토: 박자마다 화음
    if (beat % 4 === 0 || (rage && beat % 4 === 3)) for (let i = 0; i < 3; i++) this.note(t, notes[i] + 12, len * 0.9, { type: 'sawtooth', det: [-5, 5], cut: 2200, a: 0.004, r: 0.05, v: 0.028, wet: 0.3 });
    // 마디 머리: 긴 금관 화음
    if (beat === 0) for (let i = 0; i < 3; i++) this.note(t, notes[i], barLen, { type: 'square', det: [-4, 4], cut: rage ? 1500 : 1000, a: 0.25, r: 0.4, v: 0.02, wet: 0.6 });
    // 북: 보스는 1·3박 + 엇박 타이코, 격노는 더 촘촘하게
    if (beat === 0 || beat === 8 || beat === 11 || (rage && (beat === 4 || beat === 14))) this.hit(t, 'kick', rage ? 0.55 : 0.5, beat === 11 ? 1.15 : 1);
    if (beat === 4 || beat === 12) this.hit(t, 'snare', 0.28, 1);
    if (rage || beat % 2 === 0) this.hit(t, 'hat', rage ? (beat % 4 === 2 ? 0.16 : 0.08) : 0.07, 1);
    // 격노: 높은 경보 같은 멜로디
    if (rage && beat % 8 === 0) this.note(t, notes[(this.bar + beat / 8) % 3] + 24, len * 3.5, { type: 'square', cut: 2600, a: 0.01, r: 0.1, v: 0.025, wet: 0.5 });
  },

  // 매 프레임: 어떤 음악을 틀지 정하고 앞부분을 예약한다
  update: function () {
    if (!Sound.ready) return;
    if (!this.out) this.init();
    const ctx = Sound.ctx, now = ctx.currentTime, lv = this.vol[Setg.m == null ? 2 : Setg.m] * CONFIG.audio.music;
    let want = 'off';
    if (Game.state === 'play' || Game.state === 'pause' || Game.state === 'cards') {
      want = 'calm';
      for (let i = 0; i < enemies.length; i++) { const b = enemies[i]; if (b.kind === 'boss' && b.alive) { want = b.enraged ? 'rage' : 'boss'; break; } }
    } else if (Game.state === 'menu' || Game.state === 'start') want = 'calm';
    if (want !== this.mode) {
      // 바뀔 때: 지금 소리를 짧게 줄이고 새 음악을 다음 박에서 시작한다
      this.out.gain.cancelScheduledValues(now); this.out.gain.setTargetAtTime(0, now, 0.15);
      this.mode = want; this.step = 0; this.bar = 0; this.nextT = now + 0.35;
      if (want !== 'off') this.out.gain.setTargetAtTime(lv, now + 0.35, 0.5);
      return;
    }
    if (this.mode === 'off') return;
    if (Math.abs(this.out.gain.value - lv) > 0.01 && now > this.nextT - 0.3) this.out.gain.setTargetAtTime(lv, now, 0.3);
    if (lv <= 0) { this.nextT = Math.max(this.nextT, now); return; }
    const len = 60 / this.bpm[this.mode] / 4;
    if (this.nextT < now - 0.5) this.nextT = now + 0.05;          // 탭이 멈췄다 돌아온 경우
    while (this.nextT < now + 0.2) {
      this.play16(this.nextT, this.mode, this.step, len);
      this.nextT += len; this.step++;
      if (this.step % 16 === 0) this.bar++;
    }
  }
};
