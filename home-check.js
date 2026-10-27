// home-check.js —— 首页布局与图标验证
// ① 方案 A 结构：2×2 常用工具 + 3×3 更多功能，全部 9 项在首屏
// ② 9 个功能各注入 SVG 图标（非 Unicode 符号）
// ③ data-go 入口可点、locked 占位提示正常
// ④ 无遗弃的 Unicode 图标（☽✿☯❀◈☀✧✎❖）
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
const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
const log = [];
const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

// ---- A. 结构 ----
const lgTiles = $$("#view-home .home-grid-2 .home-tile");
const smTiles = $$("#view-home .home-grid-3 .home-tile");
ok(lgTiles.length === 4, "常用工具 4 项（2×2），实得 " + lgTiles.length);
ok(smTiles.length === 5, "更多功能 5 项，实得 " + smTiles.length);

const lgGo = lgTiles.map((t) => t.getAttribute("data-go"));
ok(JSON.stringify(lgGo) === JSON.stringify(["tarot", "bazi", "qian", "huangli"]),
  "常用工具顺序为 塔罗/八字/灵签/黄历，实得 " + lgGo.join("/"));

const smGo = smTiles.map((t) => t.getAttribute("data-go") || "locked:" + t.getAttribute("data-todo"));
ok(smGo.length === 5 && smGo.indexOf("ziwei") >= 0 && smGo.indexOf("liuyao") >= 0 &&
   smGo.indexOf("meihua") >= 0 && smGo.indexOf("name") >= 0 && smGo.join("|").indexOf("locked:奇门遁甲") >= 0,
  "更多功能含 紫微/六爻/梅花/起名 + 奇门占位，实得 " + smGo.join(" / "));

// 总入口数 = 9（8 可用 + 1 占位）
const allTiles = $$("#view-home .home-tile");
ok(allTiles.length === 9, "首页共 9 个功能位，实得 " + allTiles.length);
ok($$("#view-home .home-tile[data-go]").length === 8, "可点击功能 8 项");

// 旧的三族 spread-card 结构应已从首页移除
ok($$("#view-home .spread-card").length === 0, "首页旧 spread-card 已移除");

// ---- B. 图标注入 ----
let iconOk = 0, iconNames = [];
$$("#view-home [data-icon]").forEach((el) => {
  const k = el.getAttribute("data-icon");
  iconNames.push(k);
  if (/<svg[\s>]/.test(el.innerHTML)) iconOk++;
});
ok(iconOk === 9, "9 个功能图标全部注入为 SVG，实得 " + iconOk);
ok(iconNames.join(",") === "tarot,bazi,qian,huangli,ziwei,liuyao,meihua,name,qimen",
  "图标 key 齐全，实得 " + iconNames.join(","));

// 图标必须是 SVG 而非 Unicode 符号
const homeHtml = $("#view-home").innerHTML;
const unicodeIcons = ["☽", "✿", "☯", "❀", "◈", "☀", "✧", "✎", "❖"];
const leftover = unicodeIcons.filter((c) => homeHtml.indexOf(c) >= 0);
ok(leftover.length === 0, "首页无遗弃的 Unicode 图标" + (leftover.length ? "（残留：" + leftover.join("") + "）" : ""));

// 每个图标 key 都有实际 SVG 内容
if (window.WX_ICONS) {
  const keys = Object.keys(window.WX_ICONS);
  ok(keys.length === 9, "WX_ICONS 定义 9 个图标，实得 " + keys.length);
  const emptyKeys = keys.filter((k) => !/<svg[\s>]/.test(window.WX_ICONS[k]) || window.WX_ICONS[k].length < 80);
  ok(emptyKeys.length === 0, "所有图标 SVG 内容非空" + (emptyKeys.length ? "（异常：" + emptyKeys.join(",") + "）" : ""));
} else {
  ok(false, "window.WX_ICONS 未挂载");
}

// ---- B2. 图片区与主色区分（避免九个图标长得一样）----
const artTiles = $$("#view-home .home-tile .art");
ok(artTiles.length === 9, "9 个功能位都有独立图片区 .art，实得 " + artTiles.length);
const artsNestedIcon = $$("#view-home .home-tile .art .ic[data-icon]");
ok(artsNestedIcon.length === 9, "图标均嵌在图片区内，实得 " + artsNestedIcon.length);

const accents = allTiles.map((t) => (t.getAttribute("style") || "").replace(/\s/g, ""));
const noAccent = accents.filter((s) => !/--ac:#[0-9a-fA-F]{6}/.test(s));
ok(noAccent.length === 0, "每个功能位都声明了主色 --ac" + (noAccent.length ? "（缺失 " + noAccent.length + " 个）" : ""));
const accentVals = accents.map((s) => (s.match(/--ac:(#[0-9a-fA-F]{6})/) || [])[1] || "");
ok(new Set(accentVals.filter(Boolean)).size === 9, "9 个主色互不相同，实得 " + new Set(accentVals.filter(Boolean)).size + " 种");

// ---- C. 交互 ----
let goThrew = false;
try { $("[data-go=tarot]").click(); } catch (e) { goThrew = true; errs.push("点击塔罗抛错 → " + e.message); }
ok(!goThrew, "点击常用工具入口不抛错");
ok($("#view-tarot").style.display !== "none", "塔罗入口正确切换到塔罗视图");

let lockThrew = false;
try { $("#view-home .home-tile.locked").click(); } catch (e) { lockThrew = true; errs.push("点击奇门占位抛错 → " + e.message); }
ok(!lockThrew, "点击奇门占位不抛错（仅提示）");

console.log(log.join("\n"));
console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: 首页布局与图标检查全部通过");
process.exit(errs.length ? 1 : 0);
