// qr-check.js —— 自写二维码生成器的正确性校验
//
// 没有第三方库可以对照，所以用「数学性质 + 结构规范」来自证：
//   ① 版本表的算术必须自洽：数据码字 + 纠错码字 = 该版本总码字数
//   ② 纠错码必须是真 RS 码：把「数据+纠错」整体当成多项式，在 α^0..α^(k-1) 处求值，
//      综合征必须全为 0（这是 RS 码的定义，能同时验证 GF 表、生成多项式、除法三处）
//   ③ 格式信息的 BCH(15,5) 必须能被生成多项式 0x537 整除，且能解回纠错等级与掩码号
//   ④ 矩阵结构：尺寸、三个定位图形、定位线交替、固定黑点、格式区不重叠
//   ⑤ 容量：字节容量必须等于标准值（17/32/53/78/106/134）
//   ⑥ 数据位放置：可用数据格数必须正好等于码字位数（不多不少）
const fs = require("fs");
const path = require("path");

global.window = global;
require("./js/qr.js");
const QR = global.WenxingQR;

const log = [];
const errs = [];
const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

const EXP = [];
const LOG = [];
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
})();
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// ---------- ① 版本表算术 ----------
const SPEC = QR.matrix._spec;
let specOk = true;
Object.keys(SPEC).forEach((v) => {
  const s = SPEC[v];
  const dataWords = s.blocks.reduce((a, b) => a + b, 0);
  const sum = dataWords + s.ec * s.blocks.length;
  if (sum !== s.total) { specOk = false; errs.push("版本 " + v + " 码字数不自洽：" + sum + " ≠ " + s.total); }
});
ok(specOk, "版本 1-6 的数据码字 + 纠错码字 = 总码字数（逐版验算）");

// ---------- ② RS 综合征 ----------
function syndromeZero(data, ecc) {
  const cw = data.concat(ecc);
  const n = cw.length;
  for (let i = 0; i < ecc.length; i++) {
    let acc = 0;
    for (let j = 0; j < n; j++) {
      // 系数 cw[j] 对应 x^(n-1-j)，代入 α^i
      acc ^= gmul(cw[j], EXP[((n - 1 - j) * i) % 255]);
    }
    if (acc !== 0) return false;
  }
  return true;
}
let rsOk = true;
[7, 10, 15, 18, 20, 26].forEach((k) => {
  for (let t = 0; t < 40; t++) {
    const data = [];
    for (let i = 0; i < 60; i++) data.push(Math.floor(Math.random() * 256));
    const ecc = QR.matrix._eccBytes(data, k);
    if (!syndromeZero(data, ecc)) { rsOk = false; errs.push("RS 综合征非零：ec=" + k); }
  }
});
ok(rsOk, "纠错码是真 RS 码（240 组随机数据，综合征全为 0）");

// 纠错码长度正确
ok(QR.matrix._eccBytes([1, 2, 3], 7).length === 7, "纠错码字数与请求一致");

// ---------- ③ 格式信息 BCH ----------
function bchRemainder(bits15) {
  let v = bits15;
  for (let i = 14; i >= 10; i--) {
    if (v & (1 << i)) v ^= 0x537 << (i - 10);
  }
  return v & 0x3ff;
}
let fmtOk = true;
for (let mask = 0; mask < 8; mask++) {
  const bits = QR.matrix._formatBits(1, mask);
  const unmasked = bits ^ 0x5412;
  if (bchRemainder(unmasked) !== 0) { fmtOk = false; errs.push("格式信息 BCH 不整除：mask=" + mask); }
  const ec = (unmasked >> 13) & 3;
  const mk = (unmasked >> 10) & 7;
  if (ec !== 1 || mk !== mask) { fmtOk = false; errs.push("格式信息解回不一致：mask=" + mask); }
}
ok(fmtOk, "格式信息满足 BCH(15,5)，且能解回纠错等级 L 与掩码号");

// ---------- ④ 矩阵结构 ----------
function checkMatrix(text) {
  const r = QR.matrix(text);
  const { size, cells } = r;
  const isDark = (x, y) => !!cells[y][x];
  // 尺寸
  if (size !== 17 + r.version * 4) return "尺寸与版本不符";
  // 三个定位图形
  const corners = [[0, 0], [size - 7, 0], [0, size - 7]];
  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        if (isDark(cx + dx, cy + dy) !== (ring || core)) return "定位图形错位 @" + cx + "," + cy;
      }
    }
  }
  // 定位线交替（去掉与定位图形重叠的部分）
  for (let i = 8; i < size - 8; i++) {
    if (isDark(i, 6) !== (i % 2 === 0)) return "横向定位线不交替 @" + i;
    if (isDark(6, i) !== (i % 2 === 0)) return "纵向定位线不交替 @" + i;
  }
  // 固定黑点
  if (!isDark(8, size - 8)) return "缺少固定黑点";
  // 格式信息：按规范位置各读两份，必须一致，且能解回「纠错等级 L + 当前掩码」
  const vr = [], hr = [];
  for (let i = 0; i < 15; i++) {
    const vy = i < 6 ? i : (i < 8 ? i + 1 : size - 15 + i);
    vr.push(cells[vy][8]);
    const hx = i < 8 ? size - 1 - i : (i === 8 ? 7 : 14 - i);
    hr.push(cells[8][hx]);
  }
  if (vr.join("") !== hr.join("")) return "两份格式信息不一致（竖排 vs 横排）";
  let val = 0;
  for (let i = 0; i < 15; i++) val |= vr[i] << i;
  const raw = val ^ 0x5412;
  if (bchRemainder(raw) !== 0) return "格式信息未通过 BCH 校验";
  const ecBits = (raw >> 13) & 3;
  const mk = (raw >> 10) & 7;
  if (ecBits !== 1) return "纠错等级不是 L";
  if (mk !== r.mask) return "格式信息里的掩码号与实际使用的不一致";
  // 数据格数必须等于「码字位数 + 剩余位」
  const spec = QR.matrix._spec[r.version];
  const dataWords = spec.blocks.reduce((a, b) => a + b, 0);
  const totalCW = dataWords + spec.ec * spec.blocks.length;
  const free = size * size - (function () {
    // 数功能图形占用格（定位/分隔/定位线/对齐/格式/固定黑点）
    let n = 0;
    const fn = [];
    for (let y = 0; y < size; y++) { fn.push(new Array(size).fill(false)); }
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size && !fn[y][x]) { fn[y][x] = true; n++; } };
    [[0, 0], [size - 7, 0], [0, size - 7]].forEach(([cx, cy]) => {
      for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) mark(cx + dx, cy + dy);
    });
    for (let i = 8; i < size - 8; i++) { mark(i, 6); mark(6, i); }
    const centers = QR.matrix._align[r.version];
    centers.forEach((cy) => centers.forEach((cx) => {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(cx + dx, cy + dy);
    }));
    for (let i = 0; i < 15; i++) {
      const vy = i < 6 ? i : (i < 8 ? i + 1 : size - 15 + i);
      mark(8, vy);
      const hx = i < 8 ? size - 1 - i : (i === 8 ? 7 : 14 - i);
      mark(hx, 8);
    }
    mark(8, size - 8);
    return n;
  })();
  if (free !== totalCW * 8 + QR.matrix._remainder[r.version]) {
    return "数据格数 " + free + " ≠ 码字位数 " + totalCW * 8 + " + 剩余 " + QR.matrix._remainder[r.version];
  }
  return "";
}
let structOk = true;
["https://wenxingstar.top", "https://wenxingstar.top/?pair=K7M2QD", "A", "x".repeat(134)].forEach((t) => {
  const e = checkMatrix(t);
  if (e) { structOk = false; errs.push("矩阵结构：" + t.slice(0, 24) + " → " + e); }
});
ok(structOk, "矩阵结构正确（定位图形 / 定位线 / 固定黑点 / 两份格式信息一致）");

// ---------- ⑤ 字节容量 ----------
const CAP = { 1: 17, 2: 32, 3: 53, 4: 78, 5: 106, 6: 134 };
let capOk = true;
Object.keys(CAP).forEach((v) => {
  const bits = QR.matrix._dataCapacity(Number(v)) * 8;
  const bytes = Math.floor((bits - 12) / 8);
  if (bytes !== CAP[v]) { capOk = false; errs.push("版本 " + v + " 容量 " + bytes + " ≠ 标准 " + CAP[v]); }
});
ok(capOk, "字节容量与标准一致（17 / 32 / 53 / 78 / 106 / 134）");

// ---------- ⑥ 版本选择 ----------
function versionOf(text) { return QR.matrix(text).version; }
ok(versionOf("https://wenxingstar.top") === 2, "站点网址（22 字节）落在版本 2");
ok(versionOf("https://wenxingstar.top/?pair=K7M2QD") <= 3, "带邀请码的链接不超过版本 3");
ok(versionOf("x".repeat(17)) === 1, "17 字节刚好塞进版本 1");
ok(versionOf("x".repeat(18)) === 2, "18 字节溢出到版本 2");

let tooLong = false;
try { QR.matrix("x".repeat(200)); } catch (e) { tooLong = true; }
ok(tooLong, "超出 134 字节时明确报错，不静默出错图");

// ---------- ⑦ 掩码确有选择 ----------
const m1 = QR.matrix("https://wenxingstar.top");
ok(m1.mask >= 0 && m1.mask <= 7, "已选中一个合法掩码（mask=" + m1.mask + "）");
ok(m1.size === 25, "版本 2 的矩阵为 25×25，实得 " + m1.size);

// 输出
console.log(log.join("\n"));
if (errs.length) {
  console.log("\nFAIL: 二维码自检未通过（" + errs.length + " 项）");
  process.exit(1);
}
console.log("\nOK: 二维码生成器自检全部通过（RS 综合征 / BCH / 结构 / 容量 / 版本选择）");
