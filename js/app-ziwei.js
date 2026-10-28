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
      $("ziwei-result").innerHTML = "";
      pendings.length = 0;
      restoreZiweiBtn();
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

  function restoreZiweiBtn() {
    var b = $("btn-ziwei-go");
    if (b) { b.disabled = false; b.textContent = "开始排盘"; }
  }

  function run() {
    var btn = $("btn-ziwei-go");
    // 排盘要等 1MB 的排盘引擎载入 + 计算十二宫，期间必须给即时反馈，否则点下去像没反应
    btn.disabled = true;
    btn.textContent = "排盘中…";
    $("ziwei-status").innerHTML = "正在准备排盘引擎…";
    $("ziwei-result").innerHTML =
      '<div class="zw-loading"><div class="spin"></div><p>正在排盘，稍等…</p></div>';
    try { $("ziwei-result").scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}

    function restore() { restoreZiweiBtn(); }

    // —— 解析公历/农历 + 真太阳时（在引擎加载前算好，回调内直接复用）——
    var solarVal = $("zw-date").value;
    var lunarVal = ($("zw-lunar").value || "").trim();
    var city = ($("zw-city").value || "").trim();
    var useTrueSun = $("zw-truesun") && $("zw-truesun").checked;
    var rd = window.BirthUtil ? window.BirthUtil.resolveDate(solarVal, lunarVal) : { error: "生辰工具未就绪" };
    if (rd.error) { restore(); toast(rd.error); return; }
    var h0 = parseInt($("zw-hour").value, 10);
    if (!isFinite(h0)) h0 = 12;
    var adj = window.BirthUtil.trueSolarAdjust(rd.y, rd.m, rd.d, h0, city, useTrueSun);
    if (useTrueSun && adj.noCity) toast("未找到「" + city + "」的经度，已按北京时间排盘");
    var cy = adj.y, cm = adj.m, cd = adj.d, ch = adj.h;
    var date = cy + "-" + pad(cm) + "-" + pad(cd);
    var timeIndex = ch < 0 ? 6 : Math.floor(ch / 2); // 子0 丑1 … 亥11；不确定按午时
    var gender = zwState.gender === 1 ? "male" : "female";

    ensureIztro(function () {
      if (!window.iztro) { restore(); return; }
      $("ziwei-status").innerHTML = "正在计算十二宫与主星…";
      var a;
      try {
        a = window.iztro.astro.bySolar(date, timeIndex, gender, true, "zh-CN");
      } catch (e) {
        $("ziwei-result").innerHTML = "";
        $("ziwei-status").innerHTML = "";
        toast("排盘失败：" + e.message);
        restore();
        return;
      }
      zwState.res = a;
      zwState.date = date;
      zwState.hour = ch;
      zwState.name = $("zw-name").value.trim();
      $("ziwei-status").innerHTML = "";
      render(a);
      restore();
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

  // 圆形十二宫命盘：SVG 环形，子居下、顺时针排列；中宫展示基本信息
  // 星曜按字数自动折行（最多两行），避免长串冲出扇形
  function wrapStars(tokens, maxLen) {
    var lines = [], cur = "";
    tokens.forEach(function (t) {
      var cand = cur ? cur + "·" + t : t;
      if (cur && cand.length > maxLen) { lines.push(cur); cur = t; }
      else cur = cand;
    });
    if (cur) lines.push(cur);
    if (lines.length > 2) {                       // 超出两行就并到第二行，宁可略挤也不溢出
      lines = [lines[0], lines.slice(1).join("·")];
    }
    return lines;
  }

  function buildCircularChart(a, byBranch) {
    var CX = 180, CY = 180, R_OUT = 168, R_IN = 101, R_MID = 137, GAP = 1.1;
    var parts = [];
    function xy(r, deg) {
      var rad = deg * Math.PI / 180;
      return [(CX + r * Math.cos(rad)).toFixed(2), (CY + r * Math.sin(rad)).toFixed(2)];
    }
    // 外圈装饰环
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="172" fill="none" stroke="rgba(212,185,106,.28)" stroke-width="1"/>');
    for (var i = 0; i < 12; i++) {
      var p = byBranch[ZHI[i]];
      if (!p) continue;
      var mid = 90 + i * 30;                       // 子:90°(下) 卯:180°(左) 午:270°(上) 酉:0°(右)
      var a0 = mid - 15 + GAP, a1 = mid + 15 - GAP;
      var o0 = xy(R_OUT, a0), o1 = xy(R_OUT, a1);
      var i0 = xy(R_IN, a0), i1 = xy(R_IN, a1);
      var d = "M" + o0[0] + " " + o0[1] +
        " A" + R_OUT + " " + R_OUT + " 0 0 1 " + o1[0] + " " + o1[1] +
        " L" + i1[0] + " " + i1[1] +
        " A" + R_IN + " " + R_IN + " 0 0 0 " + i0[0] + " " + i0[1] + " Z";
      var isSoul = p.name === "命宫";
      var fill = isSoul ? "rgba(212,185,106,.2)" : (i % 2 ? "rgba(139,124,246,.1)" : "rgba(255,255,255,.028)");
      var stroke = isSoul ? "rgba(242,217,138,.85)" : "rgba(212,185,106,.18)";
      parts.push('<path d="' + d + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (isSoul ? 1.6 : 1) + '"/>');

      var mx = CX + R_MID * Math.cos(mid * Math.PI / 180);
      var my = CY + R_MID * Math.sin(mid * Math.PI / 180);
      var rot = mid + 90;                          // 文字沿环切向排列，并归一到 ±90° 保证不倒着写
      var flip = 1;                                // 归一过程中若翻转过 180°，局部 -y 就指向圆心，径向偏移要取反
      while (rot > 90) { rot -= 180; flip = -flip; }
      while (rot <= -90) { rot += 180; flip = -flip; }
      var nm = p.name + (p.isBodyPalace ? " ·身" : "");
      var body = '<text text-anchor="middle" y="' + (-25 * flip) + '" font-size="11" font-weight="' + (isSoul ? "700" : "500") +
          '" fill="' + (isSoul ? "#f2d98a" : "#d9d4ef") + '" letter-spacing=".5">' + esc(nm) + "</text>" +
        '<text text-anchor="middle" y="' + (-13 * flip) + '" font-size="7.5" fill="#8b84a8">' + esc(p.heavenlyStem + p.earthlyBranch) + "</text>";
      if (p.majorStars.length) {
        var ls = wrapStars(p.majorStars.map(function (s) {
          return s.name + (s.mutagen ? "化" + s.mutagen : "");
        }), 4);
        ls.forEach(function (t, k) {
          body += '<text text-anchor="middle" y="' + ((1 + k * 13) * flip) + '" font-size="8.5" fill="' +
            (/化/.test(t) ? "#e8b9b9" : "#e9e5f8") + '">' + esc(t) + "</text>";
        });
      } else {
        body += '<text text-anchor="middle" y="' + (2 * flip) + '" font-size="8.5" fill="#6f6889">空宫</text>';
      }
      parts.push('<g transform="translate(' + mx.toFixed(1) + ',' + my.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')">' + body + "</g>");
    }
    // 中宫
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + (R_IN - 5) + '" fill="rgba(18,12,38,.94)" stroke="rgba(212,185,106,.3)" stroke-width="1.1"/>');
    var cName = (zwState.name ? zwState.name + " · " : "") + (zwState.gender === 1 ? "男" : "女") + "命盘";
    parts.push('<text x="' + CX + '" y="134" text-anchor="middle" font-size="11.5" fill="#f2d98a" letter-spacing="1.5">' + esc(cName) + "</text>");
    parts.push('<text x="' + CX + '" y="163" text-anchor="middle" font-size="17" fill="#ece8f7" letter-spacing="2">' + esc(a.fiveElementsClass) + "</text>");
    parts.push('<text x="' + CX + '" y="183" text-anchor="middle" font-size="8.5" fill="#9a93b8">' + esc(a.solarDate) + "</text>");
    parts.push('<text x="' + CX + '" y="196" text-anchor="middle" font-size="8.5" fill="#9a93b8">' + esc(a.lunarDate) + "</text>");
    parts.push('<line x1="' + (CX - 34) + '" y1="209" x2="' + (CX + 34) + '" y2="209" stroke="rgba(212,185,106,.22)" stroke-dasharray="3 3"/>');
    parts.push('<text x="' + CX + '" y="226" text-anchor="middle" font-size="9" fill="#b3aacd">命主 ' + esc(a.soul || "-") + "　身主 " + esc(a.body || "-") + "</text>");
    return '<svg class="zw-circle" viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="紫微命盘十二宫">' + parts.join("") + "</svg>";
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

    // 十二宫命盘图：圆形环形排布（子居下、顺时针），中宫放基本信息
    var chartHtml =
      '<div class="zw-chart-wrap">' +
        '<div class="section-title">命 盘</div>' +
        buildCircularChart(a, byBranch) +
        '<p class="zwc-note">子居下、顺时针排布；<b>命宫</b>高亮，带「身」即身宫，红字为生年四化。</p>' +
      "</div>";

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

    $("ziwei-result").innerHTML = head + chartHtml + soulHtml +
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
