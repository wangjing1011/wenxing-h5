// bazi-mingyu-check.js
// 验证「基础四柱已改走命语」。
// 做法：把 window.MingyuBazi 换成一个可识别的 stub 引擎，其四柱刻意与 lunar 不同（甲子 ×4）。
// 若结果页四柱 / 五行分布显示的是 stub 的值，即证明基础盘确实取自命语，而非 lunar 兜底。
const fs = require("fs");
const path = require("path");
const { parseHTML } = require("linkedom");

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const { window, document } = parseHTML(html);
global.self = global;
window.iztro = require("./js/vendor/iztro.js");
const _lunar = require("./js/vendor/lunar.js");
global.Solar = window.Solar = _lunar.Solar;
global.Lunar = window.Lunar = _lunar.Lunar;

global.Event = window.Event;
window.scrollTo = () => {};
window.confirm = () => true;
window.alert = () => {};
if (window.Element && !window.Element.prototype.scrollIntoView) {
  window.Element.prototype.scrollIntoView = function () {};
}
const store = {};
window.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
global.localStorage = window.localStorage;
window.localStorage.setItem("wenxing_bazi_consent", "1");

(function patchGetById() {
  const orig = document.getElementById.bind(document);
  document.getElementById = function (id) {
    const r = orig(id);
    if (r) return r;
    try { return document.querySelector("#" + id); } catch (e) { return null; }
  };
})();

// ---- stub 命语引擎：四柱固定甲子×4，便于识别来源 ----
const STUB = {
  pillars: {
    year: { gan: "甲", zhi: "子", ganZhi: "甲子" },
    month: { gan: "甲", zhi: "子", ganZhi: "甲子" },
    day: { gan: "甲", zhi: "子", ganZhi: "甲子" },
    hour: { gan: "甲", zhi: "子", ganZhi: "甲子" }
  },
  tenGods: { year: "比肩", month: "比肩", day: "日主", hour: "比肩" },
  hiddenTenGods: { year: ["正印"], month: ["正印"], day: ["正印"], hour: ["正印"] },
  nayin: { year: "海中金", month: "海中金", day: "海中金", hour: "海中金" },
  dayMaster: { gan: "甲", element: "木", yinYang: "阳" },
  lunarDate: { year: 1990, month: 5, day: 23, monthName: "五月", dayName: "廿三" },
  zodiac: "马",
  taiYuan: "乙酉",
  mingGong: "丙戌",
  luckInfo: {
    startInfo: "出生后 3 年 2 月 起运（stub）",
    cycles: [
      { age: 1, ganZhi: "小运", isXiaoyun: true, years: [] },
      { age: 4, ganZhi: "甲子", isXiaoyun: false, years: [{ ganZhi: "甲子", tenGod: "比肩" }] },
      { age: 14, ganZhi: "乙丑", isXiaoyun: false, years: [{ ganZhi: "乙丑", tenGod: "劫财" }] }
    ]
  },
  analysis: {
    dayMasterStrength: { status: "身旺", details: { seasonalEffect: "得令", commanderEffect: "帮身" } },
    mingGe: { pattern: "建禄格", fulfillment: { status: "成格" }, basis: "stub 依据" },
    usefulGod: { useful: "财星", avoid: "比劫", favorableWuxing: ["火", "土"], unfavorableWuxing: ["木", "水"], primaryReason: "stub" }
  },
  climate: { summary: "stub 调候", medicine: ["丙火"] },
  shensha: { year: ["天乙贵人"], month: [], day: [], hour: [] },
  warnings: []
};
const received = [];
window.MingyuBazi = {
  version: "stub-1",
  calculateBazi: function (input) {
    received.push(JSON.parse(JSON.stringify(input)));
    return STUB;
  }
};

// ---- 加载前端脚本（跳过 vendor：1MB bundle 直接注入会 OOM）----
const files = [];
(function walk(d) {
  fs.readdirSync(d).forEach((f) => {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (f !== "__" && f !== "vendor") walk(p); }
    else if (f.endsWith(".js")) files.push(p);
  });
})(path.join(ROOT, "js"));
const order = ["icons.js", "tarot-data-major.js", "tarot-data-minor.js", "tarot-images.js", "bazi-meanings.js",
  "qian-data-1.js", "qian-data-2.js", "liuyao-data.js", "meihua-data.js", "ziwei-meanings.js", "name-data.js",
  "app.js", "app-fortune.js", "app-divine.js", "app-meihua.js", "app-ziwei.js", "app-name.js"];
const ordered = order.map((o) => path.join(ROOT, "js", o))
  .concat(files.filter((f) => !order.some((o) => f.endsWith(o))));

const errs = [];
ordered.forEach((f) => {
  const code = fs.readFileSync(f, "utf8");
  try {
    new Function("window", "document", "localStorage", "confirm", "alert", code)(
      window, document, window.localStorage, window.confirm, window.alert
    );
  } catch (e) { errs.push("加载异常 " + f + " → " + e.message); }
});

const $ = (s) => document.querySelector(s);
const log = [];
const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

const captured = [];
window.WenxingAI.interpret = function (payload) {
  captured.push(payload);
  return Promise.reject(new Error("offline: no backend"));
};

// ============ 排盘（stub 已就绪 → 同步升级为命语口径）============
$("[data-go=bazi]").click();
$("#bz-date").value = "1990-06-15";
$("#bz-hour").value = "12"; // 午时 → timeIndex 6
$("#bz-name").value = "不该出现在入参里的称呼";
$("#btn-bazi-go").click();

const result = $("#bazi-result");
const pillarGz = Array.prototype.map.call(
  document.querySelectorAll("#bazi-result .pillar .gz"),
  (el) => el.textContent.trim()
);

ok(pillarGz.length === 4, "结果页渲染出 4 根柱");
ok(pillarGz.join("") === "甲子甲子甲子甲子",
  "基础四柱取自命语引擎（stub 值 甲子×4），实际=" + pillarGz.join(" "));

// 十神 / 藏干十神 / 纳音同样应来自 stub
const ssText = Array.prototype.map.call(
  document.querySelectorAll("#bazi-result .pillar .ss"), (el) => el.textContent
).join(" ");
const nyText = Array.prototype.map.call(
  document.querySelectorAll("#bazi-result .pillar .ny"), (el) => el.textContent
).join(" ");
ok(/比肩/.test(ssText), "天干十神取自命语（比肩）");
ok(/正印/.test(ssText), "地支藏干十神取自命语（正印）");
ok(/海中金/.test(nyText), "纳音取自命语（海中金）");

// 五行分布应跟随 stub 干支（甲=木×4，子=水×4）
const wx = {};
Array.prototype.forEach.call(document.querySelectorAll("#bazi-result .wx-row"), (r) => {
  wx[r.querySelector(".n").textContent] = r.querySelector(".c").textContent;
});
ok(wx["木"] === "4" && wx["水"] === "4",
  "五行分布按命语干支统计（木4 水4），实际=" + JSON.stringify(wx));

// 农历 / 生肖 / 胎元 / 命宫 也应来自命语
ok(/五月廿三/.test(result.innerHTML), "农历文本取自命语（五月廿三）");
ok(/生肖马/.test(result.innerHTML), "生肖取自命语（马）");
ok(/乙酉/.test(result.innerHTML), "胎元取自命语（乙酉）");
ok(/丙戌/.test(result.innerHTML), "命宫取自命语（丙戌）");

// 大运板块应与四柱同源（stub 的 cycles，不含小运）
ok(/甲子/.test(result.innerHTML) && /乙丑/.test(result.innerHTML), "大运取自命语 cycles");
ok(!/小运/.test(result.innerHTML), "大运列表已剔除小运条目");

// 深度解读仍在（同一次 calculateBazi 的结果）
ok(/深度解读/.test(result.innerHTML), "结果页含「深度解读」板块");
ok(/建禄格/.test(result.innerHTML), "深度板块格局取值正确（建禄格）");
ok(/命语/.test(result.innerHTML), "深度板块标注数据来源「命语」");

// ---- 入参合规 ----
const inp = received[received.length - 1];
ok(!!inp, "命语引擎被调用");
ok(inp && inp.year === 1990 && inp.month === 6 && inp.day === 15, "入参为公历数字年月日");
ok(inp && inp.timeIndex === 6, "午时映射为 timeIndex=6");
ok(inp && inp.gender === "male", "性别以字符串 male 传入");
ok(inp && !/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(inp)), "入参不含原始日期字符串");
ok(inp && JSON.stringify(inp).indexOf("不该出现") < 0, "入参不含姓名");

// ---- payload 合规 ----
$("#btn-bazi-ai").click();
setTimeout(() => {
  const p = captured.find((x) => x && x.domain === "bazi");
  ok(!!p, "捕获到八字 payload");
  const s = JSON.stringify(p);
  const bad = [];
  if (/不该出现/.test(s)) bad.push("姓名");
  if (/1990-06-15/.test(s)) bad.push("原始生辰");
  if (/"?\b(19|20)\d{2}\b"?/.test(s)) bad.push("年份痕迹");
  ok(bad.length === 0, "payload 未泄露生辰/姓名/年份" + (bad.length ? "（检出：" + bad.join("、") + "）" : ""));
  ok(!!(p && p.chart && p.chart.deep), "payload 含 chart.deep");
  ok(p && p.chart.pillars && p.chart.pillars[0].gz === "甲子", "payload 四柱同样来自命语");

  // ============ 降级：撤掉命语，应回落 lunar 基础盘且不崩 ============
  window.MingyuBazi = undefined;
  const errCountBefore = errs.length;
  $("#bz-date").value = "2000-01-01";
  $("#bz-hour").value = "12";
  try { $("#btn-bazi-go").click(); } catch (e) { errs.push("降级排盘抛错：" + e.message); }
  const gz2 = Array.prototype.map.call(
    document.querySelectorAll("#bazi-result .pillar .gz"), (el) => el.textContent.trim()
  );
  ok(errs.length === errCountBefore, "命语缺失时排盘不抛错");
  ok(gz2.length === 4 && gz2.join("").length === 8, "降级路径仍渲染 4 根柱");
  ok(gz2.join("") !== "甲子甲子甲子甲子", "降级路径不再使用命语值（回落 lunar）");
  const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const jiazi = new Set();
  for (let i = 0; i < 60; i++) jiazi.add(GAN[i % 10] + ZHI[i % 12]);
  ok(gz2.every((g) => jiazi.has(g)), "降级路径四柱均为合法干支，实际=" + gz2.join(" "));

  console.log(log.join("\n"));
  console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: 基础四柱已由命语引擎计算（含降级兜底）校验通过");
  process.exit(errs.length ? 1 : 0);
}, 150);
