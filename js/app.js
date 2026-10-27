// 问星塔罗 · 应用逻辑（纯前端，零上传，数据仅存 localStorage）
(function () {
  "use strict";

  var ALL = (window.TAROT_MAJOR || []).concat(window.TAROT_MINOR || []);
  var SUIT_GLYPH = { major: "★", wands: "杖", cups: "杯", swords: "剑", pentacles: "币" };
  var SUIT_EN = { major: "MAJOR", wands: "WANDS", cups: "CUPS", swords: "SWORDS", pentacles: "PENTACLES" };
  var ROMAN = ["0","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX","XXI"];
  var REV_RATE = 0.32; // 逆位概率
  var HIST_KEY = "wenxing_tarot_history";

  var SPREADS = {
    single: {
      name: "单张指引",
      count: 1,
      positions: [{ label: "当下指引", meaning: "此刻给你的提示" }],
      ph: "例如：我近期该注意什么？",
      hint: "写下你想问的事，再开始抽牌。<br>问题越具体，解读越有针对性。",
      intro: "", keyPos: 0
    },
    three: {
      name: "三牌 · 时间之流",
      count: 3,
      positions: [
        { label: "过去", meaning: "这件事的来路与根源" },
        { label: "现在", meaning: "当下的状态与位置" },
        { label: "未来", meaning: "保持现有节奏时的走向" }
      ],
      ph: "例如：这件事接下来会怎么发展？",
      hint: "写下你想问的事，再开始抽牌。<br>问题越具体，解读越有针对性。",
      intro: "", keyPos: 2
    },
    soul: {
      name: "三牌 · 身心灵",
      count: 3,
      positions: [
        { label: "身 · 状态", meaning: "身体与日常节奏的信号" },
        { label: "心 · 情绪", meaning: "情绪与头脑中正在发生的" },
        { label: "灵 · 方向", meaning: "更深层面的提示与需要" }
      ],
      ph: "例如：我最近为什么这么累？",
      hint: "适合问自己的状态。默想你最近的整体感受，也可以写下来。<br>牌会从身、心、灵三个层面给你提示。",
      intro: "从身、心、灵三个层面，此刻照见的是——",
      keyPos: 2
    },
    choice: {
      name: "三牌 · 抉择阵",
      count: 3,
      positions: [
        { label: "选项 A", meaning: "若走这条路的大致能量" },
        { label: "选项 B", meaning: "另一条路的大致能量" },
        { label: "内心答案", meaning: "你其实已经倾向的东西" }
      ],
      ph: "例如：留在现在团队，还是接受新 offer？",
      hint: "写下你的两难，抽牌时在心里默念选项 A 与选项 B，<br>第三张牌会照出你内心的答案。",
      intro: "两条路各照出一面镜子——",
      keyPos: 2
    },
    relation: {
      name: "五牌 · 关系之镜",
      count: 5,
      positions: [
        { label: "我的状态", meaning: "你在这段关系中的位置" },
        { label: "对方状态", meaning: "TA 此刻的处境与态度" },
        { label: "关系本质", meaning: "你们之间联结的真实样貌" },
        { label: "觉察点", meaning: "潜在的课题与盲点" },
        { label: "走向", meaning: "若保持现状的发展" }
      ],
      ph: "例如：我和 TA 的关系会怎么发展？",
      hint: "默想这段关系与对方，也可以把困惑写下来。<br>适合感情、友情、合作等一切关系。",
      intro: "关系之镜映出的五个画面——",
      keyPos: 4
    },
    break: {
      name: "五牌 · 破局阵",
      count: 5,
      positions: [
        { label: "现状", meaning: "此刻所处的位置" },
        { label: "卡点", meaning: "真正阻碍你的东西" },
        { label: "资源", meaning: "手里可用的支持" },
        { label: "对策", meaning: "建议的破局动作" },
        { label: "出口", meaning: "按此方向的可能结果" }
      ],
      ph: "例如：这个项目卡住了，怎么破？",
      hint: "适合具体的困境。把卡住的事在脑中完整过一遍再抽牌，<br>牌阵会从现状一路指到出口。",
      intro: "关于这个困局，五张牌拼出的地图——",
      keyPos: 4
    },
    horseshoe: {
      name: "七牌 · 马蹄阵",
      count: 7,
      positions: [
        { label: "过去", meaning: "已发生的影响" },
        { label: "现在", meaning: "当下的状态" },
        { label: "未来", meaning: "接下来的走向" },
        { label: "自己", meaning: "你的态度与位置" },
        { label: "环境", meaning: "周围的人与形势" },
        { label: "留意", meaning: "需要看见的阻力或课题" },
        { label: "结果", meaning: "大概率的方向" }
      ],
      ph: "例如：这件事的全貌和结局如何？",
      hint: "适合需要全景的复杂问题，问题可以稍微大一点。<br>建议在安静时使用，抽牌时保持专注。",
      intro: "七张牌的马蹄弧线，从过去划向结果——",
      keyPos: 6
    },
    celtic: {
      name: "十牌 · 凯尔特十字",
      count: 10,
      positions: [
        { label: "现状", meaning: "当下的核心处境" },
        { label: "障碍", meaning: "横在面前的问题" },
        { label: "根源", meaning: "深层的基础与潜意识" },
        { label: "过去", meaning: "正在离开的影响" },
        { label: "可能", meaning: "悬在头顶的目标或机会" },
        { label: "近未来", meaning: "即将到来的事" },
        { label: "自我", meaning: "你此刻的姿态" },
        { label: "环境", meaning: "他人与外部氛围" },
        { label: "希望与恐惧", meaning: "你期待又害怕的" },
        { label: "最终走向", meaning: "综合一切的结果" }
      ],
      ph: "例如：我正处在怎样的处境，会走向哪里？",
      hint: "塔罗最经典的完整牌阵，适合深度解读一个局面。<br>建议在安静、不被打扰的时候使用。",
      intro: "凯尔特十字为你展开的全景——",
      keyPos: 9
    }
  };

  var state = { spread: "single", question: "", pool: [], picked: [], saved: false };

  // ---------- 工具 ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function cardNo(c) {
    if (c.suit === "major") return "MAJOR · " + ROMAN[c.n];
    var num = c.n % 100;
    var labels = { 11: "PA", 12: "KN", 13: "QU", 14: "KI" };
    return SUIT_EN[c.suit] + " · " + (labels[num] || (num < 10 ? "0" + num : num));
  }
  function fmtTime(t) {
    var d = new Date(t);
    function p(x) { return x < 10 ? "0" + x : x; }
    return (d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  // ---------- 视图路由 ----------
  var VIEWS = ["home", "tarot", "question", "draw", "result", "history", "huangli", "bazi", "qian", "liuyao", "meihua", "ziwei", "name"];
  function showView(name) {
    VIEWS.forEach(function (v) {
      $("view-" + v).style.display = (v === name) ? "flex" : "none";
    });
    window.scrollTo(0, 0);
  }
  // 暴露给族 B（排盘工具）模块使用
  window.AppView = { show: showView, toast: toast };

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("show"); }, 10);
    setTimeout(function () {
      t.classList.remove("show");
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 1900);
  }

  // ---------- 首页图标注入（手绘 SVG，见 js/icons.js）----------
  (function injectIcons() {
    if (!window.WX_ICONS) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-icon]"), function (el) {
      var k = el.getAttribute("data-icon");
      if (window.WX_ICONS[k]) el.innerHTML = window.WX_ICONS[k];
    });
  })();

  // 首页功能入口（含 2×2 常用工具与 3×3 更多功能）
  Array.prototype.forEach.call(document.querySelectorAll("[data-go]"), function (el) {
    el.addEventListener("click", function () { showView(el.getAttribute("data-go")); });
  });
  // 开发中功能占位
  Array.prototype.forEach.call(document.querySelectorAll(".spread-card.locked, .home-tile.locked"), function (el) {
    el.addEventListener("click", function () {
      toast(el.getAttribute("data-todo") + " · 开发中，敬请期待");
    });
  });

  // ---------- 首页 → 选牌阵 ----------
  Array.prototype.forEach.call(document.querySelectorAll(".spread-card"), function (el) {
    el.addEventListener("click", function () {
      var key = el.getAttribute("data-spread");
      if (!key || !SPREADS[key]) return; // 首页入口 / 未上线功能不进入抽牌流程
      state.spread = key;
      var sp = SPREADS[key];
      $("q-title").textContent = "提出你的问题 · " + sp.name;
      $("q-hint").innerHTML = sp.hint;
      $("question-input").placeholder = sp.ph;
      showView("question");
    });
  });
  $("btn-history").addEventListener("click", function () { renderHistory(); showView("history"); });
  $("btn-about").addEventListener("click", function () { $("sheet-mask").classList.add("show"); });
  $("sheet-close").addEventListener("click", function () { $("sheet-mask").classList.remove("show"); });
  $("sheet-mask").addEventListener("click", function (e) { if (e.target === this) this.classList.remove("show"); });

  // ---------- 牌阵分类 ----------
  // 八个牌阵平铺太多，按「问什么事」归类，一次只显示 3 个左右；
  // 牌阵允许同时属于多个类别（时间之流既在默认也在感情/事业/生活）。
  var CAT_HINTS = {
    "默认": "不知道选哪个就从这里开始，三个最通用的牌阵。",
    "感情": "适合问一段关系、一次心动，或者某个还没放下的人。",
    "事业": "适合问工作、项目、合作与选择：卡住的事、要不要动、怎么破。",
    "生活": "适合问自己的状态：为什么累、最近该注意什么、心里在纠结什么。",
    "其他": "局面复杂、想看得更深时用。牌多、信息量大，建议安静时坐下来抽。"
  };
  function filterSpreads(cat) {
    Array.prototype.forEach.call(document.querySelectorAll("#spread-cats .seg-btn"), function (b) {
      if (b.getAttribute("data-cat") === cat) b.classList.add("on");
      else b.classList.remove("on");
    });
    Array.prototype.forEach.call(document.querySelectorAll("#spread-list .spread-card"), function (card) {
      var cats = String(card.getAttribute("data-cats") || "").split(",");
      card.style.display = cats.indexOf(cat) >= 0 ? "" : "none";
    });
    var hint = $("spread-cat-hint");
    if (hint) hint.textContent = CAT_HINTS[cat] || "";
  }
  Array.prototype.forEach.call(document.querySelectorAll("#spread-cats .seg-btn"), function (b) {
    b.addEventListener("click", function () { filterSpreads(b.getAttribute("data-cat")); });
  });
  filterSpreads("默认");

  // ---------- 源码入口（AGPL-3.0 合规）----------
  // 上线前在 index.html 顶部把 window.WX_SOURCE_URL 填成仓库地址；留空则链接隐藏
  (function bindSourceLinks() {
    var url = String(window.WX_SOURCE_URL || "").trim();
    Array.prototype.forEach.call(document.querySelectorAll("[data-source-link]"), function (a) {
      if (url) { a.href = url; a.removeAttribute("hidden"); }
      else { a.setAttribute("hidden", "hidden"); }
    });
  })();

  // ---------- 提问页 ----------
  var qInput = $("question-input");
  qInput.addEventListener("input", function () {
    $("q-counter").textContent = qInput.value.length + "/60";
  });
  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (chip) {
    chip.addEventListener("click", function () {
      qInput.value = chip.textContent.replace("？", "") + "？";
      qInput.dispatchEvent(new Event("input"));
    });
  });
  $("btn-start-draw").addEventListener("click", function () {
    var q = qInput.value.trim();
    // 必须先写下问题：AI 解读要回应具体的事，没有问题的解读只会变成泛泛的牌义复述
    if (!q) {
      if (window.AppView && window.AppView.toast) {
        window.AppView.toast("先把你想问的事写下来，再开始抽牌");
      }
      try { qInput.focus(); } catch (e) {}
      return;
    }
    state.question = q;
    initDraw();
  });

  // ---------- 抽牌页 ----------
  function initDraw() {
    state.pool = shuffle(ALL);
    state.picked = [];
    state.saved = false;
    var sp = SPREADS[state.spread];
    $("draw-status").innerHTML = "默想你的问题，然后<b>点击牌堆</b>抽取 <b>" + sp.count + "</b> 张";
    $("btn-to-result").style.display = "none";

    var slots = $("slots");
    slots.innerHTML = "";
    slots.classList.toggle("small", sp.count >= 5);
    sp.positions.forEach(function (p) {
      var box = document.createElement("div");
      box.className = "slot-box";
      box.innerHTML = '<div class="slot" data-pos="' + esc(p.label) + '">' + esc(p.label) + '</div>';
      slots.appendChild(box);
    });

    var deck = $("deck");
    deck.classList.remove("shuffle");
    deck.style.pointerEvents = "none";
    Array.prototype.forEach.call(deck.querySelectorAll(".cardback"), function (b) {
      b.classList.remove("chosen");
      b.style.opacity = "";
    });
    void deck.offsetWidth; // 重置动画
    deck.classList.add("shuffle");
    setTimeout(function () { deck.style.pointerEvents = ""; }, 1100);

    showView("draw");
  }

  Array.prototype.forEach.call(document.querySelectorAll("#deck .cardback"), function (back) {
    back.addEventListener("click", function () {
      if (state.pool.length === 0) return;
      var sp = SPREADS[state.spread];
      if (state.picked.length >= sp.count) return;

      var card = state.pool.pop();
      var reversed = Math.random() < REV_RATE;
      var idx = state.picked.length;
      state.picked.push({ card: card, reversed: reversed });

      back.classList.add("chosen");
      setTimeout(function () { back.classList.remove("chosen"); }, 340);

      var slotBox = $("slots").children[idx];
      var slot = slotBox.querySelector(".slot");
      slot.classList.add("filled");
      slot.style.border = "1.5px solid rgba(212,185,106,.6)";
      slot.style.background = "linear-gradient(160deg, #3a2a7a, #1b1246)";
      slot.innerHTML = '<span class="pick-no">' + (idx + 1) + "</span>";

      var left = sp.count - state.picked.length;
      if (left > 0) {
        $("draw-status").innerHTML = "已抽 <b>" + state.picked.length + "</b> 张 · 再抽 <b>" + left + "</b> 张";
      } else {
        $("draw-status").innerHTML = "牌已抽好，<b>查看解读</b>";
        $("btn-to-result").style.display = "block";
        $("deck").style.pointerEvents = "none";
        Array.prototype.forEach.call(document.querySelectorAll("#deck .cardback"), function (b) {
          b.style.opacity = ".35";
        });
      }
    });
  });

  $("btn-to-result").addEventListener("click", renderResult);

  // ---------- AI 解读（仅单张 / 三牌 PoC） ----------
  $("btn-ai").addEventListener("click", function () {
    var btn = this;
    var sp = SPREADS[state.spread];
    // 仅结构化牌面，绝不携带生辰或个人信息
    var payload = {
      spread: state.spread,
      spreadName: sp.name,
      question: state.question || "",
      cards: state.picked.map(function (p, i) {
        var orient = p.reversed ? "reversed" : "upright";
        return {
          position: sp.positions[i] ? sp.positions[i].label : ("第" + (i + 1) + "张"),
          name: p.card.name,
          orientation: orient,
          keywords: (p.reversed ? p.card.keywordsR : p.card.keywordsU).slice(0, 4),
          gist: p.reversed ? p.card.reversed : p.card.upright
        };
      })
    };

    btn.disabled = true;
    btn.textContent = "解读生成中…";
    var box = $("ai-box");
    box.style.display = "block";
    box.innerHTML = '<div class="ai-loading">正在生成你的专属解读…</div>';

    if (!window.WenxingAI) {
      renderAiFallback(box, btn);
      return;
    }
    window.WenxingAI.interpret(payload).then(function (r) {
      state.aiText = r.text;
      box.innerHTML =
        '<div class="ai-mark">AI 生成 · 娱乐参考' + (r.mock ? " · 离线示例" : "") + '</div>' +
        aiParagraphs(r.text);
      btn.textContent = "重新解读";
      btn.disabled = false;
    }).catch(function () {
      renderAiFallback(box, btn);
    });
  });

  // 段落渲染统一交给 ai.js 的公共函数（空行分段），这里只做转发
  function aiParagraphs(text) {
    if (window.WenxingAIText) return window.WenxingAIText.paragraphs(text);
    return '<p class="ai-text">' + esc(text).replace(/\n/g, "<br>") + "</p>";
  }

  // 综合提示专用：在分段基础上把每段开头的位置名「现状」「卡点」加粗，长牌阵里方便扫读
  function summaryHtml(text) {
    return aiParagraphs(text).replace(
      /<p class="ai-text">「([^」]{1,8})」/g,
      '<p class="ai-text"><b class="para-tag">「$1」</b>'
    );
  }

  // AI 不可用时的降级：用规则综合提示（与红线词基调一致）
  function renderAiFallback(box, btn) {
    state.aiText = buildSummary();
    box.innerHTML =
      '<div class="ai-mark">离线综合解读 · 娱乐参考</div>' +
      aiParagraphs(state.aiText);
    btn.textContent = "重新解读";
    btn.disabled = false;
    if (window.AppView && window.AppView.toast) window.AppView.toast("AI 服务暂不可用，已切换本地综合解读");
  }

  // ---------- 结果页 ----------
  function renderResult() {
    var sp = SPREADS[state.spread];
    $("r-question").textContent = state.question ? "「" + state.question + "」" : "（未写下问题 · 默想即可）";
    $("r-spread-name").textContent = sp.name + " · " + fmtTime(Date.now());

    var flow = $("cards-flow");
    flow.innerHTML = "";
    state.picked.forEach(function (p, i) {
      var c = p.card;
      var kws = (p.reversed ? c.keywordsR : c.keywordsU).slice(0, 4);
      var text = p.reversed ? c.reversed : c.upright;
      var pos = sp.positions[i];

      var el = document.createElement("div");
      el.className = "rcard";
      el.style.animationDelay = (i * 0.12) + "s";
      // 真实牌面（Rider-Waite 公版图）；缺图时回退为花色字形
      var imgSrc = (window.tarotImageOf ? window.tarotImageOf(c.n) : "");
      var faceInner = imgSrc
        ? '<img class="card-img' + (p.reversed ? " rev-img" : "") + '" src="' + imgSrc +
          '" alt="' + esc(c.name) + '" loading="lazy" decoding="async">' +
          '<div class="cap"><span class="no">' + esc(cardNo(c)) + "</span>" +
          '<span class="nm">' + esc(c.name) + "</span></div>"
        : '<div class="no">' + esc(cardNo(c)) + "</div>" +
          '<div class="glyph' + (p.reversed ? " rev-mark" : "") + '">' + SUIT_GLYPH[c.suit] + "</div>" +
          '<div class="nm"><b>' + esc(c.name) + "</b><i>" + esc(c.en) + "</i></div>";
      el.innerHTML =
        '<div class="pos"><b>' + esc(pos.label) + "</b> · " + esc(pos.meaning) + "</div>" +
        '<div class="flip"><div class="flip-inner">' +
          '<div class="face3d back3d"></div>' +
          '<div class="face3d front3d' + (imgSrc ? " has-img" : "") + '">' + faceInner + "</div>" +
        "</div></div>" +
        '<div class="orient ' + (p.reversed ? "rev" : "up") + '">' + (p.reversed ? "逆 位" : "正 位") + "</div>" +
        '<div class="kw">' + kws.map(function (k) { return "<span>" + esc(k) + "</span>"; }).join("") + "</div>" +
        '<p class="meaning">' + esc(text) + "</p>";
      flow.appendChild(el);

      var flipDelay = 350 + i * (sp.count > 6 ? 260 : 480);
      setTimeout(function () { el.querySelector(".flip").classList.add("flipped"); }, flipDelay);
    });

    $("r-summary").innerHTML = summaryHtml(buildSummary());
    $("btn-save").disabled = false;
    $("btn-save").textContent = "存入历史";

    // AI 解读入口：所有牌阵统一开放（后端按牌数自适应组装，只传牌面、不传生辰）
    var aiBtn = $("btn-ai");
    aiBtn.style.display = "block";
    aiBtn.disabled = false;
    aiBtn.textContent = "AI 解读（灵感视角）";
    state.aiText = "";
    var aiBox = $("ai-box");
    aiBox.style.display = "none";
    aiBox.innerHTML = "";

    showView("result");
  }

  // ---------- 综合提示 ----------
  // 输出按「空行」分段，再由 ai.js 的公共段落渲染器转成 <p>。
  // 十张牌如果串成一大段，手机上根本读不下去，所以一段只讲一件事：
  // 开场交代整体 → 逐张说位置与关键词 → 指出最该看的位置 → 收尾。
  function buildSummary() {
    var sp = SPREADS[state.spread];
    var picked = state.picked;
    var P = picked.map(function (p) { return p.card; });
    var total = picked.length;
    if (!total) return "";

    var revCount = picked.filter(function (p) { return p.reversed; }).length;
    var kw = function (i) {
      var k = picked[i].reversed ? P[i].keywordsR : P[i].keywordsU;
      return k.slice(0, 3).join("、");
    };
    var ori = function (i) { return picked[i].reversed ? "逆位" : "正位"; };

    var trend;
    if (revCount === 0) {
      trend = "牌面全是正位，事情是顺的，适合顺着现在这股势头往前推一步。";
    } else if (revCount >= Math.ceil(total * 0.6)) {
      trend = "逆位偏多，这一段更像收尾和整理，不用急着扩张，慢一点反而稳。";
    } else {
      trend = "正逆位交错，有推得动的部分，也有暂时推不动的部分，先分清现在能动的是哪一头。";
    }

    var blocks = [];

    if (total === 1) {
      blocks.push("只抽一张牌，只回答一件事。今天这张是「" + P[0].name + "」（" + ori(0) +
        "），关键词是「" + kw(0) + "」。");
      // 单牌没有位置之间的呼应，就把牌义本身说完整
      blocks.push("这张牌想说的是：" + (picked[0].reversed ? P[0].reversed : P[0].upright));
    } else {
      // ① 开场：这组牌在看什么，整体偏顺还是偏堵
      blocks.push("这组牌从「" + sp.positions[0].label + "」一路看到「" + sp.positions[total - 1].label +
        "」，一共 " + total + " 张，其中 " + (total - revCount) + " 张正位、" + revCount + " 张逆位。" + trend);

      // ② 逐张：位置本来是什么意思 + 这张牌落在这里给出的词
      // 三个句式轮换，避免十张牌全是同一句模板
      for (var i = 0; i < total; i++) {
        var pos = sp.positions[i];
        var cz = P[i].name + "」（" + ori(i) + "），";
        var cw = "「" + kw(i) + "」。";
        var line;
        if (i % 3 === 0) {
          line = "「" + pos.label + "」讲的是" + pos.meaning + "；这里落的是「" + cz + "给出的词是" + cw;
        } else if (i % 3 === 1) {
          line = "「" + pos.label + "」——" + pos.meaning + "。这张「" + cz + "给的词是" + cw;
        } else {
          line = "「" + pos.label + "」位上坐着「" + cz + "说的是" + cw.replace(/。$/, "；") +
            "这一位原本要看的，是" + pos.meaning + "。";
        }
        blocks.push(line);
      }

      // ③ 重点：只抓一个位置，免得看完不知道从哪下手
      var kp = sp.keyPos;
      blocks.push("如果只看一件事，就看「" + sp.positions[kp].label + "」——「" + P[kp].name + "」（" +
        ori(kp) + "）在这一位上分量最重。先把「" + kw(kp) + "」这件事想清楚，下一步往哪里走也就清楚了。");
    }

    // ④ 收尾：把决定权交回用户手里
    blocks.push("塔罗是一面镜子，不是判决书。看完之后，挑一件今天就能动的小事去做，比反复琢磨牌面有用得多。");

    return blocks.join("\n\n");
  }

  // ---------- 保存 / 历史 ----------
  $("btn-save").addEventListener("click", function () {
    var sp = SPREADS[state.spread];
    var rec = {
      t: Date.now(),
      q: state.question,
      spread: sp.name,
      cards: state.picked.map(function (p) {
        return { name: p.card.name, reversed: p.reversed, kws: (p.reversed ? p.card.keywordsR : p.card.keywordsU).slice(0, 2) };
      }),
      ai: state.aiText || ""
    };
    var list = loadHist();
    list.unshift(rec);
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 50)));
      $("btn-save").disabled = true;
      $("btn-save").textContent = "已存入 ✓";
    } catch (e) {
      alert("保存失败：本机存储不可用");
    }
  });

  function loadHist() {
    try {
      var raw = localStorage.getItem(HIST_KEY);
      var v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function renderHistory() {
    var list = loadHist();
    var box = $("hist-list");
    box.innerHTML = "";
    if (list.length === 0) {
      box.innerHTML = '<div class="empty"><span class="big">☽</span>还没有记录<br>去抽一张牌吧</div>';
      $("hist-clear-zone").style.display = "none";
      return;
    }
    $("hist-clear-zone").style.display = "block";
    list.forEach(function (rec, i) {
      var el = document.createElement("div");
      el.className = "hist-item";
      var cardsHtml = rec.cards.map(function (c) {
        return "<b>" + esc(c.name) + "</b>" + (c.reversed ? " 逆位" : " 正位") + "（" + c.kws.map(esc).join("、") + "）";
      }).join("<br>");
      el.innerHTML =
        '<div class="row1"><span class="q">' + (rec.q ? "「" + esc(rec.q) + "」" : "（默想）") + "</span><span class=\"t\">" + fmtTime(rec.t) + "</span></div>" +
        '<div class="cards" style="font-size:11.5px;color:#a49dc2;margin-bottom:6px">' + esc(rec.spread) + "</div>" +
        '<div class="cards">' + cardsHtml + "</div>" +
        (rec.ai ? '<div class="hist-ai"><span class="hist-ai-tag">AI 解读</span>' + esc(rec.ai).replace(/\n/g, "<br>") + "</div>" : "") +
        '<div class="ops"><button data-i="' + i + '">删除</button></div>';
      el.querySelector("button").addEventListener("click", function () {
        var l = loadHist();
        l.splice(i, 1);
        localStorage.setItem(HIST_KEY, JSON.stringify(l));
        renderHistory();
      });
      box.appendChild(el);
    });
  }

  $("btn-clear-hist").addEventListener("click", function () {
    if (confirm("确定清空全部历史记录吗？此操作不可恢复。")) {
      localStorage.removeItem(HIST_KEY);
      renderHistory();
    }
  });

  $("btn-again").addEventListener("click", function () {
    showView("question");
  });

  // ---------- 返回 ----------
  Array.prototype.forEach.call(document.querySelectorAll(".nav-top .back"), function (btn) {
    btn.addEventListener("click", function () { showView("home"); });
  });

})();
