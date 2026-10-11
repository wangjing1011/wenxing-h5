// 数据与逻辑校验脚本：node check.js
global.window = global;
require("./js/tarot-data-major.js");
require("./js/tarot-data-minor.js");

const MAJOR = window.TAROT_MAJOR;
const MINOR = window.TAROT_MINOR;
const ALL = MAJOR.concat(MINOR);
let errors = [];

// 数量
if (MAJOR.length !== 22) errors.push("大阿卡纳数量错误: " + MAJOR.length);
if (MINOR.length !== 56) errors.push("小阿卡纳数量错误: " + MINOR.length);
if (ALL.length !== 78) errors.push("总数量错误: " + ALL.length);

// 大牌编号 0-21 连续
MAJOR.forEach((c, i) => { if (c.n !== i) errors.push("大牌编号断档: 期望 " + i + " 实际 " + c.n); });

// 小牌每花色 14 张且编号连续
["wands", "cups", "swords", "pentacles"].forEach((s, si) => {
  const cards = MINOR.filter(c => c.suit === s);
  if (cards.length !== 14) errors.push(s + " 数量错误: " + cards.length);
  cards.forEach((c, i) => {
    if (c.n !== (si + 1) * 100 + i + 1) errors.push(s + " 编号断档: " + c.name + " n=" + c.n);
  });
});

// 名称唯一性
const names = ALL.map(c => c.name);
new Set(names).size === names.length || errors.push("存在重复牌名");

// 字段完整性
ALL.forEach(c => {
  ["name", "en", "suit", "keywordsU", "keywordsR", "upright", "reversed"].forEach(k => {
    if (!c[k]) errors.push(c.name + " 缺字段 " + k);
  });
  if (!c.keywordsU || c.keywordsU.length < 3) errors.push(c.name + " 正位关键词不足");
  if (!c.keywordsR || c.keywordsR.length < 3) errors.push(c.name + " 逆位关键词不足");
  if (!c.upright || c.upright.length < 25) errors.push(c.name + " 正位解读过短");
  if (!c.reversed || c.reversed.length < 25) errors.push(c.name + " 逆位解读过短");
});

// 文案合规抽查：不得出现宿命论禁词
const banned = ["注定", "命中注定", "一定会发生", "改运", "转运", "消灾"];
ALL.forEach(c => {
  ["upright", "reversed"].forEach(f => {
    banned.forEach(w => {
      if ((c[f] || "").includes(w)) errors.push(c.name + " " + f + " 含禁词: " + w);
    });
  });
});

if (errors.length) {
  console.error("发现问题 " + errors.length + " 处:");
  errors.forEach(e => console.error("  - " + e));
  process.exit(1);
} else {
  console.log("OK: 78 张牌义全部校验通过");
  console.log("  大阿卡纳 22 张 (n=0-21)");
  console.log("  小阿卡纳 56 张 (四花色 x 14)");
  console.log("  字段完整 / 关键词 / 解读长度 / 命名唯一 / 文案禁词 全部通过");
}
