// 提示词模板与结构化输入组装
// 系统角色：传统文化与心理自助视角、基于意象开放式解读、不预测不诊断不下定论。
// 输入：前端传来的结构化牌面（不含任何生辰/个人身份信息）。

var SYSTEM_ROLE = [
  "你是一位擅长将塔罗意象用于「自我觉察与心理投射」的文化陪伴者。",
  "你只基于牌面的文化意象，给出开放式、启发式的解读，帮助用户看见自己当下的心境与可能的视角。",
  "",
  "严格要求：",
  "1. 只做意象类比与心理投射，不做任何预测、诊断、下定论。绝不使用「占卜/算命/预测/改运/转运/消灾/化太岁/命中注定/注定/宿命/天意/神灵/鬼神/命理/风水/吉凶/凶兆/趋吉避凶」等词。",
  "2. 用「你或许」「可能」「倾向于」「不妨」等开放式语气，不用「你会/必然/肯定/绝对/一定/务必」。",
  "3. 不替用户做决定，不给出医疗、法律、投资等专业性结论。若用户议题涉及健康或重大人生决定，温和提醒其寻求现实中的专业帮助。",
  "4. 行文自然，像一个温和有温度的陪伴者在聊天，避免模板腔。禁止使用「首先/其次/最后」式罗列，禁止 emoji，破折号不要连用。",
  "5. 长度适中（中文 120-260 字）。按牌阵张数自然分段：每张牌用一两句话点出其意象与给你的启发；最后给一段整体的、开放式的收束。",
  "6. 结尾不要写「结论」「综上」等总结词，用一句柔和、留白的话收尾即可。"
].join("\n");

// 把前端结构化的牌面拼成用户消息
function buildUserMessage(payload) {
  var lines = [];
  lines.push("【牌阵】" + (payload.spreadName || payload.spread || "未知牌阵"));
  lines.push("【问题】" + (payload.question && payload.question.trim()
    ? payload.question.trim()
    : "（用户未写下问题，凭直觉抽牌，请基于牌面做开放式意象解读）"));
  lines.push("");
  lines.push("【抽到的牌】");
  (payload.cards || []).forEach(function (c, i) {
    var orient = c.orientation === "reversed" ? "逆位" : "正位";
    lines.push(
      (i + 1) + ". 位置：「" + (c.position || "第" + (i + 1) + "张") + "」｜" +
      "牌：「" + c.name + "（" + orient + "）」｜" +
      "关键词：" + (c.keywords || []).join("、") + "｜" +
      "牌义梗概：" + (c.gist || "")
    );
  });
  lines.push("");
  lines.push("请基于以上牌面，从意象与心理投射的角度，给一段温柔、开放、不替用户做决定的解读。");
  return lines.join("\n");
}

function buildMessages(payload) {
  return [
    { role: "system", content: SYSTEM_ROLE },
    { role: "user", content: buildUserMessage(payload) }
  ];
}

// ================= 命盘解读（八字 / 紫微） =================
// 输入：前端传来的「已由排盘工具算好的结构化命盘」，不含任何生辰/姓名等原始信息。
// 原则：模型只看到干支/星曜排列，绝看不到出生时间；仍受红线词后置过滤约束。

var SYSTEM_ROLE_CHART = [
  "你是一位从「传统历法与命理文化研究」视角出发的文化陪伴者。",
  "你面对的是一份已经由专业排盘工具（干支历法 / 紫微斗数算法）计算好的结构化命盘，不是用户的出生信息，你也不需要任何生辰。",
  "你只基于这张命盘里的干支、五行、星曜排列，做开放式、启发式的解读，帮助用户从文化意象里照见自己的气质、能量倾向与可能的视角。",
  "",
  "严格要求：",
  "1. 只做文化意象类比与性格/能量倾向的开放式探讨，不做任何命运预测、定论或诊断。绝不使用「占卜/算命/预测/改运/转运/消灾/化太岁/命中注定/注定/宿命/天意/神灵/鬼神/命理/风水/吉凶/凶兆/趋吉避凶/批命」等词。",
  "2. 用「你或许」「可能」「倾向于」「不妨」等开放式语气，不用「你会/必然/肯定/绝对/一定/务必/注定」。",
  "3. 不替用户做决定，不给出医疗、法律、投资等专业性结论。若涉及健康或重大人生决定，温和提醒其寻求现实中的专业帮助。",
  "4. 行文自然温和，避免模板腔。禁止「首先/其次/最后」式罗列，禁止 emoji，破折号不要连用。",
  "5. 长度适中（中文 120-260 字）。先点出盘中最显眼的一两个结构（如日主五行、命宫主星、强弱、四化），再给一段整体的、开放式的收束。",
  "6. 结尾不要写「结论」「综上」，用一句柔和、留白的话收尾即可。"
].join("\n");

// 把结构化命盘拼成用户消息（纯结构化，无个人信息）
function serializeChart(p) {
  var d = p.domain, c = p.chart || {}, L = [];
  if (d === "bazi") {
    L.push("【命盘类型】八字 · 四柱干支");
    (c.pillars || []).forEach(function (pl) {
      L.push(pl.lab + "：" + pl.gz +
        "　天干十神 " + (pl.ganSS || "-") +
        "　地支十神 " + (pl.zhiSS || "-") +
        "　纳音 " + (pl.naya || "-") +
        "　五行 " + (pl.wx || "-"));
    });
    var dm = c.dayMaster || {};
    L.push("【日主】" + dm.gan + (dm.el ? "（" + dm.el + "）" : "") + (dm.trait ? "　气质：" + dm.trait : ""));
    var wx = c.wuXing || {};
    L.push("【五行分布】" + ["木", "火", "土", "金", "水"].map(function (w) { return w + (wx[w] || 0); }).join(" "));
    var sk = { "strong": "偏强", "weak": "偏弱", "balance": "中和" }[c.strength] || c.strength || "";
    L.push("【日主强弱】" + (sk || "-") + (c.deLing ? "（得月令）" : ""));
    if ((c.shiShen || []).length) L.push("【十神】" + c.shiShen.join("、"));
    if ((c.daYun || []).length) L.push("【大运】" + c.daYun.map(function (dy) { return dy.startAge + "岁起 " + dy.gz; }).join("，"));
    if (c.taiYuan) L.push("【胎元】" + c.taiYuan);
    if (c.mingGong) L.push("【命宫】" + c.mingGong);
  } else if (d === "ziwei") {
    L.push("【命盘类型】紫微斗数");
    if (c.fiveElementsClass) L.push("【五行局】" + c.fiveElementsClass);
    var soul = c.soul || {};
    L.push("【命宫】" + (soul.gz || "-") + "　主星：" + ((soul.majorStars || []).join("、") || "空宫"));
    if (c.body) L.push("【身宫地支】" + c.body);
    (c.palaces || []).forEach(function (p) {
      L.push(p.name + "：" + (p.gz || "") + "　主星：" + (((p.majorStars || []).join("、")) || "空宫") + (p.isBody ? "（身宫）" : ""));
    });
    if ((c.siHua || []).length) L.push("【四化】" + c.siHua.map(function (x) { return "化" + x.type + " " + x.star + " 在 " + x.palace; }).join("；"));
  }
  L.push("");
  L.push("请基于以上结构化命盘，从传统文化与自我觉察的角度，给一段温柔、开放、不替用户做决定也不下定论的解读。");
  return L.join("\n");
}

function buildChartMessages(p) {
  return [
    { role: "system", content: SYSTEM_ROLE_CHART },
    { role: "user", content: serializeChart(p) }
  ];
}

// ================= 签卦 / 起名解读（灵签 · 六爻 · 梅花 · 起名） =================
// 与塔罗最大的不同：这三类内容天然自带吉凶标签（上上签、卦之吉凶、体用生克），
// 稍不注意模型就会写成「你近期会顺利」这类预测。所以提示词的重点是「剥离判定」：
// 输入层面已经去掉了吉凶等级，提示词层面再锁一遍，只允许讲意象与文化背景。

var SYSTEM_ROLE_ORACLE = [
  "你是一位熟悉中国传统签文、卦象与姓名文化的陪伴者，从文化意象与自我觉察的角度和人聊天。",
  "你面对的是一次占问或起名的结构化结果，不是对用户本人的观察，你也不需要任何个人信息。",
  "",
  "严格要求：",
  "1. 只做文化意象的阐释与心理投射，绝不预测吉凶、不给结果判定，不说「会/不会」「吉/凶」「灵/不灵」「注定」「必」。",
  "2. 输入里若带体用、生克、趋势等判定性字眼，只当作一种情绪氛围来理解，不复述、不据此下结论。",
  "3. 用「你或许」「可能」「倾向于」「不妨」等开放式语气。",
  "4. 不替用户做决定，不给出医疗、法律、投资等专业性结论。若议题涉及健康或重大人生决定，温和提醒其寻求现实中的专业帮助。",
  "5. 行文自然温和，像朋友聊天，避免模板腔。禁止「首先/其次/最后」式罗列，禁止 emoji，破折号不要连用。",
  "6. 长度适中（中文 130-260 字）。最后一句柔和、留白，不要写「结论」「综上」「总的来说」。"
].join("\n");

function serializeOracle(p) {
  var d = p.data || {};
  var kind = p.kind;
  var L = [];

  if (kind === "qian") {
    L.push("【占问形式】古法灵签（抽签）");
    if (d.topic) L.push("【签题】" + d.topic);
    if (d.poem && d.poem.length) L.push("【签诗】" + d.poem.join("　"));
    if (d.note) L.push("【解曰】" + d.note);
  } else if (kind === "liuyao") {
    L.push("【占问形式】六爻（周易卦象）");
    if (d.ben) L.push("【本卦】" + d.ben);
    if (d.bian) L.push("【之卦】" + d.bian);
    if (d.moving && d.moving.length) {
      L.push("【动爻】" + d.moving.join("、"));
      if (d.yaoNotes && d.yaoNotes.length) L.push("【动爻辞意】" + d.yaoNotes.join("；"));
    } else {
      L.push("【动爻】六爻皆静");
    }
  } else if (kind === "meihua") {
    L.push("【占问形式】梅花易数");
    if (d.ben) L.push("【本卦】" + d.ben);
    if (d.hu) L.push("【互卦】" + d.hu);
    if (d.bian) L.push("【变卦】" + d.bian);
    if (d.tiWX && d.yongWX) L.push("【体用】体卦属" + d.tiWX + "，用卦属" + d.yongWX);
    if (d.relName) L.push("【体用关系】" + d.relName);
  } else if (kind === "name") {
    L.push("【事项】起名参考");
    if (d.surname) L.push("【姓氏】" + d.surname);
    if (d.tend) L.push("【四柱五行倾向】" + d.tend);
    if (d.names && d.names.length) {
      L.push("【候选名字】");
      d.names.forEach(function (n, i) {
        L.push((i + 1) + ". " + n.full + (n.pinyin ? "（" + n.pinyin + "）" : "") +
          (n.sancai ? "　三才 " + n.sancai : "") +
          (n.meaning ? "　字义：" + n.meaning : ""));
      });
    }
  }

  if (p.question) {
    L.push("【用户所问】" + p.question);
  } else {
    L.push("【用户所问】（未写下问题，凭心意起卦，请基于结果做开放式阐释）");
  }
  L.push("");
  L.push("请基于以上内容，从文化意象与自我觉察的角度给一段温柔、开放、不替用户做决定的解读。");

  return L.join("\n");
}

function buildOracleMessages(p) {
  return [
    { role: "system", content: SYSTEM_ROLE_ORACLE },
    { role: "user", content: serializeOracle(p) }
  ];
}

module.exports = {
  buildMessages: buildMessages,
  SYSTEM_ROLE: SYSTEM_ROLE,
  buildChartMessages: buildChartMessages,
  SYSTEM_ROLE_CHART: SYSTEM_ROLE_CHART,
  buildOracleMessages: buildOracleMessages,
  SYSTEM_ROLE_ORACLE: SYSTEM_ROLE_ORACLE
};
