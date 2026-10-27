// share-card-check.js —— 分享卡片：内容齐不齐、排版有没有打架
//
// Canvas 在 Node 里不存在，所以这里用一个「假 2D 上下文」把 drawCard 跑一遍：
// 记录每一次 fillText / fillRect 的坐标，然后检查
//   ① 该有的东西都画了（品牌、问题、牌阵、牌名、二维码、合规声明）
//   ② 正文最后一行没有压到二维码上（这是上一版真实踩过的 bug）
//   ③ 卡片尺寸固定，二维码矩阵能正常生成
const fs = require("fs");
const path = require("path");

global.window = global;
require("./js/qr.js");
require("./js/share-card.js");

const Share = global.WenxingShare;
const QR = global.WenxingQR;

const log = [];
const errs = [];
const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

// ---------- 假 Canvas 上下文 ----------
function fakeCtx() {
  const texts = [];
  const rects = [];
  const ctx = {
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "left", textBaseline: "alphabetic",
    canvas: { width: 750, height: 1180 },
    // 中文字宽近似：字号 × 1.0；ASCII 约 0.55
    measureText(s) {
      const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
      const size = m ? parseFloat(m[1]) : 16;
      let w = 0;
      for (const ch of String(s)) w += ch.charCodeAt(0) > 255 ? size : size * 0.55;
      return { width: w };
    },
    fillRect(x, y, w, h) { rects.push({ x, y, w, h }); },
    fillText(t, x, y) { texts.push({ t: String(t), x, y, font: ctx.font, align: ctx.textAlign }); },
    beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, stroke() {}, clip() {}, fill() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    drawImage() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; }
  };
  return { ctx, texts, rects };
}

// ---------- ① 内容完整性 ----------
const { ctx, texts, rects } = fakeCtx();
Share._draw(ctx, {
  question: "我们还在一起吗",
  spreadName: "五牌 · 关系之镜",
  time: "2026.10.27 22:15",
  cards: [
    { name: "皇后", reversed: false, img: null },
    { name: "权杖侍从", reversed: true, img: null },
    { name: "权杖九", reversed: false, img: null }
  ],
  excerpt: "这组牌从我的状态一路看到走向，一共 5 张，其中 4 张正位、1 张逆位。正逆位交错，有推得动的部分，也有暂时推不动的部分。",
  url: "https://wenxingstar.top/"
});

const allText = texts.map((t) => t.t).join("|");
ok(texts.length > 10, "卡片上确实写了文字（" + texts.length + " 段）");
ok(allText.includes("问 星"), "有品牌名「问星」");
ok(allText.includes("我们还在一起吗"), "有问题原文");
ok(allText.includes("五牌 · 关系之镜"), "有牌阵名");
ok(allText.includes("2026.10.27"), "有生成时间");
ok(allText.includes("皇后") && allText.includes("权杖侍从"), "每张牌都写了牌名");
ok(allText.includes("逆位") && allText.includes("正位"), "标注了正逆位");
ok(allText.includes("扫码也抽一次"), "有二维码引导语");
ok(allText.includes("wenxingstar.top"), "二维码旁写了域名");

// 合规声明：图片会脱离站点独立传播，这行必须在
ok(allText.includes("仅供娱乐"), "带「仅供娱乐」合规声明");
ok(/不构成任何决策/.test(allText), "声明里点明不构成决策依据");

// 隐私：卡片不该出现生辰、姓名这类信息
ok(!/出生|生日|时辰|姓名/.test(allText), "卡片上没有生辰/姓名等个人信息");

// ---------- ② 排版不重叠 ----------
// 二维码由 drawQR 用 fillRect 画出：找出最靠上的那一批小方块，得到二维码上沿
// （注意：二维码右侧还有「扫码也抽一次 / 域名 / 副标题」三行说明，
//   它们的 y 本来就在二维码上沿之下，不能当成正文——按坐标筛会误判。）
function qrTopOf(rects) {
  return Math.min.apply(null, rects.filter((r) => r.w < 20 && r.h < 20).map((r) => r.y));
}
// 正文段落有唯一特征：左对齐 x=64、24px 字号。比按 y 区间筛可靠得多。
function bodyLinesOf(texts) {
  return texts.filter((t) => t.x === 64 && /(^|\s)24px\s/.test(t.font));
}

const qrTop = qrTopOf(rects);
ok(isFinite(qrTop), "已画出二维码（" + rects.filter((r) => r.w < 20).length + " 个模块）");

const bodyTexts = bodyLinesOf(texts);
ok(bodyTexts.length >= 2, "正文摘录正常成段（" + bodyTexts.length + " 行）");
const maxBaseline = Math.max.apply(null, bodyTexts.map((t) => t.y));
ok(maxBaseline < qrTop, "正文最后一行（y=" + Math.round(maxBaseline) + "）没有压到二维码上（二维码上沿 y=" + Math.round(qrTop) + "）");

// 正文也不能压到牌名标签（牌名标签的特征：居中 + 18px；牌面内的占位名是 22px，不算）
const labelTop = Math.max.apply(null, texts
  .filter((t) => t.align === "center" && /(^|\s)18px\s/.test(t.font))
  .map((t) => t.y));
ok(isFinite(labelTop), "找到牌名标签（最后一行 y=" + Math.round(labelTop) + "）");
const bodyTop = Math.min.apply(null, bodyTexts.map((t) => t.y));
ok(bodyTop > labelTop, "正文首行（y=" + Math.round(bodyTop) + "）在牌名标签（y=" + Math.round(labelTop) + "）下方");

// 极端排版：3 行问题 + 3 张牌 + 满额摘要（160 字）——最容易把正文顶到二维码上
const xt = fakeCtx();
Share._draw(xt.ctx, {
  question: "我该不该在这个月跟他把话说清楚然后决定要不要继续走下去",
  spreadName: "五牌 · 关系之镜",
  time: "2026.10.27 22:15",
  cards: [
    { name: "皇后", reversed: false, img: null },
    { name: "权杖侍从", reversed: true, img: null },
    { name: "权杖九", reversed: false, img: null }
  ],
  excerpt: "这组牌从我的状态一路看到走向，正逆位交错，有推得动的部分，也有暂时推不动的部分。".repeat(6),
  url: "https://wenxingstar.top/"
});
const xQrTop = qrTopOf(xt.rects);
const xBody = bodyLinesOf(xt.texts);
const xBottom = Math.max.apply(null, xBody.map((t) => t.y));
ok(xBody.length >= 2 && xBottom < xQrTop, "满屏内容时正文（末行 y=" + Math.round(xBottom) + "）仍在二维码（上沿 y=" + Math.round(xQrTop) + "）之上");
ok(/…$/.test(xBody[xBody.length - 1].t), "摘要超长时末行以省略号收尾，不会硬截半句");

// 文字不出画布
const overflow = texts.filter((t) => t.y > Share._size.h - 8 || t.y < 10);
ok(overflow.length === 0, "没有文字画到画布外：" + JSON.stringify(overflow.slice(0, 2)));

// ---------- ③ 摘要截断 ----------
const short = Share._excerpt("很短的一句话。", 100);
ok(short === "很短的一句话。", "短摘要原样保留");
const long = Share._excerpt("这是一段很长的文字，".repeat(20), 30);
ok(long.length <= 32 && long.endsWith("…"), "超长摘要被截断并以省略号结尾（" + long.length + " 字）");
ok(!/「|」/.test(long), "摘要去掉了引号，排版更干净");

// ---------- ④ 卡片尺寸 ----------
ok(Share._size.w === 750 && Share._size.h === 1180, "卡片逻辑尺寸 750×1180");
ok(Share._size.scale >= 2, "按 2 倍分辨率渲染（微信里放大不糊）");

// ---------- ⑤ 二维码内容 ----------
const m = QR.matrix("https://wenxingstar.top/");
ok(m.size > 0 && m.cells.length === m.size, "站点网址能生成二维码矩阵");
const m2 = QR.matrix("https://wenxingstar.top/?pair=K7M2QD");
ok(m2.size > 0, "带邀请码的链接也能生成二维码");

// ---------- ⑥ 牌数为 1 / 5 / 10 时都不崩 ----------
[1, 5, 10].forEach((n) => {
  const t = fakeCtx();
  const cards = [];
  for (let i = 0; i < n; i++) cards.push({ name: "牌" + (i + 1), reversed: i % 2 === 1, img: null });
  let threw = "";
  try {
    Share._draw(t.ctx, {
      question: "测试", spreadName: "测试牌阵", time: "2026.01.01 00:00",
      cards: cards, excerpt: "测试摘要", url: "https://wenxingstar.top/"
    });
  } catch (e) { threw = e.message; }
  ok(!threw, n + " 张牌时卡片绘制不抛错" + (threw ? "（" + threw + "）" : ""));
  // 牌名会画两次（牌面内占位 + 牌面下方标签），所以要先按名字去重再数，否则 3 张会数成 6 张
  const shown = new Set(t.texts.filter((x) => /^牌\d+$/.test(x.t)).map((x) => x.t)).size;
  ok(shown === Math.min(3, n), n + " 张牌时最多画 3 张（实画 " + shown + " 张）");
  const rest = "共 " + n + " 张";
  ok(n <= 3 ? !t.texts.some((x) => x.t === rest) : t.texts.some((x) => x.t === rest),
    n <= 3 ? n + " 张牌时不画「共 N 张」" : n + " 张牌时用「" + rest + "」标注剩余");
});

console.log(log.join("\n"));
if (errs.length) {
  console.log("\nFAIL: 分享卡片校验未通过（" + errs.length + " 项）");
  process.exit(1);
}
console.log("\nOK: 分享卡片内容与排版校验全部通过");
