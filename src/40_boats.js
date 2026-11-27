
/* ==========================================================================
 * 보트 모델 — 기본 도형과 직접 만든 지오메트리를 조립한다
 * 보트 기준 좌표: +Z가 뱃머리, +Y가 위, +X가 좌현
 * ========================================================================== */
function sRGB(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

// 선체 치수 (모양과 충돌 판정에 쓰임)
const MODELS = {
  player:  { L: 13.6, B: 4.3, draft: 0.72, free: 1.22, bowRise: 0.50, bulwark: 0.20, rake: 1.0, topY: 3.4, lift: 0.22 },
  fast:    { L: 10.4, B: 3.2, draft: 0.55, free: 0.95, bowRise: 0.55, bulwark: 0.14, rake: 0.9, topY: 2.4, lift: 0.20 },
  gunboat: { L: 19.5, B: 5.7, draft: 1.00, free: 1.65, bowRise: 0.42, bulwark: 0.28, rake: 1.2, topY: 5.0, lift: 0.10 },
  boss:    { L: 36.0, B: 8.6, draft: 1.70, free: 2.70, bowRise: 0.34, bulwark: 0.36, rake: 1.9, topY: 9.5, lift: 0.04 },
  misboat: { L: 11.4, B: 3.3, draft: 0.58, free: 1.00, bowRise: 0.55, bulwark: 0.14, rake: 0.9, topY: 2.6, lift: 0.19 },
  minelayer: { L: 18.0, B: 5.6, draft: 1.00, free: 1.55, bowRise: 0.40, bulwark: 0.28, rake: 1.1, topY: 4.6, lift: 0.10 },
  sub:     { L: 24.0, B: 3.4, draft: 1.60, free: 0.55, bowRise: 0.12, bulwark: 0.02, rake: 2.4, topY: 4.2, lift: 0.02 },
  supply:  { L: 30.0, B: 7.2, draft: 1.50, free: 2.10, bowRise: 0.30, bulwark: 0.30, rake: 1.6, topY: 8.5, lift: 0.04 }
};

// 색으로 편을 구분한다: 플레이어는 밝은 회청색에 파란 띠, 적은 어두운 선체에 붉은 띠
const PAL = {
  player: {
    hull: sRGB(0x78838c), hull2: sRGB(0x67727b), bottom: sRGB(0x6e211b), deck: sRGB(0x3f464c), trim: sRGB(0x525b63),
    cabin: sRGB(0x86919a), roof: sRGB(0x99a3ab), glass: sRGB(0x0b1a26), gun: sRGB(0x6c767e), turret: sRGB(0x949ea6),
    dark: sRGB(0x23292e), accent: sRGB(0x2f86e0), rail: sRGB(0xd5dbdf)
  },
  fast: {
    hull: sRGB(0x2e3236), hull2: sRGB(0x26292c), bottom: sRGB(0x15171a), deck: sRGB(0x3b3f43), trim: sRGB(0xc8322a),
    cabin: sRGB(0x484d52), roof: sRGB(0x3a3e42), glass: sRGB(0x070b10), gun: sRGB(0x2a2d30), turret: sRGB(0x33373a),
    dark: sRGB(0x16181a), accent: sRGB(0xd8362b), rail: sRGB(0x7a7f84)
  },
  gunboat: {
    hull: sRGB(0x3d4239), hull2: sRGB(0x33372f), bottom: sRGB(0x4c1612), deck: sRGB(0x35392f), trim: sRGB(0xd9582b),
    cabin: sRGB(0x5a6052), roof: sRGB(0x4a5044), glass: sRGB(0x070b10), gun: sRGB(0x2f332b), turret: sRGB(0x474c40),
    dark: sRGB(0x181a16), accent: sRGB(0xe05a2a), rail: sRGB(0x80856f)
  },
  misboat: {
    hull: sRGB(0x2e3236), hull2: sRGB(0x26292c), bottom: sRGB(0x15171a), deck: sRGB(0x3b3f43), trim: sRGB(0xc8322a),
    cabin: sRGB(0x484d52), roof: sRGB(0x3a3e42), glass: sRGB(0x070b10), gun: sRGB(0x2a2d30), turret: sRGB(0x33373a),
    dark: sRGB(0x16181a), accent: sRGB(0xe0a02b), rail: sRGB(0x7a7f84)
  },
  minelayer: {
    hull: sRGB(0x3a3f45), hull2: sRGB(0x30353a), bottom: sRGB(0x4c1612), deck: sRGB(0x33373b), trim: sRGB(0xd8362b),
    cabin: sRGB(0x52585e), roof: sRGB(0x43484d), glass: sRGB(0x070b10), gun: sRGB(0x2b2e31), turret: sRGB(0x44494e),
    dark: sRGB(0x17191b), accent: sRGB(0xd8362b), rail: sRGB(0x7c8186)
  },
  sub: {
    hull: sRGB(0x1d2124), hull2: sRGB(0x181b1e), bottom: sRGB(0x101214), deck: sRGB(0x22262a), trim: sRGB(0xb3302a),
    cabin: sRGB(0x24282c), roof: sRGB(0x1c1f22), glass: sRGB(0x070b10), gun: sRGB(0x2a2d30), turret: sRGB(0x2c3034),
    dark: sRGB(0x0f1112), accent: sRGB(0xc8322a), rail: sRGB(0x5d6266)
  },
  supply: {
    hull: sRGB(0x2c4a6e), hull2: sRGB(0x263f5e), bottom: sRGB(0x7a2a22), deck: sRGB(0x5b6168), trim: sRGB(0xe9edf0),
    cabin: sRGB(0xe6e9ec), roof: sRGB(0xd2d7db), glass: sRGB(0x0b1a26), gun: sRGB(0x6c767e), turret: sRGB(0x949ea6),
    dark: sRGB(0x23292e), accent: sRGB(0x3fbf6a), rail: sRGB(0xd5dbdf)
  },
  boss: {
    hull: sRGB(0x2c3036), hull2: sRGB(0x24282d), bottom: sRGB(0x5a1712), deck: sRGB(0x3a3d40), trim: sRGB(0xd8362b),
    cabin: sRGB(0x3c4147), roof: sRGB(0x30343a), glass: sRGB(0x070b10), gun: sRGB(0x26292d), turret: sRGB(0x353a40),
    dark: sRGB(0x141618), accent: sRGB(0xd8362b), rail: sRGB(0x6f757b)
  }
};

// 내 배에서 스킨으로 칠할 색: 1 선체, 2 상부구조·포탑
PAL.player.hull.paint = 1; PAL.player.hull2.paint = 1; PAL.player.cabin.paint = 2; PAL.player.roof.paint = 2; PAL.player.turret.paint = 2;

// 여러 도형을 한 지오메트리로 합친다 (보트 한 척의 그리기 호출 수를 줄이기 위해). 색은 정점 색으로 넣는다
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(1, 1, 1), _bp = new THREE.Vector3(), _be = new THREE.Euler();

function GeoBuilder() { this.p = []; this.n = []; this.c = []; this.k = []; }
GeoBuilder.prototype.add = function (geo, col, mat) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (mat) g.applyMatrix4(mat);
  const P = g.attributes.position.array, N = g.attributes.normal.array;
  for (let i = 0; i < P.length; i += 3) {
    this.p.push(P[i], P[i + 1], P[i + 2]);
    this.n.push(N[i], N[i + 1], N[i + 2]);
    this.c.push(col.r, col.g, col.b);
    this.k.push(col.paint || 0);
  }
  return this;
};
GeoBuilder.prototype.box = function (w, h, d, x, y, z, col, rx, ry, rz) {
  _be.set(rx || 0, ry || 0, rz || 0); _bq.setFromEuler(_be); _bm.compose(_bp.set(x, y, z), _bq, _bs);
  return this.add(new THREE.BoxGeometry(w, h, d), col, _bm);
};
GeoBuilder.prototype.cyl = function (rt, rb, h, seg, x, y, z, col, rx, ry, rz) {
  _be.set(rx || 0, ry || 0, rz || 0); _bq.setFromEuler(_be); _bm.compose(_bp.set(x, y, z), _bq, _bs);
  return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), col, _bm);
};
// 두 점을 잇는 가는 막대 (난간, 안테나, 마스트)
GeoBuilder.prototype.rod = function (ax, ay, az, bx, by, bz, r, col, seg) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-4) return this;
  _v1.set(dx / len, dy / len, dz / len); _bq.setFromUnitVectors(UP, _v1);
  _bm.compose(_bp.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5), _bq, _bs);
  return this.add(new THREE.CylinderGeometry(r, r, len, seg || 5, 1, true), col, _bm);
};
// 앞뒤 면을 기울이고 위를 좁힐 수 있는 상자 (조종실, 포탑)
GeoBuilder.prototype.wedge = function (w, h, d, x, y, z, col, frontRake, backRake, topTaper) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(), P = g.attributes.position.array;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i + 1] > 0) {
      if (P[i + 2] > 0) P[i + 2] -= frontRake; else P[i + 2] += backRake;
      P[i] *= 1 - topTaper;
    }
  }
  g.computeVertexNormals();
  _bm.makeTranslation(x, y, z);
  return this.add(g, col, _bm);
};
GeoBuilder.prototype.build = function () {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
  g.setAttribute('aPaint', new THREE.Float32BufferAttribute(this.k, 1));
  g.computeBoundingSphere();
  return g;
};

// 선체 단면: s = 0(선미) ~ 1(뱃머리). 뱃머리로 갈수록 좁아지고 갑판이 솟으며, 용골이 올라와 뾰족해진다
function hullSection(m, s) {
  if (m === MODELS.player) return hullSectionDD(m, s);
  const s0 = 0.36;
  const u = s <= s0 ? 0 : (s - s0) / (1 - s0);
  const sternIn = 1 - 0.09 * Math.pow(1 - Math.min(s / 0.3, 1), 2);
  const deckHB = m.B * 0.5 * sternIn * Math.max(1 - Math.pow(u, 2.1), 0);
  const keelY = -m.draft * (1 - 0.92 * Math.pow(u, 3.2));
  const chineY = -m.draft * 0.22 + (m.free * 0.62 + m.draft * 0.22) * Math.pow(u, 2.3);
  const sheerY = m.free * (1 + m.bowRise * Math.pow(u, 1.7));
  const zBase = -m.L * 0.5 + s * m.L, rake = m.rake * u * u;
  return {
    deckHB: deckHB, chineHB: deckHB * (0.84 - 0.34 * Math.pow(u, 1.4)), inHB: Math.max(deckHB - 0.11, 0),
    keelY: keelY, chineY: chineY, sheerY: sheerY, deckY: sheerY - m.bulwark,
    zK: zBase, zC: zBase + rake * (chineY - keelY) / (sheerY - keelY), zG: zBase + rake
  };
}
function deckYAt(m, z) { return hullSection(m, clamp((z + m.L * 0.5) / m.L, 0, 1)).deckY; }

// 내 배(현대 구축함풍) 선체 단면: 갑판 높이는 다른 배와 같은 식이라 포탑·함교 자리가 그대로다.
// 뱃머리는 더 날카롭게 좁아지고, 옆면은 아래쪽이 크게 벌어지다가 꺾이는 선(너클)에서 거의 곧게 선다
function hullSectionDD(m, s) {
  const s0 = 0.34;
  const u = s <= s0 ? 0 : (s - s0) / (1 - s0);
  const sternIn = 1 - 0.06 * Math.pow(1 - Math.min(s / 0.25, 1), 2);
  const deckHB = m.B * 0.5 * sternIn * Math.max(1 - Math.pow(u, 1.85), 0);
  const keelY = -m.draft * (1 - 0.92 * Math.pow(u, 3.2));
  const chineY = -m.draft * 0.3 + (m.free * 0.5 + m.draft * 0.3) * Math.pow(u, 2.0);
  const sheerY = m.free * (1 + m.bowRise * Math.pow(u, 1.7));
  const kY = chineY + (sheerY - chineY) * 0.52;
  const chineHB = deckHB * (0.8 - 0.3 * Math.pow(u, 1.3)), kHB = chineHB + (deckHB - chineHB) * 0.82;
  const zBase = -m.L * 0.5 + s * m.L, rake = m.rake * u * u, zAt = function (y) { return zBase + rake * (y - keelY) / (sheerY - keelY); };
  return {
    deckHB: deckHB, chineHB: chineHB, inHB: Math.max(deckHB - 0.11, 0), kHB: kHB, kY: kY,
    keelY: keelY, chineY: chineY, sheerY: sheerY, deckY: sheerY - m.bulwark,
    zK: zBase, zC: zAt(chineY), zN: zAt(kY), zG: zBase + rake, s: s
  };
}
// 바깥 외판 위의 높이 y 지점: [x, y, z]
// 용골~너클은 차인을 조절점으로 한 둥근 곡선(2차 베지어)이라 배 밑이 매끄럽고, 너클 위는 곧은 판이다
function ddSideAt(sec, y) {
  const y0 = sec.keelY, y1 = sec.chineY, y2 = sec.kY;
  if (y <= y0) return [0, y0, sec.zK];
  if (y <= y2) {
    const a = y0 - 2 * y1 + y2, b = 2 * (y1 - y0), c = y0 - y;
    const t = clamp(Math.abs(a) < 1e-6 ? -c / b : (-b + Math.sqrt(Math.max(b * b - 4 * a * c, 0))) / (2 * a), 0, 1), u = 1 - t;
    return [2 * t * u * sec.chineHB + t * t * sec.kHB, y, u * u * sec.zK + 2 * t * u * sec.zC + t * t * sec.zN];
  }
  if (y >= sec.sheerY) return [sec.deckHB, sec.sheerY, sec.zG];
  const f = (y - y2) / Math.max(sec.sheerY - y2, 1e-6);
  return [sec.kHB + (sec.deckHB - sec.kHB) * f, y, sec.zN + (sec.zG - sec.zN) * f];
}
// 뱃머리 쪽 갑판을 둘러싼 높은 현장(불워크) 높이: 스텔스 군함처럼 앞갑판을 막힌 벽으로 감싼다
function ddBowWall(s) { const t = clamp((s - 0.76) / 0.1, 0, 1); return 0.5 * t * t * (3 - 2 * t); }

// 외판 이음선(세로) 위치와 폭: 선체 면에 좁은 칸을 끼워 조금 어둡게 칠한다
const DD_FRAMES = [-5.6, -4.2, -2.8, -1.4, 0, 1.4, 2.8], DD_SEAM = 0.03;
function addHullDD(gb, m, pal) {
  // 단면 위치: 고른 간격 48칸 + 세로 이음선마다 좁은 칸
  const seamS = DD_FRAMES.map(function (z) { return (z + m.L * 0.5) / m.L; }), sl = [];
  for (let i = 0; i <= 48; i++) sl.push(i / 48);
  for (const s of seamS) sl.push(s, s + DD_SEAM / m.L);
  sl.sort(function (a, b) { return a - b; });
  const S = [];
  for (const s of sl) if (!S.length || s - S[S.length - 1] > 1e-4) S.push(s);
  const NS = S.length - 1, secs = S.map(function (s) { return hullSectionDD(m, s); });
  const seamCol = S.map(function (s) { return seamS.some(function (q) { return Math.abs(q - s) < 1e-6; }); });
  const bootTop = sRGB(0x1a1d20), seam = sRGB(0x5f6a73), bottom2 = sRGB(0x5e1c17);
  seam.paint = 1;                                         // 스킨을 입혀도 정점 색 밝기만큼 은은하게 어둡게 남는다
  const WL0 = -0.08, WL1 = 0.22;
  // 아래 묶음(용골~너클, 둥근 면): 선저 3줄, 흘수선 띠, 옆면, 가로 이음선, 옆면
  const lowY = function (s) {
    const ky = s.keelY, w0 = Math.max(WL0, ky), w1 = Math.max(WL1, ky), m0 = w1 + (s.kY - w1) * 0.5;
    return [ky, ky + (w0 - ky) * 0.4, ky + (w0 - ky) * 0.75, w0, w1, m0, m0 + 0.03, s.kY];
  };
  const lowCol = [pal.bottom, bottom2, pal.bottom, bootTop, pal.hull, seam, pal.hull];
  // 위 묶음(너클~현측 끝, 곧은 판): 옆면, 가로 이음선, 옆면
  const upY = function (s) { const u0 = s.kY + (s.sheerY - s.kY) * 0.42; return [s.kY, u0, u0 + 0.03, s.sheerY]; };
  const upCol = [pal.hull, seam, pal.hull];
  // 격자 면을 만든다: 점은 단면×높이, 법선은 이웃 점으로 구해 한 묶음 안에서는 매끄럽게 이어진다
  function surface(ysOf, cols) {
    const G = secs.map(function (s) { return ysOf(s).map(function (y) { return ddSideAt(s, y); }); }), R = G[0].length;
    const N = G.map(function (col, i) {
      return col.map(function (p, r) {
        const A = G[Math.min(i + 1, NS)][r], B = G[Math.max(i - 1, 0)][r], C = col[Math.min(r + 1, R - 1)], D = col[Math.max(r - 1, 0)];
        const tx = A[0] - B[0], ty = A[1] - B[1], tz = A[2] - B[2], px = C[0] - D[0], py = C[1] - D[1], pz = C[2] - D[2];
        const nx = py * tz - pz * ty, ny = pz * tx - px * tz, nz = px * ty - py * tx, l = Math.sqrt(nx * nx + ny * ny + nz * nz);
        return l > 1e-7 ? [nx / l, ny / l, nz / l] : [1, 0, 0];
      });
    });
    const groups = new Map();
    for (let i = 0; i < NS; i++) {
      for (let r = 0; r < R - 1; r++) {
        let col = cols[r];
        if (seamCol[i] && col === pal.hull) col = seam;   // 세로 이음선은 회색 옆면에만
        if (!groups.has(col)) groups.set(col, { P: [], N: [] });
        const g = groups.get(col);
        for (const [ii, jj] of [[i, r], [i, r + 1], [i + 1, r], [i, r + 1], [i + 1, r + 1], [i + 1, r]]) {
          const p = G[ii][jj], n = N[ii][jj];
          g.P.push(p[0], p[1], p[2], -p[0], p[1], p[2]); g.N.push(n[0], n[1], n[2], -n[0], n[1], n[2]);
        }
      }
    }
    // 위에서 좌현·우현 점을 번갈아 넣었으므로 쪽별로 나눠 삼각형 순서를 맞춘다
    groups.forEach(function (g, col) {
      for (const side of [0, 1]) {
        const P = [], NN = [];
        for (let k = side * 3; k < g.P.length; k += 6) { P.push(g.P[k], g.P[k + 1], g.P[k + 2]); NN.push(g.N[k], g.N[k + 1], g.N[k + 2]); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(NN, 3));
        gb.add(geo, col);
      }
    });
    return G;
  }
  const GL = surface(lowY, lowCol), GU = surface(upY, upCol);
  // 외판 한 줄 (i0~NS 구간): 갑판 가장자리·안쪽 벽·갑판처럼 단순한 띠 (오른쪽·왼쪽 대칭)
  function strake(getA, getB, col, i0) {
    i0 = i0 || 0;
    const P = [], I = [], P2 = [], I2 = [];
    for (let i = i0; i <= NS; i++) {
      const a = getA(i), b = getB(i);
      P.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      P2.push(-a[0], a[1], a[2], -b[0], b[1], b[2]);
    }
    for (let i = 0; i < NS - i0; i++) {
      const a0 = i * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
      I.push(a0, b0, a1, b0, b1, a1);
      I2.push(a0, a1, b0, b0, a1, b1);
    }
    for (const [PP, II] of [[P, I], [P2, I2]]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(PP, 3)); g.setIndex(II); g.computeVertexNormals();
      gb.add(g, col);
    }
  }
  const SH = function (i) { return [secs[i].deckHB, secs[i].sheerY, secs[i].zG]; };
  strake(SH, function (i) { return [secs[i].inHB, secs[i].sheerY, secs[i].zG]; }, pal.dark);
  strake(function (i) { return [secs[i].inHB, secs[i].sheerY, secs[i].zG]; }, function (i) { return [secs[i].inHB, secs[i].deckY, secs[i].zG]; }, pal.hull2);
  strake(function (i) { return [secs[i].inHB, secs[i].deckY, secs[i].zG]; }, function (i) { return [0, secs[i].deckY, secs[i].zG]; }, pal.deck);
  // 앞갑판을 감싸는 높은 벽: 바깥면은 외판을 이어 올리고, 안쪽면과 윗면을 붙인다
  let i0 = 0; while (i0 < NS && ddBowWall(secs[i0 + 1].s) <= 0) i0++;
  const wTop = function (i) { const s = secs[i]; return [s.deckHB * 0.985, s.sheerY + ddBowWall(s.s), s.zG + 0.04 * ddBowWall(s.s)]; };
  const wIn = function (i) { const t = wTop(i); return [Math.max(t[0] - 0.09, 0), t[1], t[2]]; };
  strake(SH, wTop, pal.hull, i0);
  strake(wTop, wIn, pal.dark, i0);
  strake(wIn, function (i) { return [secs[i].inHB, secs[i].sheerY, secs[i].zG]; }, pal.hull2, i0);
  // 선미판: 같은 높이의 좌우 점을 잇는 사각형 띠로 채워 색 띠가 섞이지 않게 한다 (이음선 줄은 옆면 색)
  const tp = GL[0].concat(GU[0].slice(1)), tc = lowCol.concat(upCol).map(function (c) { return c === seam ? pal.hull : c; });
  for (let j = 0; j < tp.length - 1; j++) {
    const a = tp[j], b = tp[j + 1], g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([a[0], a[1], a[2], -a[0], a[1], a[2], b[0], b[1], b[2], -a[0], a[1], a[2], -b[0], b[1], b[2], b[0], b[1], b[2]], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
    gb.add(g, tc[j]);
  }
}

// 갑판·선미·물밑 디테일 (선체 지오메트리에 합친다 → 그리기 호출 수는 그대로)
function addDeckDetailsDD(gb, m, pal, white) {
  const sec = function (z) { return hullSectionDD(m, clamp((z + m.L * 0.5) / m.L, 0, 1)); };
  const steel = sRGB(0x8d969d), deckD = sRGB(0x30363b), bronze = sRGB(0x9a7436);
  // 쌍기둥 볼라드(계선주): 받침판 + 위가 살짝 넓은 기둥 둘. 갑판 가장자리 안쪽, 양쪽
  for (const z of [5.05, 1.0, -2.55, -6.05]) {
    const s = sec(z), y = s.deckY, x = s.inHB - 0.26;
    for (const sd of [1, -1]) {
      gb.box(0.22, 0.04, 0.4, sd * x, y + 0.02, z, deckD);
      gb.cyl(0.07, 0.055, 0.22, 6, sd * x, y + 0.13, z + 0.11, pal.dark);
      gb.cyl(0.07, 0.055, 0.22, 6, sd * x, y + 0.13, z - 0.11, pal.dark);
      // 현장(불워크)에 뚫린 줄 구멍(페어리드)
      gb.box(0.05, 0.13, 0.26, sd * (s.inHB + 0.01), s.sheerY - 0.1, z, pal.dark);
    }
  }
  // 버섯 모양 환기구
  for (const [x, z] of [[1.05, 2.45], [-1.05, 2.45], [1.65, -3.2], [-1.65, -3.2]]) {
    const y = sec(z).deckY;
    gb.cyl(0.07, 0.08, 0.26, 6, x, y + 0.13, z, pal.trim);
    gb.cyl(0.14, 0.12, 0.07, 6, x, y + 0.29, z, pal.dark);
  }
  // 갑판 해치: 테두리 + 뚜껑 + 손잡이
  for (const [x, z, w, d] of [[0, 2.42, 0.5, 0.36], [0, 5.05, 0.4, 0.32], [1.6, 0.25, 0.34, 0.5], [-1.6, 0.25, 0.34, 0.5]]) {
    const y = sec(z).deckY;
    gb.box(w + 0.08, 0.03, d + 0.08, x, y + 0.015, z, pal.dark);
    gb.box(w, 0.05, d, x, y + 0.04, z, pal.trim);
    gb.box(w * 0.5, 0.03, 0.04, x, y + 0.08, z - d * 0.3, steel);
  }
  // 뱃머리 끝 깃대(잭스태프)와 정박등
  { const s = hullSectionDD(m, 0.985), y = s.sheerY + ddBowWall(0.985); gb.rod(0, y - 0.05, s.zG - 0.05, 0, y + 0.75, s.zG + 0.05, 0.022, pal.rail, 4); gb.box(0.07, 0.07, 0.07, 0, y + 0.78, s.zG + 0.05, white); }
  // 닻줄 받침(체인 스토퍼)과 닻줄이 들어가는 구멍
  for (const sd of [1, -1]) { const z = 5.95, y = sec(z).deckY; gb.box(0.12, 0.08, 0.32, sd * 0.2, y + 0.04, z, steel); gb.cyl(0.07, 0.07, 0.03, 8, sd * 0.15, sec(6.22).deckY + 0.015, 6.22, pal.dark); }
  // 선미: 계류 갑판 개구부(어두운 구멍), 선미등, 양쪽 승선 사다리
  {
    const s = hullSectionDD(m, 0), z = s.zK - 0.016, top = s.deckY - 0.04;
    gb.box(2.5, 0.42, 0.02, 0, top - 0.21, z, pal.dark);                          // 개구부
    gb.box(2.6, 0.05, 0.03, 0, top + 0.01, z - 0.005, pal.hull2);                  // 개구부 위 턱
    gb.box(0.12, 0.08, 0.06, 0, s.sheerY + 0.06, z - 0.01, white);                // 선미등
    for (const sd of [1, -1]) {
      const x = sd * 1.6, y0 = 0.25, y1 = s.sheerY - 0.05;
      gb.rod(x - 0.11, y0, z - 0.04, x - 0.11, y1, z - 0.04, 0.018, steel, 4);
      gb.rod(x + 0.11, y0, z - 0.04, x + 0.11, y1, z - 0.04, 0.018, steel, 4);
      for (let k = 0; k < 5; k++) { const y = y0 + 0.08 + k * (y1 - y0 - 0.12) / 4; gb.rod(x - 0.11, y, z - 0.04, x + 0.11, y, z - 0.04, 0.014, steel, 3); }
    }
  }
  // 흘수 눈금(드래프트 마크): 뱃머리와 선미 외판의 흰 눈금
  for (const sd of [1, -1]) {
    for (const [z, k] of [[6.05, 0], [-6.55, 1]]) {
      for (let j = 0; j < 4; j++) { const y = 0.3 + j * 0.16; ddHullPlate(gb, m, sd, z, y, j % 2 ? 0.07 : 0.14, 0.035, white); }
      if (k) ddHullPlate(gb, m, sd, z + 0.12, 0.62, 0.035, 0.5, white);
    }
  }
  // 물밑: 용골 핀(스케그), 쌍 추진축·프로펠러·방향타
  {
    const s = sec(-4.5);
    gb.box(0.07, 0.3, 3.2, 0, s.keelY - 0.1, -4.6, pal.bottom);
    for (const sd of [1, -1]) {
      const x = sd * 0.62, yb = sec(-5.3).keelY * 0.75;
      gb.rod(x, yb + 0.15, -3.2, x, yb - 0.12, -6.0, 0.045, steel, 5);             // 추진축
      for (let b = 0; b < 3; b++) { const a = b * TAU / 3 + sd * 0.4; gb.box(0.05, 0.26, 0.09, x + Math.cos(a) * 0.13, yb - 0.12 + Math.sin(a) * 0.13, -6.0, bronze, 0, 0.5 * sd, a + Math.PI / 2); }
      gb.box(0.05, 0.5, 0.42, x, yb - 0.1, -6.45, pal.bottom);                     // 방향타
    }
  }
}
// 외판에 붙이는 얇은 판 (닻 자리·함번 숫자): 그 자리 외판 기울기에 맞춰 눕힌다. side: 1 좌현(+X), -1 우현
function ddHullPlate(gb, m, side, z, y, w, h, col, lift) {
  lift = lift || 0;
  // 외판은 뱃머리 쪽에서 앞으로 기울어 있으므로, 높이 yy에서 실제로 zz에 오는 단면을 몇 번 고쳐 찾는다
  const at = function (zz, yy) {
    let s = clamp((zz + m.L * 0.5) / m.L, 0, 1), p = null;
    for (let k = 0; k < 4; k++) { p = ddSideAt(hullSectionDD(m, s), yy); s = clamp(s - (p[2] - zz) / m.L, 0, 1); }
    return p[0];
  };
  const x = at(z, y), dxdy = (at(z, y + 0.05) - at(z, y - 0.05)) / 0.1, dxdz = (at(z + 0.1, y) - at(z - 0.1, y)) / 0.2;
  gb.box(0.025, h, w, side * (x + 0.012 + lift), y, z, col, 0, side * Math.atan(dxdz), -side * Math.atan(dxdy));
}
// 현측 함번 (7획 숫자). 바깥에서 볼 때 왼쪽에서 오른쪽으로 읽히게 쪽마다 방향을 바꾼다
const DD_SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd' };
function ddHullNumber(gb, m, text, zc, yc, col) {
  const W = 0.24, H = 0.42, T = 0.055, gap = 0.34;
  const seg = { a: [0, H / 2, W, T], d: [0, -H / 2, W, T], g: [0, 0, W, T], b: [W / 2, H / 4, T, H / 2], c: [W / 2, -H / 4, T, H / 2], f: [-W / 2, H / 4, T, H / 2], e: [-W / 2, -H / 4, T, H / 2] };
  for (const side of [1, -1]) {
    for (let k = 0; k < text.length; k++) {
      const uc = (k - (text.length - 1) / 2) * gap;
      for (const c of DD_SEG[text[k]]) {
        const sg = seg[c], u = uc + sg[0];
        ddHullPlate(gb, m, side, zc - side * u, yc + sg[1], sg[2], sg[3], col);
      }
    }
  }
}

function addHull(gb, m, pal) {
  const NS = 22, secs = [];
  for (let i = 0; i <= NS; i++) secs.push(hullSection(m, i / NS));
  // 외판 한 줄: 길이 방향으로는 부드럽게 잇고, 줄과 줄 사이는 각이 지게 한다
  function strake(getA, getB, col) {
    const P = [], I = [], P2 = [], I2 = [];
    for (let i = 0; i <= NS; i++) {
      const a = getA(secs[i]), b = getB(secs[i]);
      P.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      P2.push(-a[0], a[1], a[2], -b[0], b[1], b[2]);
    }
    for (let i = 0; i < NS; i++) {
      const a0 = i * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
      I.push(a0, b0, a1, b0, b1, a1);
      I2.push(a0, a1, b0, b0, a1, b1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    gb.add(g, col);
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g2.setIndex(I2); g2.computeVertexNormals();
    gb.add(g2, col);
  }
  strake(function (s) { return [0, s.keelY, s.zK]; }, function (s) { return [s.chineHB, s.chineY, s.zC]; }, pal.bottom);
  strake(function (s) { return [s.chineHB, s.chineY, s.zC]; }, function (s) { return [s.deckHB, s.sheerY, s.zG]; }, pal.hull);
  strake(function (s) { return [s.deckHB, s.sheerY, s.zG]; }, function (s) { return [s.inHB, s.sheerY, s.zG]; }, pal.dark);
  strake(function (s) { return [s.inHB, s.sheerY, s.zG]; }, function (s) { return [s.inHB, s.deckY, s.zG]; }, pal.hull2);
  strake(function (s) { return [s.inHB, s.deckY, s.zG]; }, function (s) { return [0, s.deckY, s.zG]; }, pal.deck);
  // 선미판
  const t = secs[0], oy = (t.keelY + t.deckY) * 0.5, z = t.zK;
  const out = [[0, t.keelY], [t.chineHB, t.chineY], [t.deckHB, t.sheerY], [t.inHB, t.sheerY], [t.inHB, t.deckY], [0, t.deckY]];
  const TP = [], TN = [];
  for (let j = 0; j < out.length - 1; j++) {
    const a = out[j], b = out[j + 1];
    TP.push(0, oy, z, b[0], b[1], z, a[0], a[1], z, 0, oy, z, -a[0], a[1], z, -b[0], b[1], z);
    for (let k = 0; k < 6; k++) TN.push(0, 0, -1);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(TP, 3));
  tg.setAttribute('normal', new THREE.Float32BufferAttribute(TN, 3));
  gb.add(tg, pal.hull);
  // 현측을 따라 두른 색 띠 (편 구분색)
  for (let i = 0; i < NS; i++) {
    const a = secs[i], b = secs[i + 1];
    gb.rod(a.deckHB + 0.03, a.sheerY - 0.10, a.zG, b.deckHB + 0.03, b.sheerY - 0.10, b.zG, 0.06, pal.trim, 6);
    gb.rod(-a.deckHB - 0.03, a.sheerY - 0.10, a.zG, -b.deckHB - 0.03, b.sheerY - 0.10, b.zG, 0.06, pal.trim, 6);
  }
}

// 갑판 가장자리를 따라 난간을 세운다
function addRails(gb, m, col, s0, s1, count, h, openBow) {
  let px = 0, py = 0, pz = 0, has = false, fx = 0, fy = 0, fz = 0;
  for (let i = 0; i <= count; i++) {
    const sec = hullSection(m, s0 + (s1 - s0) * i / count);
    const x = Math.max(sec.inHB - 0.04, 0.05), y = sec.sheerY, z = sec.zG;
    gb.rod(x, y, z, x, y + h, z, 0.028, col, 4);
    gb.rod(-x, y, z, -x, y + h, z, 0.028, col, 4);
    if (has) {
      gb.rod(px, py + h, pz, x, y + h, z, 0.024, col, 4);
      gb.rod(-px, py + h, pz, -x, y + h, z, 0.024, col, 4);
      gb.rod(px, py + h * 0.52, pz, x, y + h * 0.52, z, 0.014, col, 3);
      gb.rod(-px, py + h * 0.52, pz, -x, y + h * 0.52, z, 0.014, col, 3);
    } else { fx = x; fy = y; fz = z; }
    px = x; py = y; pz = z; has = true;
  }
  if (!openBow) gb.rod(-px, py + h, pz, px, py + h, pz, 0.024, col, 4);   // 뱃머리 쪽을 닫는다 (앞 현장이 있으면 열어 둔다)
  gb.rod(-fx, fy + h, fz, fx, fy + h, fz, 0.024, col, 4);   // 선미 쪽을 닫는다
}

function addFlag(gb, m, pal, h) {
  const z = -m.L * 0.5 + 0.25, y = deckYAt(m, z);
  gb.rod(0, y, z, 0, y + h, z - 0.22, 0.03, pal.rail, 5);
  gb.box(0.03, h * 0.27, h * 0.44, 0, y + h * 0.84, z - 0.2 - h * 0.24, pal.accent);
}

function addMG(gb, pal, shieldW) {
  gb.cyl(0.09, 0.12, 0.36, 8, 0, 0.18, 0, pal.gun);
  gb.box(0.24, 0.16, 0.42, 0, 0.42, 0.05, pal.gun);
  gb.box(0.11, 0.13, 0.8, 0, 0.52, 0.3, pal.dark);
  gb.cyl(0.028, 0.028, 1.0, 6, 0, 0.52, 1.15, pal.dark, Math.PI / 2);
  gb.box(0.2, 0.22, 0.3, -0.22, 0.45, 0.1, pal.dark);
  gb.box(shieldW, 0.5, 0.04, 0, 0.56, 0.5, pal.gun, -0.18);
}

function addTurret(tur, bar, pal, k) {
  tur.cyl(0.82 * k, 0.9 * k, 0.2 * k, 18, 0, 0.10 * k, 0, pal.gun);
  tur.wedge(1.55 * k, 0.78 * k, 1.9 * k, 0, 0.59 * k, -0.05 * k, pal.turret, 0.45 * k, 0.2 * k, 0.14);
  tur.box(0.62 * k, 0.5 * k, 0.34 * k, 0, 0.58 * k, 0.82 * k, pal.gun);
  tur.box(0.3 * k, 0.2 * k, 0.42 * k, 0.45 * k, 1.06 * k, 0.1 * k, pal.dark);
  tur.cyl(0.24 * k, 0.24 * k, 0.06 * k, 12, -0.32 * k, 1.0 * k, -0.35 * k, pal.dark);
  bar.cyl(0.15 * k, 0.17 * k, 0.9 * k, 10, 0, 0, 0.5 * k, pal.gun, Math.PI / 2);
  bar.cyl(0.09 * k, 0.10 * k, 3.0 * k, 10, 0, 0, 2.0 * k, pal.dark, Math.PI / 2);
  bar.cyl(0.14 * k, 0.14 * k, 0.34 * k, 10, 0, 0, 3.4 * k, pal.dark, Math.PI / 2);
}

// 내 배: 실사풍 소형 구축함. 앞에 포신 두 개짜리 함포 포탑, 그 뒤 수직 발사관(VLS), 각진 함교와 마스트,
// 함교 지붕의 근접방어포(기관총), 굴뚝, 뒷갑판의 상자형 미사일 발사대(돌아가며 조준)
function buildPlayerModel() {
  const m = MODELS.player, pal = PAL.player;
  const hull = new GeoBuilder(), cabin = new GeoBuilder(), tur = new GeoBuilder(), bar = new GeoBuilder(), mg = new GeoBuilder(), lch = new GeoBuilder();
  addHullDD(hull, m, pal);
  const zT = 3.75, dT = deckYAt(m, zT), zV = 1.5, dV = deckYAt(m, zV), zB = -1.0, dB = deckYAt(m, zB), zL = -5.1, dL = deckYAt(m, zL);
  const canvas = sRGB(0xd9d2bf), red = sRGB(0x8c2a22), white = sRGB(0xe9edf0);
  // 앞갑판: 포탑 받침, 양묘기와 닻줄, 계선주, 파도막이
  hull.cyl(0.98, 1.04, 0.24, 24, 0, dT + 0.12, zT, pal.gun);
  const dA = deckYAt(m, 5.5);
  hull.cyl(0.15, 0.15, 0.26, 10, 0.26, dA + 0.13, 5.5, pal.dark); hull.cyl(0.15, 0.15, 0.26, 10, -0.26, dA + 0.13, 5.5, pal.dark);
  hull.rod(0.26, dA + 0.05, 5.5, 0.16, deckYAt(m, 6.25) + 0.04, 6.25, 0.045, pal.dark, 5);
  hull.rod(-0.26, dA + 0.05, 5.5, -0.16, deckYAt(m, 6.25) + 0.04, 6.25, 0.045, pal.dark, 5);
  hull.rod(-0.9, dT + 0.05, zT - 1.25, 0, dT + 0.32, zT - 1.65, 0.05, pal.hull2, 4);
  // 수직 발사관 받침판 (덮개는 따로 움직이는 부품)
  hull.box(1.56, 0.1, 1.1, 0, dV + 0.05, zV, pal.dark);
  // 함체 옆 닻 자리 (뱃머리 양쪽 외판에 붙은 닻 받침과 닻)
  const steel = sRGB(0x9aa3aa);     // 스킨이 칠하지 않는 쇠 색
  for (const s of [1, -1]) {
    const sc = hullSectionDD(m, (5.6 + m.L * 0.5) / m.L), y = sc.kY + (sc.sheerY - sc.kY) * 0.45;
    ddHullPlate(hull, m, s, 5.6, y, 0.46, 0.4, pal.dark);                  // 움푹한 닻 자리
    ddHullPlate(hull, m, s, 5.6, y + 0.02, 0.06, 0.28, steel, 0.02);  // 닻 자루
    ddHullPlate(hull, m, s, 5.6, y - 0.12, 0.26, 0.06, steel, 0.02);  // 닻 팔
    ddHullPlate(hull, m, s, 5.6, y + 0.15, 0.14, 0.05, steel, 0.02);  // 닻 고리
  }
  // 현측 함번: VLS 옆 너클 위 외판 (상어 입 스킨의 눈·입 자리를 피해 뒤쪽에 둔다)
  { const sc = hullSectionDD(m, (2.2 + m.L * 0.5) / m.L); ddHullNumber(hull, m, '715', 2.2, sc.kY + (sc.sheerY - sc.kY) * 0.5, white); }
  addDeckDetailsDD(hull, m, pal, white);
  // 난간은 높은 앞 현장이 시작되는 곳까지 (그 앞은 벽이 막아 준다)
  addRails(hull, m, pal.rail, 0.02, 0.8, 12, 0.7, true);
  addFlag(hull, m, pal, 1.6);

  // 아래 상부구조물: 옆면이 안으로 기운 스텔스 상자
  cabin.wedge(2.7, 1.25, 3.6, 0, dB + 0.625, zB, pal.cabin, 0.35, 0.15, 0.10);
  // 함교: 앞으로 비스듬한 유리창 줄
  const bz = -1.2, bL = 2.1, bH = 0.85, by0 = dB + 1.25, rk = 0.45;
  cabin.wedge(2.3, bH, bL, 0, by0 + bH * 0.5, bz, pal.cabin, rk, 0.1, 0.12);
  const fz = bz + bL * 0.5, sl = Math.atan2(rk, bH);
  cabin.box(1.86, 0.3, 0.04, 0, by0 + bH * 0.62, fz - rk * 0.62 + 0.025, pal.glass, -sl);
  for (const s of [1, -1]) {
    cabin.box(0.04, 0.24, 1.3, s * 1.07, by0 + bH * 0.62, bz + 0.2, pal.glass, 0, 0, s * 0.16);
    cabin.box(0.5, 0.06, 0.5, s * 1.3, by0 + 0.03, bz + 0.6, pal.hull2);           // 함교 날개
  }
  cabin.box(2.1, 0.06, 1.6, 0, by0 + bH + 0.03, bz - 0.22, pal.roof);
  // 통합 마스트: 위로 좁아지는 피라미드에 평판 레이더 네 장
  const mz = -1.75, my0 = by0 + bH + 0.06, mH = 1.5;
  cabin.wedge(1.2, mH, 1.1, 0, my0 + mH * 0.5, mz, pal.cabin, 0.28, 0.28, 0.55);
  cabin.box(0.62, 0.55, 0.05, 0, my0 + 0.62, mz + 0.43, pal.dark, -0.18);
  cabin.box(0.62, 0.55, 0.05, 0, my0 + 0.62, mz - 0.43, pal.dark, 0.18);
  cabin.box(0.05, 0.55, 0.62, 0.42, my0 + 0.62, mz, pal.dark, 0, 0, 0.27);
  cabin.box(0.05, 0.55, 0.62, -0.42, my0 + 0.62, mz, pal.dark, 0, 0, -0.27);
  // 꼭대기는 낮게: 1인칭 시야를 가리지 않게 짧은 안테나와 작은 돔만
  cabin.rod(0, my0 + mH, mz, 0, my0 + mH + 0.35, mz, 0.04, pal.dark, 6);
  cabin.rod(-0.45, my0 + mH + 0.18, mz, 0.45, my0 + mH + 0.18, mz, 0.022, pal.dark, 4);
  cabin.cyl(0.1, 0.1, 0.12, 10, 0.42, my0 + mH + 0.24, mz, white); cabin.cyl(0.1, 0.1, 0.12, 10, -0.42, my0 + mH + 0.24, mz, white);
  cabin.box(0.07, 0.1, 0.16, 1.37, by0 + 0.12, bz + 0.6, sRGB(0xff3a22));
  cabin.box(0.07, 0.1, 0.16, -1.37, by0 + 0.12, bz + 0.6, sRGB(0x22ff66));
  // 굴뚝: 각진 스텔스 연돌과 검은 배기구
  const cz = -3.35, cd = deckYAt(m, cz);
  cabin.wedge(1.35, 1.75, 1.15, 0, cd + 0.875, cz, pal.cabin, 0.2, 0.3, 0.3);
  cabin.box(0.8, 0.08, 0.55, 0, cd + 1.78, cz - 0.1, pal.dark);
  // 구명정 통 (굴뚝 옆)
  for (const s of [1, -1]) { cabin.cyl(0.22, 0.22, 0.8, 12, s * 1.25, cd + 0.3, cz + 0.1, white, Math.PI / 2); cabin.cyl(0.23, 0.23, 0.08, 12, s * 1.25, cd + 0.3, cz + 0.1, pal.dark, Math.PI / 2); }

  // 근접방어포(기관총): 흰 돔과 개틀링 포신
  mg.cyl(0.3, 0.34, 0.26, 14, 0, 0.13, 0, pal.cabin);
  mg.box(0.5, 0.3, 0.46, 0, 0.42, -0.05, pal.cabin);
  mg.cyl(0.25, 0.25, 0.5, 14, 0, 0.82, -0.12, white);
  mg.add(new THREE.SphereGeometry(0.25, 14, 7, 0, TAU, 0, Math.PI / 2), white, new THREE.Matrix4().makeTranslation(0, 1.07, -0.12));
  mg.box(0.18, 0.18, 0.3, 0, 0.55, 0.28, pal.dark);
  mg.cyl(0.08, 0.08, 0.9, 8, 0, 0.55, 0.78, pal.dark, Math.PI / 2);
  mg.cyl(0.1, 0.1, 0.1, 8, 0, 0.55, 1.2, pal.dark, Math.PI / 2);

  // 함포 포탑: 앞면이 비스듬한 장갑 포탑, 포신 두 개(포신 덮개 천 포함)
  tur.wedge(1.85, 0.82, 2.15, 0, 0.47, -0.25, pal.turret, 0.38, 0.12, 0.14);
  tur.box(1.5, 0.06, 1.2, 0, 0.9, -0.45, pal.hull2);
  for (const s of [1, -1]) tur.box(0.34, 0.16, 0.36, s * 0.72, 0.78, -0.95, pal.dark);     // 포탑 위 관측창
  tur.box(0.2, 0.2, 0.3, 0, 0.88, -1.05, pal.dark);
  for (const s of [1, -1]) {
    bar.cyl(0.19, 0.21, 0.46, 12, s * 0.3, 0, 0.5, canvas, Math.PI / 2);
    bar.cyl(0.11, 0.085, 3.0, 12, s * 0.3, 0, 2.2, pal.gun, Math.PI / 2);
    bar.cyl(0.12, 0.12, 0.24, 12, s * 0.3, 0, 3.62, pal.gun, Math.PI / 2);
    bar.cyl(0.07, 0.07, 0.05, 10, s * 0.3, 0, 3.75, pal.dark, Math.PI / 2);
  }

  // 상자형 미사일 발사대: 돌아가는 받침 위에 6구 발사관 두 개를 비스듬히
  const ang = 0.7, ca = Math.cos(ang), sa = Math.sin(ang);
  lch.cyl(0.62, 0.68, 0.22, 18, 0, 0.11, 0, pal.gun);
  lch.box(1.0, 0.4, 0.9, 0, 0.42, -0.1, pal.hull2);
  lch.rod(0, 0.55, -0.35, 0, 0.95, 0.25, 0.09, pal.dark, 6);
  const tubes = [];
  for (const s of [1, -1]) {
    const px = s * 0.37, py = 0.86, pz = 0.05;
    lch.box(0.68, 0.6, 1.8, px, py, pz, pal.cabin, -ang);
    lch.box(0.7, 0.08, 1.82, px, py + 0.32 * ca, pz - 0.32 * sa, pal.hull2, -ang);
    const fx = px, fy = py + 0.9 * sa, fzz = pz + 0.9 * ca;
    lch.box(0.7, 0.62, 0.05, fx, fy, fzz, pal.dark, -ang);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const u = (c - 1) * 0.21, v = (r - 0.5) * 0.27;
      const tx = fx + u, ty = fy + v * ca + 0.02 * sa, tz = fzz - v * sa + 0.02 * ca;
      lch.cyl(0.085, 0.085, 0.05, 10, tx, ty, tz, red, Math.PI / 2 - ang);
      tubes.push(new THREE.Vector3(tx, ty + 0.03 * sa, tz + 0.03 * ca));
    }
  }

  return {
    hullGeo: hull.build(), cabinGeo: cabin.build(), turretGeo: tur.build(), barrelGeo: bar.build(), mgGeo: mg.build(), radarGeo: null,
    turretPos: new THREE.Vector3(0, dT + 0.24, zT), barrelPos: new THREE.Vector3(0, 0.5, 0.62), muzzleZ: 3.8, twin: 0.3,
    mgPos: new THREE.Vector3(0, by0 + bH + 0.06, bz + 0.45), mgMuzzle: new THREE.Vector3(0, 0.55, 1.25),
    radarPos: new THREE.Vector3(0, my0 + mH + 1.0, mz), eyePos: new THREE.Vector3(0, by0 + bH + 0.32, fz - 0.05),
    launcherGeo: lch.build(), launcherPos: new THREE.Vector3(0, dL, zL), launcherTubes: tubes, launcherDir: new THREE.Vector3(0, sa, ca),
    vlsPos: new THREE.Vector3(0, dV + 0.1, zV)
  };
}

function buildFastModel(kind) {
  kind = kind || 'fast';
  const m = MODELS[kind], pal = PAL[kind];
  const hull = new GeoBuilder(), mg = new GeoBuilder();
  addHull(hull, m, pal);
  const dC = deckYAt(m, -0.9), dG = deckYAt(m, 2.1);
  // 낮고 납작한 조종실
  hull.wedge(1.9, 0.95, 2.6, 0, dC + 0.475, -0.9, pal.cabin, 0.95, 0.15, 0.12);
  hull.box(1.55, 0.72, 0.04, 0, dC + 0.60, -0.15, pal.glass, -0.7854);
  hull.box(1.7, 0.07, 1.55, 0, dC + 0.97, -1.45, pal.roof);
  hull.box(0.03, 0.16, 2.0, 0.9, dC + 0.42, -1.1, pal.accent);
  hull.box(0.03, 0.16, 2.0, -0.9, dC + 0.42, -1.1, pal.accent);
  // 롤바, 레이더 돔, 안테나
  hull.rod(0.8, dC + 0.2, -2.5, 0.72, dC + 1.75, -2.75, 0.045, pal.dark, 5);
  hull.rod(-0.8, dC + 0.2, -2.5, -0.72, dC + 1.75, -2.75, 0.045, pal.dark, 5);
  hull.rod(-0.72, dC + 1.75, -2.75, 0.72, dC + 1.75, -2.75, 0.045, pal.dark, 5);
  _bm.makeTranslation(0, dC + 1.95, -2.75);
  hull.add(new THREE.SphereGeometry(0.2, 10, 8), pal.rail, _bm);
  hull.rod(0.6, dC + 1.75, -2.75, 0.75, dC + 3.6, -3.1, 0.018, pal.rail, 4);
  // 선외기 두 대
  hull.box(0.44, 0.9, 0.6, 0.55, 0.3, -5.55, pal.dark);
  hull.box(0.44, 0.9, 0.6, -0.55, 0.3, -5.55, pal.dark);
  hull.box(0.46, 0.22, 0.62, 0.55, 0.8, -5.55, pal.accent);
  hull.box(0.46, 0.22, 0.62, -0.55, 0.8, -5.55, pal.accent);
  hull.cyl(0.5, 0.55, 0.1, 14, 0, dG + 0.05, 2.1, pal.gun);
  if (kind === 'misboat') {
    // 미사일 고속정: 뒷갑판에 비스듬히 세운 발사관 두 개 (노란 띠)
    const dL = deckYAt(m, -3.4);
    for (let sd = -1; sd <= 1; sd += 2) {
      hull.box(0.62, 0.62, 2.6, sd * 0.62, dL + 0.75, -3.4, pal.gun, -0.32);
      hull.box(0.64, 0.64, 0.12, sd * 0.62, dL + 1.18, -2.18, pal.accent, -0.32);
      hull.box(0.1, 0.7, 0.1, sd * 0.62, dL + 0.3, -4.2, pal.dark);
    }
  }
  addRails(hull, m, pal.rail, 0.62, 0.93, 4, 0.5);
  addFlag(hull, m, pal, 1.3);
  addMG(mg, pal, 1.0);
  return {
    hullGeo: hull.build(), cabinGeo: null, turretGeo: null, barrelGeo: null, mgGeo: mg.build(), radarGeo: null,
    turretPos: null, barrelPos: null, muzzleZ: 0,
    mgPos: new THREE.Vector3(0, dG + 0.10, 2.1), mgMuzzle: new THREE.Vector3(0, 0.52, 1.68), radarPos: null, eyePos: null
  };
}

function buildGunboatModel(kind) {
  kind = kind || 'gunboat';
  const m = MODELS[kind], pal = PAL[kind], layer = kind === 'minelayer';
  const hull = new GeoBuilder(), tur = new GeoBuilder(), bar = new GeoBuilder(), mg = new GeoBuilder(), radar = new GeoBuilder();
  addHull(hull, m, pal);
  const dH = deckYAt(m, -1.4), dT = deckYAt(m, 5.4), dA = deckYAt(m, -7.6);
  // 갑판실과 그 위의 함교
  hull.wedge(3.7, 1.5, 6.6, 0, dH + 0.75, -1.4, pal.cabin, 0.5, 0.3, 0.06);
  for (let k = 0; k < 5; k++) {
    hull.box(0.04, 0.3, 0.42, 1.8, dH + 0.95, -3.7 + k * 1.15, pal.glass);
    hull.box(0.04, 0.3, 0.42, -1.8, dH + 0.95, -3.7 + k * 1.15, pal.glass);
  }
  hull.wedge(3.1, 1.35, 2.8, 0, dH + 2.175, 0.3, pal.cabin, 0.55, 0.2, 0.10);
  hull.box(2.6, 0.5, 0.05, 0, dH + 2.375, 1.375, pal.glass, -0.387);
  hull.box(0.05, 0.48, 2.0, 1.45, dH + 2.375, 0.15, pal.glass);
  hull.box(0.05, 0.48, 2.0, -1.45, dH + 2.375, 0.15, pal.glass);
  hull.box(3.2, 0.09, 2.5, 0, dH + 2.9, 0.15, pal.roof);
  hull.box(3.5, 0.22, 0.03, 0, dH + 1.3, 1.49, pal.accent, -0.32);
  // 굴뚝: 편 구분색 띠를 두른다
  hull.cyl(0.5, 0.62, 1.9, 14, 0, dH + 2.45, -2.9, pal.cabin, -0.1);
  hull.cyl(0.54, 0.57, 0.32, 14, 0, dH + 3.05, -2.96, pal.accent, -0.1);
  hull.cyl(0.4, 0.5, 0.12, 14, 0, dH + 3.42, -3.0, pal.dark, -0.1);
  // 마스트, 안테나
  hull.rod(0, dH + 2.94, -0.7, 0, dH + 5.6, -1.05, 0.08, pal.dark, 6);
  hull.rod(-1.3, dH + 4.7, -0.94, 1.3, dH + 4.7, -0.94, 0.035, pal.dark, 4);
  hull.rod(-0.8, dH + 5.2, -1.0, 0.8, dH + 5.2, -1.0, 0.03, pal.dark, 4);
  hull.box(0.16, 0.12, 0.5, 0, dH + 4.02, -0.62, pal.dark);
  hull.rod(1.2, dH + 2.94, -0.9, 1.4, dH + 6.2, -1.6, 0.022, pal.rail, 4);
  hull.rod(-1.2, dH + 2.94, -0.9, -1.4, dH + 6.2, -1.6, 0.022, pal.rail, 4);
  // 포대, 구명정 통, 뒷갑판
  hull.cyl(1.4, 1.5, 0.3, 20, 0, dT + 0.15, 5.4, pal.gun);
  for (let k = 0; k < 2; k++) {
    hull.cyl(0.3, 0.3, 1.0, 10, 2.15, dH + 0.45, -5.4 - k * 1.3, pal.rail, Math.PI / 2);
    hull.cyl(0.3, 0.3, 1.0, 10, -2.15, dH + 0.45, -5.4 - k * 1.3, pal.rail, Math.PI / 2);
  }
  hull.box(1.2, 0.6, 1.0, 0, dA + 0.3, -7.6, pal.dark);
  hull.box(0.5, 0.35, 0.5, 0, deckYAt(m, 8.3) + 0.17, 8.3, pal.gun);
  if (layer) {
    // 기뢰 부설함: 뒷갑판 양쪽에 기뢰를 줄지어 실은 레일
    const dR = deckYAt(m, -5.5);
    for (let sd = -1; sd <= 1; sd += 2) {
      hull.box(0.12, 0.12, 6.0, sd * 1.7, dR + 0.1, -5.6, pal.rail);
      for (let k = 0; k < 4; k++) {
        _bm.makeTranslation(sd * 1.7, dR + 0.6, -3.4 - k * 1.45);
        hull.add(new THREE.SphereGeometry(0.5, 10, 8), pal.dark, _bm);
        hull.box(0.14, 0.14, 0.14, sd * 1.7, dR + 1.15, -3.4 - k * 1.45, pal.accent);
      }
    }
  }
  addRails(hull, m, pal.rail, 0.02, 0.93, 16, 0.85);
  addFlag(hull, m, pal, 2.0);
  addMG(mg, pal, 0.9);
  if (!layer) addTurret(tur, bar, pal, 1.3);
  radar.box(2.0, 0.16, 0.26, 0, 0, 0, pal.rail);
  radar.box(0.24, 0.24, 0.24, 0, -0.12, 0, pal.dark);
  return {
    hullGeo: hull.build(), cabinGeo: null, turretGeo: layer ? null : tur.build(), barrelGeo: layer ? null : bar.build(), mgGeo: mg.build(), radarGeo: radar.build(),
    turretPos: new THREE.Vector3(0, dT + 0.30, 5.4), barrelPos: new THREE.Vector3(0, 0.78, 1.04), muzzleZ: 4.68,
    mgPos: new THREE.Vector3(0, dH + 2.945, 0.9), mgMuzzle: new THREE.Vector3(0, 0.52, 1.68),
    radarPos: new THREE.Vector3(0, dH + 4.2, -0.5), eyePos: null
  };
}

function buildBossModel() {
  const m = MODELS.boss, pal = PAL.boss;
  const hull = new GeoBuilder(), tur = new GeoBuilder(), bar = new GeoBuilder(), mg = new GeoBuilder(), radar = new GeoBuilder();
  addHull(hull, m, pal);
  const dH = deckYAt(m, -2.5), dF = deckYAt(m, 10.5), dA = deckYAt(m, -13);
  // 갑판실 3단과 함교
  hull.wedge(6.6, 2.4, 13, 0, dH + 1.2, -2.5, pal.cabin, 0.5, 0.4, 0.05);
  for (let k = 0; k < 8; k++) {
    hull.box(0.05, 0.45, 0.6, 3.25, dH + 1.5, -8 + k * 1.6, pal.glass);
    hull.box(0.05, 0.45, 0.6, -3.25, dH + 1.5, -8 + k * 1.6, pal.glass);
  }
  hull.wedge(5.4, 2.0, 7.5, 0, dH + 3.4, -0.6, pal.cabin, 0.6, 0.3, 0.08);
  hull.wedge(4.6, 1.7, 3.6, 0, dH + 5.25, 1.4, pal.cabin, 0.7, 0.2, 0.1);
  hull.box(4.0, 0.6, 0.06, 0, dH + 5.45, 3.15, pal.glass, -0.35);
  hull.box(0.06, 0.55, 2.6, 2.15, dH + 5.45, 1.2, pal.glass);
  hull.box(0.06, 0.55, 2.6, -2.15, dH + 5.45, 1.2, pal.glass);
  hull.box(4.8, 0.12, 3.4, 0, dH + 6.15, 1.2, pal.roof);
  hull.box(6.65, 0.35, 0.04, 0, dH + 2.05, 3.97, pal.accent, -0.2);
  // 굴뚝 2개 (붉은 띠)
  for (let k = 0; k < 2; k++) {
    const z = -4.6 - k * 3.6;
    hull.cyl(0.85, 1.05, 3.2, 16, 0, dH + 3.9, z, pal.cabin, -0.12);
    hull.cyl(0.9, 0.95, 0.45, 16, 0, dH + 4.85, z - 0.12, pal.accent, -0.12);
    hull.cyl(0.7, 0.85, 0.16, 16, 0, dH + 5.5, z - 0.2, pal.dark, -0.12);
  }
  // 삼각 마스트, 안테나, 신호기
  hull.rod(0, dH + 6.2, 0.2, 0, dH + 11.5, -0.6, 0.13, pal.dark, 6);
  hull.rod(1.6, dH + 6.2, -0.6, 0, dH + 9.5, -0.5, 0.08, pal.dark, 5);
  hull.rod(-1.6, dH + 6.2, -0.6, 0, dH + 9.5, -0.5, 0.08, pal.dark, 5);
  hull.rod(-2.2, dH + 9.6, -0.5, 2.2, dH + 9.6, -0.5, 0.05, pal.dark, 4);
  hull.rod(-1.4, dH + 10.6, -0.55, 1.4, dH + 10.6, -0.55, 0.04, pal.dark, 4);
  hull.rod(1.8, dH + 6.2, -0.3, 2.1, dH + 12.5, -1.2, 0.03, pal.rail, 4);
  hull.rod(-1.8, dH + 6.2, -0.3, -2.1, dH + 12.5, -1.2, 0.03, pal.rail, 4);
  // 포대 받침 2개, 측면 기관총좌, 구명정, 함수 장비
  hull.cyl(2.0, 2.2, 0.4, 22, 0, dF + 0.2, 10.5, pal.gun);
  hull.cyl(2.0, 2.2, 0.4, 22, 0, dA + 0.2, -13, pal.gun);
  for (let k = 0; k < 2; k++) {
    const sd = k ? 1 : -1;
    hull.cyl(0.55, 0.6, 0.5, 12, sd * 3.6, dH + 2.65, -1.5, pal.gun);
    hull.box(0.25, 0.25, 1.4, sd * 3.6, dH + 3.05, -0.9, pal.dark);
    for (let j = 0; j < 3; j++) hull.cyl(0.42, 0.42, 1.5, 10, sd * 3.85, dH + 0.6, -6.5 - j * 2.0, pal.rail, Math.PI / 2);
  }
  hull.box(1.0, 0.5, 0.8, 0, deckYAt(m, 15.5) + 0.25, 15.5, pal.gun);
  addRails(hull, m, pal.rail, 0.02, 0.94, 26, 1.0);
  addFlag(hull, m, pal, 3.0);
  addMG(mg, pal, 1.2);
  addTurret(tur, bar, pal, 1.75);
  radar.box(3.0, 0.22, 0.4, 0, 0, 0, pal.rail);
  radar.box(0.35, 0.35, 0.35, 0, -0.18, 0, pal.dark);
  return {
    hullGeo: hull.build(), cabinGeo: null, turretGeo: tur.build(), barrelGeo: bar.build(), mgGeo: mg.build(), radarGeo: radar.build(),
    turretPos: new THREE.Vector3(0, dF + 0.4, 10.5), turret2Pos: new THREE.Vector3(0, dA + 0.4, -13), barrelPos: new THREE.Vector3(0, 1.05, 1.4), muzzleZ: 6.3,
    mgPos: new THREE.Vector3(0, dH + 6.21, 2.2), mgMuzzle: new THREE.Vector3(0, 0.52, 1.68),
    radarPos: new THREE.Vector3(0, dH + 8.4, -0.5), eyePos: null
  };
}

const TEMPLATES = { player: null, fast: null, gunboat: null, boss: null };
let boatMat = null, wreckMat = null;
// 배 재질은 안개를 약하게 받는다: 바다·하늘은 아련하게 두고 배만 또렷하게
function thinFog(mat) {
  mat.onBeforeCompile = function (sh) {
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>',
      THREE.ShaderChunk.fog_fragment.replace('gl_FragColor.rgb = mix(', 'fogFactor *= uBoatFog;\n\tgl_FragColor.rgb = mix('));
    sh.uniforms.uBoatFog = uBoatFog;
    sh.fragmentShader = 'uniform float uBoatFog;\n' + sh.fragmentShader;
  };
  return mat;
}

// 잠수함: 길고 낮은 선체에 함교탑(세일), 잠망경
function buildSubModel() {
  const m = MODELS.sub, pal = PAL.sub;
  const hull = new GeoBuilder(), mg = new GeoBuilder();
  addHull(hull, m, pal);
  const d0 = deckYAt(m, 1.5);
  // 둥근 등판
  hull.cyl(1.55, 1.55, 17, 18, 0, d0 - 0.35, -1.2, pal.hull, Math.PI / 2);
  hull.wedge(1.7, 2.6, 4.6, 0, d0 + 1.6, 2.2, pal.cabin, 0.35, 0.25, 0.2);
  hull.box(3.6, 0.12, 0.9, 0, d0 + 2.2, 2.6, pal.cabin);
  hull.box(1.72, 0.18, 4.0, 0, d0 + 2.0, 2.0, pal.accent);
  hull.rod(0, d0 + 2.9, 2.6, 0, d0 + 4.6, 2.6, 0.09, pal.dark, 6);
  hull.rod(0.35, d0 + 2.9, 1.8, 0.35, d0 + 4.0, 1.8, 0.06, pal.dark, 5);
  hull.box(0.16, 1.6, 1.6, 0, d0 - 0.2, -10.5, pal.dark);
  hull.box(3.0, 0.12, 0.9, 0, d0 - 0.4, -10.4, pal.dark);
  addMG(mg, pal, 0.4);
  return {
    hullGeo: hull.build(), cabinGeo: null, turretGeo: null, barrelGeo: null, mgGeo: mg.build(), radarGeo: null,
    turretPos: null, barrelPos: null, muzzleZ: 0,
    mgPos: new THREE.Vector3(0, d0 + 2.3, 2.0), mgMuzzle: new THREE.Vector3(0, 0.3, 0.9), radarPos: null, eyePos: null
  };
}

// 보급선(호위 웨이브): 긴 화물선. 갑판에 컨테이너, 선미에 흰 선교
function buildSupplyModel() {
  const m = MODELS.supply, pal = PAL.supply;
  const hull = new GeoBuilder(), cabin = new GeoBuilder(), mg = new GeoBuilder();
  addHull(hull, m, pal);
  const cols = [sRGB(0xc8462e), sRGB(0x2f6fb0), sRGB(0xd9a02b), sRGB(0x3f8f56), sRGB(0x8a8f96)];
  let ci = 0;
  for (let z = -4; z <= 10; z += 2.8) {
    const y = deckYAt(m, z);
    for (let x = -2; x <= 2; x += 2) for (let h = 0; h < 2; h++) hull.box(1.9, 1.25, 2.6, x, y + 0.63 + h * 1.27, z, cols[(ci++ * 7 + h * 3) % cols.length]);
  }
  const zb = -11, yb = deckYAt(m, zb);
  cabin.box(6.2, 3.2, 4.2, 0, yb + 1.6, zb, pal.cabin);
  cabin.box(6.6, 1.2, 4.6, 0, yb + 3.8, zb + 0.2, pal.cabin);
  cabin.box(6.0, 0.4, 0.05, 0, yb + 3.9, zb + 2.5, pal.glass);
  cabin.box(1.2, 2.4, 1.2, 0, yb + 5.6, zb - 1, pal.accent);
  cabin.rod(0, yb + 4.4, zb + 1.2, 0, yb + 7.2, zb + 1.2, 0.08, pal.dark, 5);
  addRails(hull, m, pal.rail, 0.02, 0.95, 16, 0.8);
  addMG(mg, pal, 0.4);
  return {
    hullGeo: hull.build(), cabinGeo: cabin.build(), turretGeo: null, barrelGeo: null, mgGeo: mg.build(), radarGeo: null,
    turretPos: null, barrelPos: null, muzzleZ: 0, mgPos: new THREE.Vector3(0, yb + 4.4, zb), mgMuzzle: new THREE.Vector3(0, 0.5, 1), radarPos: null, eyePos: null
  };
}

let playerMat = null;
function initBoatAssets() {
  boatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide });
  thinFog(boatMat);
  wreckMat = thinFog(new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(0.17, 0.15, 0.14), roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
  TEMPLATES.player = buildPlayerModel();
  TEMPLATES.fast = buildFastModel();
  TEMPLATES.gunboat = buildGunboatModel();
  TEMPLATES.boss = buildBossModel();
  TEMPLATES.misboat = buildFastModel('misboat');
  TEMPLATES.minelayer = buildGunboatModel('minelayer');
  TEMPLATES.sub = buildSubModel();
  TEMPLATES.supply = buildSupplyModel();
  playerMat = skinMaterial();
}

/* ==========================================================================
 * 보트 물리 수치 — CONFIG에서 끌어와 저항 계수 등을 미리 계산한다
 * 전진 방향 가속 = 추력 - 선형 저항*속도 - 제곱 저항*속도², 최고 속도에서 0이 되도록 제곱 저항을 정한다
 * ========================================================================== */
function makeSpec(c) {
  const s = Object.assign({}, c);
  s.dragQuad = (c.accel - c.dragLinear * c.maxSpeed) / (c.maxSpeed * c.maxSpeed);
  s.reverseThrust = c.dragLinear * c.reverseSpeed + s.dragQuad * c.reverseSpeed * c.reverseSpeed;
  const vb = c.maxSpeed * CONFIG.boost.speedMul;
  s.boostThrust = c.dragLinear * vb + s.dragQuad * vb * vb;
  return s;
}
const SPECS = { player: makeSpec(CONFIG.player), fast: makeSpec(CONFIG.enemy.fast), gunboat: makeSpec(CONFIG.enemy.gunboat), boss: makeSpec(CONFIG.enemy.boss),
  misboat: makeSpec(CONFIG.enemy.misboat), minelayer: makeSpec(CONFIG.enemy.minelayer), sub: makeSpec(CONFIG.enemy.sub),
  supply: makeSpec({ health: 400, maxSpeed: 10, reverseSpeed: 3, accel: 3, brake: 3, dragLinear: 0.10, throttleResponse: 1.0, turnRate: 0.35, turnRefSpeed: 6, yawResponse: 1.0,
    sideGrip: 5.5, turnDrag: 0.12, bankAngle: 0.05, bowLift: 0.02, turretSlew: 1, sprayRate: 160 }) };
// 격노한 기함: 더 빠르고, 미사일을 더 자주 더 많이, 함포도 더 자주 쏜다
SPECS.bossRage = (function () {
  const B = CONFIG.enemy.boss, R = B.rage;
  return makeSpec(Object.assign({}, B, { maxSpeed: B.maxSpeed * R.speedMul, missileEvery: [B.missileEvery[0] * R.missileMul, B.missileEvery[1] * R.missileMul], missileSalvo: R.salvo, cannonReload: B.cannonReload * R.reloadMul }));
})();

/* ==========================================================================
 * 보트 — 플레이어와 적이 같은 물리, 같은 물 효과를 쓴다
 * heading: 뱃머리 방향 (sin, cos) = (x, z). 값이 커지면 좌회전
 * ========================================================================== */
let player = null;
const enemies = [];                           // 이번 웨이브에 나와 있는 적 (가라앉는 중인 것 포함)
const boatPool = { fast: [], gunboat: [], boss: [], misboat: [], minelayer: [], sub: [], supply: [] };   // 다 쓴 적 보트를 넣어 두었다가 다음 웨이브에 다시 쓴다

// 항해등 하나: 멀리서도 보이게 빛 번짐 그림을 쓴다 (안개를 받지 않음)
let navTex = null;
function navLamp(x, y, z, hex) {
  if (!navTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const c = cv.getContext('2d'), g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)'); g.addColorStop(0.6, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
    navTex = new THREE.CanvasTexture(cv);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: navTex, color: hex, depthWrite: false, transparent: true, fog: false, toneMapped: false }));
  s.position.set(x, y, z); s.scale.set(1.8, 1.8, 1); s.renderOrder = 20;
  return s;
}
// 배경이 바뀌면 모든 배의 항해등을 켜고 끈다
function envBoats(E) {
  const on = !!E.nav, set = (b) => { if (b && b.nav) b.nav.visible = on; };
  set(player);
  for (let i = 0; i < enemies.length; i++) set(enemies[i]);
  for (const k in boatPool) for (let i = 0; i < boatPool[k].length; i++) set(boatPool[k][i]);
  if (typeof allies !== 'undefined') for (let i = 0; i < allies.length; i++) set(allies[i]);
}

function Boat(kind) {
  const T = TEMPLATES[kind];
  this.kind = kind; this.isPlayer = kind === 'player';
  this.M0 = MODELS[kind]; this.M = Object.assign({}, this.M0); this.vs = 1;     // M: 지금 크기 배율(vs)을 곱한 치수 (멀리 있는 적은 커 보이게)
  this.tpl = T; this.S = SPECS[kind];
  this.meshes = [];
  const root = this.root = new THREE.Group();
  root.rotation.order = 'YXZ';
  this.hull = new THREE.Mesh(T.hullGeo, boatMat); root.add(this.hull); this.meshes.push(this.hull);
  this.cabin = null;
  if (T.cabinGeo) { this.cabin = new THREE.Mesh(T.cabinGeo, boatMat); root.add(this.cabin); this.meshes.push(this.cabin); }
  this.turretPivot = null; this.barrelPivot = null; this.barrel = null; this.muzzle = null;
  if (T.turretGeo) {
    this.turretPivot = new THREE.Group(); this.turretPivot.position.copy(T.turretPos); root.add(this.turretPivot);
    const tm = new THREE.Mesh(T.turretGeo, boatMat); this.turretPivot.add(tm); this.meshes.push(tm);
    this.barrelPivot = new THREE.Group(); this.barrelPivot.position.copy(T.barrelPos); this.turretPivot.add(this.barrelPivot);
    this.barrel = new THREE.Mesh(T.barrelGeo, boatMat); this.barrelPivot.add(this.barrel); this.meshes.push(this.barrel);
    this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0, T.muzzleZ); this.barrelPivot.add(this.muzzle);
  }
  // 보스의 뒤쪽 포탑
  this.turretPivot2 = null; this.barrelPivot2 = null; this.barrel2 = null; this.muzzle2 = null;
  if (T.turret2Pos) {
    this.turretPivot2 = new THREE.Group(); this.turretPivot2.position.copy(T.turret2Pos); root.add(this.turretPivot2);
    const tm2 = new THREE.Mesh(T.turretGeo, boatMat); this.turretPivot2.add(tm2); this.meshes.push(tm2);
    this.barrelPivot2 = new THREE.Group(); this.barrelPivot2.position.copy(T.barrelPos); this.turretPivot2.add(this.barrelPivot2);
    this.barrel2 = new THREE.Mesh(T.barrelGeo, boatMat); this.barrelPivot2.add(this.barrel2); this.meshes.push(this.barrel2);
    this.muzzle2 = new THREE.Object3D(); this.muzzle2.position.set(0, 0, T.muzzleZ); this.barrelPivot2.add(this.muzzle2);
  }
  this.turretYaw2 = Math.PI; this.turretErr2 = 0;
  this.mgPivot = new THREE.Group(); this.mgPivot.position.copy(T.mgPos); root.add(this.mgPivot);
  this.mgMesh = new THREE.Mesh(T.mgGeo, boatMat); this.mgPivot.add(this.mgMesh); this.meshes.push(this.mgMesh);
  this.mgMuzzle = new THREE.Object3D(); this.mgMuzzle.position.copy(T.mgMuzzle); this.mgPivot.add(this.mgMuzzle);
  // 내 배: 돌아가는 상자형 미사일 발사대와 수직 발사관 덮개
  this.launcher = null; this.launchYaw = 0; this.tubeI = 0; this.vls = null;
  if (T.launcherGeo) {
    this.launcher = new THREE.Group(); this.launcher.position.copy(T.launcherPos); root.add(this.launcher);
    const lm = new THREE.Mesh(T.launcherGeo, boatMat); this.launcher.add(lm); this.meshes.push(lm);
  }
  if (T.vlsPos) {
    this.vls = new THREE.Group(); this.vls.position.copy(T.vlsPos); root.add(this.vls);
    this.vlsCells = [];
    const hg = new GeoBuilder().box(0.3, 0.05, 0.4, 0, 0.025, 0.2, PAL.player.hull2).box(0.22, 0.012, 0.3, 0, 0.056, 0.2, PAL.player.dark).build();       // 덮개: 뒤쪽 경첩을 축으로 열린다
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const pv = new THREE.Group(); pv.position.set((c - 1.5) * 0.36, 0, (r - 0.5) * 0.5 - 0.2); this.vls.add(pv);
      const hm = new THREE.Mesh(hg, boatMat); pv.add(hm); this.meshes.push(hm);
      this.vlsCells.push({ pv: pv, open: 0, t: 0 });
    }
  }
  this.radar = null;
  if (T.radarGeo) { this.radar = new THREE.Mesh(T.radarGeo, boatMat); this.radar.position.copy(T.radarPos); root.add(this.radar); this.meshes.push(this.radar); }
  this.eye = null;
  if (T.eyePos) { this.eye = new THREE.Object3D(); this.eye.position.copy(T.eyePos); root.add(this.eye); }
  // 밤에만 켜는 항해등: 왼쪽 빨강, 오른쪽 초록, 돛대 꼭대기 흰색
  this.nav = new THREE.Group();
  const M = this.M, ny = M.topY * 0.55, nb = M.B * 0.42;
  this.nav.add(navLamp(nb, ny, M.L * 0.1, 0xff2a1a), navLamp(-nb, ny, M.L * 0.1, 0x2aff5a), navLamp(0, M.topY + 0.6, 0, 0xfff4e0));
  this.nav.visible = !!(ENV && ENV.nav);
  root.add(this.nav);
  root.visible = false;
  scene.add(root);
  this.wake = new Wake();
  this.ai = this.isPlayer ? null : {
    state: 0, wpX: 0, wpZ: 0, wpT: 0, orbitDir: 1, orbitR: 100, orbitT: 0, lostT: 0, hunter: false,
    errX: 0, errZ: 0, errT: 0, lead: 1, burstLeft: 0, fireT: 0, pauseT: 0, cannonT: 0, misT: 0, leader: null
  };
  this.active = false; this.alive = false; this.gone = true;
  this.x = 0; this.z = 0; this.y = 0; this.vx = 0; this.vz = 0; this.vy = 0;
  this.heading = 0; this.yawRate = 0; this.throttle = 0; this.inThrottle = 0; this.inSteer = 0; this.boosting = false;
  this.pitch = 0; this.pitchV = 0; this.lean = 0; this.leanV = 0;
  this.surf = 0; this.airT = 0; this.u = 0; this.w = 0; this.spN = 0; this.hBow = 0; this.hStern = 0; this.dip = 0; this.lod = 1;
  this.hp = 1; this.maxHp = 1; this.dmgMul = 1; this.accMul = 1;
  this.sinkT = 0; this.sinkDur = 10; this.sinkSide = 1; this.sinkBow = 0;
  this.turretYaw = 0; this.turretErr = 0; this.barrelPitch = 0.06; this.mgYaw = 0; this.mgErr = 0; this.recoil = 0;
  this.accBow = 0; this.accMist = 0; this.accStern = 0; this.accTurn = 0; this.accFire = 0; this.accSmoke = 0;
}

Boat.prototype.reset = function (x, z, heading, t) {
  this.active = true; this.alive = true; this.gone = false;
  this.x = x; this.z = z; this.heading = heading;
  this.surf = waveHeight(x, z, t); this.y = this.surf;
  this.vx = 0; this.vz = 0; this.vy = 0; this.yawRate = 0; this.throttle = 0; this.inThrottle = 0; this.inSteer = 0; this.boosting = false;
  this.pitch = 0; this.pitchV = 0; this.lean = 0; this.leanV = 0; this.airT = 0; this.u = 0; this.w = 0; this.spN = 0; this.dip = 0;
  this.hBow = this.surf; this.hStern = this.surf;
  this.maxHp = this.isPlayer ? CONFIG.player.maxHealth : this.S.health; this.hp = this.maxHp; this.dmgMul = 1; this.accMul = 1;
  this.sinkT = 0;
  this.turretYaw = 0; this.barrelPitch = 0.06; this.mgYaw = 0; this.recoil = 0;
  this.accBow = 0; this.accMist = 0; this.accStern = 0; this.accTurn = 0; this.accFire = 0; this.accSmoke = 0;
  const mat0 = this.isPlayer && playerMat ? playerMat : boatMat;
  for (let i = 0; i < this.meshes.length; i++) { this.meshes[i].material = mat0; this.meshes[i].visible = true; }
  if (this.turretPivot) { this.turretPivot.rotation.y = 0; this.barrel.position.z = 0; }
  if (this.turretPivot2) { this.turretYaw2 = Math.PI; this.turretPivot2.rotation.y = Math.PI; this.barrel2.position.z = 0; }
  this.mgPivot.rotation.y = 0;
  this.wake.clear();
  this.setVisScale(1);
  this.root.visible = true;
  this.root.position.set(x, this.y, z);
  this.root.rotation.set(0, heading, 0);
};

// 크기 배율: 모형과 선체 치수(맞는 판정·물보라·체력바 높이에 쓰임)를 같이 키운다
Boat.prototype.setVisScale = function (v) {
  if (v - this.vs < 0.002 && this.vs - v < 0.002) return;
  this.vs = v;
  const M = this.M, M0 = this.M0;
  for (const k in M0) M[k] = M0[k] * v;
  this.root.scale.setScalar(v);
};

Boat.prototype.retire = function () {
  this.active = false; this.gone = true; this.root.visible = false;
};

// 한 프레임의 물리: 관성 있는 추진과 선회, 파도에 맞춘 높이와 기울기
Boat.prototype.step = function (dt, t) {
  const S = this.S, M = this.M, alive = this.alive;
  const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
  const u = this.vx * sh + this.vz * ch;        // 전진 속도
  const w = this.vx * ch - this.vz * sh;        // 좌현 쪽으로 미끄러지는 속도

  // 엔진: 스로틀이 서서히 올라가고, 추력과 물의 저항이 맞서 최고 속도가 정해진다
  this.throttle = damp(this.throttle, alive ? this.inThrottle : 0, S.throttleResponse, dt);
  let thrust;
  if (this.throttle >= 0) thrust = this.throttle * (this.boosting ? S.boostThrust : S.accel);
  else thrust = this.throttle * (u > 1.5 ? S.brake : S.reverseThrust);
  const du = thrust - S.dragLinear * (alive ? 1 : 3.5) * u - S.dragQuad * u * Math.abs(u) - S.turnDrag * Math.abs(this.yawRate) * u;
  const dw = -S.sideGrip * w - 0.06 * w * Math.abs(w);   // 옆으로는 저항이 크지만 바로 멈추지는 않아 살짝 미끄러진다

  // 파도: 뱃머리, 선미, 좌현, 우현 네 곳의 수면 높이
  const lf = M.L * 0.38, bs = M.B * 0.42;
  const hB = waveHeight(this.x + sh * lf, this.z + ch * lf, t);
  const hS = waveHeight(this.x - sh * lf, this.z - ch * lf, t);
  const hP = waveHeight(this.x + ch * bs, this.z - sh * bs, t);
  const hR = waveHeight(this.x - ch * bs, this.z + sh * bs, t);
  const hC = (hB + hS + hP + hR) * 0.25;
  const slopeF = (hB - hS) / (2 * lf), slopeL = (hP - hR) / (2 * bs);
  this.hBow = hB; this.hStern = hS;

  let ax = sh * du + ch * dw, az = ch * du - sh * dw;
  ax -= (sh * slopeF + ch * slopeL) * 3.2;       // 파도 경사를 타고 조금 밀린다
  az -= (ch * slopeF - sh * slopeL) * 3.2;
  // 바다 경계: 가까워질수록 안쪽으로 미는 힘이 커진다
  // 바깥으로 나가는 속도도 함께 줄여서 튕기지 않고 부드럽게 멈춰 선다
  const lim = HALF - CONFIG.world.pushMargin, pm = CONFIG.world.pushMargin, pa = CONFIG.world.pushAccel;
  if (this.x > lim) { const k = Math.min((this.x - lim) / pm, 2.5); ax -= pa * k * k + (this.vx > 0 ? this.vx * 2.2 * Math.min(k, 1) : 0); }
  else if (this.x < -lim) { const k = Math.min((-lim - this.x) / pm, 2.5); ax += pa * k * k - (this.vx < 0 ? this.vx * 2.2 * Math.min(k, 1) : 0); }
  if (this.z > lim) { const k = Math.min((this.z - lim) / pm, 2.5); az -= pa * k * k + (this.vz > 0 ? this.vz * 2.2 * Math.min(k, 1) : 0); }
  else if (this.z < -lim) { const k = Math.min((-lim - this.z) / pm, 2.5); az += pa * k * k - (this.vz < 0 ? this.vz * 2.2 * Math.min(k, 1) : 0); }

  this.vx += ax * dt; this.vz += az * dt;
  this.x += this.vx * dt; this.z += this.vz * dt;

  // 선회: 물이 타를 지나야 먹히므로 속도가 있어야 잘 돈다
  const sp = Math.abs(u), spN = sp / S.maxSpeed;
  let eff = clamp(sp / S.turnRefSpeed, 0, 1);
  eff = eff * (2 - eff) * (1 - 0.3 * Math.min(spN * spN, 2.2));
  const tAbs = this.throttle < 0 ? -this.throttle : this.throttle;
  if (eff < 0.22 * tAbs) eff = 0.22 * tAbs;
  const yawT = (alive ? this.inSteer : 0) * S.turnRate * eff * (u < -0.5 ? -1 : 1);
  this.yawRate = damp(this.yawRate, yawT, S.yawResponse, dt);
  this.heading = wrapAngle(this.heading + this.yawRate * dt);

  // 높이: 수면을 스프링처럼 따라가되, 부력은 위로만 밀기 때문에 수면이 빨리 꺼지면 잠깐 뜬다
  const surfVy = clamp((hC - this.surf) / dt, -8, 8);    // 충돌로 위치가 튀어도 선체가 솟구치지 않게 제한
  this.surf = hC;
  const sq = Math.min(spN, 1.5);
  const target = hC + M.lift * sq * sq;
  let ay = 46 * (target - this.y) - 9.5 * (this.vy - surfVy);
  if (ay < -16) ay = -16;
  this.vy += ay * dt; this.y += this.vy * dt;
  if (this.y - target > 0.32) this.airT += dt;
  else {
    if (this.airT > 0.12 && alive) {
      const hit = surfVy - this.vy;
      if (hit > 1.6 && this.lod > 0) this.slam(hit, this.lod);     // 파도에 부딪혀 떨어질 때 물이 튄다
    }
    this.airT = 0;
  }

  // 기울기: 파도 경사 + 가속하면 뱃머리가 들리고 + 선회하면 안쪽으로 기운다
  const accN = clamp(du / S.accel, -1.2, 2.2);
  const pitchT = Math.atan2(hB - hS, 2 * lf) * 0.92 +
    S.bowLift * (0.55 * smooth01(spN * 1.15) + 0.5 * (accN > 0 ? accN : 0) + (this.boosting ? 0.35 : 0)) + 0.03 * (accN < 0 ? accN : 0);
  const leanT = -Math.atan2(hP - hR, 2 * bs) * 0.92 +
    S.bankAngle * clamp(this.yawRate / S.turnRate, -1.2, 1.2) * clamp(spN * 1.2, 0, 1.15);
  this.pitchV += (58 * (pitchT - this.pitch) - 10.5 * this.pitchV) * dt; this.pitch += this.pitchV * dt;
  this.leanV += (44 * (leanT - this.lean) - 9 * this.leanV) * dt; this.lean += this.leanV * dt;
  this.dip = hB - (this.y + Math.sin(this.pitch) * lf);
  this.u = u; this.w = w; this.spN = spN;

  // 격파된 뒤: 한쪽으로 기울면서 천천히 가라앉는다
  let sinkY = 0, sinkRoll = 0, sinkPitch = 0;
  if (!alive) {
    this.sinkT += dt;
    const k = Math.min(this.sinkT / this.sinkDur, 1);
    sinkY = -Math.pow(k, 1.8) * (M.free + M.topY * 0.95 + 1.2);
    sinkRoll = this.sinkSide * Math.pow(k, 1.1) * 0.95;
    sinkPitch = this.sinkBow * k * 0.42;
  }
  this.root.position.set(this.x, this.y + sinkY, this.z);
  this.root.rotation.set(-(this.pitch + sinkPitch), this.heading, -(this.lean + sinkRoll));

  if (this.recoil > 0) {
    this.recoil = Math.max(0, this.recoil - dt * 2.4);
    if (this.barrel) this.barrel.position.z = -0.6 * this.recoil * this.recoil;
    if (this.barrel2) this.barrel2.position.z = -0.6 * this.recoil * this.recoil;
  }
  if (this.radar && alive) this.radar.rotation.y += dt * 2.6;
  // 수직 발사관 덮개: 쏠 때 확 열렸다가 천천히 닫힌다
  if (this.vlsCells) for (let i = 0; i < this.vlsCells.length; i++) {
    const c = this.vlsCells[i];
    if (c.t > 0) { c.t -= dt; c.open = Math.min(1, c.open + dt * 14); }
    else if (c.open > 0) c.open = Math.max(0, c.open - dt * 1.6);
    c.pv.rotation.x = -1.95 * c.open;
  }
  // 상자형 발사대: 내가 보는 쪽으로 천천히 돌아간다
  if (this.launcher && alive) {
    const want = wrapAngle(Cam.yaw - this.heading), d = wrapAngle(want - this.launchYaw), st = 1.6 * dt;
    this.launchYaw += d > st ? st : (d < -st ? -st : d);
    this.launcher.rotation.y = this.launchYaw;
  }
};

// 포탑과 기관총을 목표 쪽으로 돌린다 (회전 속도 제한). 함포 목표 (cx, cz), 기관총 목표 (mx, mz)
Boat.prototype.aimWeapons = function (cx, cz, mx, mz, elev, dt) {
  const T = this.tpl, step = this.S.turretSlew * dt;
  const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
  if (this.turretPivot) {
    const p = T.turretPos;
    const wx = this.x + p.x * ch + p.z * sh, wz = this.z - p.x * sh + p.z * ch;
    const d = wrapAngle(Math.atan2(cx - wx, cz - wz) - this.heading - this.turretYaw);
    const mv = clamp(d, -step, step);
    this.turretYaw = wrapAngle(this.turretYaw + mv);
    this.turretErr = Math.abs(d - mv);
    this.turretPivot.rotation.y = this.turretYaw;
    this.barrelPitch = damp(this.barrelPitch, elev, 8, dt);
    this.barrelPivot.rotation.x = -this.barrelPitch;
  }
  if (this.turretPivot2) {
    const p2 = T.turret2Pos;
    const wx2 = this.x + p2.x * ch + p2.z * sh, wz2 = this.z - p2.x * sh + p2.z * ch;
    const e2 = wrapAngle(Math.atan2(cx - wx2, cz - wz2) - this.heading - this.turretYaw2);
    const m2 = clamp(e2, -step, step);
    this.turretYaw2 = wrapAngle(this.turretYaw2 + m2);
    this.turretErr2 = Math.abs(e2 - m2);
    this.turretPivot2.rotation.y = this.turretYaw2;
    this.barrelPivot2.rotation.x = -this.barrelPitch;
  }
  const q = T.mgPos;
  const gx = this.x + q.x * ch + q.z * sh, gz = this.z - q.x * sh + q.z * ch;
  const d2 = wrapAngle(Math.atan2(mx - gx, mz - gz) - this.heading - this.mgYaw);
  const mv2 = clamp(d2, -step * 1.6, step * 1.6);
  this.mgYaw = wrapAngle(this.mgYaw + mv2);
  this.mgErr = Math.abs(d2 - mv2);
  this.mgPivot.rotation.y = this.mgYaw;
};

// 물 효과: 선체 둘레 거품과 그림자, 항적, 뱃머리 물보라, 선미 물줄기, 급선회 물보라
Boat.prototype.emitWater = function (dt, t, lod) {
  const S = this.S, M = this.M;
  const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
  const spN = this.spN, u = this.u, w = this.w;
  const speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
  const sinkK = this.alive ? 1 : Math.max(0, 1 - this.sinkT / this.sinkDur);
  foamStamp(this.x, this.z, sh, ch, M.L * 0.57, M.B * 0.68, (0.28 + 0.6 * Math.min(spN, 1.3)) * sinkK + (this.alive ? 0 : 0.4), 0, 0.55, 0);
  const sl = M.topY * 2.1 * sinkK;
  foamStamp(this.x - SUN_FLAT.x * sl * 0.5, this.z - SUN_FLAT.y * sl * 0.5, SUN_FLAT.x, SUN_FLAT.y, M.L * 0.42 + sl * 0.5, M.L * 0.36, 0.6 * sinkK, 0, 0.7, 1);
  this.wake.update(this.x, this.z, sh, ch, speed, M.L, M.B, t, this.alive);
  if (!this.alive || lod <= 0) return;

  const boost = this.boosting ? 1 : 0;
  // 뱃머리 양옆으로 갈라지는 물보라: 속도의 제곱에 비례하고, 뱃머리가 파도에 박히면 더 크게 튄다
  if (u > 4) {
    const pw = spN * spN * (1 + 0.7 * boost) * (1 + 2.4 * clamp(this.dip, 0, 0.7));
    const bx = this.x + sh * M.L * 0.30, bz = this.z + ch * M.L * 0.30, by = this.hBow + 0.15;
    this.accBow += S.sprayRate * 2 * pw * lod * dt;
    if (this.accBow > 60) this.accBow = 60;
    while (this.accBow >= 1) {
      this.accBow -= 1;
      const side = rnd() < 0.5 ? 1 : -1, out = rr(2.4, 7) * (0.45 + spN), carry = rr(0.5, 0.86), f = rr(-1.6, 0.9);
      const px = bx + ch * side * M.B * 0.2 + sh * f, pz = bz - sh * side * M.B * 0.2 + ch * f;
      if (rnd() < 0.62) {
        // 낱낱의 물방울: 진행 방향으로 길게 늘어져 보인다
        spraySys.spawn(px, by, pz, this.vx * carry + ch * side * out, rr(3, 9.5) * (0.4 + 0.8 * spN), this.vz * carry - sh * side * out,
          rr(0.6, 1.25), rr(0.16, 0.42), 0.08, 1, 1, 1, rr(0.7, 1), 15, 0.7, 0, 0.045, 0, by - 0.45);
      } else {
        // 물방울이 뭉친 흰 물덩이: 물보라에 두께를 준다
        spraySys.spawn(px, by + 0.2, pz, this.vx * carry + ch * side * out * 0.7, rr(2.6, 6.5) * (0.4 + 0.8 * spN), this.vz * carry - sh * side * out * 0.7,
          rr(0.5, 0.95), rr(0.5, 0.9), rr(1.3, 2.2), 1, 1, 1, rr(0.6, 0.9), 12, 1.0, rr(-2, 2), 0, 0.7, by - 0.6);
      }
    }
    this.accMist += (12 + 24 * spN) * pw * lod * dt;
    if (this.accMist > 12) this.accMist = 12;
    while (this.accMist >= 1) {
      this.accMist -= 1;
      const side = rnd() < 0.5 ? 1 : -1, f = rr(-4, 0.5);
      mistSys.spawn(bx + ch * side * M.B * 0.3 + sh * f, by + 0.9, bz - sh * side * M.B * 0.3 + ch * f,
        this.vx * 0.5 + ch * side * rr(1, 3.8), rr(2.2, 4.6), this.vz * 0.5 - sh * side * rr(1, 3.8),
        rr(0.8, 1.4), rr(1.0, 1.6), rr(2.8, 4.2) * (0.7 + 0.4 * spN), 1, 1, 1, rr(0.34, 0.55), 0.6, 1.6, rr(-1, 1), 0, 0.92, -100);
    }
  }
  // 선미 뒤로 솟는 물줄기: 빠를수록, 부스트 중일수록 크다
  if (spN > 0.42 && this.throttle > 0.25) {
    const k = spN - 0.34;
    const sx = this.x - sh * M.L * 0.5, sz = this.z - ch * M.L * 0.5, sy = this.hStern + 0.1;
    this.accStern += 150 * k * k * (1 + 1.5 * boost) * lod * dt;
    if (this.accStern > 60) this.accStern = 60;
    while (this.accStern >= 1) {
      this.accStern -= 1;
      const o = rr(-0.3, 0.3) * M.B, carry = rr(0.22, 0.55), r = rnd();
      if (r < 0.7) {
        spraySys.spawn(sx + ch * o, sy, sz - sh * o, this.vx * carry + ch * rr(-1.7, 1.7), rr(3, 9) * (1 + 0.55 * boost), this.vz * carry - sh * rr(-1.7, 1.7),
          rr(0.6, 1.2), rr(0.16, 0.42), 0.08, 1, 1, 1, rr(0.6, 0.95), 15, 0.6, 0, 0.045, 0, sy - 0.45);
      } else if (r < 0.9) {
        spraySys.spawn(sx + ch * o, sy + 0.2, sz - sh * o, this.vx * carry, rr(2.5, 6.5) * (1 + 0.5 * boost), this.vz * carry,
          rr(0.5, 0.95), rr(0.5, 0.9), rr(1.4, 2.4), 1, 1, 1, rr(0.45, 0.7), 12, 1.0, rr(-2, 2), 0, 0.7, sy - 0.6);
      } else {
        mistSys.spawn(sx + ch * o, sy + 1.0, sz - sh * o, this.vx * 0.3, rr(2.2, 4.5), this.vz * 0.3,
          rr(0.9, 1.5), rr(1.1, 1.7), rr(3.0, 4.4), 1, 1, 1, rr(0.3, 0.5), 0.6, 1.5, rr(-1, 1), 0, 0.92, -100);
      }
    }
  }
  // 급선회: 선체가 옆으로 미끄러지며 바깥쪽 뱃전에서 물이 튄다
  const slip = w < 0 ? -w : w;
  if (slip > 1.6 && u > 6) {
    const side = w > 0 ? 1 : -1;
    this.accTurn += Math.min(190, 46 * (slip - 1.6)) * lod * dt;
    while (this.accTurn >= 1) {
      this.accTurn -= 1;
      const f = rr(-0.36, 0.26) * M.L, out = rr(3, 9);
      if (rnd() < 0.75) {
        spraySys.spawn(this.x + sh * f + ch * side * M.B * 0.48, this.y + 0.15, this.z + ch * f - sh * side * M.B * 0.48,
          this.vx * 0.6 + ch * side * out, rr(2, 7), this.vz * 0.6 - sh * side * out,
          rr(0.5, 1.1), rr(0.16, 0.4), 0.08, 1, 1, 1, rr(0.6, 0.95), 15, 0.7, 0, 0.045, 0, this.y - 0.5);
      } else {
        spraySys.spawn(this.x + sh * f + ch * side * M.B * 0.5, this.y + 0.3, this.z + ch * f - sh * side * M.B * 0.5,
          this.vx * 0.6 + ch * side * out * 0.6, rr(1.5, 4.5), this.vz * 0.6 - sh * side * out * 0.6,
          rr(0.45, 0.9), rr(0.5, 0.9), rr(1.4, 2.3), 1, 1, 1, rr(0.4, 0.65), 12, 1.0, rr(-2, 2), 0, 0.7, this.y - 0.6);
      }
    }
  }
};

// 파도에 부딪혔을 때 뱃머리에서 크게 튀는 물
Boat.prototype.slam = function (hit, lod) {
  const M = this.M, k = clamp(hit / 6, 0.25, 1.5);
  const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
  const bx = this.x + sh * M.L * 0.28, bz = this.z + ch * M.L * 0.28, by = this.hBow;
  const n = ((26 + 70 * k) * lod) | 0;
  for (let i = 0; i < n; i++) {
    const side = rnd() < 0.5 ? 1 : -1, out = rr(3, 11) * k, fw = rr(-2, 7) * k;
    spraySys.spawn(bx + ch * side * M.B * 0.25, by + 0.1, bz - sh * side * M.B * 0.25,
      this.vx * 0.7 + ch * side * out + sh * fw, rr(3, 10) * (0.5 + k * 0.6), this.vz * 0.7 - sh * side * out + ch * fw,
      rr(0.7, 1.5), rr(0.2, 0.52), 0.1, 1, 1, 1, rr(0.7, 1), 16, 0.6, 0, 0.04, 0, by - 0.5);
  }
  const cn = ((8 + 14 * k) * lod) | 0;
  for (let i = 0; i < cn; i++) {
    const side = rnd() < 0.5 ? 1 : -1, out = rr(2, 7) * k;
    spraySys.spawn(bx + ch * side * M.B * 0.3, by + 0.3, bz - sh * side * M.B * 0.3,
      this.vx * 0.65 + ch * side * out, rr(2.5, 7) * (0.5 + k * 0.5), this.vz * 0.65 - sh * side * out,
      rr(0.6, 1.1), rr(0.7, 1.2), rr(1.8, 3.0), 1, 1, 1, rr(0.5, 0.8), 13, 1.0, rr(-2, 2), 0, 0.7, by - 0.7);
  }
  const mn = ((5 + 8 * k) * lod) | 0;
  for (let i = 0; i < mn; i++) {
    mistSys.spawn(bx + rr(-2, 2), by + 1.1, bz + rr(-2, 2), this.vx * 0.55 + rr(-3, 3), rr(2.5, 5.5), this.vz * 0.55 + rr(-3, 3),
      rr(0.8, 1.6), rr(1.4, 2.2), rr(4, 6.5) * (0.6 + 0.4 * k), 1, 1, 1, rr(0.35, 0.55), 2, 1.6, rr(-1, 1), 0, 0.92, -100);
  }
  foamDecal(bx, bz, 2, 6 + 3 * k, 3.2, 0.9, 0, 0.5);
  Sound.playAt('slam', bx, bz, 0.55 * k, rr(0.9, 1.15));
  if (this.isPlayer) Cam.trauma = Math.min(1, Cam.trauma + 0.16 * k);
};

// 격파: 폭발하고 그을린 잔해가 된다
Boat.prototype.kill = function () {
  this.alive = false; this.hp = 0; this.sinkT = 0;
  this.sinkDur = this.kind === 'boss' ? 20 : (this.kind === 'gunboat' ? 13 : 9.5);
  this.sinkSide = rnd() < 0.5 ? -1 : 1; this.sinkBow = rr(-1, 1);
  this.inThrottle = 0; this.inSteer = 0; this.boosting = false;
  for (let i = 0; i < this.meshes.length; i++) { this.meshes[i].material = wreckMat; this.meshes[i].visible = true; }
  fxExplosion(this.x, this.y + 1.2, this.z, this.kind === 'boss' ? 2.6 : (this.kind === 'gunboat' ? 1.5 : 1.1));
};

// 가라앉는 동안 불과 검은 연기를 낸다
Boat.prototype.emitBurn = function (dt, lod) {
  const k = this.sinkT / this.sinkDur;
  if (k > 0.82 || lod <= 0) return;
  const M = this.M, sc = this.kind === 'boss' ? 2.0 : (this.kind === 'gunboat' ? 1.35 : 1);
  if (this.kind === 'boss' && k < 0.6 && rnd() < dt * 1.6) {
    // 가라앉는 보스에서 연달아 터지는 폭발
    const o = rr(-0.4, 0.4) * M.L, s0 = Math.sin(this.heading), c0 = Math.cos(this.heading);
    fxExplosion(this.x + s0 * o, this.root.position.y + rr(1, 4), this.z + c0 * o, rr(0.8, 1.4));
    Sound.playAt('explosion', this.x, this.z, 0.7, rr(0.8, 1.1));
  }
  const sh = Math.sin(this.heading), ch = Math.cos(this.heading), py = this.root.position.y;
  this.accFire += 30 * (1 - k) * lod * dt;
  while (this.accFire >= 1) {
    this.accFire -= 1;
    const o = rr(-0.3, 0.3) * M.L;
    fireSys.spawn(this.x + sh * o + rr(-0.8, 0.8), py + rr(1.0, 2.2) * sc, this.z + ch * o + rr(-0.8, 0.8),
      rr(-0.8, 0.8), rr(2.5, 6), rr(-0.8, 0.8), rr(0.35, 0.8), rr(1.0, 1.8) * sc, rr(2.2, 3.4) * sc,
      rr(3.2, 5), rr(1.1, 1.9), rr(0.2, 0.45), 1, -2.5, 1.2, rr(-2, 2), 0, 0.85, -100);
  }
  this.accSmoke += 12 * lod * dt;
  while (this.accSmoke >= 1) {
    this.accSmoke -= 1;
    const o = rr(-0.25, 0.25) * M.L, g = rr(0.02, 0.08);
    smokeSys.spawn(this.x + sh * o + rr(-1, 1), py + rr(1.5, 3) * sc, this.z + ch * o + rr(-1, 1),
      rr(-1, 1), rr(3.5, 7), rr(-1, 1), rr(2.6, 4.8), rr(1.6, 2.6) * sc, rr(7, 11) * sc, g, g, g, rr(0.5, 0.75), -1.0, 0.5, rr(-0.6, 0.6), 0, 0.9, -100);
  }
};
