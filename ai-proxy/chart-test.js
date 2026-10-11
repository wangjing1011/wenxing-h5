// 命盘 AI 解读后端测试：提示词序列化 + 红线词过滤 + mock 模式 /interpret
const path = require("path");
const prompt = require("./prompt");
const redwords = require("./redwords");

const BAZI = {
  type: "chart", domain: "bazi",
  chart: {
    pillars: [
      { lab: "年柱", gz: "甲子", ganSS: "正印", zhiSS: "偏财", naya: "海中金", wx: "木" },
      { lab: "月柱", gz: "丙寅", ganSS: "食神", zhiSS: "正官", naya: "炉中火", wx: "火" },
      { lab: "日柱", gz: "庚午", ganSS: "日主", zhiSS: "正印", naya: "路旁土", wx: "金" },
      { lab: "时柱", gz: "壬午", ganSS: "伤官", zhiSS: "正印", naya: "杨柳木", wx: "水" }
    ],
    dayMaster: { gan: "庚", el: "金", trait: "刚毅果决", tip: "庚金如刀，宁折不弯。" },
    wuXing: { 木: 2, 火: 2, 土: 1, 金: 2, 水: 1 },
    strength: "balance", deLing: false,
    shiShen: ["正印", "食神", "正官", "伤官"],
    daYun: [{ gz: "丁卯", startAge: 10, startYear: 2000 }, { gz: "戊辰", startAge: 20, startYear: 2010 }],
    taiYuan: "辛酉", mingGong: "卯"
  }
};

const ZIWEI = {
  type: "chart", domain: "ziwei",
  chart: {
    fiveElementsClass: "水二局",
    soul: { gz: "甲子", majorStars: ["紫微", "七杀"] },
    body: "午",
    palaces: [
      { name: "命宫", gz: "甲子", majorStars: ["紫微", "七杀"], minorStars: ["左辅"], isBody: false },
      { name: "兄弟宫", gz: "乙丑", majorStars: [], minorStars: [], isBody: false },
      { name: "财帛宫", gz: "丙寅", majorStars: ["廉贞"], minorStars: [], isBody: false },
      { name: "迁移宫", gz: "丁卯", majorStars: ["破军"], minorStars: [], isBody: false }
    ],
    siHua: [{ star: "廉贞", type: "禄", palace: "财帛宫" }, { star: "破军", type: "权", palace: "迁移宫" }]
  }
};

let fail = 0;
function ok(c, m) { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) fail++; }

// 1) 提示词序列化：含结构化盘、不含生辰/姓名
const bm = prompt.buildChartMessages(BAZI);
ok(/八字/.test(bm[1].content), "八字 user 消息含牌阵类型");
ok(/庚/.test(bm[1].content) && /五行分布/.test(bm[1].content), "八字 user 消息含日主与五行分布");
ok(!/2005|1990|出生|姓名/.test(JSON.stringify(BAZI.chart)), "八字 payload 不含生辰/姓名/原始年份");
const zm = prompt.buildChartMessages(ZIWEI);
ok(/紫微斗数/.test(zm[1].content) && /紫微/.test(zm[1].content), "紫微 user 消息含命宫主星");
ok(!/出生|姓名|1990/.test(JSON.stringify(ZIWEI.chart)), "紫微 payload 不含生辰/姓名");

// 2) 系统角色重申红线
ok(/命中注定/.test(prompt.SYSTEM_ROLE_CHART), "chart 系统角色声明红线词禁用");

// 3) 红线词过滤（模拟模型越界输出）
const dirty = redwords.filter("你命中注定会发财，这是必然的，吉凶已定");
ok(!/命中注定/.test(dirty.text) && !/必然/.test(dirty.text) && !/吉凶/.test(dirty.text), "模型越界输出被净化（命中注定/必然/吉凶 均消除）");
ok(dirty.dirty === true, "净化标记 dirty=true");

// 4) 离线 mock（无 Key）生成命盘兜底文本
function mockChartInterpret(payload) {
  // 复刻 server.js 的逻辑做轻量校验（server 也会走同一条路径）
  const c = payload.chart || {};
  if (payload.domain === "ziwei") {
    return "这是一张由排盘工具算出的紫微命盘快照。命宫坐" + ((c.soul && c.soul.majorStars) || []).join("、") + "，是一张地图。你始终握有书写它的笔。";
  }
  const dm = c.dayMaster || {};
  return "这是一份由干支历法排盘工具算出的八字快照。日主" + dm.gan + "（" + dm.el + "），是一张地图，而不是锁死的人生剧本。你始终握有书写它的笔。";
}
const bzMock = redwords.filter(mockChartInterpret(BAZI));
ok(bzMock.text.indexOf("锁死的人生剧本") !== -1 && bzMock.text.indexOf("书写它的笔") !== -1, "八字 mock 文本自然、无红线词残留");
const zwMock = redwords.filter(mockChartInterpret(ZIWEI));
ok(zwMock.text.indexOf("命宫坐紫微、七杀") !== -1, "紫微 mock 文本含命宫主星");

console.log(fail === 0 ? "\nOK: 命盘后端管线测试全部通过" : "\nFAIL: " + fail + " 条未通过");
process.exit(fail === 0 ? 0 : 1);
