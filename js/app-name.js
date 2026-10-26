// 问星 · 起名（字义 + 音律 + 三才五格参考）
// 生辰为可选项：不填也能起名，填了只在本机计算，不上传
(function () {
  "use strict";

  var NM_KEY = "wenxing_name_history";
  var CONSENT_KEY = "wenxing_bazi_consent";

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
  function safe(fn, def) { try { var v = fn(); return v == null ? def : v; } catch (e) { return def; } }
  function load() {
    try { var v = JSON.parse(localStorage.getItem(NM_KEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function saveList(list) {
    try { localStorage.setItem(NM_KEY, JSON.stringify(list.slice(0, 40))); return true; }
    catch (e) { return false; }
  }

  var CHARS = window.NAME_CHARS || [];
  var SUR = window.NAME_SURNAMES || {};
  var SHULI = window.NAME_SHULI || {};
  var WX = window.NAME_WX || {};

  // ---------- 五行 ----------
  var WX_LIST = ["木", "火", "土", "金", "水"];
  var SHENG = { "木": "火", "火": "土", "土": "金", "金": "水", "水": "木" };
  var KE = { "木": "土", "土": "水", "水": "火", "火": "金", "金": "木" };

  function wxOfGanZhi(gz) {
    var gan = { "甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土", "己": "土", "庚": "金", "辛": "金", "壬": "水", "癸": "水" };
    var zhi = { "子": "水", "丑": "土", "寅": "木", "卯": "木", "辰": "土", "巳": "火", "午": "火", "未": "土", "申": "金", "酉": "金", "戌": "土", "亥": "水" };
    var out = [];
    (gz || "").split("").forEach(function (c, i) {
      out.push(i === 0 ? gan[c] : zhi[c]);
    });
    return out.filter(Boolean);
  }

  // 八字五行分布（与八字排盘同一口径：天干五行 + 地支五行）
  function birthWx(dateStr, hour) {
    if (typeof Solar === "undefined" || typeof Lunar === "undefined") return null;
    var p = String(dateStr).split("-");
    var solar = Solar.fromYmdHms(+p[0], +p[1], +p[2], hour, 0, 0);
    var lunar = Lunar.fromSolar(solar);
    var ec = safe(function () { return lunar.getEightChar(); }, null);
    if (!ec) return null;
    var cnt = { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };
    ["getYear", "getMonth", "getDay", "getTime"].forEach(function (m) {
      wxOfGanZhi(safe(function () { return ec[m](); }, "")).forEach(function (w) {
        if (cnt[w] !== undefined) cnt[w]++;
      });
    });
    return cnt;
  }

  // 偏少 / 偏多的五行（仅作取名时的字义参考，不作吉凶判断）
  function wxTendency(cnt) {
    var arr = WX_LIST.map(function (w) { return { w: w, n: cnt[w] }; });
    arr.sort(function (a, b) { return a.n - b.n; });
    var least = arr.filter(function (x) { return x.n === arr[0].n; }).map(function (x) { return x.w; });
    var most = arr.filter(function (x) { return x.n === arr[arr.length - 1].n; }).map(function (x) { return x.w; });
    return { cnt: cnt, least: least, most: most, sorted: arr };
  }

  // ---------- 笔画与三才五格 ----------
  function charStroke(c) {
    for (var i = 0; i < CHARS.length; i++) if (CHARS[i][0] === c) return CHARS[i][2];
    return null;
  }
  function strokesOf(surname) {
    var out = [];
    for (var i = 0; i < surname.length; i++) {
      var c = surname.charAt(i);
      var s = SUR[c] != null ? SUR[c] : charStroke(c);
      if (s == null) return null;
      out.push(s);
    }
    return out;
  }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function wuge(surS, nameS) {
    var tian = surS.length > 1 ? sum(surS) : surS[0] + 1;
    var ren = surS[surS.length - 1] + nameS[0];
    var di = nameS.length > 1 ? sum(nameS) : nameS[0] + 1;
    var zong = sum(surS) + sum(nameS);
    var wai;
    if (nameS.length === 1) wai = surS.length === 1 ? 2 : surS[0];
    else wai = surS.length === 1 ? nameS[1] + 1 : surS[0] + nameS[1];
    return { tian: tian, ren: ren, di: di, wai: wai, zong: zong };
  }
  function wxOfNum(n) {
    var d = n % 10;
    if (d === 1 || d === 2) return "木";
    if (d === 3 || d === 4) return "火";
    if (d === 5 || d === 6) return "土";
    if (d === 7 || d === 8) return "金";
    return "水";
  }
  function shuLi(n) {
    var v = n % 81;
    if (v <= 0) v = v === 0 ? 81 : ((v % 81) + 81);
    return { n: v, info: SHULI[v] || [1, "—"] };
  }
  function sancai(g) {
    var t = wxOfNum(g.tian), r = wxOfNum(g.ren), d = wxOfNum(g.di);
    function rel(a, b) {
      if (a === b) return "bihe";
      if (SHENG[a] === b) return "sheng";
      if (SHENG[b] === a) return "beisheng";
      if (KE[a] === b) return "ke";
      return "beike";
    }
    var r1 = rel(t, r), r2 = rel(r, d);
    var good = ["bihe", "sheng", "beisheng"];
    var level = (good.indexOf(r1) >= 0 && good.indexOf(r2) >= 0) ? 0
      : (r1 === "ke" || r1 === "beike" || r2 === "ke" || r2 === "beike") ? 2 : 1;
    return { t: t, r: r, d: d, level: level };
  }

  // ---------- 音律 ----------
  function toneOf(p) {
    var m = /([1-4])$/.exec(p || "");
    return m ? +m[1] : 0;
  }
  function toneTip(tones) {
    var T = window.NAME_TONE_TIP || {};
    if (tones.length === 1) {
      return tones[0] === 3 ? "上声收尾，念起来略顿" : (T.end4 && tones[0] === 4 ? T.end4 : "单字名，重在与姓氏搭配");
    }
    if (tones[0] === tones[1]) return T.same || "两字同调，略显平直";
    if (tones[0] <= 2 && tones[1] <= 2) return T.flat || "全平声，读起来偏柔";
    if (tones[1] === 4) return T.end4 || "末字去声，收得干脆";
    if (tones[1] <= 2) return T.end12 || "末字平声，收得舒缓";
    return T.vary || "声调有起伏，读起来顺口";
  }

  // ---------- 风格关键词 ----------
  var STYLE = {
    steady: ["稳", "厚", "定", "静", "守", "恒", "正", "端", "堂", "坤", "坦", "固", "朴", "淳", "重", "承", "宗", "本"],
    lively: ["灵", "动", "扬", "飞", "翔", "捷", "敏", "巧", "俏", "欣", "跃", "波", "泉", "汐", "盈", "欢", "朗"],
    bookish: ["书", "文", "诗", "墨", "儒", "雅", "吟", "知", "思", "研", "艺", "字", "言", "章", "经", "学", "淳", "修"],
    elegant: ["清", "雅", "芷", "兰", "荷", "莲", "竹", "茗", "芳", "菲", "洁", "素", "宛", "澄", "汐", "淇", "筱", "筠"],
    grand: ["宇", "天", "海", "博", "宏", "伟", "峰", "越", "盛", "乾", "广", "洋", "洲", "雷", "赫", "邦", "乾", "景"],
    gentle: ["婉", "柔", "怡", "悦", "惠", "安", "宁", "和", "曼", "姗", "依", "韵", "沁", "暖", "舒", "容", "恩"]
  };
  var STYLE_LABEL = { steady: "沉稳", lively: "灵动", bookish: "书卷气", elegant: "清雅", grand: "大气", gentle: "温婉" };

  function styleHit(c, keys) {
    if (!keys.length) return true;
    for (var i = 0; i < keys.length; i++) {
      if (c[0] === keys[i]) return true;
      if ((c[4] || "").indexOf(keys[i]) >= 0) return true;
    }
    return false;
  }

  // ---------- 候选生成 ----------
  var nmState = { gender: 0, len: 2, styles: [], res: [], seed: 0 };

  function pickPool() {
    var g = nmState.gender;          // 0 不限 / 1 男 / 2 女
    var keys = [];
    nmState.styles.forEach(function (s) { keys = keys.concat(STYLE[s] || []); });
    var pool = CHARS.filter(function (c) {
      if (g && c[5] !== 0 && c[5] !== g) return false;
      return styleHit(c, keys);
    });
    if (pool.length < 8) pool = CHARS.filter(function (c) { return !g || c[5] === 0 || c[5] === g; });
    return pool;
  }

  // 确定性洗牌：同一 seed 出同一批，换一批就换一批
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(arr, seed) {
    var a = arr.slice(), rnd = mulberry32(seed + 1);
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function buildCandidates(surname, surS, tend) {
    var pool = shuffled(pickPool(), nmState.seed);
    if (pool.length > 150) pool = pool.slice(0, 150); // 控制组合规模，手机上也快
    var out = [];
    for (var a = 0; a < pool.length; a++) {
      if (nmState.len === 1) {
        out.push(makeOne(surname, surS, [pool[a]], tend));
      } else {
        for (var b = 0; b < pool.length; b++) {
          if (a === b) continue;
          if (pool[a][1].replace(/[1-4]$/, "") === pool[b][1].replace(/[1-4]$/, "")) continue; // 同音字不叠用
          out.push(makeOne(surname, surS, [pool[a], pool[b]], tend));
        }
      }
    }
    out.sort(function (x, y) { return y.score - x.score; });
    return dedup(out, 8);
  }

  function dedup(list, n) {
    var seen = {}, out = [];
    list.forEach(function (x) {
      if (seen[x.full]) return;
      seen[x.full] = 1;
      out.push(x);
    });
    return out.slice(0, n);
  }

  function makeOne(surname, surS, chars, tend) {
    var full = surname + chars.map(function (c) { return c[0]; }).join("");
    var nameS = chars.map(function (c) { return c[2]; });
    var g = wuge(surS, nameS);
    var sc = sancai(g);
    var sl = {
      tian: shuLi(g.tian), ren: shuLi(g.ren), di: shuLi(g.di),
      wai: shuLi(g.wai), zong: shuLi(g.zong)
    };
    var tones = chars.map(function (c) { return toneOf(c[1]); });
    var els = chars.map(function (c) { return c[3]; });

    var score = 0;
    // 数理：人格最重，总格次之，地格再次
    [[sl.ren, 15], [sl.zong, 12], [sl.di, 8], [sl.wai, 5], [sl.tian, 3]].forEach(function (p) {
      var lv = p[0].info[0];
      score += lv === 0 ? p[1] : (lv === 1 ? Math.round(p[1] * 0.3) : -p[1]);
    });
    // 三才
    score += sc.level === 0 ? 14 : (sc.level === 1 ? 0 : -14);
    // 五行参考：偏少五行入选加分（只是字义取向，不作吉凶）
    if (tend && tend.least.length && tend.least.length < 5) {
      els.forEach(function (e) { if (tend.least.indexOf(e) >= 0) score += 18; });
      els.forEach(function (e) { if (tend.most.length < 5 && tend.most.indexOf(e) >= 0) score -= 4; });
    }
    // 音律
    if (tones.length === 2 && tones[0] !== tones[1]) score += 6;
    if (tones[tones.length - 1] === 3) score -= 3;
    // 笔画：太重或太轻都不好写
    var total = g.zong;
    if (total >= 12 && total <= 32) score += 5;
    if (total > 40) score -= 12;

    return {
      full: full,
      chars: chars,
      pinyin: chars.map(function (c) { return c[1]; }).join(" "),
      tones: tones,
      els: els,
      g: g, sc: sc, sl: sl,
      score: score
    };
  }

  // ---------- 渲染 ----------
  function lvlText(lv) { return lv === 0 ? "吉" : (lv === 1 ? "半吉" : "凶"); }
  function lvlClass(lv) { return lv === 0 ? "good" : (lv === 1 ? "mid" : "bad"); }

  function renderResult(surname, list, tend, hasBirth) {
    var html = "";
    if (hasBirth && tend) {
      var max = Math.max.apply(null, WX_LIST.map(function (w) { return tend.cnt[w]; })) || 1;
      html += '<div class="nm-card"><div class="nm-title">五行分布参考</div>' +
        '<div class="nm-wx">' + WX_LIST.map(function (w) {
          var n = tend.cnt[w];
          var pct = Math.round((n / max) * 100);
          return '<div class="nm-wxrow"><span class="w">' + esc(w) + '</span>' +
            '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
            '<span class="n">' + n + "</span></div>";
        }).join("") + "</div>" +
        '<div class="nm-tip">偏少：' + esc(tend.least.join("、")) + "　偏多：" + esc(tend.most.join("、")) +
        "<br>这只是四柱五行的分布情况。取名时可以参考，但不必执着于「补」——字义、读音、写起来顺手更重要。</div></div>";
    }

    html += '<div class="section-title" style="margin-top:16px">候选名字 · ' + list.length + " 个</div>";
    list.forEach(function (c, i) {
      var wugeHtml = '<div class="nm-wuge">' +
        ["tian:天格", "ren:人格", "di:地格", "wai:外格", "zong:总格"].map(function (k) {
          var key = k.split(":")[0], lab = k.split(":")[1];
          var s = c.sl[key];
          return '<div class="nm-wg"><span class="k">' + lab + "</span>" +
            '<b class="' + lvlClass(s.info[0]) + '">' + s.n + "</b>" +
            '<em class="' + lvlClass(s.info[0]) + '">' + lvlText(s.info[0]) + "</em></div>";
        }).join("") + "</div>";
      var scTxt = ["吉", "平", "波折"][c.sc.level];
      html += '<div class="nm-item">' +
        '<div class="nm-head"><b>' + esc(c.full) + "</b>" +
        '<span class="py">' + esc(c.pinyin) + "</span>" +
        '<span class="strokes">共 ' + c.g.zong + " 画</span></div>" +
        '<div class="nm-els">' + c.chars.map(function (ch) {
          return '<div class="nm-el"><b>' + esc(ch[0]) + '</b><span>' + esc(ch[3]) + " · " + ch[2] + "画</span>" +
            "<p>" + esc(ch[4]) + "</p></div>";
        }).join("") + "</div>" +
        wugeHtml +
        '<div class="nm-meta">三才 ' + esc(c.sc.t + c.sc.r + c.sc.d) + '　<span class="' +
        (c.sc.level === 0 ? "good" : (c.sc.level === 1 ? "mid" : "bad")) + '">' + esc(scTxt) + "</span>" +
        "　音律：" + esc(toneTip(c.tones)) + "</div>" +
        '<div class="nm-ops"><button class="btn-mini" data-i="' + i + '">收藏</button></div>' +
        "</div>";
    });

    html += '<div class="ly-note" style="margin-top:14px"><h4>— 说 明 —</h4>' + esc(window.NAME_NOTE || "") +
      "<br>" + esc((window.NAME_SANCAI || {}).note || "") + "</div>" +
      '<div class="ly-note" style="margin-top:10px"><h4>— 起 名 自 检 —</h4>' +
      "连着姓氏念三遍，看是否顺口；用家乡话念一遍，避开方言联想；写出来看字形是否平衡；查一下姓名拼音缩写有无尴尬组合；问问家里长辈有没有忌讳的字。</div>" +
      '<div class="result-actions" style="margin-top:12px">' +
      '<button class="btn ai-btn" id="btn-nm-ai">AI 解读（命名思路）</button>' +
      "</div>" +
      '<div class="ai-box" id="nm-ai-box" style="display:none"></div>' +
      '<div class="result-actions" style="margin-top:14px">' +
      '<button class="btn ghost" id="btn-nm-again">换一批</button>' +
      "</div>" +
      '<p class="gen-note">笔画按简体规范计算，与传统康熙笔画算法不同；三才五格为民国时期传入的评断方法，娱乐参考价值大于实际意义。</p>';

    $("name-result").innerHTML = html;
    Array.prototype.forEach.call($("name-result").querySelectorAll(".nm-ops button"), function (b) {
      b.addEventListener("click", function () {
        saveOne(list[+b.getAttribute("data-i")]);
      });
    });
    $("btn-nm-again").addEventListener("click", function () {
      nmState.seed++;
      go(true);
    });
    // AI 解读：传候选名字的构成（字义/三才/音律），不上传生辰
    if (window.WenxingOracleAI) {
      window.WenxingOracleAI.attach({
        btnId: "btn-nm-ai",
        boxId: "nm-ai-box",
        kind: "name",
        data: function () {
          return {
            surname: surname,
            tend: tend ? ("偏少：" + tend.least.join("、") + "；偏多：" + tend.most.join("、")) : "",
            names: list.slice(0, 5).map(function (c) {
              return {
                full: c.full,
                pinyin: c.pinyin,
                sancai: c.sc.t + c.sc.r + c.sc.d,
                meaning: c.chars.map(function (ch) { return ch[0] + "：" + ch[4]; }).join("；")
              };
            })
          };
        },
        fallback: window.NAME_NOTE || ""
      });
    }
    $("name-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- 执行 ----------
  function go(reshuffle) {
    var surname = ($("nm-surname").value || "").trim();
    if (!surname) { toast("请先填写姓氏"); return; }
    if (surname.length > 2) { toast("姓氏请填 1-2 个字"); return; }

    var dateStr = ($("nm-date").value || "").trim();
    var h = parseInt($("nm-hour").value, 10);
    if (!isFinite(h)) h = 12;
    var hasBirth = !!dateStr;

    if (hasBirth && localStorage.getItem(CONSENT_KEY) !== "1") {
      window.__consentCb = function () { go(reshuffle); };
      $("sheet-consent").classList.add("show");
      return;
    }

    var surS = strokesOf(surname);
    var tend = null;
    if (hasBirth) {
      var cnt = safe(function () { return birthWx(dateStr, h); }, null);
      if (cnt) tend = wxTendency(cnt);
    }

    var list = buildCandidates(surname, surS || [surname.length], tend);
    if (!list.length) { toast("可用的字太少，换个条件试试"); return; }
    nmState.res = list;
    renderResult(surname, list, tend, hasBirth);
    if (!surS) toast("「" + surname + "」的笔画未收录，三才五格按估算值显示");
  }

  // ---------- 历史（收藏） ----------
  function saveOne(c) {
    var list = load();
    if (list.some(function (x) { return x.full === c.full; })) { toast("已经收藏过了"); return; }
    list.unshift({
      t: Date.now(),
      full: c.full,
      pinyin: c.pinyin,
      els: c.els.join(""),
      zong: c.g.zong,
      sancai: c.sc.t + c.sc.r + c.sc.d,
      meaning: c.chars.map(function (ch) { return ch[0] + "：" + ch[4]; }).join("；")
    });
    if (saveList(list)) { toast("已收藏"); renderNmHistory(); }
    else toast("保存失败：本机存储不可用");
  }

  function renderNmHistory() {
    var list = load();
    var box = $("name-history");
    var block = $("name-history-block");
    box.innerHTML = "";
    block.style.display = list.length ? "block" : "none";
    list.forEach(function (rec, i) {
      var el = document.createElement("div");
      el.className = "nm-hist";
      el.innerHTML =
        '<div class="r1"><span class="nm">' + esc(rec.full) + "</span>" +
        '<span class="tm">' + fmtTime(rec.t) + "</span></div>" +
        '<div class="pz">' + esc(rec.pinyin) + "　共" + esc(rec.zong) + "画　三才" + esc(rec.sancai) + "</div>" +
        '<div class="mn">' + esc(rec.meaning) + "</div>" +
        '<div class="ops"><button data-i="' + i + '">删除</button></div>';
      el.querySelector("button").addEventListener("click", function () {
        var l = load();
        l.splice(i, 1);
        saveList(l);
        renderNmHistory();
      });
      box.appendChild(el);
    });
  }
  renderNmHistory();
  $("btn-clear-name").addEventListener("click", function () {
    if (confirm("确定清空全部收藏的名字吗？此操作不可恢复。")) {
      localStorage.removeItem(NM_KEY);
      renderNmHistory();
    }
  });

  // ---------- 表单交互 ----------
  function segBind(wrapId, key, cast) {
    var wrap = $(wrapId);
    if (!wrap) return;
    Array.prototype.forEach.call(wrap.querySelectorAll(".seg-btn"), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(wrap.querySelectorAll(".seg-btn"), function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        nmState[key] = cast(b.getAttribute("data-v"));
      });
    });
  }
  segBind("nm-gender", "gender", function (v) { return +v; });
  segBind("nm-len", "len", function (v) { return +v; });

  var styleWrap = $("nm-styles");
  if (styleWrap) {
    Array.prototype.forEach.call(styleWrap.querySelectorAll(".chip"), function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-s");
        var i = nmState.styles.indexOf(k);
        if (i >= 0) { nmState.styles.splice(i, 1); b.classList.remove("on"); }
        else { nmState.styles.push(k); b.classList.add("on"); }
      });
    });
  }

  $("btn-name-go").addEventListener("click", function () { go(false); });

})();
