// 冒烟测试：在 DOM 环境里加载全部脚本，模拟摇签 / 摇卦 / 存历史 / 清空
const fs = require("fs");
const path = require("path");
const { parseHTML } = require("linkedom");

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const { window, document } = parseHTML(html);
// 紫微算法库（页面里是懒加载，这里直接注入以便离线测试）
global.self = global;
window.iztro = require("./js/vendor/iztro.js");
// 历法库：显式挂到全局，模拟浏览器 <script> 的效果（UMD 行为受 self 影响）
const _lunar = require("./js/vendor/lunar.js");
global.Solar = window.Solar = _lunar.Solar;
global.Lunar = window.Lunar = _lunar.Lunar;

// ---- 环境补齐 ----
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

// ---- 加载脚本 ----
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
const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// linkedom 的 <select>.value 是只读 getter，赋值会静默失效，这里用 defineProperty 模拟真实浏览器
const setSel = (sel, v) => Object.defineProperty($(sel), "value", { value: v, writable: true, configurable: true });
const shown = () => ["home", "tarot", "question", "draw", "result", "history", "huangli", "bazi", "qian", "liuyao", "meihua", "ziwei", "name"]
  .filter((v) => { const e = $("#view-" + v); return e && e.style.display !== "none"; });


(async () => {
  const log = [];
  const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

  // 1) 首页入口
  ok($('[data-go="qian"]') !== null, "首页存在古法灵签入口");
  ok(!$('[data-go="qian"]').classList.contains("locked"), "古法灵签入口已解锁");
  ok($('[data-go="liuyao"]') !== null, "首页存在六爻入口");

  fire($('[data-go="qian"]'), "click");
  ok(shown().join() === "qian", "点击后进入灵签页（当前 " + shown().join() + "）");

  // 2) 摇签：必须先写下问题（与塔罗一致，空手摇签只会得到一段泛泛的韵文）
  fire($("#qian-tube"), "click");
  await sleep(300);
  ok($("#qian-result").textContent.trim() === "", "未写问题时点签筒被拦下，不出签文");
  ok(!$("#qian-tube").classList.contains("shaking"), "未写问题时签筒不进入摇动状态");

  $("#qian-q").value = "这件事该推进还是再等等？";
  fire($("#qian-q"), "input");
  ok($("#qian-counter").textContent === "12/60", "字数计数正确（" + $("#qian-counter").textContent + "）");
  fire($("#qian-tube"), "click");
  await sleep(1800);
  const qr = $("#qian-result").textContent;
  ok(/第\s*\d+\s*签/.test(qr), "摇出签文（" + (qr.match(/第\s*\d+\s*签/) || ["-"])[0] + "）");
  ok(qr.includes("解 曰") && qr.includes("提 示"), "签文含解曰与提示");
  ok(/上上|上吉|中吉|中平|下下/.test(qr), "签文含吉凶等级");
  // 签筒静止时轻摇（tubeIdle），出签后加 .done 停下，否则结果页一直在动
  ok($("#qian-tube").classList.contains("done"), "出签后签筒停掉静止轻摇（.done）");
  const cssText = require("fs").readFileSync(require("path").join(__dirname, "css/style.css"), "utf8");
  ok(/@keyframes\s+tubeIdle/.test(cssText), "样式表里有 tubeIdle 关键帧（签筒轻摇）");
  ok(/prefers-reduced-motion[\s\S]{0,200}\.qian-tube\s*\{\s*animation:\s*none/.test(cssText),
    "用户开启「减少动态效果」时签筒不摇");

  fire($("#btn-qian-save"), "click");
  const qh = JSON.parse(store["wenxing_qian_history"] || "[]");
  ok(qh.length === 1 && qh[0].n >= 1 && qh[0].n <= 100, "签文已存入历史（第 " + (qh[0] || {}).n + " 签）");
  ok($("#qian-history-block").style.display === "block", "签文历史区已显示");

  // 3) 六爻
  fire($("#view-qian .nav-top .back"), "click");
  ok(shown().join() === "home", "返回首页");
  fire($('[data-go="liuyao"]'), "click");
  ok(shown().join() === "liuyao", "进入六爻页");

  $("#ly-q").value = "这个项目接下来会顺利吗？";
  fire($("#ly-q"), "input");
  for (let i = 0; i < 6; i++) {
    fire($("#btn-ly-roll"), "click");
    await sleep(950);
  }
  const lr = $("#ly-result").textContent;
  ok(document.querySelectorAll("#ly-yaos .yao-item").length === 6, "摇满六爻");
  ok(lr.includes("本卦"), "结果含本卦");
  ok(/第\s*\d+\s*卦/.test(lr), "结果含卦序号（" + (lr.match(/第\s*\d+\s*卦/) || ["-"])[0] + "）");
  ok(lr.includes("上") && lr.includes("下"), "结果含上下卦象");
  ok(/动\s*爻/.test(lr), "结果含动爻分析");
  const ben = (lr.match(/第\s*(\d+)\s*卦/) || [])[1];
  ok(ben && Number(ben) >= 1 && Number(ben) <= 64, "卦序号在 1-64 内");

  fire($("#btn-ly-save"), "click");
  const lh = JSON.parse(store["wenxing_liuyao_history"] || "[]");
  ok(lh.length === 1 && !!lh[0].ben, "卦象已存入历史（" + (lh[0] || {}).ben + "）");

  // 4) 重新摇卦应清空
  fire($("#btn-ly-again"), "click");
  ok(document.querySelectorAll("#ly-yaos .yao-item").length === 0 && $("#ly-result").innerHTML === "", "重新摇卦已重置");

  // 5) 梅花起卦
  fire($("#view-liuyao .nav-top .back"), "click");
  fire($('[data-go="meihua"]'), "click");
  ok(shown().join() === "meihua", "进入梅花页");
  ok($("#mh-now").textContent.includes("农历"), "时间起卦显示农历时刻");

  $("#mh-q").value = "眼前这个机会要不要接？";
  fire($("#mh-q"), "input");
  fire($("#btn-mh-roll"), "click");
  let mr = $("#mh-result").textContent;
  ok(mr.includes("本卦") && mr.includes("互卦") && mr.includes("变卦"), "时间起卦输出本/互/变三卦");
  ok(/比和|用生体|体克用|体生用|用克体/.test(mr), "输出体用关系");
  ok(/卦气/.test(mr) && /旺|相|休|囚|死/.test(mr), "输出卦气");
  ok(/第\s*\d+\s*卦/.test(mr), "本卦带卦序号");

  // 切到报数起卦
  fire($('#mh-method .seg-btn[data-m="num"]'), "click");
  ok($("#mh-pane-num").style.display === "block" && $("#mh-pane-time").style.display === "none", "切换到报数面板");
  $("#mh-n1").value = "128";
  $("#mh-n2").value = "35";
  fire($("#btn-mh-roll"), "click");
  mr = $("#mh-result").textContent;
  ok(mr.includes("数一 128") && mr.includes("数二 35"), "报数起卦显示所用之数");
  // 128%8=0→8坤, 35%8=3离, 163%6=1 初爻动 → 上坤下离 = 地火明夷(36)
  ok(mr.includes("地火明夷"), "报数 128/35 应为地火明夷（实得 " + (mr.match(/第\s*(\d+)\s*卦/) || [])[1] + "）");
  fire($("#btn-mh-save"), "click");
  const mhh = JSON.parse(store["wenxing_meihua_history"] || "[]");
  ok(mhh.length === 1 && !!mhh[0].ben, "梅花卦已存入历史（" + (mhh[0] || {}).ben + "）");
  fire($("#btn-mh-again"), "click");
  ok($("#mh-result").innerHTML === "", "重新起卦已清空");

  // 6) 紫微斗数（含生辰单独同意流程）
  fire($('[data-go="ziwei"]'), "click");
  ok(shown().join() === "ziwei", "进入紫微页");
  $("#zw-date").value = "1990-05-20";
  setSel("#zw-hour", "12");
  $("#zw-name").value = "测试";
  fire($("#btn-ziwei-go"), "click");
  ok($("#sheet-consent").classList.contains("show"), "首次排盘弹出单独同意");
  fire($("#btn-consent-yes"), "click");
  const zr = $("#ziwei-result").textContent;
  ok(zr.includes("土五局"), "输出五行局（土五局）");
  ok(/命宫丁亥/.test(zr), "命宫落在丁亥");
  ok(zr.includes("紫微") && zr.includes("七杀"), "命宫主星为紫微/七杀");
  ok(zr.includes("十二宫"), "输出十二宫");
  ok(document.querySelectorAll(".zw-pal").length === 12, "十二宫共 12 行");
  // 命盘图：圆形 SVG，12 个扇形按地支方位环绕（子居下、顺时针），中宫放基本信息
  const zwSvg = document.querySelector("#ziwei-result svg.zw-circle");
  ok(!!zwSvg, "命盘图渲染为圆形 SVG");
  ok(document.querySelectorAll("#ziwei-result svg.zw-circle path").length === 12,
    "命盘共 12 个扇形，实得 " + document.querySelectorAll("#ziwei-result svg.zw-circle path").length);
  ok(document.querySelectorAll('#ziwei-result svg.zw-circle path[stroke-width="1.6"]').length === 1,
    "命宫扇形单独高亮");
  const segs = {};
  Array.prototype.forEach.call(document.querySelectorAll("#ziwei-result svg.zw-circle g"), (g) => {
    const m = (g.getAttribute("transform") || "").match(/translate\(([-\d.]+),([-\d.]+)\)/);
    if (m) segs[(g.textContent || "").slice(0, 2)] = { x: +m[1], y: +m[2] };
  });
  ok(Object.keys(segs).length === 12, "12 个宫位都排到了位上，实得 " + Object.keys(segs).length);
  ok(segs["疾厄"] && segs["疾厄"].y < 160, "午宫（疾厄）在正上方");
  ok(segs["父母"] && segs["父母"].y > 200, "子宫（父母）在正下方");
  ok(segs["官禄"] && segs["官禄"].x < 160, "卯宫（官禄）在左侧");
  ok(segs["夫妻"] && segs["夫妻"].x > 200, "酉宫（夫妻）在右侧");
  const centerTxt = (document.querySelector("#ziwei-result svg.zw-circle") || {}).textContent || "";
  ok(centerTxt.includes("土五局") && /男|女/.test(centerTxt), "中宫显示性别与五行局");
  ok(zr.includes("四化速览"), "输出四化速览");
  fire($("#btn-zw-save"), "click");
  const zh = JSON.parse(store["wenxing_ziwei_history"] || "[]");
  ok(zh.length === 1 && zh[0].soul === "丁亥", "命盘已存入历史（" + (zh[0] || {}).soul + "）");
  fire($("#btn-zw-again"), "click");
  ok($("#ziwei-result").innerHTML === "", "重新排盘已清空");

  // 7) 起名（不填生辰也能用）
  fire($("#view-ziwei .nav-top .back"), "click");
  fire($('[data-go="name"]'), "click");
  ok(shown().join() === "name", "进入起名页");
  $("#nm-surname").value = "李";
  fire($("#btn-name-go"), "click");
  let nr = $("#name-result").textContent;
  ok(/候选名字\s*·\s*\d+\s*个/.test(nr), "输出候选名字（" + (nr.match(/候选名字\s*·\s*\d+\s*个/) || ["-"])[0] + "）");
  ok(document.querySelectorAll(".nm-item").length === 8, "候选 8 个（实得 " + document.querySelectorAll(".nm-item").length + "）");
  ok(/天格/.test(nr) && /人格/.test(nr) && /总格/.test(nr), "输出三才五格");
  ok(/三才/.test(nr) && /音律/.test(nr), "输出三才与音律");
  ok(!/五行分布参考/.test(nr), "未填生辰时不显示五行分布");
  const firstNames = [...document.querySelectorAll(".nm-item .nm-head b")].map((e) => e.textContent).join(",");

  // 换一批应换出不同结果
  fire($("#btn-nm-again"), "click");
  const secondNames = [...document.querySelectorAll(".nm-item .nm-head b")].map((e) => e.textContent).join(",");
  ok(firstNames !== secondNames, "换一批会换出不同名字");

  // 收藏 + 历史
  fire(document.querySelector(".nm-item .nm-ops button"), "click");
  const nh = JSON.parse(store["wenxing_name_history"] || "[]");
  ok(nh.length === 1 && !!nh[0].full, "名字已收藏（" + (nh[0] || {}).full + "）");
  ok($("#name-history-block").style.display === "block", "收藏区已显示");

  // 单字模式
  fire($('#nm-len .seg-btn[data-v="1"]'), "click");
  fire($("#btn-name-go"), "click");
  ok([...document.querySelectorAll(".nm-item .nm-els .nm-el")].length === 8, "单字模式每个候选 1 字");

  // 填生辰 → 走同意流程 → 出五行分布（此时已同意过，直接出）
  fire($('#nm-len .seg-btn[data-v="2"]'), "click");
  $("#nm-date").value = "1990-05-20";
  setSel("#nm-hour", "12");
  fire($("#btn-name-go"), "click");
  nr = $("#name-result").textContent;
  ok(/五行分布参考/.test(nr), "填生辰后显示五行分布");
  ok(/偏少/.test(nr) && /偏多/.test(nr), "输出五行偏少偏多");

  // 8) 回归：塔罗与排盘入口不报错
  fire($('[data-go="huangli"]'), "click");
  ok(shown().join() === "huangli", "黄历入口正常");
  fire($("#view-huangli .nav-top .back"), "click");
  fire($('[data-go="bazi"]'), "click");
  ok(shown().join() === "bazi", "八字入口正常");
  fire($("#view-bazi .nav-top .back"), "click");
  fire($('[data-go="tarot"]'), "click");
  ok(shown().join() === "tarot", "塔罗入口正常");
  fire($('[data-spread="three"]'), "click");
  ok(shown().join() === "question", "塔罗牌阵进入提问页");

  console.log(log.join("\n"));
  console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: 冒烟测试全部通过（灵签 + 六爻 + 梅花 + 紫微 + 起名 + 回归入口）");
  process.exit(errs.length ? 1 : 0);
})();
