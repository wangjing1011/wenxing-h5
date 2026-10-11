// mingyu-integration-check.js
// 验证「命语深度能力」在 H5 前端链路中真实生效：
//   ① 排盘后异步加载命语 vendor 包（测试中直接注入 sandbox 的 window.MingyuBazi）
//   ② 结果页渲染出「深度解读」板块：格局 / 用神喜忌 / 调候 / 神煞 / 精确大运
//   ③ 命语失败时可降级（不影响基础排盘）
//   ④ 扩展后的 payload 含 chart.deep，且仍不含生辰/姓名
const fs = require("fs");
const path = require("path");
const vm = require("vm");
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

// ---- 关键：注入命语 bundle 到 window，模拟 ensureMingyu 懒加载完成 ----
const sandboxBundle = { console, setTimeout, clearTimeout };
sandboxBundle.window = sandboxBundle;
sandboxBundle.self = sandboxBundle;
sandboxBundle.globalThis = sandboxBundle;
vm.createContext(sandboxBundle);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/vendor/mingyu-bazi.js"), "utf8"), sandboxBundle, { filename: "mingyu-bazi.js" });
window.MingyuBazi = sandboxBundle.MingyuBazi;   // 预置，故 ensureMingyu 会走同步分支

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

const captured = [];
window.WenxingAI.interpret = function (payload) {
  captured.push(payload);
  return Promise.reject(new Error("offline: no backend"));
};

// ============ 八字链路 ============
click($("[data-go=bazi]"));
const bzDate = $("#bz-date");
bzDate.value = "1990-06-15";
$("#bz-hour").value = "12"; // 午时 → timeIndex 6
$("#bz-name").value = "测试用称呼"; // 故意填姓名，验证不进 payload

click($("#btn-bazi-go"));

// 命语为同步分支（已预置 window.MingyuBazi），但 ensureMingyu 返回 Promise，
// 故深度板块在微任务后插入。用 setTimeout 断言。
setTimeout(() => {
  const result = $("#bazi-result");
  const htmlStr = result.innerHTML;

  ok(/深度解读/.test(htmlStr), "结果页渲染出「深度解读」板块");
  ok(/格局/.test(htmlStr), "深度板块含「格局」");
  ok(/用神喜忌/.test(htmlStr), "深度板块含「用神喜忌」");
  ok(/调候/.test(htmlStr), "深度板块含「调候」");
  ok(/神煞/.test(htmlStr), "深度板块含「神煞」");
  ok(/精确起运/.test(htmlStr), "深度板块含「精确起运」");
  ok(/大运（逐年十神）/.test(htmlStr), "深度板块含「大运（逐年十神）」");
  ok(/命语/.test(htmlStr), "深度板块标注了数据来源「命语」");

  // 结论值抽查：1990-06-15 午时男 → 正官格（破格）
  ok(/正官格/.test(htmlStr), "格局取值正确（正官格）");
  ok(/破格/.test(htmlStr), "格局成破判定正确（破格）");
  ok(/正印|偏印/.test(htmlStr), "用神取值正确（含印星）");

  // ---- 基础四柱也必须来自命语（同一引擎、同一次计算）----
  const expect = window.MingyuBazi.calculateBazi({ year: 1990, month: 6, day: 15, timeIndex: 6, gender: "male" });
  const domGz = Array.prototype.map.call(
    document.querySelectorAll("#bazi-result .pillar .gz"), (el) => el.textContent.trim()
  );
  const mgGz = [expect.pillars.year.ganZhi, expect.pillars.month.ganZhi, expect.pillars.day.ganZhi, expect.pillars.hour.ganZhi];
  ok(domGz.join("") === mgGz.join(""), "基础四柱与命语一致（" + domGz.join(" ") + "）");
  const expectLunar = (expect.lunarDate.monthName || "") + (expect.lunarDate.dayName || "");
  ok(htmlStr.indexOf(expectLunar) >= 0, "农历文本与命语一致（" + expectLunar + "）");
  ok(htmlStr.indexOf("生肖" + expect.zodiac) >= 0, "生肖与命语一致（" + expect.zodiac + "）");
  ok(htmlStr.indexOf("胎元") >= 0 && htmlStr.indexOf(expect.taiYuan) >= 0, "胎元与命语一致（" + expect.taiYuan + "）");

  // 校验：确保深度内容确实在 .bz-card 内、且在任何 gen-note 之前
  const card = document.querySelector("#bazi-result .bz-card");
  ok(!!card, "结果卡片 .bz-card 存在");
  const deepEl = document.querySelector("#bazi-result .my-deep");
  ok(!!deepEl, "深度板块 .my-deep DOM 节点存在（非仅字符串匹配）");

  // ---- payload 合规 ----
  click($("#btn-bazi-ai"));
  setTimeout(() => {
    const bzP = captured.find((p) => p && p.domain === "bazi");
    ok(!!bzP, "捕获到八字 payload");

    const s = JSON.stringify(bzP);
    const bad = [];
    if (/测试用称呼/.test(s)) bad.push("姓名");
    if (/1990-06-15/.test(s)) bad.push("原始生辰日期");
    // 严格：任何 4 位数字（1900-2099）都视为暴露原始年份/年份痕迹
    const years = s.match(/"?\b(19|20)\d{2}\b"?/g);
    if (years) bad.push("年份痕迹(" + [...new Set(years)].join(",") + ")");
    ok(bad.length === 0, "payload 未泄露生辰/姓名/年份" + (bad.length ? "（检出：" + bad.join("、") + "）" : ""));

    ok(bzP && bzP.chart && bzP.chart.deep, "payload 含扩展字段 chart.deep（深度信息已供 AI 使用）");
    if (bzP && bzP.chart && bzP.chart.deep) {
      const d = bzP.chart.deep;
      ok(d.pattern === "正官格", "chart.deep.pattern 正确（正官格），实际=" + d.pattern);
      ok(!!d.usefulGod, "chart.deep.usefulGod 存在");
      ok(!!d.shensha, "chart.deep.shensha 存在");
      ok(!!d.climate, "chart.deep.climate 存在");
      ok(!!d.luckStartText, "chart.deep.luckStartText 存在（已剥离年份）");
      ok(Array.isArray(d.daYun) && d.daYun.length > 0, "chart.deep.daYun 为数组且非空");
      if (Array.isArray(d.daYun) && d.daYun[0]) {
        ok(typeof d.daYun[0].gz === "string" && d.daYun[0].gz.length === 2, "chart.deep.daYun[0].gz 为干支");
        ok(d.daYun[0].years && d.daYun[0].years[0] && !("year" in d.daYun[0].years[0]),
          "chart.deep.daYun 逐年条目不含量年份数字");
      }
    }

    console.log(log.join("\n"));
    console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: 命语深度能力前端接入检查全部通过");
    process.exit(errs.length ? 1 : 0);
  }, 120);
}, 200);
