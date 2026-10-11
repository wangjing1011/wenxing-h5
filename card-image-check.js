// card-image-check.js —— 塔罗真实牌面接入验证
// ① 78 张图文件与映射清单一一对应、无缺漏
// ② 结果页每张牌渲染真实 <img>（非圆形字母占位）
// ③ 逆位整张图案 rotate(180deg)（.rev-img 类）
// ④ 正位不旋转；牌名/编号仍可见
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

// ---- A. 映射清单 ----
const IMG_DIR = path.join(ROOT, "assets", "tarot");
const diskFiles = fs.readdirSync(IMG_DIR).filter((f) => f.endsWith(".webp"));
ok(diskFiles.length === 78, "assets/tarot 下 78 张 webp，实得 " + diskFiles.length);

ok(!!window.TAROT_IMAGES && typeof window.tarotImageOf === "function", "window.tarotImageOf 已挂载");
const mapKeys = Object.keys(window.TAROT_IMAGES || {});
ok(mapKeys.length === 78, "映射清单 78 条，实得 " + mapKeys.length);

// 每条映射都能在磁盘找到文件
const missing = mapKeys.filter((n) => !fs.existsSync(path.join(IMG_DIR, window.TAROT_IMAGES[n])));
ok(missing.length === 0, "清单指向的文件全部存在" + (missing.length ? "（缺失：" + missing.join(",") + "）" : ""));

// 关键的 4 个端点牌 + 大牌首尾
ok(window.tarotImageOf(0) === "assets/tarot/000-thefool.webp", "愚人(0) 路径正确，实得 " + window.tarotImageOf(0));
ok(window.tarotImageOf(21) !== "", "世界(21) 有图");
ok(window.tarotImageOf(101) !== "", "权杖一(101) 有图");
ok(window.tarotImageOf(114) !== "", "权杖国王(114) 有图");
ok(window.tarotImageOf(214) !== "", "圣杯国王(214) 有图");
ok(window.tarotImageOf(414) !== "", "星币国王(414) 有图");
ok(window.tarotImageOf(999) === "", "未知编号返回空串（安全降级）");

// ---- B. 结果页渲染 ----
// 进入塔罗 → 选「单张」→ 提问页 → 抽 1 张 → 查看解读
$("[data-go=tarot]").click();
$('[data-spread="single"]').click();
const qq = $("#question-input");
if (qq) { qq.value = "测试问题"; }
if (qq && qq.dispatchEvent) { qq.dispatchEvent(new window.Event("input")); }
const qgo = $("#btn-start-draw");
if (qgo) qgo.click();

// 抽牌页：点第一张卡背（单张牌阵只需抽 1 张）
const back = $("#deck .cardback");
if (back) back.click();
const toResult = $("#btn-to-result");
if (toResult) toResult.click();

// 结果页断言
const rc = $$("#cards-flow .rcard");
ok(rc.length > 0, "结果页渲染出牌卡，实得 " + rc.length);

if (rc.length > 0) {
  const imgs = $$("#cards-flow .card-img");
  ok(imgs.length === rc.length, "每张牌都有真实图案 <img>，图片数 " + imgs.length + " / 牌数 " + rc.length);

  const firstImg = imgs[0];
  if (firstImg) {
    ok(/^assets\/tarot\/\d{3}-.+\.webp$/.test(firstImg.getAttribute("src")),
      "图片 src 指向真实 WebP 资源，实得 " + firstImg.getAttribute("src"));
    ok(firstImg.getAttribute("loading") === "lazy", "图片为懒加载");
  }

  // 正逆位：所有 .card-img 要么带 .rev-img 要么不带，且与 orient 一致
  const rejected = $$("#cards-flow .rcard").map((r) => ({
    rev: /逆\s*位/.test(r.querySelector(".orient") ? r.querySelector(".orient").textContent : ""),
    imgRev: !!r.querySelector(".card-img.rev-img")
  }));
  const bad = rejected.filter((x) => x.rev !== x.imgRev);
  ok(bad.length === 0, "正逆位与图案旋转一致" + (bad.length ? "（不一致 " + bad.length + " 张）" : ""));

  // 牌名可见
  const caps = $$("#cards-flow .front3d .cap .nm");
  ok(caps.length === rc.length, "每张牌都有牌名标签，实得 " + caps.length);
}

// 不应再出现旧的圆形字母占位（本页有图时）
ok($$("#cards-flow .front3d .glyph").length === 0, "结果页未残留圆形字母占位");

console.log(log.join("\n"));
console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: 塔罗真实牌面接入检查全部通过");
process.exit(errs.length ? 1 : 0);
