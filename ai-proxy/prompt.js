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
  "5. 必须分段，这是硬要求：每张牌单独成一段，段与段之间空一行；每段 2 到 3 句、最多 4 句。绝不能把所有内容挤成一大段连续文字。",
  "6. 说人话。不堆砌术语：提到牌名时，用一句白话说明这张牌画的是什么、通常象征什么。避免「能量场」「频率」「振动」「课题」「显化」「高我」这类空泛玄学词，也避免「意象」「投射」这类心理学术语堆叠。就像一个懂行的朋友在饭桌上跟你解释，不是在写论文。",
  "7. 必须先回应问题：开头一到两句直接针对用户问的那件具体事说话，把牌面接到这件事上。不要一上来就复述牌义，更不要绕开问题只讲牌。如果用户问的是「该不该」，要帮他把两边的顾虑都说清楚，但不替他做决定。",
  "8. 长度适中（中文 220-360 字）。结尾不要写「结论」「综上」「总而言之」这类总结词，用一句柔和、留白的话收尾即可。"
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
  lines.push("请按这个顺序写：先用一到两句直接回应用户问的那件具体事，再结合牌面展开；" +
    "每张牌单独成段、段间空一行，用日常白话讲清楚这张牌在说什么；" +
    "不要用术语堆砌，不要绕开问题只讲牌，也不要替用户做决定。");
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

// 八字单独一套：一份四柱能读出的信息量远大于一段话，
// 之前的通用提示词只要 120-260 字，出来就是「你五行偏木、性格温和」这种空话。
var SYSTEM_ROLE_BAZI = [
  "你是一位研究传统干支历法与命理文化的陪伴者，擅长把一张四柱命盘讲成人能听懂的话。",
  "你面对的是一份已经由排盘工具算好的结构化命盘（四柱干支、十神、五行分布、日主强弱、大运序列），不是用户的出生信息，你也不需要任何生辰。",
  "",
  "严格要求：",
  "1. 只做文化意象与性格、做事方式的开放式探讨，不做命运预测、不下定论、不做健康或投资方面的判断。绝不使用「占卜/算命/预测/改运/转运/消灾/化太岁/命中注定/注定/宿命/天意/神灵/鬼神/命理/风水/吉凶/凶兆/趋吉避凶/批命」等词。",
  "2. 用「你或许」「可能」「倾向于」「不妨」这类语气，不用「你会/必然/肯定/绝对/一定/务必/注定」。",
  "3. 必须分段，这是硬要求：按下面的顺序写五段，段与段之间空一行，每段 3 到 5 句。不要写小标题，也不要在正文里写「第一段」「首先」这类标记。",
  "　· 第一段写这个盘的样子：日主是什么五行、偏强还是偏弱、有没有得月令，然后用一句白话解释这意味着什么——比如「偏强，大致是说你的自我比较足，不太容易被别人的意见带走」。",
  "　· 第二段写性格与做事方式：从十神分布、哪一行最旺来看，他大概率是个什么样的人——念头怎么起、事情怎么推、被压着的时候什么反应。要给具体的行为描述，不要只丢「伤官」「七杀」这类名词。",
  "　· 第三段写优势，以及容易踩的坑：优势讲两三条，坑讲一两条，坑要说得具体，比如「容易一开始铺得太开，收尾全靠意志力硬扛」。",
  "　· 第四段写与人相处和情绪：五行哪一块偏多、哪一块偏少，落到日常是什么感受，和什么样的人容易合得来、和什么样的人容易别扭。",
  "　· 第五段写大运给的节奏：只讲这一串大运整体像什么节奏（例如「二十几岁那一段是一个明显的换挡期」这种方向感），不预测具体事件，不说哪年哪月会发生什么。",
  "4. 专业名词第一次出现时用一句白话带过，之后可以简称。避免「能量场」「频率」「振动」「课题」「显化」「高我」这类空泛玄学词，也不要堆「意象」「投射」这类心理学术语。就像一个懂行的朋友坐下来跟你聊，不是在写论文。",
  "5. 全程散文，不要罗列条目、不要用「首先/其次/最后」、不要 emoji、破折号不要连用。",
  "6. 长度：中文 550 到 750 字。结尾不要写「结论」「综上」「总而言之」，用一句柔和、留白的话收尾即可。"
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
    var ORDER_WX = ["木", "火", "土", "金", "水"];
    L.push("【五行分布】" + ORDER_WX.map(function (w) { return w + (wx[w] || 0); }).join(" "));
    // 给模型一些能落地的抓手：哪一行最旺、哪一行是空的
    var top = ORDER_WX.slice().sort(function (a, b) { return (wx[b] || 0) - (wx[a] || 0); })[0];
    if (top && wx[top]) L.push("【五行最旺】" + top);
    var miss = ORDER_WX.filter(function (w) { return !wx[w]; });
    if (miss.length) L.push("【五行缺】" + miss.join("、"));
    var sk = { "strong": "偏强", "weak": "偏弱", "balance": "中和" }[c.strength] || c.strength || "";
    L.push("【日主强弱】" + (sk || "-") + (c.deLing ? "（得月令）" : ""));
    if ((c.shiShen || []).length) {
      var cnt = {};
      c.shiShen.forEach(function (s) { cnt[s] = (cnt[s] || 0) + 1; });
      L.push("【十神分布】" + Object.keys(cnt).map(function (k) { return k + "×" + cnt[k]; }).join("、"));
    }
    if ((c.daYun || []).length) L.push("【大运】" + c.daYun.map(function (dy) { return dy.startAge + "岁起 " + dy.gz; }).join("，"));
    if (c.taiYuan) L.push("【胎元】" + c.taiYuan);
    if (c.mingGong) L.push("【命宫】" + c.mingGong);

    // 命语算出的深度结构（格局 / 旺衰 / 喜用 / 调候 / 神煞 / 起运）。
    // 这一块以前没带给模型，所以解读只能停在「你五行偏木」这种层面。
    var dp = c.deep;
    if (dp) {
      var flat = function (v) {
        if (v == null) return "";
        if (typeof v === "string" || typeof v === "number") return String(v);
        if (typeof v === "boolean") return v ? "有" : "";
        if (Array.isArray(v)) return v.map(flat).filter(Boolean).join("、");
        if (typeof v === "object") {
          return Object.keys(v).map(function (k) {
            var vv = flat(v[k]);
            return vv ? k + " " + vv : "";
          }).filter(Boolean).join("；");
        }
        return "";
      };
      if (dp.pattern) L.push("【格局】" + flat(dp.pattern) + (dp.patternStatus ? "（" + flat(dp.patternStatus) + "）" : ""));
      if (dp.patternBasis) L.push("【格局依据】" + flat(dp.patternBasis));
      if (dp.dayMasterStrength) L.push("【旺衰判定】" + flat(dp.dayMasterStrength));
      if (dp.usefulGod) {
        var ug = dp.usefulGod;
        L.push("【喜用】" + (flat(ug.useful) || "-") +
          "　喜用五行：" + (flat(ug.favorableWuxing) || "-") +
          "　需留意五行：" + (flat(ug.unfavorableWuxing) || "-"));
      }
      if (dp.climate) L.push("【调候】" + flat(dp.climate));
      var sh = flat(dp.shensha);
      if (sh) L.push("【神煞】" + sh.slice(0, 160));
      if (dp.luckStartText) L.push("【起运】" + flat(dp.luckStartText));
      if ((dp.daYun || []).length) {
        L.push("【大运十神】" + dp.daYun.map(function (dy) {
          var y0 = (dy.years || [])[0] || {};
          var tg = [y0.tenGod, y0.tenGodZhi].filter(Boolean).join("·");
          return (dy.startAge != null ? dy.startAge + "岁 " : "") + (dy.gz || "") + (tg ? "（" + tg + "）" : "");
        }).filter(Boolean).join("，"));
      }
    }
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
  if (d === "bazi") {
    L.push("请基于以上结构化命盘，按系统设定的五段顺序写一份完整的解读：盘的样子、性格与做事方式、优势与容易踩的坑、与人相处和情绪、大运的节奏。" +
      "每段 3 到 5 句、段间空一行，用日常白话讲，名词第一次出现时用一句话解释清楚。" +
      "不要预测具体事件，不要替用户做决定，也不要用「吉凶」这类判定词。");
  } else {
    L.push("请基于以上结构化命盘，从传统文化与自我觉察的角度，给一段温柔、开放、不替用户做决定也不下定论的解读。");
  }
  return L.join("\n");
}

function buildChartMessages(p) {
  var role = p && p.domain === "bazi" ? SYSTEM_ROLE_BAZI : SYSTEM_ROLE_CHART;
  return [
    { role: "system", content: role },
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
  "6. 必须分段：开头一到两句直接回应用户问的那件具体事；之后按内容自然分成 2 到 3 段，段与段之间空一行，每段 2 到 3 句。绝不能挤成一大段连续文字。",
  "7. 说人话：签诗、卦名、体用这些概念出现时，用一句白话解释它在说什么，不要直接甩术语。避免「能量场」「频率」「课题」「显化」「高我」这类空泛词。",
  "8. 长度适中（中文 200-320 字）。最后一句柔和、留白，不要写「结论」「综上」「总的来说」。"
].join("\n");

// 双人合盘单独一套角色：难点是「不站队」，既不能说谁对谁错，也不能预测关系结局。
var SYSTEM_ROLE_PAIR = [
  "你是一位擅长关系视角的塔罗读者，帮两个人把各自抽到的牌并排看一遍。",
  "你收到的是一次双人合盘：同一件事，两个人各自抽了一组牌。你不知道他们是谁，也不需要任何个人信息。",
  "",
  "严格要求：",
  "1. 只描述牌面呈现的两种视角，绝不站队。不说「谁对谁错」「谁更爱谁」，也不预测分手、复合、结婚、怀孕这类结果。",
  "2. 不出现「注定」「必然」「一定会」这类判定；用「你这边可能更在意…」「TA 那边看起来更想…」这种并置的说法。",
  "3. 不替他们做决定，不给心理咨询、法律、医疗结论。若议题涉及家暴、自伤等风险，温和建议寻求现实中的专业帮助。",
  "4. 行文温和克制，像朋友把两叠牌摊在桌上一起看。禁止 emoji，禁止「首先/其次/最后」式罗列。",
  "5. 必须分段：第一段一到两句直接回应他们问的那件事；第二段讲「你」这边的牌；第三段讲「TA」那边；第四段说两边怎么互相作用。段与段之间空一行，每段 2 到 3 句。",
  "6. 牌名、正逆位出现时用一句白话解释它在说什么，不堆术语；避免「能量场」「频率」「课题」「显化」「高我」这类空泛词。",
  "7. 中文 280-400 字。最后一句留白，不要写「结论」「综上」「总的来说」。"
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
  } else if (kind === "pair") {
    L.push("【占问形式】塔罗双人合盘（同一个问题，双方各抽一次，a 为提问者、b 为对方）");
    var fmtSide = function (list, who) {
      if (!list || !list.length) return;
      L.push("【" + who + "抽到的牌】");
      list.forEach(function (c, i) {
        L.push((i + 1) + ". " + c.name + "（" + (c.orientation === "reversed" ? "逆位" : "正位") + "）" +
          (c.keywords && c.keywords.length ? "　关键词：" + c.keywords.join("、") : "") +
          (c.gist ? "　牌义：" + c.gist : ""));
      });
    };
    fmtSide(d.a, "你");
    fmtSide(d.b, "对方");
  }

  if (p.question) {
    L.push("【用户所问】" + p.question);
  } else {
    L.push("【用户所问】（未写下问题，凭心意起卦，请基于结果做开放式阐释）");
  }
  L.push("");
  if (kind === "pair") {
    L.push("请先一到两句回应用户问的那件事，然后分别讲「你」与「对方」两边各看到什么，" +
      "最后说这两组牌放在一起时怎么互相作用。分段书写、段间空一行，不站队、不预测结局、不替他们做决定。");
  } else {
    L.push("请先用一到两句直接回应用户问的那件具体事，再结合上面的内容展开；" +
      "分段书写、段间空一行，用日常白话讲清楚，不堆术语，不替用户做决定。");
  }

  return L.join("\n");
}

function buildOracleMessages(p) {
  return [
    { role: "system", content: p.kind === "pair" ? SYSTEM_ROLE_PAIR : SYSTEM_ROLE_ORACLE },
    { role: "user", content: serializeOracle(p) }
  ];
}

module.exports = {
  buildMessages: buildMessages,
  SYSTEM_ROLE: SYSTEM_ROLE,
  buildChartMessages: buildChartMessages,
  SYSTEM_ROLE_CHART: SYSTEM_ROLE_CHART,
  SYSTEM_ROLE_BAZI: SYSTEM_ROLE_BAZI,
  buildOracleMessages: buildOracleMessages,
  SYSTEM_ROLE_ORACLE: SYSTEM_ROLE_ORACLE,
  SYSTEM_ROLE_PAIR: SYSTEM_ROLE_PAIR
};
