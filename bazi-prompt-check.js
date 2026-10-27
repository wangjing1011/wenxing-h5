// bazi-prompt-check.js —— 八字 AI 解读的「深度」校验
// 背景：八字和紫微原来共用一套提示词，只要求 120-260 字，出来就是「你五行偏木、性格温和」这种空话。
// 现在八字单独一套（五段、550-750 字），并且把命语算出的格局/喜用/调候/神煞也带给了模型。
// 断言：① 八字走专属提示词、紫微不受影响；② 深度字段真的进了用户消息；
//      ③ 离线兜底也是多段且不含四位年份；④ 生成上限与超时足够长。
const fs = require("fs");
const path = require("path");
const P = require("./ai-proxy/prompt.js");

const log = [];
const errs = [];
const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

// ---- A. 角色分派 ----
const baziPayload = {
  type: "chart", domain: "bazi",
  chart: {
    pillars: [
      { lab: "年柱", gz: "甲子", ganSS: "比肩", zhiSS: "正印", naya: "海中金", wx: "木水" },
      { lab: "月柱", gz: "丙寅", ganSS: "食神", zhiSS: "比肩", naya: "炉中火", wx: "火木" },
      { lab: "日柱", gz: "甲午", ganSS: "日主", zhiSS: "伤官", naya: "沙中金", wx: "木火" },
      { lab: "时柱", gz: "庚午", ganSS: "七杀", zhiSS: "伤官", naya: "路旁土", wx: "金火" }
    ],
    dayMaster: { gan: "甲", el: "木", trait: "挺拔好胜", tip: "认定的事不太回头" },
    wuXing: { 木: 3, 火: 4, 土: 0, 金: 2, 水: 1 },
    strength: "strong", deLing: true,
    shiShen: ["比肩", "比肩", "食神", "伤官", "七杀", "正印"],
    daYun: [{ startAge: 6, gz: "乙丑" }, { startAge: 16, gz: "甲子" }],
    mingGong: "申",
    deep: {
      pattern: "建禄格", patternStatus: "成格", patternBasis: "月令临官",
      dayMasterStrength: "身强",
      usefulGod: { useful: "壬水", avoid: "庚金", favorableWuxing: ["水", "土"], unfavorableWuxing: ["金"] },
      climate: "生于正月，余寒未尽，喜火暖局",
      shensha: { 天乙贵人: true, 驿马: false, 华盖: true },
      luckStartText: "6岁起运",
      daYun: [{ startAge: 6, gz: "乙丑", years: [{ ganZhi: "乙丑", tenGod: "劫财", tenGodZhi: "正财" }] }]
    }
  }
};

const baziMsg = P.buildChartMessages(baziPayload);
ok(baziMsg[0].content === P.SYSTEM_ROLE_BAZI, "八字使用专属提示词 SYSTEM_ROLE_BAZI");
ok(P.SYSTEM_ROLE_BAZI.length > P.SYSTEM_ROLE_CHART.length * 1.5,
  "八字提示词比通用命盘提示词厚实（" + P.SYSTEM_ROLE_BAZI.length + " vs " + P.SYSTEM_ROLE_CHART.length + " 字符）");
ok(/550/.test(P.SYSTEM_ROLE_BAZI) && /750/.test(P.SYSTEM_ROLE_BAZI), "八字提示词要求 550-750 字（不再是 120-260 字）");
ok(/五段/.test(P.SYSTEM_ROLE_BAZI), "八字提示词明确要求五段结构");
["盘的样子", "性格与做事方式", "优势", "与人相处", "大运"].forEach((k) => {
  ok(P.SYSTEM_ROLE_BAZI.indexOf(k) >= 0, "五段内容包含「" + k + "」");
});
ok(/不要写小标题/.test(P.SYSTEM_ROLE_BAZI), "要求不写小标题（避免输出成报告体）");

// 紫微不受影响
const zwMsg = P.buildChartMessages({ type: "chart", domain: "ziwei", chart: { fiveElementsClass: "土五局", soul: { gz: "丁亥", majorStars: ["紫微"] }, palaces: [], siHua: [] } });
ok(zwMsg[0].content === P.SYSTEM_ROLE_CHART, "紫微仍使用通用提示词 SYSTEM_ROLE_CHART");

// ---- B. 深度字段进用户消息 ----
const u = baziMsg[1].content;
const need = [
  ["格局", "【格局】建禄格（成格）"],
  ["格局依据", "【格局依据】月令临官"],
  ["旺衰判定", "【旺衰判定】身强"],
  ["喜用", "【喜用】"],
  ["喜用五行", "喜用五行：水、土"],
  ["需留意五行", "需留意五行：金"],
  ["调候", "【调候】"],
  ["神煞", "【神煞】"],
  ["起运", "【起运】"],
  ["五行最旺", "【五行最旺】火"],
  ["五行缺", "【五行缺】土"],
  ["十神分布", "【十神分布】"],
  ["大运十神", "【大运十神】"]
];
need.forEach(([name, token]) => ok(u.indexOf(token) >= 0, "用户消息含「" + name + "」(" + token + ")"));

// 神煞的布尔值要渲染成「有」，不能是空串
ok(/天乙贵人/.test(u) && /华盖/.test(u), "神煞名称已渲染（天乙贵人 / 华盖）");
ok(!/驿马/.test(u), "神煞里为 false 的项被过滤掉（不出现「驿马 」空值）");

// ---- C. 离线兜底 ----
const S = require("./ai-proxy/server.js");
if (typeof S.mockChartInterpret === "function") {
  const mk = S.mockChartInterpret(baziPayload);
  const paras = mk.split(/\n{2,}/).filter(Boolean);
  ok(paras.length >= 4, "八字离线兜底为多段（实得 " + paras.length + " 段），不再是一句话");
  ok(mk.length >= 300, "八字离线兜底长度 " + mk.length + " 字（≥300）");
  ok(!/\d{4}/.test(mk), "八字离线兜底不含四位年份（合规）");
  ok(!/大吉|大凶|必凶/.test(mk), "八字离线兜底无吉凶判词");
  const zwMk = S.mockChartInterpret({ domain: "ziwei", chart: baziPayload.chart });
  ok(typeof zwMk === "string" && zwMk.length > 0, "紫微离线兜底仍可用");
} else {
  ok(false, "server.js 未导出 mockChartInterpret（测试无法覆盖离线兜底）");
}

// ---- D. 生成上限与超时 ----
const srv = fs.readFileSync(path.join(__dirname, "ai-proxy", "server.js"), "utf8");
const mt = srv.match(/max_tokens:\s*(\d+)/);
ok(mt && Number(mt[1]) >= 1000, "max_tokens 已放宽（" + (mt ? mt[1] : "?") + " ≥ 1000，够写 700 字）");
const st = srv.match(/\},\s*(\d{4,6})\);/);
ok(st && Number(st[1]) >= 20000, "服务端超时 ≥ 20s（" + (st ? st[1] : "?") + "ms），长文不会中途被掐");

const cli = fs.readFileSync(path.join(__dirname, "js", "ai.js"), "utf8");
const ct = cli.match(/\},\s*(\d{4,6})\);/);
ok(ct && Number(ct[1]) > Number(st[1]), "前端超时（" + (ct ? ct[1] : "?") + "ms）大于服务端（" + (st ? st[1] : "?") + "ms），不会先于后端放弃");

console.log(log.join("\n"));
console.log(errs.length ? "\nFAIL:\n" + errs.join("\n") : "\nOK: 八字深度解读提示词检查全部通过");
process.exit(errs.length ? 1 : 0);
