// 起名模块校验：字库 / 姓氏表 / 八十一数理 / 三才五格算式 / 五行统计 / 红线词
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;

global.window = global;
global.self = global;
const _lunar = require(path.join(ROOT, "js/vendor/lunar.js"));
const Solar = global.Solar || _lunar.Solar;
const Lunar = global.Lunar || _lunar.Lunar;
new Function("window", fs.readFileSync(path.join(ROOT, "js/name-data.js"), "utf8"))(global);

const CHARS = global.NAME_CHARS;
const SUR = global.NAME_SURNAMES;
const SHULI = global.NAME_SHULI;
const WX = ["木", "火", "土", "金", "水"];
const errs = [];
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

// ---------- 1. 字库 ----------
console.log("汉字库 " + CHARS.length + " 字：");
ok(CHARS.length >= 280, "字库规模 >= 280（实得 " + CHARS.length + "）");

// 源码层面：每一行都必须是带尾逗号的完整条目（排序 / 编辑时最容易漏）
const rawLines = fs.readFileSync(path.join(ROOT, "js/name-data.js"), "utf8").split("\n");
const arrStart = rawLines.findIndex((l) => l.indexOf("window.NAME_CHARS") === 0);
const arrEnd = rawLines.findIndex((l, i) => i > arrStart && l.indexOf("];") === 0);
const entryLines = rawLines.slice(arrStart + 1, arrEnd);
const noComma = entryLines.filter((l) => !/,\s*$/.test(l));
ok(entryLines.length === CHARS.length && noComma.length === 0,
  "源码 " + entryLines.length + " 行且均带尾逗号（缺逗号 " + noComma.length + "）");

let badField = 0, badStroke = 0, badWx = 0, badPy = 0, badMean = 0, badG = 0;
const seen = new Map();
CHARS.forEach((c) => {
  if (!Array.isArray(c) || c.length !== 6) { badField++; return; }
  if (typeof c[2] !== "number" || !(c[2] >= 1 && c[2] <= 24)) badStroke++;
  if (WX.indexOf(c[3]) < 0) badWx++;
  if (!/^[a-z]+[1-4]$/.test(c[1])) badPy++;
  if (typeof c[4] !== "string" || c[4].length < 3 || c[4].length > 24) badMean++;
  if ([0, 1, 2].indexOf(c[5]) < 0) badG++;
  seen.set(c[0], (seen.get(c[0]) || 0) + 1);
});
const dups = [...seen.entries()].filter((e) => e[1] > 1).map((e) => e[0]);
ok(badField === 0, "字段结构完整（异常 " + badField + "）");
ok(badStroke === 0, "笔画均在 1-24（异常 " + badStroke + "）");
ok(badWx === 0, "五行均属金木水火土（异常 " + badWx + "）");
ok(badPy === 0, "拼音格式合法（异常 " + badPy + "）");
ok(badMean === 0, "寓意长度 3-24 字（异常 " + badMean + "）");
ok(badG === 0, "性别倾向合法（异常 " + badG + "）");
ok(dups.length === 0, "无重复字（重复：" + (dups.join("、") || "无") + "）");

// 与权威笔画库交叉核对（装了 cnchar 才跑）
let cnchar = null;
try { cnchar = require("cnchar"); require("cnchar-order"); } catch (e) {}
if (cnchar) {
  const diff = [];
  CHARS.forEach((c) => {
    let s = null;
    try { s = cnchar.stroke(c[0]); } catch (e) {}
    if (s && s !== c[2]) diff.push(c[0] + ":" + c[2] + "→" + s);
  });
  ok(diff.length === 0, "笔画与权威字库一致（差异 " + diff.length + (diff.length ? "：" + diff.join(" ") : "") + "）");
  const sd = [];
  Object.keys(SUR).forEach((k) => {
    let s = null;
    try { s = cnchar.stroke(k); } catch (e) {}
    if (s && s !== SUR[k]) sd.push(k + ":" + SUR[k] + "→" + s);
  });
  ok(sd.length === 0, "姓氏笔画与权威字库一致（差异 " + sd.length + (sd.length ? "：" + sd.join(" ") : "") + "）");
} else {
  console.log("  - 未安装 cnchar，跳过笔画交叉核对");
}

const strokeDist = {};
CHARS.forEach((c) => { strokeDist[c[2]] = (strokeDist[c[2]] || 0) + 1; });
const wxDist = {};
CHARS.forEach((c) => { wxDist[c[3]] = (wxDist[c[3]] || 0) + 1; });
const gDist = { 0: 0, 1: 0, 2: 0 };
CHARS.forEach((c) => { gDist[c[5]]++; });
console.log("  笔画分布 " + JSON.stringify(strokeDist));
console.log("  五行分布 " + JSON.stringify(wxDist) + "　性别分布 中性" + gDist[0] + " 偏男" + gDist[1] + " 偏女" + gDist[2]);
ok(WX.every((w) => wxDist[w] >= 20), "五行五个各不少于 20 字");
ok(gDist[1] >= 40 && gDist[2] >= 40, "男女倾向字各不少于 40");

// ---------- 2. 姓氏表 ----------
const surKeys = Object.keys(SUR);
ok(surKeys.length >= 100, "姓氏表 >= 100（实得 " + surKeys.length + "）");
const badSur = surKeys.filter((k) => k.length !== 1 || !(SUR[k] >= 1 && SUR[k] <= 20));
ok(badSur.length === 0, "姓氏笔画合法（异常：" + (badSur.join("、") || "无") + "）");

// ---------- 3. 八十一数理 ----------
const miss = [];
for (let i = 1; i <= 81; i++) if (!SHULI[i]) miss.push(i);
ok(miss.length === 0, "八十一数理 1-81 齐全（缺：" + (miss.join(",") || "无") + "）");
const badLv = Object.keys(SHULI).filter((k) => [0, 1, 2].indexOf(SHULI[k][0]) < 0 || !SHULI[k][1]);
ok(badLv.length === 0, "数理等级与短语完整（异常：" + (badLv.join(",") || "无") + "）");
const lvCnt = { 0: 0, 1: 0, 2: 0 };
Object.keys(SHULI).forEach((k) => { lvCnt[SHULI[k][0]]++; });
console.log("  数理档位 吉" + lvCnt[0] + " 半吉" + lvCnt[1] + " 凶" + lvCnt[2]);
ok(lvCnt[0] > 20 && lvCnt[2] > 20, "吉凶分布合理");

// ---------- 4. 三才五格算式（独立实现，交叉验证） ----------
function wuge(surS, nameS) {
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const tian = surS.length > 1 ? sum(surS) : surS[0] + 1;
  const ren = surS[surS.length - 1] + nameS[0];
  const di = nameS.length > 1 ? sum(nameS) : nameS[0] + 1;
  const zong = sum(surS) + sum(nameS);
  const wai = nameS.length === 1
    ? (surS.length === 1 ? 2 : surS[0])
    : (surS.length === 1 ? nameS[1] + 1 : surS[0] + nameS[1]);
  return { tian, ren, di, wai, zong };
}
function wxOfNum(n) {
  const d = n % 10;
  if (d === 1 || d === 2) return "木";
  if (d === 3 || d === 4) return "火";
  if (d === 5 || d === 6) return "土";
  if (d === 7 || d === 8) return "金";
  return "水";
}
function shuli(n) { const v = n % 81; return v <= 0 ? 81 : v; }

// 手算样例 1：李(7) + 安(6) —— 单姓单名
const g1 = wuge([7], [6]);
ok(g1.tian === 8 && g1.ren === 13 && g1.di === 7 && g1.zong === 13 && g1.wai === 2,
  "李安 → 天8 人13 地7 外2 总13（实得 " + JSON.stringify(g1) + "）");
// 手算样例 2：王(4) + 安(6)然(12) —— 单姓双名
const g2 = wuge([4], [6, 12]);
ok(g2.tian === 5 && g2.ren === 10 && g2.di === 18 && g2.zong === 22 && g2.wai === 13,
  "王安然 → 天5 人10 地18 外13 总22（实得 " + JSON.stringify(g2) + "）");
// 手算样例 3：欧(8)阳(6) + 子(3)墨(15) —— 复姓双名
const g3 = wuge([8, 6], [3, 15]);
ok(g3.tian === 14 && g3.ren === 9 && g3.di === 18 && g3.zong === 32 && g3.wai === 23,
  "欧阳子墨 → 天14 人9 地18 外23 总32（实得 " + JSON.stringify(g3) + "）");
// 复姓单名
const g4 = wuge([8, 6], [7]);
ok(g4.tian === 14 && g4.ren === 13 && g4.di === 8 && g4.zong === 21 && g4.wai === 8,
  "欧阳君 → 天14 人13 地8 外8 总21（实得 " + JSON.stringify(g4) + "）");

// 五格五行
ok(wxOfNum(1) === "木" && wxOfNum(2) === "木" && wxOfNum(3) === "火" && wxOfNum(4) === "火" &&
   wxOfNum(5) === "土" && wxOfNum(6) === "土" && wxOfNum(7) === "金" && wxOfNum(8) === "金" &&
   wxOfNum(9) === "水" && wxOfNum(10) === "水", "五格五行个位数映射正确");
ok(shuli(81) === 81 && shuli(82) === 1 && shuli(162) === 81, "数理取 1-81 循环（81→81, 82→1, 162→81）");

// 遍历：任意单姓双名都应自洽
let bad = 0;
for (let s = 1; s <= 20; s++) {
  for (let a = 1; a <= 24; a++) {
    for (let b = 1; b <= 24; b++) {
      const g = wuge([s], [a, b]);
      if (g.zong !== s + a + b) bad++;
      if (g.ren !== s + a) bad++;
      if (g.di !== a + b) bad++;
      if (g.wai !== b + 1) bad++;
      if (g.tian !== s + 1) bad++;
      if (g.zong - g.ren !== b) bad++;
    }
  }
}
ok(bad === 0, "全量单姓双名算式自洽（11520 组，异常 " + bad + "）");

// ---------- 5. 八字五行统计 ----------
const GAN = { 甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水" };
const ZHI = { 子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火", 午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水" };
function wxOfGanZhi(gz) {
  return (gz || "").split("").map((c, i) => (i === 0 ? GAN[c] : ZHI[c])).filter(Boolean);
}
ok(JSON.stringify(wxOfGanZhi("甲子")) === JSON.stringify(["木", "水"]), "甲子 → 木水");
ok(JSON.stringify(wxOfGanZhi("庚午")) === JSON.stringify(["金", "火"]), "庚午 → 金火");

function birthWx(dateStr, hour) {
  const p = dateStr.split("-");
  const solar = Solar.fromYmdHms(+p[0], +p[1], +p[2], hour, 0, 0);
  const ec = Lunar.fromSolar(solar).getEightChar();
  const cnt = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  ["getYear", "getMonth", "getDay", "getTime"].forEach((m) => {
    wxOfGanZhi(ec[m]()).forEach((w) => { if (cnt[w] !== undefined) cnt[w]++; });
  });
  return cnt;
}
let wxBad = 0, samples = [];
for (let i = 0; i < 400; i++) {
  const y = 1960 + (i % 55), m = 1 + (i % 12), d = 1 + (i % 28), h = (i % 12) * 2;
  const cnt = birthWx(y + "-" + m + "-" + d, h);
  const total = WX.reduce((s, w) => s + cnt[w], 0);
  if (total !== 8) wxBad++;
  if (i < 3) samples.push(y + "-" + m + "-" + d + " → " + JSON.stringify(cnt));
}
ok(wxBad === 0, "400 例八字五行合计均为 8（异常 " + wxBad + "）");
console.log("  样例 " + samples.join("　"));

// ---------- 6. 候选生成（复刻打分逻辑做抽样） ----------
function buildPool(gender) {
  return CHARS.filter((c) => !gender || c[5] === 0 || c[5] === gender);
}
let genBad = 0;
[0, 1, 2].forEach((g) => {
  [1, 2].forEach((len) => {
    const pool = buildPool(g);
    const out = new Set();
    for (let a = 0; a < pool.length; a++) {
      if (len === 1) out.add(pool[a][0]);
      else for (let b = 0; b < pool.length; b++) {
        if (a !== b) out.add(pool[a][0] + pool[b][0]);
      }
    }
    if (out.size < 8) genBad++;
  });
});
ok(genBad === 0, "六种性别/字数组合均可生成足额候选");

// ---------- 7. 红线词 ----------
const RED = ["占卜", "算命", "预测", "改运", "注定", "命中注定", "转运", "消灾", "破解", "化太岁"];
["js/name-data.js", "js/app-name.js"].forEach((f) => {
  const txt = fs.readFileSync(path.join(ROOT, f), "utf8");
  const hit = RED.filter((w) => txt.indexOf(w) >= 0);
  ok(hit.length === 0, f + " 无红线词（命中：" + (hit.join("、") || "无") + "）");
});

console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: 起名模块校验通过");
process.exit(errs.length ? 1 : 0);
