// question-check.js —— 提问示例是否跟着牌阵类别走
// 背景：提问页的 placeholder 和「或者试试这些」原来取自牌阵自身的 ph，
// 结果在「感情」分类点进五牌关系阵，示例仍是「这个项目怎么推进」这类事业问句，
// 用户写的感情问题很自然会被带偏。
// 现在按 activeCat 取 CAT_QUESTIONS：感情问关系、事业问项目、生活问状态。
// 断言：① 五个类别按钮齐全、每类至少 2 个牌阵；
//      ② 每类 4 个示例、类内不重复、跨类不重复；
//      ③ 每类 placeholder 非空且各不相同；
//      ④ 感情类不出现事业词、事业类不出现感情词；
//      ⑤ 选分类后再点牌阵，示例仍属于该类（不被牌阵自带 ph 覆盖）；
//      ⑥ 点示例会填进输入框并更新字数计数。
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
const log = [];
const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

const CATS = ["通用排阵", "感情家庭", "事业财运", "生活人际"];
const btns = $$("#spread-cats .seg-btn");
const input = $("#question-input");
const chipsBox = $("#q-chips");

// 分类词汇表：用来抓「感情问句里冒出项目」「事业问句里冒出 TA」这类错配
const WORK_WORDS = ["项目", "团队", "汇报", "职场", "晋升", "offer", "面试", "工作", "老板", "领导", "同事", "业务"];
const LOVE_WORDS = ["TA", "ta", "他", "她", "我们之间", "这段关系", "在一起", "分手", "喜欢的人", "对方"];
// 生活人际要有人味儿，但只到「朋友/相处/关系」这一层，不该出现伴侣向的词
const PEOPLE_WORDS = ["人", "朋友", "相处", "关系", "大家", "身边"];
// 牌数口径（与 app.js / spread-check.js 一致）
const COUNTS = { single: 1, three: 3, soul: 3, choice: 3, relation: 5, break: 5, horseshoe: 7, celtic: 10 };

function chipsNow() {
  return $$("#q-chips .chip").map((c) => c.textContent.trim());
}
function shownCards() {
  return $$("#spread-list .spread-card").filter((c) => c.style.display !== "none");
}

// ---------- ① 分类按钮 ----------
ok(btns.length === CATS.length, "分类按钮共 " + CATS.length + " 个，实得 " + btns.length);
ok(btns.map((b) => b.getAttribute("data-cat")).join(",") === CATS.join(","),
  "分类按钮顺序依次为 " + CATS.join(" / "));

const snapshot = {};
CATS.forEach((cat) => {
  const btn = btns.find((b) => b.getAttribute("data-cat") === cat);
  ok(!!btn, "存在「" + cat + "」分类按钮");
  if (!btn) return;
  btn.click();

  // ---------- 牌阵可见性 ----------
  const cards = shownCards();
  ok(cards.length >= 2 && cards.length <= 5, cat + "：显示 " + cards.length + " 个牌阵（2-5 个）");
  const badCat = cards.filter((c) => String(c.getAttribute("data-cats") || "").split(",").indexOf(cat) < 0);
  ok(badCat.length === 0, cat + "：显示出来的牌阵都标了这个类，越界 " + badCat.length + " 个");

  // placeholder 与示例由「点进牌阵」时才写入，所以必须先点一张卡再读，
  // 否则读到的是 index.html 里的静态初始值（五个类会读到同一份，误判成"没生效"）。
  if (cards[0]) cards[0].click();

  // ---------- ② 示例问题 ----------
  const chips = chipsNow();
  ok(chips.length === 4, cat + "：示例问题 4 条，实得 " + chips.length);
  ok(new Set(chips).size === chips.length, cat + "：示例问题类内不重复");
  ok(chips.every((c) => c.length >= 6 && c.endsWith("？")), cat + "：示例问题都是完整问句且以「？」结尾");
  snapshot[cat] = { chips: chips, ph: input.placeholder };

  // ---------- ④ 词汇错配 ----------
  if (cat === "感情家庭") {
    const hit = chips.filter((c) => WORK_WORDS.some((w) => c.indexOf(w) >= 0));
    ok(hit.length === 0, "感情家庭：示例里没有职场词，越界 " + JSON.stringify(hit));
  }
  if (cat === "事业财运") {
    const hit = chips.filter((c) => LOVE_WORDS.some((w) => c.indexOf(w) >= 0));
    ok(hit.length === 0, "事业财运：示例里没有感情词，越界 " + JSON.stringify(hit));
    ok(chips.some((c) => /收入|薪|钱|财运|奖金|涨薪/.test(c)), "事业财运：至少一条问收入/财运（不只是问工作）");
  }
  if (cat === "生活人际") {
    const hit = chips.filter((c) => WORK_WORDS.some((w) => c.indexOf(w) >= 0) ||
      LOVE_WORDS.some((w) => c.indexOf(w) >= 0));
    ok(hit.length === 0, "生活人际：示例里不问项目也不问伴侣，越界 " + JSON.stringify(hit));
    ok(chips.some((c) => PEOPLE_WORDS.some((w) => c.indexOf(w) >= 0)), "生活人际：至少一条问人际相处");
  }
});

// ---------- ③ placeholder ----------
const phs = CATS.map((c) => (snapshot[c] || {}).ph || "");
ok(phs.every((p) => p && p.indexOf("例如") >= 0), "每类都有「例如：…」形式的 placeholder");
ok(new Set(phs).size === phs.length, "四类 placeholder 各不相同，实得 " + new Set(phs).size + " 种");

// ---------- ② 跨类不重复 ----------
const all = CATS.reduce((a, c) => a.concat((snapshot[c] || {}).chips || []), []);
ok(new Set(all).size === all.length, "跨类别示例问题不重复（共 " + all.length + " 条，去重后 " + new Set(all).size + " 条）");

// ---------- ⑦ 牌数顺序 ----------
// 用户明确要求：感情家庭下按「三牌、三牌、五牌」排，先轻后重。
const catCounts = (cat) => {
  const btn = btns.find((b) => b.getAttribute("data-cat") === cat);
  if (!btn) return [];
  btn.click();
  return shownCards().map((c) => COUNTS[c.getAttribute("data-spread")] || 0);
};
ok(catCounts("感情家庭").join(",") === "3,3,5",
  "感情家庭：牌数顺序为 三牌 → 三牌 → 五牌，实得 " + catCounts("感情家庭").join(","));
ok(catCounts("事业财运").join(",") === "3,3,5",
  "事业财运：牌数顺序为 三牌 → 三牌 → 五牌，实得 " + catCounts("事业财运").join(","));
ok(catCounts("通用排阵").join(",") === "1,3,7,10",
  "通用排阵：按牌数由少到多 1 → 3 → 7 → 10，实得 " + catCounts("通用排阵").join(","));
const lifeCounts = catCounts("生活人际");
ok(lifeCounts.join(",") === lifeCounts.slice().sort((a, b) => a - b).join(","),
  "生活人际：按牌数由少到多排列，实得 " + lifeCounts.join(","));
// 「其他」类别已取消
ok(!$('#spread-cats [data-cat="其他"]'), "「其他」分类已取消");
const dangling = $$("#spread-list .spread-card").filter((c) => {
  const cats = String(c.getAttribute("data-cats") || "").split(",");
  return cats.some((x) => CATS.indexOf(x) < 0);
});
ok(dangling.length === 0,
  "没有牌阵还挂在已删除的类别上，残留 " + JSON.stringify(dangling.map((c) => c.getAttribute("data-spread"))));

// ---------- ⑤ 选分类后再点牌阵，示例仍属于该类 ----------
// 这里是最容易回归的地方：点牌阵会调 applyCatQuestions(activeCat, key)，
// 一旦有人把它改回取 SPREADS[key].ph，感情分类下点五牌就会退回通用例句。
function checkSpreadKeepsCat(cat, spreadKey) {
  const btn = btns.find((b) => b.getAttribute("data-cat") === cat);
  if (!btn) return;
  btn.click();
  const card = $$("#spread-list .spread-card").find((c) => c.getAttribute("data-spread") === spreadKey);
  if (!card) return;
  card.click();
  const want = (snapshot[cat] || {}).ph;
  ok(input.placeholder === want,
    cat + " 选 " + spreadKey + " 牌阵后 placeholder 仍是该类（期望「" + want + "」，实得「" + input.placeholder + "」）");
  ok(chipsNow().join("|") === ((snapshot[cat] || {}).chips || []).join("|"),
    cat + " 选 " + spreadKey + " 牌阵后示例问题仍是该类（实得 " + JSON.stringify(chipsNow()) + "）");
}

checkSpreadKeepsCat("感情家庭", "relation");
checkSpreadKeepsCat("事业财运", "break");
checkSpreadKeepsCat("生活人际", "soul");

// ---------- ⑥ 点示例填入输入框 ----------
btns.find((b) => b.getAttribute("data-cat") === "感情家庭").click();
$$("#spread-list .spread-card").find((c) => c.getAttribute("data-spread") === "relation").click();
const firstChip = $("#q-chips .chip");
if (firstChip) {
  const text = firstChip.textContent.trim();
  firstChip.click();
  ok(input.value === text, "点示例后输入框被填入「" + text + "」，实得「" + input.value + "」");
  ok($("#q-counter").textContent === input.value.length + "/60",
    "字数计数同步更新为 " + input.value.length + "/60");
} else {
  ok(false, "感情分类下应至少有一个可点的示例问题");
}

// ---------- 输出 ----------
errs.forEach((e) => log.unshift("  ✗ " + e));
console.log(log.join("\n"));
if (errs.length) {
  console.log("\nFAIL: 提问示例检查未通过（" + errs.length + " 项）");
  process.exit(1);
}
console.log("\nOK: 提问示例随类别切换检查全部通过");
