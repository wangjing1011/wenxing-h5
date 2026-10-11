// 校验：紫微斗数（以 iztro 为基准，交叉验证命身宫公式、五虎遁、十四主星、四化）
global.self = global;
var iztro = require("./js/vendor/iztro.js");
global.window = { iztro: iztro };
require("./js/ziwei-meanings.js");

var ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
var GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
var MAJ = ["紫微", "天机", "太阳", "武曲", "天同", "廉贞", "天府", "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军"];
var JU5 = ["水二局", "木三局", "金四局", "土五局", "火六局"];
var HU_DUN = [2, 4, 6, 8, 0]; // 甲己→丙寅 乙庚→戊寅 丙辛→庚寅 丁壬→壬寅 戊癸→甲寅

var lunar = require("./js/vendor/lunar.js");
var err = [];
function ok(c, m) { if (!c) err.push(m); }
function pad(x) { return x < 10 ? "0" + x : "" + x; }

// —— 我的独立实现（用于交叉验证）——
function mySoulBody(y, mo, d, h) {
  var L = lunar.Lunar.fromSolar(lunar.Solar.fromYmdHms(y, mo, d, h, 0, 0));
  var raw = L.getMonth();               // 闰月为负数
  var day = Math.abs(L.getDay());
  var m = Math.abs(raw);
  // 闰月规则：十五日（含）之前按当月，之后按下一月
  if (raw < 0 && day > 15) m = m + 1;
  var hIdx = ZHI.indexOf(L.getTimeZhi()) + 1; // 子1..亥12
  var soul = ((m + 3 - hIdx - 1) % 12 + 12) % 12 + 1;
  var body = ((m + hIdx) % 12 + 12) % 12 + 1;
  return { soul: ZHI[soul - 1], body: ZHI[body - 1], isLeap: raw < 0 };
}

// 1) 定点样本：1990-05-20 午时 男
var a = iztro.astro.bySolar("1990-05-20", 6, "male", true, "zh-CN");
var soul = a.palace("命宫");
ok(a.fiveElementsClass === "土五局", "样本五行局应为土五局，实得 " + a.fiveElementsClass);
ok(soul && soul.earthlyBranch === "亥", "样本命宫应在亥，实得 " + (soul ? soul.earthlyBranch : "?"));
ok(a.earthlyBranchOfBodyPalace === "亥", "样本身宫应在亥，实得 " + a.earthlyBranchOfBodyPalace);
ok(soul && soul.majorStars.map(function (s) { return s.name; }).join("/") === "紫微/七杀",
  "样本命宫主星应为紫微/七杀，实得 " + (soul ? soul.majorStars.map(function (s) { return s.name; }).join("/") : "?"));

// 2) 随机 3000 例交叉验证
var nSoulBad = 0, nBodyBad = 0, nDun = 0, nStar = 0, nJu = 0, nSi = 0, nPal = 0;
var leapCount = 0, total = 0;
for (var i = 0; i < 3000; i++) {
  var y = 1940 + Math.floor(Math.random() * 96);
  var mo = 1 + Math.floor(Math.random() * 12);
  var d = 1 + Math.floor(Math.random() * 28);
  var ti = Math.floor(Math.random() * 12);              // 0=早子 … 11=亥
  var hour = ti === 0 ? 0 : ti * 2;                      // 与界面 select 一致
  var gender = Math.random() < 0.5 ? "male" : "female";
  var ds = y + "-" + pad(mo) + "-" + pad(d);
  var ast;
  try { ast = iztro.astro.bySolar(ds, ti, gender, true, "zh-CN"); }
  catch (e) { err.push("排盘异常 " + ds + " " + e.message); continue; }
  total++;

  // 十二宫齐全、地支不重复
  var branches = ast.palaces.map(function (p) { return p.earthlyBranch; });
  if (branches.length !== 12 || new Set(branches).size !== 12) nPal++;

  // 十四主星：总数 14、无重复、都在名单内
  var majors = [];
  ast.palaces.forEach(function (p) { p.majorStars.forEach(function (s) { majors.push(s.name); }); });
  if (majors.length !== 14 || new Set(majors).size !== 14) nStar++;
  majors.forEach(function (nm) { if (MAJ.indexOf(nm) < 0) nStar++; });

  // 五行局合法
  if (JU5.indexOf(ast.fiveElementsClass) < 0) nJu++;

  // 四化：禄权科忌 各一次
  var si = [];
  ast.palaces.forEach(function (p) {
    p.majorStars.concat(p.minorStars || []).forEach(function (s) { if (s.mutagen) si.push(s.mutagen); });
  });
  if (si.length !== 4 || new Set(si).size !== 4) nSi++;

  // 五虎遁：寅宫天干 与 年干 对应，其后顺行
  var yearGan = null;
  var L0 = lunar.Lunar.fromSolar(lunar.Solar.fromYmdHms(y, mo, d, hour, 0, 0));
  yearGan = L0.getYearGan();
  var base = HU_DUN[GAN.indexOf(yearGan) % 5];
  ast.palaces.forEach(function (p) {
    var bi = ZHI.indexOf(p.earthlyBranch);
    var want = GAN[(base + ((bi - 2 + 12) % 12)) % 10]; // 寅(index2) 起 base
    if (p.heavenlyStem !== want) nDun++;
  });

  // 命宫 / 身宫 公式
  var mb = mySoulBody(y, mo, d, hour);
  if (mb.isLeap) leapCount++;
  if (mb.soul !== ast.earthlyBranchOfSoulPalace) nSoulBad++;
  if (mb.body !== ast.earthlyBranchOfBodyPalace) nBodyBad++;
}
ok(nPal === 0, "十二宫异常 " + nPal + " 例");
ok(nStar === 0, "十四主星异常 " + nStar + " 例");
ok(nJu === 0, "五行局异常 " + nJu + " 例");
ok(nSi === 0, "四化异常 " + nSi + " 例");
ok(nDun === 0, "五虎遁宫干不符 " + nDun + " 处");
ok(nSoulBad === 0, "命宫公式不符 " + nSoulBad + " 例");
ok(nBodyBad === 0, "身宫公式不符 " + nBodyBad + " 例");

// 3) 文案完整性
var STAR = window.ZW_STAR, PAL = window.ZW_PALACE, SH = window.ZW_SIHUA, JU = window.ZW_WUXING_JU;
MAJ.forEach(function (nm) {
  ok(STAR[nm] && STAR[nm].trait && STAR[nm].tip && STAR[nm].el, "主星文案缺失 " + nm);
});
Object.keys(PAL).forEach(function (nm) {
  ok(ZHI.length === 12 && PAL[nm] && PAL[nm].length > 6, "宫位文案缺失 " + nm);
});
ok(Object.keys(PAL).length === 12, "宫位应为 12 个，实得 " + Object.keys(PAL).length);
["禄", "权", "科", "忌"].forEach(function (k) { ok(!!SH[k], "四化文案缺失 " + k); });
JU5.forEach(function (k) { ok(!!JU[k], "五行局文案缺失 " + k); });

// 4) 红线词
var fs = require("fs");
var BAN = ["占卜", "算命", "命中注定", "转运", "改运", "消灾", "破解", "化太岁", "注定"];
["js/ziwei-meanings.js", "js/app-ziwei.js"].forEach(function (f) {
  var s = fs.readFileSync(f, "utf8");
  BAN.forEach(function (w) {
    var re = new RegExp(w, "g"), m;
    while ((m = re.exec(s))) err.push("红线词「" + w + "」 " + f + " L" + s.slice(0, m.index).split("\n").length);
  });
});

console.log("交叉验证 " + total + " 例：宫位" + nPal + " 主星" + nStar + " 五行局" + nJu +
  " 四化" + nSi + " 五虎遁" + nDun + " 命宫" + nSoulBad + " 身宫" + nBodyBad +
  "　（含闰月 " + leapCount + " 例，已按「十五日前当月、十五日后下月」规则对齐）");
console.log("定点样本：1990-05-20 午时男 → " + a.fiveElementsClass + " 命宫" +
  (soul ? soul.heavenlyStem + soul.earthlyBranch : "?") + " 身宫" + a.earthlyBranchOfBodyPalace +
  " 主星" + (soul ? soul.majorStars.map(function (s) { return s.name; }).join("/") : "?"));
console.log(err.length ? "FAIL:\n" + err.slice(0, 20).join("\n") : "OK: 紫微斗数排盘校验通过");
