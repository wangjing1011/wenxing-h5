// 校验：古法灵签 + 六爻引擎（八卦还原 / 六十四卦往返 / 动爻变卦 / 合规词）
global.window = {};
require("./js/qian-data-1.js");
require("./js/qian-data-2.js");
require("./js/liuyao-data.js");

var GUA = window.LIUYAO_GUA, BAGUA = window.BAGUA, YAO_NOTE = window.YAO_NOTE;
var QIAN = (window.QIAN_1 || []).concat(window.QIAN_2 || []);
var err = [];

// —— 复刻 app-divine.js 的核心算法 ——
function trigram(a, b, c) {
  var v = (a ? 4 : 0) + (b ? 2 : 0) + (c ? 1 : 0);
  return 8 - v;
}
function yaoOfBagua(k) {
  var v = 8 - k;
  return [(v >> 2) & 1, (v >> 1) & 1, v & 1]; // 初、中、上
}
function findGua(up, down) {
  for (var i = 0; i < GUA.length; i++) if (GUA[i].up === up && GUA[i].down === down) return GUA[i];
  return null;
}

// 1) 八卦还原：k -> 三爻 -> trigram() 应回到 k
BAGUA.forEach(function (b) {
  var y = yaoOfBagua(b.k);
  if (trigram(y[0], y[1], y[2]) !== b.k) {
    err.push("八卦还原失败 " + b.name + " k=" + b.k + " yao=" + y.join(""));
  }
});
// 2) 八卦爻象与《易经》标准象对照（乾111 兑110 离101 震100 巽011 坎010 艮001 坤000，自下而上）
var STD = { 1: [1, 1, 1], 2: [1, 1, 0], 3: [1, 0, 1], 4: [1, 0, 0], 5: [0, 1, 1], 6: [0, 1, 0], 7: [0, 0, 1], 8: [0, 0, 0] };
Object.keys(STD).forEach(function (k) {
  var got = yaoOfBagua(Number(k));
  var want = STD[k];
  if (got.join("") !== want.join("")) {
    err.push("卦象不符 " + BAGUA[k - 1].name + " got=" + got.join("") + " want=" + want.join(""));
  }
});

// 3) 六十四卦往返：由 up/down 还原六爻，再算回 up/down，应命中原卦
GUA.forEach(function (g) {
  var d = yaoOfBagua(g.down), u = yaoOfBagua(g.up);
  var Y = [d[0], d[1], d[2], u[0], u[1], u[2]]; // 初→上
  var gotDown = trigram(Y[0], Y[1], Y[2]);
  var gotUp = trigram(Y[3], Y[4], Y[5]);
  var back = findGua(gotUp, gotDown);
  if (!back) { err.push("往返失败 找不到 " + g.name + " (up" + gotUp + " down" + gotDown + ")"); return; }
  if (back.no !== g.no) err.push("往返错位 " + g.name + " -> " + back.name);
});

// 4) 动爻变卦：随机 5000 次，本卦与之卦都必须能在 64 卦中查到
var TYPE = [null, { yang: 1, mv: false }, { yang: 0, mv: false }, { yang: 1, mv: true }];
function typeOf(backs) {
  if (backs === 3) return TYPE[3];
  if (backs === 2) return TYPE[2];
  if (backs === 1) return TYPE[1];
  return { yang: 0, mv: true };
}
var noMove = 0, hasMove = 0, mvCnt = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
for (var i = 0; i < 5000; i++) {
  var Y = [];
  for (var j = 0; j < 6; j++) {
  var backs = 0;
  for (var c = 0; c < 3; c++) if (Math.random() < 0.5) backs++; // 三枚铜钱，各 50%
  Y.push(typeOf(backs));
}
  var mv = Y.filter(function (y) { return y.mv; }).length;
  mvCnt[mv]++;
  var b = findGua(trigram(Y[3].yang, Y[4].yang, Y[5].yang), trigram(Y[0].yang, Y[1].yang, Y[2].yang));
  if (!b) { err.push("本卦未命中 #" + i); continue; }
  if (mv === 0) { noMove++; continue; }
  hasMove++;
  var BY = Y.map(function (y) { return { yang: y.mv ? (y.yang ? 0 : 1) : y.yang }; });
  var b2 = findGua(trigram(BY[3].yang, BY[4].yang, BY[5].yang), trigram(BY[0].yang, BY[1].yang, BY[2].yang));
  if (!b2) err.push("之卦未命中 #" + i);
  else if (mv === 6 && b2.no === b.no) err.push("六爻全动却未变卦 #" + i);
}

// 5) 灵签：1-100 都能取到
for (var n = 1; n <= 100; n++) {
  var q = QIAN.filter(function (x) { return x.n === n; })[0];
  if (!q) err.push("缺签 " + n);
}

// 6) 合规红线词（小程序高危类目）
var BAN = ["占卜", "算命", "预测", "命中注定", "注定", "转运", "改运", "消灾", "破解", "化太岁"];
var BAN_WHITE = ["预测"]; // 允许出现在否定语境，单独核对
var fs = require("fs");
["js/qian-data-1.js", "js/qian-data-2.js", "js/liuyao-data.js", "js/app-divine.js"].forEach(function (f) {
  var s = fs.readFileSync(f, "utf8");
  BAN.forEach(function (w) {
    if (BAN_WHITE.indexOf(w) >= 0) return;
    var re = new RegExp(w, "g"), m;
    while ((m = re.exec(s))) {
      var line = s.slice(0, m.index).split("\n").length;
      err.push("红线词「" + w + "」 " + f + " L" + line);
    }
  });
});

console.log("八卦还原 + 六十四卦往返 + 5000 次动爻变卦：");
console.log("  无动爻 " + noMove + " 次 / 有动爻 " + hasMove + " 次");
console.log("  动爻个数分布 " + JSON.stringify(mvCnt));
console.log(err.length ? "FAIL:\n" + err.slice(0, 30).join("\n") : "OK: 古法灵签与六爻引擎校验通过");
