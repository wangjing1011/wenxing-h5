// 问星 · 紫微斗数排盘
// 排盘算法来自 iztro（MIT），按需懒加载；生辰仅在本机计算，不上传
(function () {
  "use strict";

  var ZW_KEY = "wenxing_ziwei_history";
  var CONSENT_KEY = "wenxing_bazi_consent";
  var ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(x) { return x < 10 ? "0" + x : "" + x; }
  function fmtTime(t) {
    var d = new Date(t);
    return (d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function toast(msg) {
    if (window.AppView && window.AppView.toast) { window.AppView.toast(msg); return; }
    var t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("show"); }, 10);
    setTimeout(function () {
      t.classList.remove("show");
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 1900);
  }
  function load() {
    try { var v = JSON.parse(localStorage.getItem(ZW_KEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function saveList(list) {
    try { localStorage.setItem(ZW_KEY, JSON.stringify(list.slice(0, 30))); return true; }
    catch (e) { return false; }
  }

  // ---------- 按需加载 iztro ----------
  var pendings = [];
  function ensureIztro(cb) {
    if (window.iztro) { cb(); return; }
    pendings.push(cb);
    if (pendings.length > 1) return; // 已在加载中
    $("ziwei-status").innerHTML = "正在载入排盘算法…";
    var s = document.createElement("script");
    s.src = "js/vendor/iztro.js";
    s.onload = function () {
      $("ziwei-status").innerHTML = "";
      var q = pendings.slice(); pendings.length = 0;
      q.forEach(function (f) { f(); });
    };
    s.onerror = function () {
      $("ziwei-status").innerHTML = "<b style='color:#e79a9a'>排盘算法载入失败，请检查网络后重试</b>";
      pendings.length = 0;
      toast("排盘算法载入失败");
    };
    document.head.appendChild(s);
  }

  var zwState = { gender: 1, res: null };
  var zwChartState = null; // 排好盘后的结构化命盘，供 AI 解读（不含生辰）

  Array.prototype.forEach.call($("zw-gender").querySelectorAll(".seg-btn"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call($("zw-gender").querySelectorAll(".seg-btn"), function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      zwState.gender = parseInt(b.getAttribute("data-g"), 10);
    });
  });

  $("btn-ziwei-go").addEventListener("click", function () {
    var date = $("zw-date").value;
    if (!date) { toast("请先选择出生日期"); return; }
    if (localStorage.getItem(CONSENT_KEY) !== "1") {
      window.__consentCb = run;
      $("sheet-consent").classList.add("show");
      return;
    }
    run();
  });

  function run() {
    ensureIztro(function () {
      if (!window.iztro) return;
      var date = $("zw-date").value;
      var h = parseInt($("zw-hour").value, 10);
      if (!isFinite(h)) h = 12;                      // 取值异常时兜底为午时
      var timeIndex = h < 0 ? 6 : Math.floor(h / 2); // 子0 丑1 … 亥11；不确定按午时
      var gender = zwState.gender === 1 ? "male" : "female";
      var a;
      try {
        a = window.iztro.astro.bySolar(date, timeIndex, gender, true, "zh-CN");
      } catch (e) {
        toast("排盘失败：" + e.message);
        return;
      }
      zwState.res = a;
      zwState.date = date;
      zwState.hour = h;
      zwState.name = $("zw-name").value.trim();
      render(a);
    });
  }

  var STAR = window.ZW_STAR || {};
  var PAL = window.ZW_PALACE || {};
  var SH = window.ZW_SIHUA || {};
  var BR = window.ZW_BRIGHT || {};
  var JU = window.ZW_WUXING_JU || {};
  var EMPTY = window.ZW_EMPTY || "";
  var NOTE = window.ZW_NOTE || "";

  function starLine(s) {
    var b = s.brightness ? (BR[s.brightness] || s.brightness) : "";
    return '<span class="zw-star' + (s.mutagen ? " mu" : "") + '">' + esc(s.name) +
      (s.mutagen ? '<i>' + esc(s.mutagen) + "</i>" : "") +
      (b ? '<em>' + esc(b) + "</em>" : "") + "</span>";
  }

  function render(a) {
    var soul = null, byBranch = {};
    a.palaces.forEach(function (p) {
      byBranch[p.earthlyBranch] = p;
      if (p.name === "命宫") soul = p;
    });
    if (!soul) soul = a.palace("命宫") || a.palaces[0];
    var soulIdx = ZHI.indexOf(soul.earthlyBranch);

    var head =
      '<div class="zw-card"><div class="zw-title">' +
        (zwState.name ? esc(zwState.name) + " · " : "") + (zwState.gender === 1 ? "男" : "女") + "命盘" +
      "</div>" +
      '<div class="zw-sub">' + esc(a.solarDate) + "　" + esc(a.lunarDate) + "<br>" +
        esc(a.zodiac) + "座 · " + esc(a.sign) + "　五行局 " + esc(a.fiveElementsClass) + "</div>" +
      '<div class="zw-keyrow">' +
        '<div><span>命宫</span><b>' + esc(soul.heavenlyStem + soul.earthlyBranch) + "</b></div>" +
        '<div><span>身宫</span><b>' + esc(a.earthlyBranchOfBodyPalace) + "</b></div>" +
        '<div><span>主星</span><b>' + esc(soul.majorStars.map(function (s) { return s.name; }).join("、") || "空宫") + "</b></div>" +
      "</div>" +
      '<div class="zw-tip">' + esc(JU[a.fiveElementsClass] || "") + "</div></div>";

    // 命宫主星解读
    var soulHtml = "";
    if (!soul.majorStars.length) {
      soulHtml = '<div class="zw-block"><h4>— 命宫 · 空宫 —</h4><p>' + esc(EMPTY) + "</p></div>";
    } else {
      soulHtml = soul.majorStars.map(function (s) {
        var d = STAR[s.name];
        if (!d) return "";
        return '<div class="zw-block"><h4>— 命宫主星 · ' + esc(s.name) +
          (s.brightness ? "（" + esc(BR[s.brightness] || s.brightness) + "）" : "") +
          (s.mutagen ? "　化" + esc(s.mutagen) : "") + " —</h4>" +
          '<p class="kwline">关键词：' + esc(d.trait) + "　五行属" + esc(d.el) + "</p>" +
          "<p>" + esc(d.tip) + "</p>" +
          (s.mutagen ? '<p class="mu-line">化' + esc(s.mutagen) + "：" + esc(SH[s.mutagen] || "") + "</p>" : "") +
          "</div>";
      }).join("");
    }

    // 十二宫（自命宫起顺时针）
    var rows = "";
    for (var i = 0; i < 12; i++) {
      var p = byBranch[ZHI[(soulIdx + i) % 12]];
      if (!p) continue;
      var mj = p.majorStars.length
        ? p.majorStars.map(starLine).join("")
        : '<span class="zw-star empty">空宫</span>';
      var mn = p.minorStars.length
        ? '<div class="zw-minor">' + p.minorStars.map(function (s) { return esc(s.name); }).join("　") + "</div>"
        : "";
      rows += '<div class="zw-pal' + (p.isBodyPalace ? " body" : "") + '">' +
        '<div class="l">' +
          '<b>' + esc(p.name) + (p.isBodyPalace ? " <i>身</i>" : "") + "</b>" +
          '<span>' + esc(p.heavenlyStem + p.earthlyBranch) + "</span>" +
        "</div>" +
        '<div class="r">' + mj + mn + "</div>" +
        '<div class="d">' + esc(PAL[p.name] || "") + "</div>" +
        "</div>";
    }

    // 四化速览
    var sihua = [];
    a.palaces.forEach(function (p) {
      p.majorStars.concat(p.minorStars || []).forEach(function (s) {
        if (s.mutagen) sihua.push({ name: s.name, mu: s.mutagen, palace: p.name });
      });
    });
    var shHtml = sihua.length
      ? '<div class="zw-block"><h4>— 四化速览 —</h4>' + sihua.map(function (x) {
          return '<div class="zw-si"><b>化' + esc(x.mu) + "</b>　" + esc(x.name) + "　<span>在" + esc(x.palace) + "</span>" +
            '<p>' + esc(SH[x.mu] || "") + "</p></div>";
        }).join("") + "</div>"
      : "";

    var summary = "命宫在" + esc(soul.earthlyBranch) + "，";
    summary += soul.majorStars.length
      ? "由" + soul.majorStars.map(function (s) { return s.name; }).join("、") + "坐守，"
      : "宫内无正曜，";
    summary += "身宫在" + esc(a.earthlyBranchOfBodyPalace) + "。";
    summary += "命宫是一个人最外显的样子，身宫是更深一层的取向——两处一起看，比只盯一个宫位准。";
    summary += "　" + NOTE;

    // 结构化命盘（供 AI 解读；只含星曜/宫位排列，不含生辰）
    zwChartState = {
      fiveElementsClass: a.fiveElementsClass,
      soul: { gz: soul.heavenlyStem + soul.earthlyBranch, majorStars: soul.majorStars.map(function (s) { return s.name; }) },
      body: a.earthlyBranchOfBodyPalace,
      palaces: a.palaces.map(function (p) {
        return {
          name: p.name, gz: p.heavenlyStem + p.earthlyBranch,
          majorStars: p.majorStars.map(function (s) { return s.name; }),
          minorStars: (p.minorStars || []).map(function (s) { return s.name; }),
          isBody: p.isBodyPalace
        };
      }),
      siHua: sihua.map(function (x) { return { star: x.name, type: x.mu, palace: x.palace }; })
    };

    $("ziwei-result").innerHTML = head + soulHtml +
      '<div class="section-title" style="margin-top:16px">十二宫 · 自命宫起顺时针</div>' + rows +
      shHtml +
      '<div class="ly-note" style="margin-top:12px"><h4>— 说 明 —</h4>' + esc(summary) + "</div>" +
      '<div class="result-actions" style="margin-top:12px"><button class="btn ai-btn" id="btn-zw-ai">AI 解读（灵感视角）</button></div>' +
      '<div class="ai-box" id="zw-ai-box" style="display:none"></div>' +
      '<div class="result-actions" style="margin-top:14px">' +
        '<button class="btn gold" id="btn-zw-save">存入历史</button>' +
        '<button class="btn ghost" id="btn-zw-again">重新排盘</button>' +
      "</div>" +
      '<p class="gen-note">排盘算法 iztro（MIT）· 内容为传统文化研究，仅供娱乐与自我探索</p>';

    zwState.save = {
      t: Date.now(), name: zwState.name, gender: zwState.gender, date: zwState.date, hour: zwState.hour,
      soul: soul.heavenlyStem + soul.earthlyBranch,
      body: a.earthlyBranchOfBodyPalace,
      ju: a.fiveElementsClass,
      stars: soul.majorStars.map(function (s) { return s.name; })
    };
    $("btn-zw-save").addEventListener("click", saveZiwei);
    $("btn-zw-again").addEventListener("click", function () {
      $("ziwei-result").innerHTML = "";
      window.scrollTo(0, 0);
    });
    var zwAiBtn = $("btn-zw-ai");
    if (zwAiBtn) zwAiBtn.addEventListener("click", function () { requestZwAI(zwAiBtn); });
    $("ziwei-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // AI 解读：只把结构化命盘（星曜/宫位排列）发给后端，绝不传生辰
  function buildZiweiChartPayload() {
    return { type: "chart", domain: "ziwei", chart: zwChartState };
  }
  function requestZwAI(btn) {
    if (!zwChartState) { toast("命盘尚未排好"); return; }
    var payload = buildZiweiChartPayload();
    btn.disabled = true; btn.textContent = "解读生成中…";
    var box = $("zw-ai-box");
    box.style.display = "block";
    box.innerHTML = '<div class="ai-loading">正在生成你的专属解读…</div>';
    if (!window.WenxingAI) { zwAiFallback(box, btn); return; }
    window.WenxingAI.interpret(payload).then(function (r) {
      zwChartState.aiText = r.text;
      box.innerHTML = '<div class="ai-mark">AI 生成 · 娱乐参考' + (r.mock ? " · 离线示例" : "") + '</div>' +
        aiParas(r.text);
      btn.textContent = "重新解读"; btn.disabled = false;
    }).catch(function () { zwAiFallback(box, btn); });
  }
  // 段落渲染统一走 ai.js 的公共函数（空行分段）
  function aiParas(text) {
    if (window.WenxingAIText) return window.WenxingAIText.paragraphs(text);
    return '<p class="ai-text">' + esc(text) + '</p>';
  }
  function zwAiFallback(box, btn) {
    zwChartState.aiText = zwLocalSummary();
    box.innerHTML = '<div class="ai-mark">离线综合解读 · 娱乐参考</div>' +
      aiParas(zwChartState.aiText);
    btn.textContent = "重新解读"; btn.disabled = false;
    if (window.AppView && window.AppView.toast) window.AppView.toast("AI 服务暂不可用，已切换本地综合解读");
  }
  function zwLocalSummary() {
    var s = "命宫落在" + (zwChartState.soul.gz || "") + "，由" +
      ((zwChartState.soul.majorStars || []).join("、") || "空宫") + "坐守，是盘里最外显的一束气质。";
    var hua = (zwChartState.siHua || []);
    if (hua.length) s += "四化里" + hua.map(function (x) { return "化" + x.type + " " + x.star; }).join("、") + "，是能量的几处流动。";
    s += "命盘是帮你看清自己的镜子，不是替你定下结局的裁判。";
    return s;
  }

  function saveZiwei() {
    var r = zwState.save;
    if (!r) return;
    var list = load();
    list.unshift(r);
    if (saveList(list)) {
      $("btn-zw-save").disabled = true;
      $("btn-zw-save").textContent = "已存入 ✓";
      renderZwHistory();
    } else {
      toast("保存失败：本机存储不可用");
    }
  }

  function renderZwHistory() {
    var list = load();
    var box = $("ziwei-history");
    var block = $("ziwei-history-block");
    box.innerHTML = "";
    block.style.display = list.length ? "block" : "none";
    list.forEach(function (rec, i) {
      var el = document.createElement("div");
      el.className = "bz-hist";
      el.innerHTML =
        '<div class="r1"><span class="nm">' + (rec.name ? esc(rec.name) + " · " : "") + "命宫" + esc(rec.soul) + "</span>" +
        '<span class="tm">' + fmtTime(rec.t) + "</span></div>" +
        '<div class="pz">' + esc(rec.ju) + "　身宫" + esc(rec.body) + "　" + esc((rec.stars || []).join("、") || "空宫") + "</div>" +
        '<div style="font-size:12.5px;color:#a49dc2;margin-top:5px">' + esc(rec.date) + "　" + (rec.gender === 1 ? "男" : "女") + "</div>" +
        '<div class="ops"><button data-i="' + i + '">删除</button></div>';
      el.querySelector("button").addEventListener("click", function () {
        var l = load();
        l.splice(i, 1);
        saveList(l);
        renderZwHistory();
      });
      box.appendChild(el);
    });
  }
  renderZwHistory();
  $("btn-clear-zw").addEventListener("click", function () {
    if (confirm("确定清空全部紫微命盘记录吗？此操作不可恢复。")) {
      localStorage.removeItem(ZW_KEY);
      renderZwHistory();
    }
  });

})();
