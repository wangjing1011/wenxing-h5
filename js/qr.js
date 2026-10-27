// js/qr.js —— 极简二维码生成器（字节模式 / 纠错等级 L / 版本 1-6）
//
// 为什么自己写而不是引库：
//   本站是零依赖纯静态，不引 CDN（微信内和离线环境都不稳）。
//   分享卡片只需要把一条网址画成二维码，长度不超过 100 字节，
//   所以只实现版本 1-6（最大 134 字节），不碰版本信息块、不碰多块交织里最容易出错的版本 7+。
//
// 参考 ISO/IEC 18004。对外只暴露一个函数：
//   window.WenxingQR.matrix(text) -> { size, cells }  cells[y][x] = 0/1
(function (global) {
  "use strict";

  // ---------- GF(256)：二维码的纠错码在伽罗华域上做除法 ----------
  // 本原多项式 x^8 + x^4 + x^3 + x^2 + 1 = 0x11d
  var EXP = new Array(512);
  var LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  // k 次生成多项式 g(x) = (x-α^0)(x-α^1)...(x-α^(k-1))，系数从高次到低次
  function genPoly(k) {
    var g = [1];
    for (var i = 0; i < k; i++) {
      var next = new Array(g.length + 1);
      for (var j = 0; j < next.length; j++) next[j] = 0;
      for (var j2 = 0; j2 < g.length; j2++) {
        next[j2] ^= g[j2];                    // × x
        next[j2 + 1] ^= gmul(g[j2], EXP[i]);  // × α^i
      }
      g = next;
    }
    return g;
  }

  // 对一个数据块算 k 个纠错码字
  function eccBytes(data, k) {
    var g = genPoly(k);
    var res = new Array(k);
    for (var i = 0; i < k; i++) res[i] = 0;
    for (var d = 0; d < data.length; d++) {
      var factor = data[d] ^ res[0];
      for (var s = 0; s < k - 1; s++) res[s] = res[s + 1] ^ gmul(g[s + 1], factor);
      if (k > 0) res[k - 1] = gmul(g[k], factor);
    }
    return res;
  }

  // ---------- 版本表（纠错等级 L） ----------
  // 每项：总码字数 / 每块纠错码字数 / 数据块数 / 每块数据码字数
  // 数据码字数之和 + 纠错码字数之和 必须等于该版本总码字数（tests/qr-check.js 会验算）
  var SPEC = {
    1: { total: 26, ec: 7, blocks: [19] },
    2: { total: 44, ec: 10, blocks: [34] },
    3: { total: 70, ec: 15, blocks: [55] },
    4: { total: 100, ec: 20, blocks: [80] },
    5: { total: 134, ec: 26, blocks: [108] },
    6: { total: 172, ec: 18, blocks: [68, 68] }
  };
  // 对齐图形中心（版本 2 起才有）
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };
  // 剩余位：数据格数比码字位数多出来的那几格，填 0 后一起参与掩码
  var REMAINDER = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7 };

  function dataCapacity(v) {
    var s = SPEC[v];
    var dataWords = 0;
    for (var i = 0; i < s.blocks.length; i++) dataWords += s.blocks[i];
    return dataWords;
  }

  // ---------- 数据编码（字节模式） ----------
  function encodeData(text) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return bytes;
  }

  function pickVersion(byteLen) {
    for (var v = 1; v <= 6; v++) {
      // 4 位模式 + 8 位长度 + 数据
      if (byteLen + 2 <= dataCapacity(v)) return v;
    }
    return 0;
  }

  // 组装比特流 → 数据码字（含填充 0xEC / 0x11）
  function buildCodewords(bytes, v) {
    var capBits = dataCapacity(v) * 8;
    var bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    push(4, 4);              // 0100 = 字节模式
    push(bytes.length, 8);   // 版本 1-9：长度用 8 位
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
    // 结束符：最多 4 个 0
    var term = Math.min(4, capBits - bits.length);
    for (var t = 0; t < term; t++) bits.push(0);
    // 补到字节边界
    while (bits.length % 8 !== 0) bits.push(0);
    var words = [];
    for (var b = 0; b < bits.length; b += 8) {
      var w = 0;
      for (var k = 0; k < 8; k++) w = (w << 1) | bits[b + k];
      words.push(w);
    }
    // 交替填充，直到填满数据容量
    var pads = [0xec, 0x11];
    var p = 0;
    while (words.length < dataCapacity(v)) words.push(pads[p++ % 2]);
    return words;
  }

  // ---------- 分块 + 交织 ----------
  function interleave(words, v) {
    var s = SPEC[v];
    var blocks = [];
    var idx = 0;
    for (var i = 0; i < s.blocks.length; i++) {
      var d = words.slice(idx, idx + s.blocks[i]);
      idx += s.blocks[i];
      blocks.push({ data: d, ecc: eccBytes(d, s.ec) });
    }
    var out = [];
    var maxData = 0;
    for (var j = 0; j < blocks.length; j++) maxData = Math.max(maxData, blocks[j].data.length);
    for (var c = 0; c < maxData; c++) {
      for (var b = 0; b < blocks.length; b++) {
        if (c < blocks[b].data.length) out.push(blocks[b].data[c]);
      }
    }
    for (var e = 0; e < s.ec; e++) {
      for (var b2 = 0; b2 < blocks.length; b2++) out.push(blocks[b2].ecc[e]);
    }
    return out;
  }

  // ---------- 矩阵 ----------
  function makeMatrix(v) {
    var size = 17 + v * 4;
    var m = [], fn = [];
    for (var y = 0; y < size; y++) {
      m.push(new Array(size));
      fn.push(new Array(size));
      for (var x = 0; x < size; x++) { m[y][x] = 0; fn[y][x] = false; }
    }
    function set(x, y, dark) { if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = dark ? 1 : 0; fn[y][x] = true; } }

    // 三个定位图形（7×7）+ 分隔带
    [[0, 0], [size - 7, 0], [0, size - 7]].forEach(function (p) {
      for (var dy = -1; dy <= 7; dy++) {
        for (var dx = -1; dx <= 7; dx++) {
          var xx = p[0] + dx, yy = p[1] + dy;
          if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
          var inner = (dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6);
          var dark = false;
          if (inner) {
            var ring = (dx === 0 || dx === 6 || dy === 0 || dy === 6);
            var core = (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
            dark = ring || core;
          }
          set(xx, yy, dark);
        }
      }
    });

    // 定位线（第 6 行 / 第 6 列交替）
    for (var i = 8; i < size - 8; i++) {
      set(i, 6, i % 2 === 0);
      set(6, i, i % 2 === 0);
    }

    // 对齐图形（5×5）：跳过与定位图形重叠的三个角
    var centers = ALIGN[v];
    for (var a = 0; a < centers.length; a++) {
      for (var b = 0; b < centers.length; b++) {
        var cx = centers[b], cy = centers[a];
        var atCorner = (cx === 6 && cy === 6) ||
          (cx === 6 && cy === size - 7) ||
          (cx === size - 7 && cy === 6);
        if (atCorner) continue;
        for (var dy2 = -2; dy2 <= 2; dy2++) {
          for (var dx2 = -2; dx2 <= 2; dx2++) {
            var ring2 = Math.max(Math.abs(dx2), Math.abs(dy2));
            set(cx + dx2, cy + dy2, ring2 !== 1);
          }
        }
      }
    }

    // 固定黑点
    set(8, size - 8, 1);

    // 预留格式信息（15 位，共两条副本：第 8 列竖排 / 第 8 行横排）
    // 位序按规范：i 从 0 开始，
    //   竖排 i<6 → (8,i)；i=6,7 → (8,i+1)；i≥8 → (8,size-15+i)
    //   横排 i<8 → (size-1-i,8)；i=8 → (7,8)；i≥9 → (14-i,8)
    var vPos = [], hPos = [];
    for (var b = 0; b < 15; b++) {
      var vy = b < 6 ? b : (b < 8 ? b + 1 : size - 15 + b);
      vPos.push([8, vy]);
      var hx = b < 8 ? size - 1 - b : (b === 8 ? 7 : 14 - b);
      hPos.push([hx, 8]);
    }
    vPos.concat(hPos).forEach(function (p) { fn[p[1]][p[0]] = true; });

    return { size: size, m: m, fn: fn, fmt: { v: vPos, h: hPos }, v: v };
  }

  // 数据位按「右下起、两列一束、蛇形向上/向下」填入
  function placeData(mx, codewords) {
    var size = mx.size, m = mx.m, fn = mx.fn;
    var bits = [];
    for (var i = 0; i < codewords.length; i++) {
      for (var b = 7; b >= 0; b--) bits.push((codewords[i] >> b) & 1);
    }
    var bitIdx = 0, up = true;
    var placed = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // 跳过定位线所在列
      for (var vert = 0; vert < size; vert++) {
        var y = up ? size - 1 - vert : vert;
        for (var c = 0; c < 2; c++) {
          var x = right - c;
          if (fn[y][x]) continue;
          m[y][x] = bitIdx < bits.length ? bits[bitIdx] : 0;
          bitIdx++;
          placed++;
        }
      }
      up = !up;
    }
    return { used: bitIdx, total: bits.length };
  }

  // 掩码：8 种，按惩罚分最低者选
  function maskFn(id, x, y) {
    switch (id) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
      case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
      case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
      default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    }
  }

  function applyMask(mx, id) {
    var size = mx.size, m = mx.m, fn = mx.fn;
    var out = [];
    for (var y = 0; y < size; y++) {
      out.push(new Array(size));
      for (var x = 0; x < size; x++) {
        out[y][x] = fn[y][x] ? m[y][x] : (m[y][x] ^ (maskFn(id, x, y) ? 1 : 0));
      }
    }
    return out;
  }

  // 格式信息：2 位纠错等级（L=01）+ 3 位掩码号，BCH(15,5)，再异或 0x5412
  function formatBits(ecLevelBits, maskId) {
    var data = (ecLevelBits << 3) | maskId;
    var v = data << 10;
    for (var i = 4; i >= 0; i--) {
      if (v & (1 << (i + 10))) v ^= 0x537 << i;
    }
    return ((data << 10) | v) ^ 0x5412;
  }

  function writeFormat(m, fmt, bits) {
    for (var i = 0; i < 15; i++) {
      var bit = (bits >> i) & 1; // i=0 是最低位，与规范里的位序一致
      m[fmt.v[i][1]][fmt.v[i][0]] = bit;
      m[fmt.h[i][1]][fmt.h[i][0]] = bit;
    }
  }

  // 惩罚分（规范里的四条规则，选掩码用）
  function penalty(m, size) {
    var score = 0;
    // 规则 1：同色连续 ≥5
    for (var y = 0; y < size; y++) {
      var runC = 1, runR = 1;
      for (var x = 1; x < size; x++) {
        if (m[y][x] === m[y][x - 1]) runC++; else { if (runC >= 5) score += runC - 2; runC = 1; }
        if (m[x][y] === m[x - 1][y]) runR++; else { if (runR >= 5) score += runR - 2; runR = 1; }
      }
      if (runC >= 5) score += runC - 2;
      if (runR >= 5) score += runR - 2;
    }
    // 规则 2：2×2 同色块
    for (var y2 = 0; y2 < size - 1; y2++) {
      for (var x2 = 0; x2 < size - 1; x2++) {
        var c = m[y2][x2];
        if (c === m[y2][x2 + 1] && c === m[y2 + 1][x2] && c === m[y2 + 1][x2 + 1]) score += 3;
      }
    }
    // 规则 3：形如 1011101 0000 的模式
    var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (var y3 = 0; y3 < size; y3++) {
      for (var x3 = 0; x3 < size - 10; x3++) {
        var h1 = true, h2 = true, v1 = true, v2 = true;
        for (var k = 0; k < 11; k++) {
          if (m[y3][x3 + k] !== pat1[k]) h1 = false;
          if (m[y3][x3 + k] !== pat2[k]) h2 = false;
          if (m[x3 + k][y3] !== pat1[k]) v1 = false;
          if (m[x3 + k][y3] !== pat2[k]) v2 = false;
        }
        if (h1) score += 40;
        if (h2) score += 40;
        if (v1) score += 40;
        if (v2) score += 40;
      }
    }
    // 规则 4：黑模块占比偏离 50%
    var dark = 0;
    for (var y4 = 0; y4 < size; y4++) for (var x4 = 0; x4 < size; x4++) dark += m[y4][x4];
    var pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  function matrix(text) {
    var str = String(text || "");
    var bytes = encodeData(str);
    var v = pickVersion(bytes.length);
    if (!v) throw new Error("内容太长，二维码只支持到 134 字节");
    var words = buildCodewords(bytes, v);
    var all = interleave(words, v);

    var base = makeMatrix(v);
    var info = placeData(base, all);
    // 数据格数 = 码字位数 + 剩余位（版本 1 为 0，2-6 为 7）；不相等说明排布区域算错了
    if (info.used !== info.total + REMAINDER[v]) {
      throw new Error("数据位放置异常：" + info.used + " 格 vs " + info.total + " 位 + 剩余 " + REMAINDER[v]);
    }

    var best = null;
    for (var id = 0; id < 8; id++) {
      var masked = applyMask(base, id);
      var bits = formatBits(1, id); // 纠错等级 L 对应 01
      writeFormat(masked, base.fmt, bits);
      var p = penalty(masked, base.size);
      if (!best || p < best.penalty) best = { cells: masked, penalty: p, mask: id };
    }
    return { size: base.size, cells: best.cells, version: v, mask: best.mask };
  }

  // 供自检使用：暴露内部工具
  matrix._spec = SPEC;
  matrix._eccBytes = eccBytes;
  matrix._formatBits = formatBits;
  matrix._dataCapacity = dataCapacity;
  matrix._maskFn = maskFn;
  matrix._remainder = REMAINDER;
  matrix._align = ALIGN;

  global.WenxingQR = { matrix: matrix };
  if (typeof module !== "undefined" && module.exports) module.exports = global.WenxingQR;
})(typeof window !== "undefined" ? window : globalThis);
