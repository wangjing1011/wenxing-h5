// 四板块 AI 解读接入检查（灵签 / 六爻 / 梅花 / 起名）
// 验证三件事：
//   ① 结构：四个板块渲染后都有 AI 按钮与容器，且都排在「存入历史」之前；
//   ② 载荷：type=oracle、kind 正确；合规红线——灵签不带吉凶等级、六爻不带卦势倾向；
//   ③ 行为：成功时渲染 AI 文案，失败时降级为本地解读并提示，按钮回落为可再次点击。
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
const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shown = () => ["home", "tarot", "question", "draw", "result", "history", "huangli", "bazi",
  "qian", "liuyao", "meihua", "ziwei", "name"]
  .filter((v) => { const e = $("#view-" + v); return e && e.style.display !== "none"; });

// 用两个 id 在渲染容器内的文档顺序判断「AI 按钮是否排在存入历史之前」
function beforeInDom(containerSel, idA, idB) {
  const list = Array.from(document.querySelectorAll(containerSel + " *"));
  const a = list.findIndex((e) => e.id === idA);
  const b = list.findIndex((e) => e.id === idB);
  return a >= 0 && b >= 0 && a < b;
}

(async () => {
  const log = [];
  const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

  // 拦截请求：记录载荷，默认返回成功
  let last = null;
  let mode = "ok";
  window.WenxingAI = {
    endpoint: "/interpret",
    interpret: function (payload) {
      last = payload;
      if (mode === "fail") return Promise.reject(new Error("offline"));
      return Promise.resolve({ text: "这是模型返回的示例解读。\n第二段。", mock: true });
    }
  };

  ok(typeof window.WenxingOracleAI === "object" && typeof window.WenxingOracleAI.attach === "function",
    "挂载器 window.WenxingOracleAI.attach 已就位");

  // ---------- 1. 古法灵签 ----------
  fire($('[data-go="qian"]'), "click");
  ok(shown().join() === "qian", "进入灵签页");
  $("#qian-q").value = "这件事该怎么推进？";
  fire($("#qian-q"), "input");
  fire($("#qian-tube"), "click");
  await sleep(1900);
  ok($("#btn-qian-ai") !== null, "灵签结果页存在 AI 按钮");
  ok($("#qian-ai-box") !== null, "灵签结果页存在 AI 容器");
  ok(beforeInDom("#qian-result", "btn-qian-ai", "btn-qian-save"), "灵签：AI 解读排在「存入历史」之前");
  ok(beforeInDom("#qian-result", "qian-ai-box", "btn-qian-save"), "灵签：AI 结果区排在「存入历史」之前");

  fire($("#btn-qian-ai"), "click");
  await sleep(30);
  ok(last && last.type === "oracle", "灵签：请求 type=oracle");
  ok(last && last.kind === "qian", "灵签：kind=qian");
  ok(last && Array.isArray(last.data.poem) && last.data.poem.length > 0, "灵签：上传了签诗");
  ok(last && typeof last.data.note === "string" && last.data.note.length > 0, "灵签：上传了解曰");
  ok(last && !("l" in last.data), "灵签红线：吉凶等级字段 l 未上传");
  ok(last && !/上上|上吉|中吉|中平|下下/.test(JSON.stringify(last.data)),
    "灵签红线：载荷内不含任何吉凶等级字样（" + JSON.stringify(last.data).slice(0, 40) + "…）");
  ok($("#qian-ai-box").textContent.includes("AI 生成"), "灵签：AI 文案已渲染");
  ok($("#qian-ai-box").textContent.includes("模型返回的示例解读"), "灵签：渲染内容来自模型返回");
  ok($("#btn-qian-ai").textContent === "重新解读", "灵签：按钮变为「重新解读」");

  // 失败降级
  mode = "fail";
  fire($("#btn-qian-ai"), "click");
  await sleep(30);
  ok(/离线综合解读/.test($("#qian-ai-box").textContent), "灵签：接口失败降级为本地解读并标注");
  ok($("#btn-qian-ai").textContent === "重新解读" && $("#btn-qian-ai").disabled === false,
    "灵签：降级后按钮可再次点击");
  mode = "ok";

  // ---------- 2. 六爻 ----------
  fire($("#view-qian .nav-top .back"), "click");
  fire($('[data-go="liuyao"]'), "click");
  ok(shown().join() === "liuyao", "进入六爻页");
  $("#ly-q").value = "这个项目接下来怎么走？";
  fire($("#ly-q"), "input");
  for (let i = 0; i < 6; i++) { fire($("#btn-ly-roll"), "click"); await sleep(950); }
  await sleep(200);
  ok($("#btn-ly-ai") !== null, "六爻结果页存在 AI 按钮");
  ok(beforeInDom("#ly-result", "btn-ly-ai", "btn-ly-save"), "六爻：AI 解读排在「存入历史」之前");
  ok(beforeInDom("#ly-result", "ly-ai-box", "btn-ly-save"), "六爻：AI 结果区排在「存入历史」之前");

  last = null;
  fire($("#btn-ly-ai"), "click");
  await sleep(30);
  ok(last && last.kind === "liuyao", "六爻：kind=liuyao");
  ok(last && typeof last.data.ben === "string" && last.data.ben.length > 0, "六爻：上传了本卦卦名");
  ok(last && Array.isArray(last.data.moving), "六爻：上传了动爻");
  ok(last && !("tend" in last.data), "六爻红线：卦势倾向 tend 未上传");
  ok(last && Array.isArray(last.data.yaoNotes), "六爻：上传了动爻辞意（爻辞原文含元吉等经典用语，非判定字段）");
  ok($("#ly-ai-box").textContent.includes("模型返回的示例解读"), "六爻：AI 文案已渲染");

  // ---------- 3. 梅花易数 ----------
  fire($("#view-liuyao .nav-top .back"), "click");
  fire($('[data-go="meihua"]'), "click");
  ok(shown().join() === "meihua", "进入梅花页");
  $("#mh-q").value = "这个机会要不要接？";
  fire($("#mh-q"), "input");
  fire($("#btn-mh-roll"), "click");
  await sleep(30);
  ok($("#btn-mh-ai") !== null, "梅花结果页存在 AI 按钮");
  ok(beforeInDom("#mh-result", "btn-mh-ai", "btn-mh-save"), "梅花：AI 解读排在「存入历史」之前");
  ok(beforeInDom("#mh-result", "mh-ai-box", "btn-mh-save"), "梅花：AI 结果区排在「存入历史」之前");

  last = null;
  fire($("#btn-mh-ai"), "click");
  await sleep(30);
  ok(last && last.kind === "meihua", "梅花：kind=meihua");
  ok(last && typeof last.data.ben === "string" && last.data.ben.length > 0, "梅花：上传了本卦");
  ok(last && typeof last.data.hu === "string" && last.data.hu.length > 0, "梅花：上传了互卦");
  ok(last && typeof last.data.bian === "string" && last.data.bian.length > 0, "梅花：上传了变卦");
  ok(last && !!last.data.tiWX && !!last.data.yongWX, "梅花：上传了体卦与用卦五行");
  ok(last && !("tend" in last.data), "梅花红线：卦势倾向 tend 未上传");
  ok($("#mh-ai-box").textContent.includes("模型返回的示例解读"), "梅花：AI 文案已渲染");

  // ---------- 4. 起名 ----------
  fire($('[data-go="name"]'), "click");
  ok(shown().join() === "name", "进入起名页");
  $("#nm-surname").value = "李";
  fire($("#btn-name-go"), "click");
  await sleep(30);
  ok($("#btn-nm-ai") !== null, "起名结果页存在 AI 按钮");
  ok($("#nm-ai-box") !== null, "起名结果页存在 AI 容器");
  ok(beforeInDom("#name-result", "btn-nm-ai", "btn-nm-again"), "起名：AI 解读排在「换一批」之前");
  ok($("#name-result .nm-item .nm-ops button") !== null, "起名：每条候选自带收藏按钮（存档动作在候选条目内）");

  last = null;
  fire($("#btn-nm-ai"), "click");
  await sleep(30);
  ok(last && last.kind === "name", "起名：kind=name");
  ok(last && last.data.surname === "李", "起名：上传了姓氏");
  ok(last && Array.isArray(last.data.names) && last.data.names.length === 5,
    "起名：只取前 5 个候选（实得 " + (last && last.data.names ? last.data.names.length : "-") + "）");
  ok(last && last.data.names.every((n) => !!n.full && !!n.sancai), "起名：候选含姓名与三才");
  ok(last && !("birth" in last.data) && !("date" in last.data) && !("year" in last.data),
    "起名红线：未上传出生日期");
  ok($("#nm-ai-box").textContent.includes("模型返回的示例解读"), "起名：AI 文案已渲染");

  console.log(log.join("\n"));
  console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: 四板块 AI 解读检查全部通过");
  process.exit(errs.length ? 1 : 0);
})();
