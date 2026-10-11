// 命盘 AI 解读接入检查（linkedom 离线环境）
// 验证：① 八字结果页存在 btn-bazi-ai / bazi-ai-box；② 紫微结果页存在 btn-zw-ai / zw-ai-box；
//      ③ 无后端时点击 AI 解读安全降级为「离线综合解读」并标注「重新解读」；
//      ④ 构造给后端的 payload 只含结构化命盘，绝不泄露生辰/姓名/原始年份。
// 说明：linkedom 在定时器回调的 dispatchEvent 过程中 getElementById 对静态元素偶发返回 null（已知缺陷），
//       故所有会触发 initDraw/排盘 的链路均放在顶层同步执行；仅 AI 异步降级结果用末端 setTimeout 断言
//       （该断言只读取 querySelector/textContent，不触碰 getElementById，故在定时器上下文也稳定）。
// 关键：linkedom 下 (async IIFE) 包裹会让脚本加载与事件分发进入不确定状态，故主体用顶层同步执行。
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
// 跳过合规知情同意弹窗，直接进入排盘（测试用途）
window.localStorage.setItem("wenxing_bazi_consent", "1");

// linkedom 缺陷修复：原生 getElementById 在事件分发的某些时序下对静态元素偶发返回 null，
// 用 querySelector("#id") 兜底包装，覆盖后 app.js 内部的 $ 也能稳定解析。必须在加载 app.js 前生效。
(function patchGetById() {
  const orig = document.getElementById.bind(document);
  document.getElementById = function (id) {
    const r = orig(id);
    if (r) return r;
    try { return document.querySelector("#" + id); } catch (e) { return null; }
  };
})();

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
const click = (el) => el.click();

const log = [];
const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

// 捕获发给后端的 payload，用于合规校验（必须只含结构化命盘，不含生辰/姓名/年份）
const captured = [];
// 模拟「无后端」：interpret 立即 reject，触发前端 catch → 本地综合解读降级。
window.WenxingAI.interpret = function (payload) {
  captured.push(payload);
  return Promise.reject(new Error("offline: no backend"));
};

ok(typeof window.WenxingAI === "object" && typeof window.WenxingAI.interpret === "function",
  "前端 AI 封装 window.WenxingAI.interpret 已挂载（已替换为离线模拟）");

// ============ 八字链路 ============
click($("[data-go=bazi]"));
ok($("#view-bazi").style.display !== "none", "八字：已进入八字视图");

const bzDate = $("#bz-date");
bzDate.value = "1990-05-20";
const bzHour = $("#bz-hour");
bzHour.value = "12"; // 午时
const bzName = $("#bz-name");
bzName.value = "测试用称呼"; // 故意填姓名，验证它不会进 payload

click($("#btn-bazi-go"));
ok($("#bazi-result").innerHTML.indexOf("btn-bazi-ai") >= 0, "八字：结果页渲染出 AI 解读按钮 btn-bazi-ai");
ok($("#bazi-ai-box") !== null, "八字：结果页存在 AI 解读容器 bazi-ai-box");
ok($("#btn-bazi-ai") !== null, "八字：可从 DOM 取到 btn-bazi-ai");

// 点击 AI 解读：同步阶段不抛错；异步降级在末端 setTimeout 断言
let bzThrew = false;
try { click($("#btn-bazi-ai")); } catch (e) { bzThrew = true; errs.push("八字点击 AI 解读同步抛错 → " + e.message); }
ok(!bzThrew, "八字：点击 AI 解读同步阶段不抛错");

// ============ 紫微链路 ============
click($("[data-go=ziwei]"));
ok($("#view-ziwei").style.display !== "none", "紫微：已进入紫微视图");

const zwDate = $("#zw-date");
zwDate.value = "1990-05-20";
const zwHour = $("#zw-hour");
zwHour.value = "12"; // 午时（timeIndex=6）
const zwName = $("#zw-name");
zwName.value = "测试用称呼"; // 故意填姓名，验证它不会进 payload

click($("#btn-ziwei-go"));
ok($("#ziwei-result").innerHTML.indexOf("btn-zw-ai") >= 0, "紫微：结果页渲染出 AI 解读按钮 btn-zw-ai");
ok($("#zw-ai-box") !== null, "紫微：结果页存在 AI 解读容器 zw-ai-box");
ok($("#btn-zw-ai") !== null, "紫微：可从 DOM 取到 btn-zw-ai");

let zwThrew = false;
try { click($("#btn-zw-ai")); } catch (e) { zwThrew = true; errs.push("紫微点击 AI 解读同步抛错 → " + e.message); }
ok(!zwThrew, "紫微：点击 AI 解读同步阶段不抛错");

// ============ 合规 & 降级断言（定时器内，不触碰 getElementById） ============
setTimeout(() => {
  // 八字降级
  const bzBox = $("#bazi-ai-box");
  ok(bzBox.style.display === "block", "八字：AI 解读容器已展开");
  ok(/离线综合解读/.test(bzBox.textContent), "八字：无后端时降级为本地综合解读并正确标注「离线综合解读」");
  ok($("#btn-bazi-ai").textContent === "重新解读", "八字：AI 按钮变为「重新解读」");

  // 紫微降级
  const zwBox = $("#zw-ai-box");
  ok(zwBox.style.display === "block", "紫微：AI 解读容器已展开");
  ok(/离线综合解读/.test(zwBox.textContent), "紫微：无后端时降级为本地综合解读并正确标注「离线综合解读」");
  ok($("#btn-zw-ai").textContent === "重新解读", "紫微：AI 按钮变为「重新解读」");

  // 合规：两个 payload 都只含结构化命盘，绝不泄露生辰/姓名/年份
  ok(captured.length === 2, "共捕获 2 个发给后端的 payload（八字+紫微），实得 " + captured.length);

  const bzP = captured.find((p) => p && p.domain === "bazi");
  const zwP = captured.find((p) => p && p.domain === "ziwei");
  ok(!!bzP && bzP.type === "chart", "八字 payload 类型正确（type=chart, domain=bazi）");
  ok(!!zwP && zwP.type === "chart", "紫微 payload 类型正确（type=chart, domain=ziwei）");

  function leakScan(name, p) {
    const s = JSON.stringify(p);
    const bad = [];
    if (/测试用称呼/.test(s)) bad.push("姓名");
    if (/"?date"?\s*:/.test(s) && /1990-05-20/.test(s)) bad.push("原始生辰日期");
    if (/"?year"?\s*:/.test(s)) bad.push("原始年份字段");
    return bad;
  }
  if (bzP) {
    const bad = leakScan("bazi", bzP);
    ok(bad.length === 0, "八字 payload 未泄露生辰/姓名" + (bad.length ? "（检出：" + bad.join("、") + "）" : ""));
    ok(bzP.chart && Array.isArray(bzP.chart.pillars) && bzP.chart.pillars.length === 4, "八字 payload 含四柱结构化数据");
    ok(bzP.chart && bzP.chart.dayMaster && bzP.chart.dayMaster.gan, "八字 payload 含日主干支");
  } else {
    ok(false, "八字 payload 未捕获，无法校验合规");
  }
  if (zwP) {
    const bad = leakScan("ziwei", zwP);
    ok(bad.length === 0, "紫微 payload 未泄露生辰/姓名" + (bad.length ? "（检出：" + bad.join("、") + "）" : ""));
    ok(zwP.chart && zwP.chart.fiveElementsClass && Array.isArray(zwP.chart.palaces) && zwP.chart.palaces.length === 12,
      "紫微 payload 含五行局 + 十二宫结构化数据");
    ok(zwP.chart && Array.isArray(zwP.chart.siHua), "紫微 payload 含四化结构化数据");
  } else {
    ok(false, "紫微 payload 未捕获，无法校验合规");
  }

  console.log(log.join("\n"));
  console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: 命盘 AI 解读前端接入检查全部通过");
  process.exit(errs.length ? 1 : 0);
}, 120);
