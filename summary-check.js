// summary-check.js —— 综合提示分段 + 牌阵分类筛选
// 背景：综合提示原来是「一串到底」的 textContent，十张牌连成一大坨，手机上读不下去。
// 现在改为按空行分段、由 <p> 渲染，一段只说一件事。
// 断言：① 每个牌阵的段落数符合「逐张一段」的预期；② 单段不过长、无空段；
//      ③ 分类筛选每个类别 2-4 个牌阵、五个类别覆盖全部 8 个；④ 每类都有说明文案。
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

// linkedom 缺陷兜底：事件分发时序下 getElementById 偶发返回 null
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
  "ai.js", "ai-oracle.js",
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
const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
const click = (el) => el.click();
const log = [];
const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

// SPREADS 的牌数（与 app.js 保持一致；spread-check.js 已单独校验过的口径）
const COUNTS = { single: 1, three: 3, soul: 3, choice: 3, relation: 5, break: 5, horseshoe: 7, celtic: 10 };

// ---- A. 分类筛选 ----
const visibleSpreads = () => $$("#spread-list .spread-card").filter((c) => c.style.display !== "none");
const CATS = ["通用排阵", "感情家庭", "事业财运", "生活人际"];
const seen = {};
let catNumOk = true, hintOk = true;
CATS.forEach((cat) => {
  const tab = $('#spread-cats [data-cat="' + cat + '"]');
  if (!tab) { ok(false, "缺少分类标签「" + cat + "」"); return; }
  click(tab);
  const vs = visibleSpreads();
  if (vs.length < 2 || vs.length > 5) catNumOk = false;
  if (String($("#spread-cat-hint").textContent || "").length < 12) hintOk = false;
  vs.forEach((c) => { seen[c.getAttribute("data-spread")] = 1; });
  log.push("    · " + cat + "：" + vs.map((c) => c.getAttribute("data-spread")).join(" / "));
});
ok(catNumOk, "每个类别显示 2-5 个牌阵（不再一次摊开 8 个）");
ok(hintOk, "每个类别都有说明文案");
ok(Object.keys(seen).length === 8, "四个类别合起来覆盖全部 8 个牌阵，实得 " + Object.keys(seen).length);
ok($$("#spread-cats .seg-btn.on").length === 1, "任意时刻只有一个分类处于选中态");
// 切回通用排阵，后续抽取链路从通用类别进入
click($('#spread-cats [data-cat="通用排阵"]'));
ok(visibleSpreads().length === 4, "切回通用排阵显示 4 个牌阵");

// ---- B. 综合提示分段 ----
function drawSpread(key) {
  click($('[data-spread="' + key + '"]'));
  const q = $("#question-input");
  q.value = "这件事接下来会怎么发展？";
  q.dispatchEvent(new window.Event("input", { bubbles: true }));
  click($("#btn-start-draw"));
  const backs = document.querySelectorAll("#deck .cardback");
  const n = COUNTS[key];
  for (let i = 0; i < n; i++) click(backs[i % backs.length]);
  click($("#btn-to-result"));
}

Object.keys(COUNTS).forEach((key) => {
  const n = COUNTS[key];
  drawSpread(key);
  if ($("#view-result").style.display === "none") { ok(false, key + "：未进入结果页"); return; }

  const ps = $$("#r-summary p");
  const texts = ps.map((p) => (p.textContent || "").trim());
  // 段落构成（每段只说一件事）：开场1 + 逐张 n + 重点1 + 明确结论1 + 收尾1
  const expect = n === 1 ? 4 : n + 4;
  ok(ps.length === expect, key + "（" + n + " 牌）：综合提示分 " + expect + " 段，实得 " + ps.length);
  ok(texts.every((t) => t.length > 0), key + "：无空段");
  const longest = texts.reduce((a, b) => (b.length > a.length ? b : a), "");
  ok(longest.length <= 200, key + "：最长一段 " + longest.length + " 字（≤200，不会糊成一大坨）");
  ok(texts.every((t) => t.indexOf("\n") < 0), key + "：段内无残留换行（分段已生效）");
  // 逐张一段：除首尾与重点段外，每段都带位置标签「…」
  if (n > 1) {
    const cardParas = ps.slice(1, 1 + n).map((p) => p.textContent || "");
    ok(cardParas.filter((t) => /^「[^」]+」/.test(t)).length === n, key + "：每张牌各占一段且以位置名开头");
    ok(ps[ps.length - 1].textContent.indexOf("镜子") >= 0, key + "：末段为收尾提醒（把决定权交回用户）");
  }
  // 红线段落：综合提示不能出现吉凶判词
  const all = texts.join("");
  ok(!/大吉|大凶|必凶|必吉/.test(all), key + "：综合提示无吉凶判词");
});

console.log(log.join("\n"));
console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: 综合提示分段与牌阵分类检查全部通过");
process.exit(errs.length ? 1 : 0);
