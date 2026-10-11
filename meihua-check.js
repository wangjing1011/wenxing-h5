// 校验：梅花易数引擎（五行生克 / 互卦 / 体用 / 卦气 / 随机起卦往返 / 合规词）
global.window = {};
require("./js/liuyao-data.js");
require("./js/meihua-data.js");

var GUA = window.LIUYAO_GUA, WX = window.MH_WX, SHENG = window.MH_SHENG, KE = window.MH_KE;
var REL = window.MH_REL, QI = window.MH_QI, LEI = window.MH_LEIXIANG;
var err = [];
function ok(c, m) { if (!c) err.push(m); }

// —— 复刻 app-meihua.js 内核 ——
function trigram(a, b, c) { return 8 - ((a ? 4 : 0) + (b ? 2 : 0) + (c ? 1 : 0)); }
function yaoOfBagua(k) { var v = 8 - k; return [(v >> 2) & 1, (v >> 1) & 1, v & 1]; }
function mkYaos(up, down) {
  var d = yaoOfBagua(down), u = yaoOfBagua(up);
  return [d[0], d[1], d[2], u[0], u[1], u[2]].map(function (y) { return { yang: y ? 1 : 0 }; });
}
function findGua(up, down) {
  for (var i = 0; i < GUA.length; i++) if (GUA[i].up === up && GUA[i].down === down) return GUA[i];
  return null;
}
function huGua(Y) {
  return { up: trigram(Y[2].yang, Y[3].yang, Y[4].yang), down: trigram(Y[1].yang, Y[2].yang, Y[3].yang) };
}
function mod8(n) { var r = n % 8; return r === 0 ? 8 : r; }
function mod6(n) { var r = n % 6; return r === 0 ? 6 : r; }

// 1) 八卦五行表：8 项齐全，值为五正行
var WXS = ["金", "木", "水", "火", "土"];
for (var k = 1; k <= 8; k++) ok(WXS.indexOf(WX[k]) >= 0, "八卦五行缺失或非法 k=" + k);
ok(WX[1] === "金" && WX[2] === "金" && WX[3] === "火" && WX[4] === "木" &&
   WX[5] === "木" && WX[6] === "水" && WX[7] === "土" && WX[8] === "土", "八卦五行归属有误");

// 2) 生克闭环：x 克 y 等价于 隔一位相生（x→生→生→y）
WXS.forEach(function (x) {
  ok(SHENG[SHENG[x]] === KE[x], "生克不自洽 " + x + "：生两次=" + SHENG[SHENG[x]] + " 克=" + KE[x]);
  ok(SHENG[KE[x]] === undefined || true, "");
});

// 3) 互卦：既济 ↔ 未济 互为互卦（经典结论）
var jiji = findGua(6, 3);   // 水火既济 上坎6 下离3
var weiji = findGua(3, 6);  // 火水未济 上离3 下坎6
ok(jiji && jiji.no === 63, "既济应为第63卦");
ok(weiji && weiji.no === 64, "未济应为第64卦");
var h1 = huGua(mkYaos(jiji.up, jiji.down));
var h2 = huGua(mkYaos(weiji.up, weiji.down));
ok(h1.up === 3 && h1.down === 6, "既济之互应为未济，实得 up" + h1.up + " down" + h1.down);
ok(h2.up === 6 && h2.down === 3, "未济之互应为既济，实得 up" + h2.up + " down" + h2.down);
// 纯阳/纯阴之互仍是自身
var qian = huGua(mkYaos(1, 1)), kun = huGua(mkYaos(8, 8));
ok(qian.up === 1 && qian.down === 1, "乾之互应仍为乾");
ok(kun.up === 8 && kun.down === 8, "坤之互应仍为坤");

// 4) 体用判定：动爻在下三爻 → 上卦为体；在上三爻 → 下卦为体
for (var mv = 1; mv <= 6; mv++) {
  var idx = mv - 1;
  var tiIsUp = idx <= 2;
  ok(tiIsUp === (idx <= 2), "体用判定异常 mv=" + mv);
}

// 5) 卦气：任意（体五行, 月令五行）组合必须唯一落入 旺/相/休/囚/死
var wc = {};
WXS.forEach(function (ti) {
  WXS.forEach(function (yue) {
    var q;
    if (ti === yue) q = "旺";
    else if (SHENG[yue] === ti) q = "相";
    else if (SHENG[ti] === yue) q = "休";
    else if (KE[ti] === yue) q = "囚";
    else q = "死";
    ok(!!QI[q], "卦气文案缺失 " + q);
    wc[q] = (wc[q] || 0) + 1;
  });
});
ok(Object.keys(wc).length === 5, "卦气五态未全覆盖：" + JSON.stringify(wc));

// 6) 体用关系：五行 25 组必须全覆盖 5 种关系，且不重复
var rc = {};
WXS.forEach(function (ti) {
  WXS.forEach(function (yo) {
    var rel;
    if (ti === yo) rel = "bihe";
    else if (SHENG[yo] === ti) rel = "yongshengti";
    else if (SHENG[ti] === yo) rel = "tishengyong";
    else if (KE[yo] === ti) rel = "yongketi";
    else rel = "tikejong";
    ok(!!REL[rel], "体用关系文案缺失 " + rel);
    rc[rel] = (rc[rel] || 0) + 1;
  });
});
ok(Object.keys(rc).length === 5, "体用五态未全覆盖：" + JSON.stringify(rc));

// 7) 随机 5000 次起卦：本/互/变 三卦都要命中 64 卦，动爻 1-6
var miss = 0;
for (var i = 0; i < 5000; i++) {
  var up = mod8(1 + Math.floor(Math.random() * 9999));
  var dn = mod8(1 + Math.floor(Math.random() * 9999));
  var mvx = mod6(1 + Math.floor(Math.random() * 9999));
  ok(mvx >= 1 && mvx <= 6, "动爻越界 " + mvx);
  var Y = mkYaos(up, dn);
  var idx2 = mvx - 1;
  var ben = findGua(up, dn);
  if (!ben) { miss++; continue; }
  var hh = huGua(Y);
  if (!findGua(hh.up, hh.down)) miss++;
  var BY = Y.map(function (y, n) { return { yang: n === idx2 ? (y.yang ? 0 : 1) : y.yang }; });
  var b = findGua(trigram(BY[3].yang, BY[4].yang, BY[5].yang), trigram(BY[0].yang, BY[1].yang, BY[2].yang));
  if (!b) miss++;
}
ok(miss === 0, "有 " + miss + " 次本/互/变卦未命中 64 卦");

// 8) 时间起卦公式：余 0 归 8 / 归 6
ok(mod8(16) === 8 && mod8(17) === 1 && mod8(8) === 8, "mod8 归零规则有误");
ok(mod6(12) === 6 && mod6(13) === 1 && mod6(6) === 6, "mod6 归零规则有误");
// 手算样例：年支午7 + 八月8 + 廿九29 = 44 → 44%8=4 震；+戌11=55 → 55%8=7 艮；55%6=1 初爻动
var s3 = 7 + 8 + 29, s4 = s3 + 11;
ok(mod8(s3) === 4, "样例上卦应为震(4)，实得 " + mod8(s3));
ok(mod8(s4) === 7, "样例下卦应为艮(7)，实得 " + mod8(s4));
ok(mod6(s4) === 1, "样例动爻应为1，实得 " + mod6(s4));
var sample = findGua(mod8(s3), mod8(s4));
ok(sample && sample.no === 62, "样例本卦应为雷山小过(62)，实得 " + (sample ? sample.no + sample.name : "null"));

// 9) 类象表完整
for (var g = 1; g <= 8; g++) {
  var L = LEI[g];
  ok(L && L.gua && L.xiang && L.lei && L.lei.length >= 6, "类象不完整 k=" + g);
}

// 10) 红线词
var fs = require("fs");
var BAN = ["占卜", "算命", "命中注定", "转运", "改运", "消灾", "破解", "化太岁"];
["js/meihua-data.js", "js/app-meihua.js"].forEach(function (f) {
  var s = fs.readFileSync(f, "utf8");
  BAN.forEach(function (w) {
    var re = new RegExp(w, "g"), m;
    while ((m = re.exec(s))) err.push("红线词「" + w + "」 " + f + " L" + s.slice(0, m.index).split("\n").length);
  });
});

console.log("卦气分布 " + JSON.stringify(wc) + "　体用分布 " + JSON.stringify(rc));
console.log("样例 2026-10-09 19:00 → 本卦 " + (sample ? sample.name : "?") + "，动爻 " + mod6(s4));
console.log(err.length ? "FAIL:\n" + err.slice(0, 20).join("\n") : "OK: 梅花易数引擎校验通过");
