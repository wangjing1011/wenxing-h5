// AI 解读接入检查（linkedom 离线环境）
// 验证：① 前端脚本无加载错误；② btn-ai / ai-box 存在；③ 单牌/三牌结果页显示 AI 按钮、
//      非单三牌（关系之镜）隐藏；④ 点击 AI 解读在无后端时安全降级为本地综合解读（不抛错、标注正确）。
// 说明：linkedom 在定时器回调的 dispatchEvent 过程中 getElementById 对静态元素偶发返回 null（已知缺陷），
//       故所有会触发 initDraw 的抽牌链路均放在顶层同步执行；仅 btn-ai 的异步降级结果用末端 setTimeout 断言
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
// linkedom：click 用原生 .click()，input 用 dispatchEvent
const click = (el) => el.click();
const input = (el) => el.dispatchEvent(new window.Event("input", { bubbles: true }));

const log = [];
const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

// —— 顶层同步检查：脚本加载与基础结构 ——
ok(typeof window.WenxingAI === "object" && typeof window.WenxingAI.interpret === "function",
  "前端 AI 封装 window.WenxingAI.interpret 已挂载");
ok($("#btn-ai") !== null, "结果页存在 AI 解读按钮 btn-ai");
ok($("#ai-box") !== null, "结果页存在 AI 解读容器 ai-box");

// 注意：所有抽牌链路（会触发 initDraw → getElementById）都放在顶层同步执行，
//       避免在 linkedom 定时器上下文触发其 getElementById 返回 null 的已知缺陷。

// —— 提问必填：未写问题不允许开始抽牌 ——
click($("[data-spread=single]"));
ok($("#view-question").style.display !== "none", "进入提问页");
ok(!/可不填/.test($("#q-hint").textContent), "提示语已去掉「可不填，直接开始」");
$("#question-input").value = "";
click($("#btn-start-draw"));
ok($("#view-draw").style.display === "none", "未写问题时点「开始抽牌」被拦下，不进入抽牌页");
$("#question-input").value = "这是必填校验测试";
input($("#question-input"));
click($("#btn-start-draw"));
ok($("#view-draw").style.display !== "none", "写下问题后可以正常开始抽牌");

// —— 三牌链路：结果页应显示 AI 按钮 ——
// 注意：提问已改为必填，未写问题点「开始抽牌」会被拦下，故这里必须赋值
click($("[data-spread=three]"));
const q3 = $("#question-input");
q3.value = "这件事该怎么推进？";
input(q3);
click($("#btn-start-draw"));
ok($("#view-draw").style.display !== "none", "三牌：已进入抽牌页");
const backs3 = document.querySelectorAll("#deck .cardback");
click(backs3[0]); click(backs3[1]); click(backs3[2]);
ok($("#btn-to-result").style.display === "block", "三牌：抽满后「查看解读」按钮出现");
click($("#btn-to-result"));
ok($("#view-result").style.display !== "none", "三牌：已进入结果页");
ok($("#btn-ai").style.display === "block", "三牌结果页显示 AI 解读按钮");

// —— 关系之镜（五牌）：所有牌阵统一开放 AI 入口（原先仅单/三牌的 PoC 限制已解除）——
click($("#btn-again"));
click($("[data-go=tarot]"));
click($("[data-spread=relation]"));
const q5 = $("#question-input");
q5.value = "我们之间还有没有可能？";
input(q5);
click($("#btn-start-draw"));
ok($("#view-draw").style.display !== "none", "关系之镜：已进入抽牌页");
// 牌堆固定 3 张卡背，大牌阵靠重复点击同一张卡背抽满（应用本身即如此处理）
const rbacks = document.querySelectorAll("#deck .cardback");
for (let i = 0; i < 5; i++) click(rbacks[i % rbacks.length]);
ok($("#btn-to-result").style.display === "block", "关系之镜：抽满后「查看解读」按钮出现");
click($("#btn-to-result"));
ok($("#view-result").style.display !== "none", "关系之镜：已进入结果页");
ok($("#btn-ai").style.display === "block", "五牌（关系之镜）同样显示 AI 解读按钮");

// —— 单牌链路：显示 AI 按钮，点击后无后端安全降级 ——
click($("#btn-again"));
click($("[data-spread=single]"));
const q = $("#question-input");
q.value = "我近期该注意什么？";
input(q);
click($("#btn-start-draw"));
ok($("#view-draw").style.display !== "none", "单牌：已进入抽牌页");
click(document.querySelector("#deck .cardback"));
ok($("#btn-to-result").style.display === "block", "单牌：抽满 1 张后「查看解读」按钮出现");
click($("#btn-to-result"));
ok($("#view-result").style.display !== "none", "单牌：已进入结果页");
ok($("#btn-ai").style.display === "block", "单牌结果页显示 AI 解读按钮");

// 点击 AI 解读：本地无后端 → 同步阶段不抛错；异步降级结果在末端 setTimeout 断言
let threw = false;
try {
  click($("#btn-ai"));
} catch (e) { threw = true; errs.push("点击 AI 解读同步抛错 → " + e.message); }
ok(!threw, "点击 AI 解读同步阶段不抛错");

// —— 仅 btn-ai 异步降级结果在定时器内断言（不触发 getElementById）——
setTimeout(() => {
  const box = $("#ai-box");
  ok(box.style.display === "block", "AI 解读容器已展开");
  ok(/离线综合解读/.test(box.textContent), "无后端时降级为本地综合解读并正确标注");
  ok($("#btn-ai").textContent === "重新解读", "AI 按钮变为「重新解读」");

  console.log(log.join("\n"));
  console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: AI 解读接入检查全部通过");
  process.exit(errs.length ? 1 : 0);
}, 80);
