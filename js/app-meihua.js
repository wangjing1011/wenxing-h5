// 问星 · 梅花易数起卦（时间起卦 / 报数起卦）
// 纯前端：不上传、不收集，记录仅存 localStorage
(function () {
  "use strict";

  var GUA = window.LIUYAO_GUA || [];
  var BAGUA = window.BAGUA || [];
  var YAO_NOTE = window.YAO_NOTE || [];
  var WX = window.MH_WX || {};
  var SHENG = window.MH_SHENG || {};
  var KE = window.MH_KE || {};
  var LEI = window.MH_LEIXIANG || {};
  var REL = window.MH_REL || {};
  var QI = window.MH_QI || {};
  var STAGE = window.MH_STAGE || {};
  var METHOD = window.MH_METHOD || {};
  var NOTE = window.MH_NOTE || "";

  var MH_KEY = "wenxing_meihua_history";
  var ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  var YAO_POS = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"];
  var YUE_WX = { "寅": "木", "卯": "木", "巳": "火", "午": "火", "申": "金", "酉": "金", "亥": "水", "子": "水", "辰": "土", "未": "土", "戌": "土", "丑": "土" };

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
    try { var v = JSON.parse(localStorage.getItem(MH_KEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function saveList(list) {
    try { localStorage.setItem(MH_KEY, JSON.stringify(list.slice(0, 50))); return true; }
    catch (e) { return false; }
  }

  // ---------- 卦象内核 ----------
  function trigram(a, b, c) { return 8 - ((a ? 4 : 0) + (b ? 2 : 0) + (c ? 1 : 0)); }
  function yaoOfBagua(k) { var v = 8 - k; return [(v >> 2) & 1, (v >> 1) & 1, v & 1]; }
  function findGua(up, down) {
    for (var i = 0; i < GUA.length; i++) if (GUA[i].up === up && GUA[i].down === down) return GUA[i];
    return null;
  }
  function baguaOf(k) {
    for (var i = 0; i < BAGUA.length; i++) if (BAGUA[i].k === k) return BAGUA[i];
    return { k: k, name: "?", xiang: "?", xing: "?" };
  }
  function mkYaos(up, down) {
    var d = yaoOfBagua(down), u = yaoOfBagua(up);
    return [d[0], d[1], d[2], u[0], u[1], u[2]].map(function (y) {
      return { yang: y ? 1 : 0, mv: false, mk: "", name: y ? "阳" : "阴" };
    });
  }
  // 互卦：下互取 2/3/4 爻，上互取 3/4/5 爻
  function huGua(Y) {
    var lo = trigram(Y[1].yang, Y[2].yang, Y[3].yang);
    var up = trigram(Y[2].yang, Y[3].yang, Y[4].yang);
    return { up: up, down: lo, yaos: mkYaos(up, lo) };
  }
  function guaFig(Y, marks) {
    var rows = "";
    for (var i = 5; i >= 0; i--) {
      var y = Y[i];
      var mk = (marks && y.mv) ? y.mk : "";
      var attr = (mk ? ' class="mk" data-mk="' + mk + '"' : "");
      var inner = y.yang ? "<i" + attr + "></i>" : "<i" + attr + "></i><i></i>";
      rows += '<div class="yrow">' + inner + "</div>";
    }
    return '<div class="gua-fig">' + rows + "</div>";
  }
  function guaBlock(g, Y, title, marks) {
    if (!g) return '<div class="gua-block"><div class="gt">卦象未收录</div></div>';
    var up = baguaOf(g.up), dn = baguaOf(g.down);
    return '<div class="gua-block">' +
      '<div class="gt">' + esc(g.name) + '　<span style="font-size:11px;color:#a49dc2">' + esc(title) + "</span></div>" +
      '<div class="gs">第 ' + g.no + " 卦 · 上" + esc(up.xiang) + "下" + esc(dn.xiang) +
        " · " + esc(up.name + up.xiang) + "／" + esc(dn.name + dn.xiang) + "</div>" +
      guaFig(Y, marks) +
      '<div class="ci">「' + esc(g.ci) + "」</div>" +
      '<div class="jie">' + esc(g.jie) + "</div>" +
      "</div>";
  }

  // ---------- 起卦 ----------
  function mod8(n) { var r = n % 8; return r === 0 ? 8 : r; }
  function mod6(n) { var r = n % 6; return r === 0 ? 6 : r; }

  function lunarParts(date) {
    if (!window.Solar || !window.Lunar) return null;
    var s = window.Solar.fromDate(date);
    var l = window.Lunar.fromSolar(s);
    var yz = l.getYearZhi();            // 年支
    var mo = Math.abs(l.getMonth());    // 农历月（闰月取绝对值）
    var dy = Math.abs(l.getDay());      // 农历日
    var tz = l.getTimeZhi();            // 时辰地支
    return {
      yz: yz, yzIdx: ZHI.indexOf(yz) + 1,
      month: mo, day: dy,
      tz: tz, tzIdx: ZHI.indexOf(tz) + 1,
      text: l.getYearInGanZhi() + "年" + l.getMonthInChinese() + "月" + l.getDayInChinese() + " " + tz + "时"
    };
  }

  var mhState = { question: "", method: "time", res: null, saved: false };

  // 方式切换
  Array.prototype.forEach.call($("mh-method").querySelectorAll(".seg-btn"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call($("mh-method").querySelectorAll(".seg-btn"), function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      mhState.method = b.getAttribute("data-m");
      $("mh-pane-time").style.display = mhState.method === "time" ? "block" : "none";
      $("mh-pane-num").style.display = mhState.method === "num" ? "block" : "none";
      if (mhState.method === "time") refreshNow();
    });
  });

  function nowLocalStr(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function refreshNow() {
    var v = $("mh-when").value;
    var d = v ? new Date(v.replace("T", " ") + ":00") : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var p = lunarParts(d);
    $("mh-now").innerHTML = p
      ? "农历 <b>" + esc(p.text) + "</b><br>年支 " + p.yz + "（" + p.yzIdx + "）　月 " + p.month +
        "　日 " + p.day + "　时 " + p.tz + "（" + p.tzIdx + "）"
      : "历法库未就绪";
    return p;
  }
  $("mh-when").value = nowLocalStr(new Date());
  $("mh-when").addEventListener("change", refreshNow);
  refreshNow();

  // 提问
  var mhQ = $("mh-q");
  mhQ.addEventListener("input", function () { $("mh-counter").textContent = mhQ.value.length + "/60"; });
  Array.prototype.forEach.call($("mh-chips").querySelectorAll(".chip"), function (chip) {
    chip.addEventListener("click", function () {
      mhQ.value = chip.textContent;
      mhQ.dispatchEvent(new Event("input"));
    });
  });

  // 随意报数
  $("btn-mh-random").addEventListener("click", function () {
    $("mh-n1").value = 1 + Math.floor(Math.random() * 999);
    $("mh-n2").value = 1 + Math.floor(Math.random() * 999);
  });

  // 起卦
  $("btn-mh-roll").addEventListener("click", function () {
    mhState.question = mhQ.value.trim();
    mhState.saved = false;
    var parts;
    if (mhState.method === "time") {
      var p = refreshNow();
      if (!p) { toast("历法未就绪，请改用报数起卦"); return; }
      var sum3 = p.yzIdx + p.month + p.day;
      var sum4 = sum3 + p.tzIdx;
      parts = {
        method: "time",
        up: mod8(sum3), down: mod8(sum4), mv: mod6(sum4),
        src: "年支 " + p.yz + "（" + p.yzIdx + "）+ 月 " + p.month + " + 日 " + p.day + " = " + sum3 +
             " → 上卦 " + baguaOf(mod8(sum3)).name + "<br>再加时 " + p.tz + "（" + p.tzIdx + "）= " + sum4 +
             " → 下卦 " + baguaOf(mod8(sum4)).name + "，动爻 " + mod6(sum4)
      };
      var lp = lunarParts(new Date(($("mh-when").value || "").replace("T", " ") + ":00"));
      parts.yueZhi = lp ? lp.yz : "子";
    } else {
      var n1 = parseInt($("mh-n1").value, 10);
      var n2 = parseInt($("mh-n2").value, 10);
      if (!n1 || !n2 || n1 < 1 || n2 < 1) { toast("请先报两个大于 0 的数"); return; }
      var s2 = n1 + n2;
      parts = {
        method: "num",
        up: mod8(n1), down: mod8(n2), mv: mod6(s2),
        src: "数一 " + n1 + " → 上卦 " + baguaOf(mod8(n1)).name + "　数二 " + n2 + " → 下卦 " + baguaOf(mod8(n2)).name +
             "<br>两数之和 " + s2 + " → 动爻 " + mod6(s2)
      };
      var lp2 = lunarParts(new Date());
      parts.yueZhi = lp2 ? lp2.yz : "子";
    }

    var Y = mkYaos(parts.up, parts.down);
    var idx = parts.mv - 1;           // 动爻 1-6 → 索引 0-5
    Y[idx].mv = true;
    Y[idx].mk = Y[idx].yang ? "○" : "×";
    Y[idx].name = Y[idx].yang ? "老阳" : "老阴";

    var ben = findGua(parts.up, parts.down);
    var hu = huGua(Y);
    var huG = findGua(hu.up, hu.down);
    var BY = Y.map(function (y) {
      return { yang: y.mv ? (y.yang ? 0 : 1) : y.yang, mv: false, mk: "", name: y.name };
    });
    var bUp = trigram(BY[3].yang, BY[4].yang, BY[5].yang);
    var bDn = trigram(BY[0].yang, BY[1].yang, BY[2].yang);
    var bian = findGua(bUp, bDn);

    // 体用：动爻所在的三爻卦为「用」，另一个为「体」
    var tiK = idx <= 2 ? parts.up : parts.down;   // 动在下面 → 上卦为体
    var yongK = idx <= 2 ? parts.down : parts.up;
    var tiWX = WX[tiK], yongWX = WX[yongK];
    var rel;
    if (tiWX === yongWX) rel = "bihe";
    else if (SHENG[yongWX] === tiWX) rel = "yongshengti";
    else if (SHENG[tiWX] === yongWX) rel = "tishengyong";
    else if (KE[yongWX] === tiWX) rel = "yongketi";
    else rel = "tikejong";

    // 卦气（体卦五行 相对 月令五行）
    var yueWX = YUE_WX[parts.yueZhi] || "土";
    var qi;
    if (tiWX === yueWX) qi = "旺";
    else if (SHENG[yueWX] === tiWX) qi = "相";
    else if (SHENG[tiWX] === yueWX) qi = "休";
    else if (KE[tiWX] === yueWX) qi = "囚";
    else qi = "死";

    mhState.res = {
      Y: Y, ben: ben, hu: huG, huYaos: hu.yaos, bian: bian, bYaos: BY,
      mvIdx: idx, tiK: tiK, yongK: yongK, tiWX: tiWX, yongWX: yongWX,
      rel: rel, qi: qi, yueWX: yueWX, yueZhi: parts.yueZhi,
      src: parts.src, method: parts.method
    };
    renderMeihua();
  });

  var REL_CLS = { "吉": "good", "平": "mid", "凶": "bad" };

  function renderMeihua() {
    var R = mhState.res, Y = R.Y;
    var r = REL[R.rel] || { name: "—", tend: "平", text: "" };
    var ti = baguaOf(R.tiK), yo = baguaOf(R.yongK);
    var html = "";
    // 起卦依据
    html += '<div class="mh-src"><h4>— 起 卦 —</h4>' +
      '<div class="mline">' + R.src + "</div>" +
      '<div class="mline muted">动爻：' + YAO_POS[R.mvIdx] + "（" + Y[R.mvIdx].name + " " + Y[R.mvIdx].mk + "）· " +
      esc(YAO_NOTE[R.mvIdx] || "") + "</div>" +
      '<div class="mline muted">' + esc(METHOD[R.method] || "") + "</div></div>";

    // 体用
    html += '<div class="mh-rel ' + (REL_CLS[r.tend] || "mid") + '">' +
      '<div><div class="nm">' + esc(r.name) + "</div>" +
      '<div class="sub">体 ' + esc(ti.name + ti.xiang) + "（" + R.tiWX + "） · 用 " + esc(yo.name + yo.xiang) + "（" + R.yongWX + "）</div></div>" +
      '<div class="tag">' + esc(r.tend) + "</div></div>" +
      '<div class="bz-item"><b>体用关系 · ' + esc(r.name) + "</b><p>" + esc(r.text) + "</p></div>" +
      '<div class="bz-item"><b>卦气 · ' + esc(R.qi) + "</b><p>月令属" + esc(R.yueWX) + "，体卦" + esc(R.tiWX) + "当" + esc(R.qi) + "：" + esc(QI[R.qi] || "") + "</p></div>";

    // 本卦 / 互卦 / 变卦
    html += guaBlock(R.ben, Y, "本卦 · 当下", true);
    html += '<div class="mh-stage">' + esc(STAGE.ben) + "</div>";
    html += '<div class="bz-item"><b>卦象直读</b><p>外「' + esc((LEI[R.ben.up] || {}).xiang || "—") + "」内「" +
      esc((LEI[R.ben.down] || {}).xiang || "—") + "」：" +
      esc(((LEI[R.ben.up] || {}).lei || []).slice(0, 3).join("、")) + " 显于外，" +
      esc(((LEI[R.ben.down] || {}).lei || []).slice(0, 3).join("、")) + " 藏于内。</p></div>";

    html += guaBlock(R.hu, R.huYaos, "互卦 · 过程", false);
    html += '<div class="mh-stage">' + esc(STAGE.hu) +
      (R.hu ? "互卦为「" + esc(R.hu.name) + "」，中途的走向偏" + esc(R.hu.tend) + "。" : "") + "</div>";

    html += guaBlock(R.bian, R.bYaos, "变卦 · 结果", false);
    html += '<div class="mh-stage">' + esc(STAGE.bian) +
      (R.bian ? "变卦为「" + esc(R.bian.name) + "」，落点偏" + esc(R.bian.tend) + "。" : "") + "</div>";

    // 综合
    var rk = REL[R.rel] || {};
    var sum;
    if (R.rel === "bihe" || R.rel === "yongshengti") {
      sum = "体卦" + R.tiWX + "、用卦" + R.yongWX + "，落在「" + rk.name + "」上——这局站在你这边。";
    } else if (R.rel === "tikejong") {
      sum = "体卦" + R.tiWX + "克用卦" + R.yongWX + "，主动权在你手里，但这局要你自己动手才拿得到。";
    } else if (R.rel === "tishengyong") {
      sum = "体卦" + R.tiWX + "生用卦" + R.yongWX + "，你在持续投入。事能成，代价是你的精力，记得留一手给自己。";
    } else {
      sum = "用卦" + R.yongWX + "克体卦" + R.tiWX + "，外部在压制你。这一局硬来不划算，减损、等待、换路径都算应对。";
    }
    sum += "卦气" + R.qi + "，" + (QI[R.qi] || "");
    if (R.bian) sum += "结局落在「" + R.bian.name + "」。";
    sum += "　" + NOTE;

    html += '<div class="ly-note" style="margin-top:12px"><h4>— 综 合 —</h4>' + esc(sum) + "</div>" +
      '<div class="result-actions" style="margin-top:12px">' +
        '<button class="btn ai-btn" id="btn-mh-ai">AI 解读（灵感视角）</button>' +
      "</div>" +
      '<div class="ai-box" id="mh-ai-box" style="display:none"></div>' +
      '<div class="result-actions" style="margin-top:14px">' +
        '<button class="btn gold" id="btn-mh-save">存入历史</button>' +
        '<button class="btn ghost" id="btn-mh-again">重新起卦</button>' +
      "</div>" +
      '<p class="gen-note">梅花易数以象推事 · 仅供娱乐与自我探索</p>';

    $("mh-result").innerHTML = html;
    $("btn-mh-save").addEventListener("click", saveMeihua);
    $("btn-mh-again").addEventListener("click", function () {
      $("mh-result").innerHTML = "";
      window.scrollTo(0, 0);
    });
    // AI 解读：传卦名与体用关系，不传吉凶趋势
    if (window.WenxingOracleAI) {
      window.WenxingOracleAI.attach({
        btnId: "btn-mh-ai",
        boxId: "mh-ai-box",
        kind: "meihua",
        question: function () { return mhState.question; },
        data: function () {
          return {
            ben: R.ben ? R.ben.name : "",
            hu: R.hu ? R.hu.name : "",
            bian: R.bian ? R.bian.name : "",
            tiWX: R.tiWX,
            yongWX: R.yongWX,
            relName: (REL[R.rel] || {}).name || ""
          };
        },
        fallback: sum
      });
    }
    $("mh-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveMeihua() {
    var R = mhState.res;
    if (!R) return;
    var rec = {
      t: Date.now(), q: mhState.question,
      method: R.method,
      ben: R.ben ? R.ben.name : "—",
      hu: R.hu ? R.hu.name : "—",
      bian: R.bian ? R.bian.name : "—",
      rel: (REL[R.rel] || {}).name || "—",
      tend: (REL[R.rel] || {}).tend || "平",
      mv: R.mvIdx
    };
    var list = load();
    list.unshift(rec);
    if (saveList(list)) {
      $("btn-mh-save").disabled = true;
      $("btn-mh-save").textContent = "已存入 ✓";
      renderMhHistory();
    } else {
      toast("保存失败：本机存储不可用");
    }
  }

  function renderMhHistory() {
    var list = load();
    var box = $("mh-history");
    var block = $("mh-history-block");
    box.innerHTML = "";
    block.style.display = list.length ? "block" : "none";
    list.forEach(function (rec, i) {
      var el = document.createElement("div");
      el.className = "bz-hist";
      el.innerHTML =
        '<div class="r1"><span class="nm">' + esc(rec.ben) + " → " + esc(rec.bian) + "</span>" +
        '<span class="tm">' + fmtTime(rec.t) + "</span></div>" +
        '<div class="pz">' + esc(rec.rel) + " · 互" + esc(rec.hu) + " · " + esc(YAO_POS[rec.mv]) + "动</div>" +
        '<div style="font-size:12.5px;color:#a49dc2;margin-top:5px">' + (rec.q ? "「" + esc(rec.q) + "」" : "（默想）") + "</div>" +
        '<div class="ops"><button data-i="' + i + '">删除</button></div>';
      el.querySelector("button").addEventListener("click", function () {
        var l = load();
        l.splice(i, 1);
        saveList(l);
        renderMhHistory();
      });
      box.appendChild(el);
    });
  }
  renderMhHistory();
  $("btn-clear-mh").addEventListener("click", function () {
    if (confirm("确定清空全部梅花卦记录吗？此操作不可恢复。")) {
      localStorage.removeItem(MH_KEY);
      renderMhHistory();
    }
  });

})();
