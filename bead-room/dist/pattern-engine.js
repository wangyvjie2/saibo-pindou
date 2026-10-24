/* The conversion and drawing algorithms below are reused from the user's
   拼豆图/_src/part3-engine.js. This adapter keeps references separate from beads. */
const PatternEngine = (() => {
'use strict';
/* =====================================================================
   拼豆图生成器 — 转换引擎
   颜色距离使用 redmean 近似（比裸 RGB 更接近人眼感知），无需色彩空间转换。
   ===================================================================== */

/* ---------- 小工具 ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}
/** redmean 加权 RGB 距离，返回平方值 */
function cdist(r1, g1, b1, r2, g2, b2) {
  const rm = (r1 + r2) >> 1;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return (((512 + rm) * dr * dr) >> 8) + (dg * dg << 2) + (((767 - rm) * db * db) >> 8);
}
function dist2rgb(c, r, g, b) { return cdist(c[0], c[1], c[2], r, g, b); }

function nearest(rgbArr, r, g, b, cache) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < rgbArr.length; i++) {
    const c = rgbArr[i];
    const d = cdist(r, g, b, c[0], c[1], c[2]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/* ---------- 画布助手 ---------- */
function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  return c;
}
function ctxOf(cv, alpha = true) {
  return cv.getContext('2d', { willReadFrequently: true, alpha });
}

/**
 * 高质量重采样：先逐级减半，再双线性采样到精确目标尺寸。
 * 逐级减半可避免大面积缩小时的噪点与摩尔纹。
 */
function resizeImage(src, tw, th) {
  tw = Math.max(1, Math.round(tw)); th = Math.max(1, Math.round(th));
  let cur = src;
  while (cur.width >= tw * 2 && cur.height >= th * 2 && cur.width > 2 && cur.height > 2) {
    const nw = Math.max(tw, cur.width >> 1), nh = Math.max(th, cur.height >> 1);
    if (nw === cur.width && nh === cur.height) break;
    const nc = newCanvas(nw, nh);
    const g = ctxOf(nc);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, nw, nh);
    cur = nc;
  }
  if (cur.width === tw && cur.height === th) return cur;
  const out = newCanvas(tw, th);
  const srcCtx = ctxOf(cur);
  const sd = srcCtx.getImageData(0, 0, cur.width, cur.height);
  const od = ctxOf(out).createImageData(tw, th);
  const sw = cur.width, sh = cur.height;
  const s = sd.data, o = od.data;
  const xr = sw / tw, yr = sh / th;
  for (let y = 0; y < th; y++) {
    let sy = (y + 0.5) * yr - 0.5;
    if (sy < 0) sy = 0; else if (sy > sh - 1) sy = sh - 1;
    const y0 = sy | 0, y1 = Math.min(sh - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < tw; x++) {
      let sx = (x + 0.5) * xr - 0.5;
      if (sx < 0) sx = 0; else if (sx > sw - 1) sx = sw - 1;
      const x0 = sx | 0, x1 = Math.min(sw - 1, x0 + 1), fx = sx - x0;
      const i00 = (y0 * sw + x0) << 2, i01 = (y0 * sw + x1) << 2;
      const i10 = (y1 * sw + x0) << 2, i11 = (y1 * sw + x1) << 2;
      const w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy), w10 = (1 - fx) * fy, w11 = fx * fy;
      const di = (y * tw + x) << 2;
      o[di]     = s[i00]     * w00 + s[i01]     * w01 + s[i10]     * w10 + s[i11]     * w11;
      o[di + 1] = s[i00 + 1] * w00 + s[i01 + 1] * w01 + s[i10 + 1] * w10 + s[i11 + 1] * w11;
      o[di + 2] = s[i00 + 2] * w00 + s[i01 + 2] * w01 + s[i10 + 2] * w10 + s[i11 + 2] * w11;
      o[di + 3] = s[i00 + 3] * w00 + s[i01 + 3] * w01 + s[i10 + 3] * w10 + s[i11 + 3] * w11;
    }
  }
  ctxOf(out).putImageData(od, 0, 0);
  return out;
}

/** 按矩形区域（可为浮点，越界部分视为透明）面积平均缩放，用于「完整放入」模式 */
function resizeRegion(src, sx0, sy0, sx1, sy1, tw, th) {
  tw = Math.max(1, Math.round(tw)); th = Math.max(1, Math.round(th));
  const sd = ctxOf(src).getImageData(0, 0, src.width, src.height).data;
  const sw = src.width, sh = src.height;
  const out = newCanvas(tw, th);
  const od = ctxOf(out).createImageData(tw, th);
  const o = od.data;
  const dx = (sx1 - sx0) / tw, dy = (sy1 - sy0) / th;
  for (let y = 0; y < th; y++) {
    const y0 = sy0 + y * dy, y1 = y0 + dy;
    const iy0 = Math.max(0, Math.ceil(y0)), iy1 = Math.min(sh, Math.ceil(y1));
    for (let x = 0; x < tw; x++) {
      const x0 = sx0 + x * dx, x1 = x0 + dx;
      const ix0 = Math.max(0, Math.ceil(x0)), ix1 = Math.min(sw, Math.ceil(x1));
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      const cellA = Math.max(0.0001, (x1 - x0) * (y1 - y0));
      for (let yy = iy0; yy < iy1; yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        for (let xx = ix0; xx < ix1; xx++) {
          const wx = Math.min(xx + 1, x1) - Math.max(xx, x0);
          const w = wx * wy;
          const i = (yy * sw + xx) << 2;
          const av = sd[i + 3] / 255;
          r += sd[i] * w * av; g += sd[i + 1] * w * av; b += sd[i + 2] * w * av;
          a += sd[i + 3] * w; wsum += w;
        }
      }
      const di = (y * tw + x) << 2;
      const da = wsum > 0 ? a / wsum : 0;
      const ac = wsum > 0 ? a / 255 : 0;
      if (ac > 0.0001) {
        o[di] = r / ac; o[di + 1] = g / ac; o[di + 2] = b / ac;
      }
      o[di + 3] = da;
    }
  }
  ctxOf(out).putImageData(od, 0, 0);
  return out;
}

/** 「主色提取」：每格取出现次数最多的颜色（先做 5bit 量化分桶） */
function dominantSample(src, tw, th) {
  const sd = ctxOf(src).getImageData(0, 0, src.width, src.height).data;
  const sw = src.width, sh = src.height;
  const out = newCanvas(tw, th);
  const od = ctxOf(out).createImageData(tw, th);
  const o = od.data;
  const xr = sw / tw, yr = sh / th;
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor(y * yr), y1 = Math.max(y0 + 1, Math.min(sh, Math.ceil((y + 1) * yr)));
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor(x * xr), x1 = Math.max(x0 + 1, Math.min(sw, Math.ceil((x + 1) * xr)));
      const cnt = new Map();
      let bestKey = 0, bestN = 0, bestR = 0, bestG = 0, bestB = 0, alphaSum = 0, alphaN = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * sw + xx) << 2;
          const a = sd[i + 3];
          alphaSum += a; alphaN++;
          if (a < 128) continue;
          const qr = sd[i] >> 3, qg = sd[i + 1] >> 3, qb = sd[i + 2] >> 3;
          const key = (qr << 10) | (qg << 5) | qb;
          const e = cnt.get(key);
          if (e) { e[0]++; e[1] += sd[i]; e[2] += sd[i + 1]; e[3] += sd[i + 2]; }
          else cnt.set(key, [1, sd[i], sd[i + 1], sd[i + 2]]);
        }
      }
      cnt.forEach(v => { if (v[0] > bestN) { bestN = v[0]; bestR = v[1] / v[0]; bestG = v[2] / v[0]; bestB = v[3] / v[0]; } });
      const di = (y * tw + x) << 2;
      if (bestN > 0) { o[di] = bestR; o[di + 1] = bestG; o[di + 2] = bestB; o[di + 3] = 255; }
      else { o[di] = o[di + 1] = o[di + 2] = 0; o[di + 3] = 0; }
    }
  }
  ctxOf(out).putImageData(od, 0, 0);
  return out;
}

/* ---------- 图像调整 ---------- */
function applyAdjust(data, opt) {
  const n = data.length >> 2;
  const br = (opt.brightness || 0) * 2.55 * 0.6;
  const ct = (opt.contrast || 0) / 100;
  const cf = ct >= 0 ? (1 / Math.max(0.02, 1 - ct)) : (1 + ct);
  const sa = (opt.saturation || 0) / 100;
  const sf = sa >= 0 ? 1 + sa * 1.6 : 1 + sa;
  let hasContent = false;
  for (let i = 0; i < data.length; i += 4) { if (data[i + 3] > 8) { hasContent = true; break; } }
  if (!hasContent) return;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = data[i], g = data[i + 1], b = data[i + 2];
    if (br) { r += br; g += br; b += br; }
    if (ct) { r = (r - 128) * cf + 128; g = (g - 128) * cf + 128; b = (b - 128) * cf + 128; }
    if (sa) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum + (r - lum) * sf; g = lum + (g - lum) * sf; b = lum + (b - lum) * sf;
    }
    data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  const sh = (opt.sharpness || 0) / 100;
  if (sh > 0.01) {
    const W = opt.w, H = opt.h;
    const cp = new Uint8ClampedArray(data);
    const k = 1 / 13;
    const wts = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = (y * W + x) << 2;
        if (cp[i + 3] === 0) continue;
        let br2 = 0, bg2 = 0, bb2 = 0, ki = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const j = ((y + dy) * W + (x + dx)) << 2;
            const w = wts[ki++] * k;
            br2 += cp[j] * w; bg2 += cp[j + 1] * w; bb2 += cp[j + 2] * w;
          }
        }
        const amt = sh * 1.3;
        data[i] = clamp(cp[i] + (cp[i] - br2) * amt, 0, 255);
        data[i + 1] = clamp(cp[i + 1] + (cp[i + 1] - bg2) * amt, 0, 255);
        data[i + 2] = clamp(cp[i + 2] + (cp[i + 2] - bb2) * amt, 0, 255);
      }
    }
  }
}

/* ---------- 去背景：从四边漫水填充 ---------- */
function buildBgMask(data, w, h, tol) {
  const n = w * h;
  const mask = new Uint8Array(n);
  const visited = new Uint8Array(n);
  const hist = new Map();
  const sample = (i) => {
    const p = i << 2;
    if (data[p + 3] < 24) return;
    const key = ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);
    const e = hist.get(key);
    if (e) { e[0]++; e[1] += data[p]; e[2] += data[p + 1]; e[3] += data[p + 2]; }
    else hist.set(key, [1, data[p], data[p + 1], data[p + 2]]);
  };
  for (let x = 0; x < w; x++) { sample(x); sample((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { sample(y * w); sample(y * w + w - 1); }
  let bg = [255, 255, 255], bestN = -1;
  hist.forEach(v => { if (v[0] > bestN) { bestN = v[0]; bg = [v[1] / v[0], v[2] / v[0], v[3] / v[0]]; } });
  if (bestN <= 0) return { mask, bg, transparent: true };
  const T = tol * tol * 3;
  const stack = [];
  const seed = (i) => { if (!visited[i]) { visited[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const p = i << 2;
    if (data[p + 3] < 24) { mask[i] = 1; }
    else {
      const d = cdist(data[p], data[p + 1], data[p + 2], bg[0], bg[1], bg[2]);
      if (d > T) continue;
      mask[i] = 1;
    }
    const x = i % w, y = (i / w) | 0;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (y > 0) seed(i - w);
    if (y < h - 1) seed(i + w);
  }
  return { mask, bg, transparent: false };
}

/* ---------- 颜色量化：中位切分 ---------- */
function medianCut(data, n, maxColors) {
  const BITS = 5, SH = 3, SIZE = 1 << (BITS * 3), MASK = SIZE - 1;
  const hist = new Uint32Array(SIZE);
  const sr = new Float64Array(SIZE), sg = new Float64Array(SIZE), sb = new Float64Array(SIZE);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (data[p + 3] < 128) continue;
    const r = data[p] >> SH, g = data[p + 1] >> SH, b = data[p + 2] >> SH;
    const idx = (r << (BITS * 2)) | (g << BITS) | b;
    hist[idx]++;
    sr[idx] += data[p]; sg[idx] += data[p + 1]; sb[idx] += data[p + 2];
  }
  const idxs = [];
  for (let i = 0; i < SIZE; i++) if (hist[i]) idxs.push(i);
  if (!idxs.length) return { rgb: [], weight: [] };   /* 整张图全透明 */
  const colorOf = (idx) => {
    const c = hist[idx];
    return [
      idx >> (BITS * 2) & 31, idx >> BITS & 31, idx & 31,
      sr[idx] / c, sg[idx] / c, sb[idx] / c, c
    ];
  };
  let boxes = [{ items: idxs.map(colorOf), r0: 0, r1: 31, g0: 0, g1: 31, b0: 0, b1: 31, count: n }];
  const boxStats = (b) => {
    let r0 = 31, r1 = 0, g0 = 31, g1 = 0, b0 = 31, b1 = 0, c = 0;
    for (const it of b.items) {
      if (it[0] < r0) r0 = it[0]; if (it[0] > r1) r1 = it[0];
      if (it[1] < g0) g0 = it[1]; if (it[1] > g1) g1 = it[1];
      if (it[2] < b0) b0 = it[2]; if (it[2] > b1) b1 = it[2];
      c += it[6];
    }
    b.r0 = r0; b.r1 = r1; b.g0 = g0; b.g1 = g1; b.b0 = b0; b.b1 = b1; b.count = c;
  };
  boxStats(boxes[0]);
  const target = Math.max(1, Math.min(maxColors, idxs.length));
  while (boxes.length < target) {
    let bi = -1, bv = -1;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.items.length < 2) continue;
      const span = Math.max(b.r1 - b.r0, b.g1 - b.g0, b.b1 - b.b0);
      const v = span * Math.log(b.count + 1) * (1 + b.items.length / (idxs.length + 1));
      if (v > bv) { bv = v; bi = i; }
    }
    if (bi < 0) break;
    const b = boxes[bi];
    const dr = b.r1 - b.r0, dg = b.g1 - b.g0, db = b.b1 - b.b0;
    const ch = (dr >= dg && dr >= db) ? 0 : (dg >= db ? 1 : 2);
    b.items.sort((x, y) => x[ch] - y[ch]);
    let half = b.count / 2, acc = 0, split = 1;
    for (let i = 0; i < b.items.length - 1; i++) {
      acc += b.items[i][6];
      if (acc >= half) { split = i + 1; break; }
    }
    const nb = { items: b.items.splice(split), r0: 0, r1: 0, g0: 0, g1: 0, b0: 0, b1: 0, count: 0 };
    boxStats(b); boxStats(nb);
    boxes.push(nb);
  }
  const rgb = [], weight = [];
  for (const b of boxes) {
    let R = 0, G = 0, B = 0, c = 0;
    for (const it of b.items) { R += it[3] * it[6]; G += it[4] * it[6]; B += it[5] * it[6]; c += it[6]; }
    if (c === 0) continue;
    rgb.push([Math.round(R / c), Math.round(G / c), Math.round(B / c)]);
    weight.push(c);
  }
  return { rgb, weight };
}

/** 中位切分 + 最近的 K 个中心重新求均值（refine） */
function quantizeImage(data, n, maxColors) {
  const mc = medianCut(data, n, maxColors);
  if (!mc.rgb.length) return { rgb: [], weight: [] };
  const K = mc.rgb.length;
  if (K === 1) return mc;
  const sumR = new Float64Array(K), sumG = new Float64Array(K), sumB = new Float64Array(K), cnt = new Float64Array(K);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (data[p + 3] < 128) continue;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    let best = 0, bd = Infinity;
    for (let k = 0; k < K; k++) {
      const c = mc.rgb[k];
      const d = cdist(r, g, b, c[0], c[1], c[2]);
      if (d < bd) { bd = d; best = k; }
    }
    sumR[best] += r; sumG[best] += g; sumB[best] += b; cnt[best]++;
  }
  const rgb = [], weight = [];
  for (let k = 0; k < K; k++) {
    if (!cnt[k]) continue;
    rgb.push([Math.round(sumR[k] / cnt[k]), Math.round(sumG[k] / cnt[k]), Math.round(sumB[k] / cnt[k])]);
    weight.push(cnt[k]);
  }
  return { rgb, weight };
}

/** 5-bit 网格加速表：把红绿蓝各压缩到 5bit（32768 格），加速最近色查找 */
const LUT_BITS = 5, LUT_SH = 3, LUT_N = 1 << (LUT_BITS * 3);
const lutCache = new Map();
function buildLUT(rgbArr, key) {
  const ck = key || ('p' + rgbArr.length + ':' + rgbArr[0] + ',' + rgbArr[rgbArr.length - 1]);
  let lut = lutCache.get(ck);
  if (lut) return lut;
  lut = new Int16Array(LUT_N);
  const sh = 8 - LUT_BITS;
  for (let r = 0; r < (1 << LUT_BITS); r++) {
    const R = (r << sh) | (1 << (sh - 1));
    for (let g = 0; g < (1 << LUT_BITS); g++) {
      const G = (g << sh) | (1 << (sh - 1));
      for (let b = 0; b < (1 << LUT_BITS); b++) {
        const B = (b << sh) | (1 << (sh - 1));
        lut[(r << (LUT_BITS * 2)) | (g << LUT_BITS) | b] = nearest(rgbArr, R, G, B);
      }
    }
  }
  lutCache.set(ck, lut);
  return lut;
}
function lutNearest(lut, r, g, b) {
  return lut[((r >> LUT_SH) << (LUT_BITS * 2)) | ((g >> LUT_SH) << LUT_BITS) | (b >> LUT_SH)];
}

/* =====================================================================
   主流程
   ===================================================================== */
/**
 * @param {HTMLCanvasElement} source 源图（已裁剪/旋转）
 * @param {object} opt 全部参数
 * @returns {{grid:Uint16Array, gw:number, gh:number, colors:Array, counts:Int32Array, ms:number}}
 */
function generateGrid(source, opt) {
  const t0 = performance.now();
  const gw = Math.max(1, opt.gridW | 0), gh = Math.max(1, opt.gridH | 0);

  /* 让源图比例贴合网格 */
  const iw = source.width, ih = source.height;
  const targetAR = gw / gh;
  const srcAR = iw / ih;
  const fit = opt.fit || 'contain';
  let drawW, drawH, offX, offY;
  if (fit === 'stretch') {
    drawW = iw; drawH = ih; offX = 0; offY = 0;
  } else if (fit === 'cover' || Math.abs(targetAR - srcAR) < 0.002) {
    if (srcAR > targetAR) { drawH = ih; drawW = Math.round(ih * targetAR); }
    else { drawW = iw; drawH = Math.round(iw / targetAR); }
    offX = (drawW - iw) / 2; offY = (drawH - ih) / 2;
  } else {
    if (srcAR > targetAR) { drawW = iw; drawH = Math.round(iw / targetAR); }
    else { drawH = ih; drawW = Math.round(ih * targetAR); }
    offX = (drawW - iw) / 2; offY = (drawH - ih) / 2;
  }

  /* 中间工作分辨率：色板模式下适当降低以保留大色块 */
  let ww = drawW, wh = drawH;
  const wantBead = opt.mode === 'beads' && opt.colors && opt.colors.length;
  if (wantBead) {
    const defMax = Math.max(gw, gh);
    const boost = opt.simplify > 0 ? Math.max(1, 1 + opt.simplify * 1.8) : 1;
    /* 抖动是逐像素误差扩散，成本随工作分辨率平方增长，单独压低上限 */
    const cap = opt.dither ? 440 : 560;
    const wmax = Math.round(Math.min(cap, Math.max(defMax * 6, defMax * 3 * boost)));
    const scale = Math.max(1, Math.min(8, wmax / defMax));
    ww = Math.max(gw, Math.round(gw * scale));
    wh = Math.max(gh, Math.round(gh * scale));
  } else {
    ww = gw; wh = gh;
  }

  let work;
  if (opt.sampleMode === 'dominant') {
    let scaled;
    if (Math.abs(offX) < 0.5 && Math.abs(offY) < 0.5 && Math.abs(drawW - iw) < 1 && Math.abs(drawH - ih) < 1) scaled = source;
    else scaled = resizeRegion(source, -offX, -offY, -offX + drawW, -offY + drawH, Math.max(1, Math.round(Math.min(drawW, ww))), Math.max(1, Math.round(Math.min(drawH, wh))));
    const stage = resizeImage(scaled, ww, wh);
    work = dominantSample(stage, gw, gh);
  } else {
    if (Math.abs(offX) < 0.5 && Math.abs(offY) < 0.5 && Math.abs(drawW - iw) < 1 && Math.abs(drawH - ih) < 1) {
      work = resizeImage(source, ww, wh);
    } else {
      work = resizeRegion(source, -offX, -offY, -offX + drawW, -offY + drawH, ww, wh);
    }
  }

  const wctx = ctxOf(work);
  const wimg = wctx.getImageData(0, 0, work.width, work.height);
  const data = wimg.data;
  const wn = work.width * work.height;

  /* 图像调整 */
  if (opt.brightness || opt.contrast || opt.saturation || opt.sharpness) {
    applyAdjust(data, {
      brightness: opt.brightness, contrast: opt.contrast, saturation: opt.saturation,
      sharpness: opt.sharpness, w: work.width, h: work.height
    });
  }

  /* 去背景 */
  let bgMask = null;
  if (opt.removeBg) {
    const bres = buildBgMask(data, work.width, work.height, opt.bgTol || 26);
    bgMask = bres.mask;
    for (let i = 0, p = 0; i < wn; i++, p += 4) if (bgMask[i]) data[p + 3] = 0;
    wctx.putImageData(wimg, 0, 0);
  }

  /* 量化：中位切分得到 K 个代表色，再决定最终色板 */
  const quant = quantizeImage(data, wn, Math.max(2, Math.min(256, opt.colorCount)));
  if (!quant.rgb.length) {
    /* 整张图都是透明的：不产生任何豆子 */
    return {
      grid: new Uint16Array(gw * gh).fill(0xFFFF),
      gw, gh, colors: [], counts: new Int32Array(0), total: 0,
      ms: performance.now() - t0, work
    };
  }
  const K = quant.rgb.length;
  const palette = wantBead ? opt.colors : quant.rgb;

  /* 每个量化中心 -> 目标色板索引 */
  const entryTarget = new Int32Array(K);
  const lut = opt.mode === 'beads' ? buildLUT(palette, opt.lutKey) : null;
  for (let k = 0; k < K; k++) {
    const c = quant.rgb[k];
    entryTarget[k] = opt.mode === 'beads' ? lutNearest(lut, c[0], c[1], c[2]) : k;
  }
  /* 去重后的最终色板 */
  const useMap = new Int32Array(opt.mode === 'beads' ? palette.length : K).fill(-1);
  const finalRGB = [], finalMeta = [];
  for (let k = 0; k < K; k++) {
    const t = entryTarget[k];
    if (useMap[t] < 0) {
      useMap[t] = finalRGB.length;
      finalRGB.push(palette[t].slice(0, 3));
      finalMeta.push(t);
    }
  }
  const FK = finalRGB.length;

  /* 逐像素分配（可选 Floyd–Steinberg 抖动） */
  const grid = new Uint16Array(gw * gh);
  const gwW = work.width, ghW = work.height;
  const xr = gwW / gw, yr = ghW / gh;
  const dither = !!opt.dither;

  if (!dither) {
    /* 无抖动：先算工作分辨率下每格的索引，再合并到网格 */
    const cellIdx = new Uint16Array(wn);
    for (let i = 0, p = 0; i < wn; i++, p += 4) {
      if (data[p + 3] < 128) { cellIdx[i] = 0xFFFF; continue; }
      let best = 0, bd = Infinity;
      for (let k = 0; k < K; k++) {
        const c = quant.rgb[k];
        const d = cdist(data[p], data[p + 1], data[p + 2], c[0], c[1], c[2]);
        if (d < bd) { bd = d; best = k; }
      }
      cellIdx[i] = useMap[entryTarget[best]];
    }
    for (let gy = 0; gy < gh; gy++) {
      const y0 = Math.floor(gy * yr), y1 = Math.max(y0 + 1, Math.min(ghW, Math.ceil((gy + 1) * yr)));
      for (let gx = 0; gx < gw; gx++) {
        const x0 = Math.floor(gx * xr), x1 = Math.max(x0 + 1, Math.min(gwW, Math.ceil((gx + 1) * xr)));
        const cnt = new Int32Array(FK);
        let total = 0;
        for (let y = y0; y < y1; y++) {
          const row = y * gwW;
          for (let x = x0; x < x1; x++) {
            const v = cellIdx[row + x];
            if (v === 0xFFFF) continue;
            cnt[v]++; total++;
          }
        }
        if (!total) { grid[gy * gw + gx] = 0xFFFF; continue; }
        let best = 0, bn = -1;
        for (let k = 0; k < FK; k++) if (cnt[k] > bn) { bn = cnt[k]; best = k; }
        grid[gy * gw + gx] = best;
      }
    }
  } else {
    /* 抖动：在工作分辨率上做误差扩散 */
    const buf = new Float32Array(wn * 3);
    let anyAlpha = false;
    for (let i = 0, p = 0, q = 0; i < wn; i++, p += 4, q += 3) {
      const a = data[p + 3];
      if (a < 24) { buf[q] = buf[q + 1] = buf[q + 2] = -1e9; }
      else {
        if (a < 255) { buf[q] = data[p] * 255 / a > 255 ? 255 : data[p] * 255 / a;
          buf[q + 1] = data[p + 1] * 255 / a > 255 ? 255 : data[p + 1] * 255 / a;
          buf[q + 2] = data[p + 2] * 255 / a > 255 ? 255 : data[p + 2] * 255 / a;
          anyAlpha = true;
        } else { buf[q] = data[p]; buf[q + 1] = data[p + 1]; buf[q + 2] = data[p + 2]; }
      }
    }
    const cellIdx = new Uint16Array(wn);
    for (let y = 0; y < ghW; y++) {
      const rev = (y & 1) === 1;
      const xStart = rev ? gwW - 1 : 0, xEnd = rev ? -1 : gwW, xStep = rev ? -1 : 1;
      for (let x = xStart; x !== xEnd; x += xStep) {
        const i = y * gwW + x, q = i * 3;
        if (buf[q] < -1e8) { cellIdx[i] = 0xFFFF; continue; }
        const R = buf[q], G = buf[q + 1], B = buf[q + 2];
        let best = 0, bd = Infinity;
        for (let k = 0; k < K; k++) {
          const c = quant.rgb[k];
          const d = cdist(R, G, B, c[0], c[1], c[2]);
          if (d < bd) { bd = d; best = k; }
        }
        const c = quant.rgb[best];
        const er = R - c[0], eg = G - c[1], eb = B - c[2];
        cellIdx[i] = useMap[entryTarget[best]];
        const push = (xx, yy, f) => {
          if (xx < 0 || xx >= gwW || yy < 0 || yy >= ghW) return;
          const j = (yy * gwW + xx) * 3;
          if (buf[j] < -1e8) return;
          buf[j] += er * f; buf[j + 1] += eg * f; buf[j + 2] += eb * f;
        };
        push(x + xStep, y, 7 / 16);
        push(x - xStep, y + 1, 3 / 16);
        push(x, y + 1, 5 / 16);
        push(x + xStep, y + 1, 1 / 16);
      }
    }
    for (let gy = 0; gy < gh; gy++) {
      const y0 = Math.floor(gy * yr), y1 = Math.max(y0 + 1, Math.min(ghW, Math.ceil((gy + 1) * yr)));
      for (let gx = 0; gx < gw; gx++) {
        const x0 = Math.floor(gx * xr), x1 = Math.max(x0 + 1, Math.min(gwW, Math.ceil((gx + 1) * xr)));
        const cnt = new Int32Array(FK);
        let total = 0;
        for (let y = y0; y < y1; y++) {
          const row = y * gwW;
          for (let x = x0; x < x1; x++) {
            const v = cellIdx[row + x];
            if (v === 0xFFFF) continue;
            cnt[v]++; total++;
          }
        }
        if (!total) { grid[gy * gw + gx] = 0xFFFF; continue; }
        let best = 0, bn = -1;
        for (let k = 0; k < FK; k++) if (cnt[k] > bn) { bn = cnt[k]; best = k; }
        grid[gy * gw + gx] = best;
      }
    }
  }

  /* 统计 */
  const counts = new Int32Array(FK);
  let total = 0;
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v === 0xFFFF) continue;
    counts[v]++; total++;
  }
  const colors = [];
  for (let k = 0; k < FK; k++) {
    if (!counts[k]) continue;
    const t = finalMeta[k];
    colors.push({
      rgb: finalRGB[k],
      hex: rgb2hex(finalRGB[k][0], finalRGB[k][1], finalRGB[k][2]),
      code: opt.mode === 'beads' ? (opt.codes[t] || ('#' + t)) : ('C' + (k + 1)),
      count: counts[k],
      paletteIndex: opt.mode === 'beads' ? t : -1,
      pos: k                                   /* 压缩前的索引，用于排序后重映射 */
    });
  }
  colors.sort((a, b) => b.count - a.count);

  /* 排序后必须把网格索引重映射到新顺序，否则统计数字与图纸不一致 */
  const oldToNew = new Int32Array(FK).fill(-1);
  for (let newIdx = 0; newIdx < colors.length; newIdx++) oldToNew[colors[newIdx].pos] = newIdx;
  for (const c of colors) delete c.pos;
  const gOut = new Uint16Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    gOut[i] = v === 0xFFFF ? 0xFFFF : oldToNew[v];
  }
  const countsOut = new Int32Array(colors.length);
  for (let i = 0; i < gOut.length; i++) if (gOut[i] !== 0xFFFF) countsOut[gOut[i]]++;

  return { grid: gOut, gw, gh, colors, counts: countsOut, total, ms: performance.now() - t0, work };
}

/* =====================================================================
   图案渲染
   ===================================================================== */
/** 编辑后重排色板：剔除已不存在的颜色、按用豆量降序、网格索引同步更新 */
function normalizeGrid(grid, colors) {
  const n = colors.length;
  const tally = new Int32Array(n);
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v !== 0xFFFF && v < n) tally[v]++;
  }
  /* 仍在使用的颜色，按数量降序编号 */
  const alive = [];
  for (let i = 0; i < n; i++) if (tally[i] > 0) alive.push(i);
  alive.sort((a, b) => tally[b] - tally[a]);
  const remap = new Int32Array(n).fill(-1);
  const out = new Array(alive.length);
  const counts = new Int32Array(alive.length);
  for (let k = 0; k < alive.length; k++) {
    const old = alive[k];
    remap[old] = k;
    out[k] = { ...colors[old], count: tally[old] };
    counts[k] = tally[old];
  }
  const g = new Uint16Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    g[i] = (v === 0xFFFF || v >= n) ? 0xFFFF : remap[v];
  }
  return { grid: g, colors: out, counts: counts };
}

function drawPattern(g, ctx, cell, opts) {
  const { gw, gh, grid, colors } = g;
  const bead = opts.beadView;
  const showGrid = opts.showGrid;
  const showCode = opts.showCode;
  const majorGrid = opts.majorGrid;
  ctx.clearRect(0, 0, gw * cell, gh * cell);
  if (!bead) {
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const v = grid[y * gw + x];
        if (v === 0xFFFF) continue;
        ctx.fillStyle = colors[v].hex;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  } else {
    const paths = colors.map(() => new Path2D());
    const pad = cell * 0.03;
    const r = cell / 2 - pad;
    const cx0 = cell / 2;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const v = grid[y * gw + x];
        if (v === 0xFFFF) continue;
        const p = paths[v];
        p.moveTo(x * cell + cx0 + r, y * cell + cx0);
        p.arc(x * cell + cx0, y * cell + cx0, r, 0, Math.PI * 2);
      }
    }
    for (let i = 0; i < colors.length; i++) {
      ctx.fillStyle = colors[i].hex;
      ctx.fill(paths[i]);
      if (cell >= 7) {
        ctx.strokeStyle = 'rgba(0,0,0,.22)';
        ctx.lineWidth = Math.max(0.5, cell * 0.045);
        ctx.stroke(paths[i]);
      }
    }
  }
  if (showGrid && cell >= 3) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < gw; x++) { ctx.moveTo(x * cell + .5, 0); ctx.lineTo(x * cell + .5, gh * cell); }
    for (let y = 1; y < gh; y++) { ctx.moveTo(0, y * cell + .5); ctx.lineTo(gw * cell, y * cell + .5); }
    ctx.stroke();
    if (majorGrid) {
      ctx.strokeStyle = 'rgba(0,0,0,.72)';
      ctx.lineWidth = Math.max(1, cell * 0.07);
      ctx.beginPath();
      for (let x = 5; x < gw; x += 5) { ctx.moveTo(x * cell + .5, 0); ctx.lineTo(x * cell + .5, gh * cell); }
      for (let y = 5; y < gh; y += 5) { ctx.moveTo(0, y * cell + .5); ctx.lineTo(gw * cell, y * cell + .5); }
      ctx.stroke();
    }
    ctx.restore();
  }
  if (showCode && cell >= 13) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.max(6, Math.round(cell * 0.34))}px -apple-system,"Segoe UI","Microsoft YaHei",sans-serif`;
    const placed = new Map();
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const v = grid[y * gw + x];
        if (v === 0xFFFF) continue;
        const c = colors[v];
        const label = c.code;
        const step = label.length >= 4 ? 3 : label.length === 3 ? 2 : 1;
        if (!opts.everyCode && step > 1 && ((x % step) || (y % step))) continue;
        const lum = 0.2126 * c.rgb[0] + 0.7152 * c.rgb[1] + 0.0722 * c.rgb[2];
        ctx.fillStyle = lum > 150 ? 'rgba(0,0,0,.82)' : 'rgba(255,255,255,.92)';
        ctx.fillText(label, x * cell + cell / 2, y * cell + cell / 2 + cell * 0.03, cell * 0.94);
      }
    }
    ctx.restore();
  }
}

/* =====================================================================
   导出
   ===================================================================== */
function renderExportCanvas(g, scale, opt) {
  const { gw, gh, colors } = g;
  const showCode = opt.codes && scale >= 16;
  const band = showCode ? Math.max(20, Math.round(scale * 1.4)) : 0;
  const ruler = opt.ruler ? Math.max(18, Math.round(scale * 0.95)) : 0;
  const pad = Math.max(12, Math.round(scale * 0.7));
  const titleH = Math.max(26, Math.round(scale * 1.5));
  const legend = opt.legend ? buildLegendLayout(colors, scale) : null;
  const footH = legend ? Math.max(18, Math.round(scale * 0.95)) : 0;
  const gridW = gw * scale, gridH = gh * scale;
  const W = Math.max(gridW + ruler + pad * 2, legend ? legend.width + pad * 2 : 0);
  const H = titleH + ruler + gridH + band + footH +
    (legend ? legend.height + Math.round(scale * 0.9) + pad : 0) + pad;

  const cv = newCanvas(W, H);
  const ctx = ctxOf(cv);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  /* 标题 */
  const title = opt.title || '拼豆图纸';
  const sub = opt.subtitle || '';
  ctx.fillStyle = '#111';
  ctx.font = `700 ${Math.max(15, Math.round(scale * 0.9))}px -apple-system,"Segoe UI","Microsoft YaHei",sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(title, pad, titleH * 0.5);
  if (sub) {
    ctx.fillStyle = '#666';
    ctx.font = `400 ${Math.max(11, Math.round(scale * 0.5))}px -apple-system,"Segoe UI","Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(sub, W - pad, titleH * 0.5);
  }

  const gx0 = pad + ruler, gy0 = titleH + ruler;
  /* 背景网格底板 */
  ctx.fillStyle = '#f2f4f8';
  ctx.fillRect(gx0 - 1, gy0 - 1, gw * scale + 2, gh * scale + 2);

  /* 色块 */
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const v = g.grid[y * gw + x];
      if (v === 0xFFFF) continue;
      ctx.fillStyle = colors[v].hex;
      ctx.fillRect(gx0 + x * scale, gy0 + y * scale, scale, scale);
      if (scale >= 30) {
        /* 圆点提示，方便数格子 */
        ctx.fillStyle = 'rgba(0,0,0,.05)';
        ctx.beginPath();
        ctx.arc(gx0 + x * scale + scale / 2, gy0 + y * scale + scale / 2, scale * 0.44, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  /* 网格线 */
  ctx.strokeStyle = 'rgba(0,0,0,.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= gw; x++) { ctx.moveTo(gx0 + x * scale + .5, gy0); ctx.lineTo(gx0 + x * scale + .5, gy0 + gh * scale); }
  for (let y = 0; y <= gh; y++) { ctx.moveTo(gx0, gy0 + y * scale + .5); ctx.lineTo(gx0 + gw * scale, gy0 + y * scale + .5); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.62)';
  ctx.lineWidth = Math.max(1, scale * 0.07);
  ctx.beginPath();
  for (let x = 5; x < gw; x += 5) { ctx.moveTo(gx0 + x * scale + .5, gy0); ctx.lineTo(gx0 + x * scale + .5, gy0 + gh * scale); }
  for (let y = 5; y < gh; y += 5) { ctx.moveTo(gx0, gy0 + y * scale + .5); ctx.lineTo(gx0 + gw * scale, gy0 + y * scale + .5); }
  ctx.stroke();

  /* 色号 */
  if (showCode) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.max(7, Math.round(scale * 0.34))}px -apple-system,"Segoe UI","Microsoft YaHei",sans-serif`;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const v = g.grid[y * gw + x];
        if (v === 0xFFFF) continue;
        const c = colors[v];
        const label = c.code;
        const step = label.length >= 4 ? 3 : label.length === 3 ? 2 : 1;
        if (!opt.everyCode && step > 1 && ((x % step) || (y % step))) continue;
        const lum = 0.2126 * c.rgb[0] + 0.7152 * c.rgb[1] + 0.0722 * c.rgb[2];
        ctx.fillStyle = lum > 150 ? 'rgba(0,0,0,.85)' : 'rgba(255,255,255,.95)';
        ctx.fillText(label, gx0 + x * scale + scale / 2, gy0 + y * scale + scale / 2 + scale * 0.03, scale * 0.94);
      }
    }
  }

  /* 标尺 */
  if (ruler) {
    ctx.fillStyle = '#8892a6';
    ctx.font = `600 ${Math.max(8, Math.round(scale * 0.4))}px -apple-system,"Segoe UI","Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const stepN = ruler >= 30 ? 1 : (gw > 60 ? 5 : (gw > 30 ? 2 : 1));
    for (let x = 0; x < gw; x++) {
      if (x % stepN) continue;
      ctx.fillText(String(x + 1), gx0 + x * scale + scale / 2, gy0 - ruler / 2 + 1);
    }
    const stepM = gh > 60 ? 5 : (gh > 30 ? 2 : 1);
    for (let y = 0; y < gh; y++) {
      if (y % stepM) continue;
      ctx.textAlign = 'right';
      ctx.fillText(String(y + 1), gx0 - ruler / 2 + 2, gy0 + y * scale + scale / 2);
    }
    /* 每 5 格坐标轴标线 */
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx0 + .5, gy0 - 4); ctx.lineTo(gx0 + .5, gy0 + 0.5);
    ctx.moveTo(gx0 - 4, gy0 + .5); ctx.lineTo(gx0 + .5, gy0 + .5);
    ctx.stroke();
  }

  /* 图例 */
  if (legend) {
    const headGap = Math.round(scale * 0.9);
    const ly0 = gy0 + gridH + band + headGap + legend.headH;
    const swatch = legend.swatch;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.font = `700 ${Math.max(11, Math.round(scale * 0.62))}px -apple-system,"Segoe UI","Microsoft YaHei",sans-serif`;
    ctx.fillText('用豆清单（色号 / 颗数）', pad, gy0 + gridH + band + headGap + Math.round(legend.headH * 0.45));
    for (let i = 0; i < colors.length; i++) {
      const col = i % legend.perRow, row = (i / legend.perRow) | 0;
      const bx = pad + col * legend.colW;
      const by = ly0 + row * legend.rowH;
      ctx.fillStyle = colors[i].hex;
      ctx.fillRect(bx, by, swatch, swatch);
      ctx.strokeStyle = 'rgba(0,0,0,.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + .5, by + .5, swatch - 1, swatch - 1);
      const fs = Math.max(9, Math.round(scale * 0.40));
      const fs2 = Math.max(8, fs - 1);
      /* 两行文字以整行高度为基准排布，行距由 buildLegendLayout 保证不挤压 */
      const boxH = legend.rowH;
      const y1 = by + Math.round(legend.lineTop);
      const y2 = by + Math.round(boxH - legend.lineBot);
      ctx.fillStyle = '#111';
      ctx.font = `700 ${fs}px -apple-system,"Segoe UI","Microsoft YaHei",sans-serif`;
      ctx.fillText(colors[i].code, bx + swatch + Math.max(7, Math.round(scale * 0.3)), y1);
      ctx.fillStyle = '#666';
      ctx.font = `400 ${fs2}px -apple-system,"Segoe UI","Microsoft YaHei",sans-serif`;
      ctx.fillText(colors[i].count + ' 颗', bx + swatch + Math.max(7, Math.round(scale * 0.3)), y2);
    }
  }
  /* 页脚免责声明：单独占一条底线，不与图例抢空间 */
  if (footH) {
    ctx.fillStyle = '#9aa3b2';
    ctx.font = `400 ${Math.max(9, Math.round(scale * 0.34))}px -apple-system,"Segoe UI","Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('色号为屏幕参考值，请以实物色卡为准', W - pad, H - footH * 0.5);
  }
  return cv;
}

function buildLegendLayout(colors, scale) {
  const swatch = Math.max(16, Math.round(scale * 0.8));
  const colW = swatch + Math.max(58, Math.round(scale * 3.4));
  /* 行高严格由两行文字的高度推出，保证"色号 / 颗数"永不挤压 */
  const fsCode = Math.max(9, Math.round(scale * 0.40));
  const fsCnt = Math.max(8, fsCode - 1);
  const lineGap = Math.max(4, Math.round(scale * 0.16));
  const textH = Math.round(fsCode * 1.0) + lineGap + Math.round(fsCnt * 1.05);
  const rowH = Math.max(swatch + 6, textH + Math.round(scale * 0.5));
  const headH = Math.max(18, Math.round(scale * 0.95));   /* 表头单独占一行 */
  const maxW = 1000;
  const perRow = Math.max(1, Math.min(8, Math.floor(maxW / colW)));
  const rows = Math.ceil(Math.max(1, colors.length) / perRow);
  return {
    swatch, perRow, colW, rowH, headH,
    lineTop: Math.max(3, (rowH - textH) / 2 + fsCode * 0.55),
    lineBot: Math.max(3, (rowH - textH) / 2 + fsCnt * 0.62),
    width: perRow * colW - Math.max(20, Math.round(scale * 0.8)),
    height: headH + rows * rowH + Math.round(scale * 0.5)
  };
}


const EMPTY = 0xFFFF;
const MAX_GRID = 400;
const SOURCE = 'https://github.com/HansBug/pindou-color-data';
const metadata = {
 mard291:{brand:'MARD',series:'MARD公开色库',namespace:'mard'},
 mard221:{brand:'MARD',series:'MARD公开色库',namespace:'mard'},
 artkalC:{brand:'ARTKAL',series:'C 系列',namespace:'artkal-c'},
 artkalM:{brand:'ARTKAL',series:'M-2.6mm',namespace:'artkal-m'},
 manman:{brand:'漫漫',series:'漫漫 278 色',namespace:'manman'},
 coco:{brand:'COCO',series:'COCO 291 色',namespace:'coco'},
 mixiaowo:{brand:'米小窝',series:'米小窝 290 色',namespace:'mixiaowo'}
};
const exactKeys = new Map(), customRegistry = new Map();
const cleanHex = value => {
 if(typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))throw new TypeError('颜色数据无效。');
 return value.toUpperCase();
};
function colorGroup(rgb){
 const [r,g,b]=rgb,max=Math.max(r,g,b),min=Math.min(r,g,b);
 if(max-min<22)return 'neutral';
 if(max<115&&r>=g&&g>b)return 'earth';
 if(g>r*1.08&&g>b*.97)return 'green';
 if(b>r*1.04&&b>g*.95)return 'blue';
 if(r>b*.95&&b>g*1.16)return r>b*1.15?'pink':'violet';
 if(r>g*1.18&&r>b*1.18)return 'warm';
 if(r>g&&g>b)return 'earth';
 return 'muted';
}
const keyIdentity=(id,code,hex)=>`${metadata[id].namespace}\u0000${code}\u0000${hex}`;
function registerBrandColor(id,code,rgb){
 const m=metadata[id],hex=rgb2hex(...rgb),identity=keyIdentity(id,code,hex);
 if(exactKeys.has(identity))return exactKeys.get(identity);
 const primary=`${m.namespace}:${code}`;
 let key=primary;
 const existing=CRAFT_PALETTE[primary];
 if(existing&&(existing.brand!==m.brand||existing.series!==m.series||existing.hex.toUpperCase()!==hex))key=`pattern:${m.namespace}:${code}:${hex.slice(1)}`;
 if(!CRAFT_PALETTE[key])CRAFT_PALETTE[key]=Object.freeze({brand:m.brand,series:m.series,code,name:`${m.brand} ${code}`,hex,rgb:Object.freeze(rgb.slice()),group:colorGroup(rgb),colorSeries:code.match(/^[A-Za-z]+/)?.[0]||'数字色号',material:'solid',materialLabel:'色卡参考',officialRGB:false,source:SOURCE,sourceLabel:'原图纸工具的公开色卡',sourceQuality:'public_reference',version:'supplied-generator',pendingCode:code.startsWith('UNKNOWN-')});
 exactKeys.set(identity,key);
 return key;
}
const catalogList=Object.keys(metadata).map(id=>{
 const p=PatternPaletteData[id],m=metadata[id];
 if(!p||p.codes.length!==p.rgb.length)throw new Error('图纸色库数据不完整。');
 const keys=p.codes.map((code,i)=>registerBrandColor(id,code,p.rgb[i]));
 return Object.freeze({id,label:p.name,name:p.name,note:p.note.replace(/官方/g,'参考'),brand:m.brand,series:m.series,count:p.codes.length,keys:Object.freeze(keys),source:SOURCE,sourceLabel:'原图纸工具的公开色卡',version:'supplied-generator',referenceNote:'沿用你提供的图纸工具色卡。屏幕色仅供参考；未将公开数据标为厂家官方色卡。'});
});
function palette(id){
 const p=PatternPaletteData[id],catalog=catalogList.find(c=>c.id===id);
 if(!p||!catalog)throw new TypeError('请选择有效的图纸色卡。');
 return {...catalog,codes:p.codes.slice(),rgb:p.rgb.map(c=>c.slice()),colors:p.codes.map((code,i)=>({...CRAFT_PALETTE[catalog.keys[i]],key:catalog.keys[i],rgb:p.rgb[i].slice()}))};
}
function registerCustomColors(colors){
 if(!Array.isArray(colors)||colors.length>4096)throw new TypeError('自定义颜色数据无效。');
 const checked=colors.map(c=>{
  const hex=cleanHex(c?.hex),key=`pattern-custom:${hex}`;
  if(c.key!==key)throw new TypeError('自定义颜色编号与颜色不匹配。');
  if(CRAFT_PALETTE[key]&&CRAFT_PALETTE[key].hex.toUpperCase()!==hex)throw new TypeError('自定义颜色编号冲突。');
  return {key,hex,rgb:hex2rgb(hex),brand:'图像取色',series:'图像取色（非商品色号）',code:hex,name:hex,group:colorGroup(hex2rgb(hex)),colorSeries:'custom',material:'solid',materialLabel:'图像颜色',officialRGB:false,source:'',sourceLabel:'导入图片取色',sourceQuality:'image_sample',version:'1'};
 });
 for(const c of checked){if(!CRAFT_PALETTE[c.key])CRAFT_PALETTE[c.key]=Object.freeze({...c,rgb:Object.freeze(c.rgb)});customRegistry.set(c.key,c);}
 return checked.map(c=>c.key);
}
function colorKey(brand,code,hex){
 hex=cleanHex(hex);
 if(brand==='auto'||brand==='original'||brand==='raw'){
  const key=`pattern-custom:${hex}`;registerCustomColors([{key,hex}]);return key;
 }
 if(!metadata[brand]||typeof code!=='string')throw new TypeError('图纸品牌或色号无效。');
 const key=exactKeys.get(keyIdentity(brand,code,hex));
 if(!key)throw new TypeError(`${metadata[brand].brand} ${code} 的颜色与所选色卡不一致。`);
 return key;
}
function customColorsForGrids(grids){
 const keys=new Set();
 if(!Array.isArray(grids))return [];
 for(const grid of grids){if(!Array.isArray(grid))continue;for(const row of grid){if(!Array.isArray(row))continue;for(const key of row)if(typeof key==='string'&&key.startsWith('pattern-custom:')&&CRAFT_PALETTE[key])keys.add(key);}}
 return [...keys].map(key=>({key,hex:CRAFT_PALETTE[key].hex}));
}
function convert(source,options={}){
 if(!source||typeof source.getContext!=='function'||!Number.isFinite(source.width)||!Number.isFinite(source.height)||source.width<1||source.height<1||source.width>8192||source.height>8192||source.width*source.height>33554432)throw new TypeError('请导入有效的图片画布。');
 const gridW=Number(options.gridW??64),gridH=Number(options.gridH??gridW);
 if(!Number.isInteger(gridW)||!Number.isInteger(gridH)||gridW<1||gridH<1||gridW>MAX_GRID||gridH>MAX_GRID)throw new RangeError('图纸每边需在 1–400 格之间。');
 const mode=['auto','original','raw'].includes(options.mode)?options.mode:'beads';
 const brand=mode==='beads'?(options.brand||'mard291'):(mode==='raw'?'original':mode);
 const opt={...options,gridW,gridH,mode:mode==='beads'?'beads':'auto',fit:['contain','cover','stretch'].includes(options.fit)?options.fit:'contain',colorCount:clamp(Number(options.colorCount)||32,2,256),brightness:clamp(Number(options.brightness)||0,-100,100),contrast:clamp(Number(options.contrast)||0,-100,100),saturation:clamp(Number(options.saturation)||0,-100,100),sharpness:clamp(Number(options.sharpness)||0,0,100),bgTol:clamp(Number(options.bgTol)||26,1,100),simplify:clamp(Number(options.simplify)||0,0,4)};
 if(mode==='beads'){const p=palette(brand);opt.colors=p.rgb;opt.codes=p.codes;opt.lutKey=`pattern-brand:${brand}`;}
 const result=generateGrid(source,opt);
 result.brand=brand;
 result.settings={...options,gridW,gridH,mode:mode==='raw'?'original':mode,brand};
 result.colors=result.colors.map(c=>({...c,key:colorKey(brand,c.code,c.hex),brand:metadata[brand]?.brand||'图像取色',series:metadata[brand]?.series||'图像取色（非商品色号）'}));
 return result;
}
function render(result,canvas,options={}){
 const cell=Math.max(1,Math.min(96,Number(options.cell)||Math.max(1,Math.floor(800/Math.max(result.gw,result.gh)))));
 canvas.width=Math.max(1,Math.round(result.gw*cell));canvas.height=Math.max(1,Math.round(result.gh*cell));
 drawPattern(result,ctxOf(canvas),cell,{showGrid:options.grid??options.showGrid??true,showCode:options.code??options.showCode??false,beadView:options.bead??options.beadView??false,majorGrid:options.major??options.majorGrid??true,everyCode:options.everyCode===true});
 return canvas;
}
function exportCanvas(result,scale=16,options={}){
 scale=Math.max(1,Math.min(40,Math.round(Number(scale)||16)));
 if(result.gw*result.gh*scale*scale>42000000)throw new RangeError('导出尺寸过大，请选择较低的像素倍率。');
 return renderExportCanvas(result,scale,{codes:true,ruler:true,legend:true,...options});
}
function plainObject(value,limit=12000){
 if(value==null)return {};
 let text;try{text=JSON.stringify(value);}catch{throw new TypeError('图纸设置无法保存。');}
 if(text.length>limit)throw new RangeError('图纸设置过大。');
 const parsed=JSON.parse(text),walk=(v,depth=0)=>{
  if(depth>5)throw new TypeError('图纸设置层级过深。');
  if(v==null||typeof v==='boolean'||typeof v==='string'||(typeof v==='number'&&Number.isFinite(v)))return v;
  if(Array.isArray(v))return v.map(x=>walk(x,depth+1));
  if(typeof v==='object'){const out={};for(const [key,val]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(key))throw new TypeError('图纸设置字段无效。');out[key]=walk(val,depth+1);}return out;}
  throw new TypeError('图纸设置值无效。');
 };
 if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new TypeError('图纸设置无效。');
 return walk(parsed);
}
function sourceURL(value,limit,label){
 if(value==null||value==='')return undefined;
 if(typeof value!=='string'||value.length>limit||!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(value))throw new TypeError(`${label}数据无效或过大。`);
 return value;
}
const newId=()=>`pattern-${Date.now().toString(36)}-${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2,12)}`;
function validateRecord(input){
 if(!input||typeof input!=='object')throw new TypeError('图纸数据无效。');
 const width=Number(input.width),height=Number(input.height),brand=input.brand||'mard291';
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>MAX_GRID||height>MAX_GRID)throw new RangeError('图纸尺寸无效。');
 if(!metadata[brand]&&!['auto','original'].includes(brand))throw new TypeError('图纸色卡无效。');
 if(!Array.isArray(input.colors)||input.colors.length>2048||!Array.isArray(input.grid)||input.grid.length!==width*height)throw new TypeError('图纸网格或颜色表无效。');
 const colors=input.colors.map((c,i)=>{
  const hex=cleanHex(c?.hex),code=String(c?.code??`C${i+1}`);
  if(code.length>48)throw new TypeError('图纸色号无效。');
  const key=colorKey(brand,code,hex);
  if(c.key&&c.key!==key)throw new TypeError('图纸颜色编号与色卡不一致。');
  return {hex,code,key,brand:metadata[brand]?.brand||'图像取色',series:metadata[brand]?.series||'图像取色（非商品色号）',rgb:hex2rgb(hex),count:0};
 });
 const grid=input.grid.map(v=>{if(!Number.isInteger(v)||v<-1||v>=colors.length)throw new TypeError('图纸包含无效的网格索引。');if(v>=0)colors[v].count++;return v;});
 const id=input.id||newId();if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(id))throw new TypeError('图纸编号无效。');
 const date=value=>{const parsed=new Date(value??Date.now());if(!Number.isFinite(parsed.getTime()))throw new TypeError('图纸日期无效。');return parsed.toISOString();};
 const record={version:1,id,name:String(input.name||'我的拼豆图纸').trim().slice(0,80)||'我的拼豆图纸',width,height,brand,createdAt:date(input.createdAt),updatedAt:date(input.updatedAt),grid,colors,settings:plainObject(input.settings),crop:plainObject(input.crop,2000)};
 const sourceDataURL=sourceURL(input.sourceDataURL,12000000,'处理后的图片'),sourceOriginalDataURL=sourceURL(input.sourceOriginalDataURL,12000000,'原始图片'),thumbnail=sourceURL(input.thumbnail,800000,'缩略图');
 if((sourceDataURL?.length||0)+(sourceOriginalDataURL?.length||0)>18000000)throw new RangeError('保存的图片过大，请缩小图片后再试。');
 if(sourceDataURL)record.sourceDataURL=sourceDataURL;if(sourceOriginalDataURL)record.sourceOriginalDataURL=sourceOriginalDataURL;if(thumbnail)record.thumbnail=thumbnail;
 return record;
}
function toRecord(result,details={}){
 const brand=details.brand||result.brand||'mard291';
 return validateRecord({...details,brand,width:result.gw,height:result.gh,settings:details.settings||result.settings||{},grid:Array.from(result.grid,v=>v===EMPTY?-1:v),colors:result.colors.map(c=>({...c,key:colorKey(brand,c.code,c.hex)}))});
}
function registerRecord(record){return validateRecord(record);}
function fromRecord(record){
 const r=registerRecord(record),grid=Uint16Array.from(r.grid,v=>v<0?EMPTY:v),counts=Int32Array.from(r.colors,c=>c.count);
 return {grid,gw:r.width,gh:r.height,colors:r.colors.map(c=>({...c,rgb:c.rgb.slice()})),counts,total:counts.reduce((a,b)=>a+b,0),brand:r.brand,settings:{...r.settings},ms:0};
}
function recordGrid(record){const r=registerRecord(record);return Array.from({length:r.height},(_,y)=>r.grid.slice(y*r.width,(y+1)*r.width).map(v=>v<0?'.':r.colors[v].key));}
function normalize(result){const n=normalizeGrid(result.grid,result.colors);return {...result,...n,total:n.counts.reduce((a,b)=>a+b,0)};}
const craftCatalogs=()=>Object.fromEntries(catalogList.map(c=>[`pattern-${c.id}`,{...c,id:`pattern-${c.id}`} ]));
return Object.freeze({EMPTY,MAX_GRID,catalogs:()=>catalogList.slice(),craftCatalogs,palette,convert,render,exportCanvas,toRecord,validateRecord,registerRecord,fromRecord,recordGrid,colorKey,registerCustomColors,customColorsForGrids,normalize,newId});
})();

