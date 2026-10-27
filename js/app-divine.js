// 问星 · 问事起卦（古法灵签 / 六爻）
// 纯前端：不上传、不收集，记录仅存 localStorage
(function () {
  "use strict";

  var QIAN = (window.QIAN_1 || []).concat(window.QIAN_2 || []);
  var GUA = window.LIUYAO_GUA || [];
  var BAGUA = window.BAGUA || [];
  var YAO_NOTE = window.YAO_NOTE || [];

  var QIAN_KEY = "wenxing_qian_history";
  var LY_KEY = "wenxing_liuyao_history";

  // ---------- 工具 ----------
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
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
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
  function load(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function save(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list.slice(0, 50))); return true; }
    catch (e) { return false; }
  }

  // =========================================================
  // 一、古法灵签
  // =========================================================
  var LEVEL_TEXT = {
    "上上": "签面极好，气势正盛。好签给的是底气，不是免考证——趁着这股劲把事推起来，才不辜负它。",
    "上吉": "大方向是顺的，可放心往前走。顺境里最容易松懈，保持节奏比猛冲更重要。",
    "中吉": "事情可为，但需要你主动推一把。等不来结果，做了才有下文。",
    "中平": "平顺之签，无大起也无大落。此时守常即是进，把手里的事做扎实就够。",
    "下下": "签面偏沉，是在提醒你慢下来。此时宜守不宜攻，避开硬碰，等局面松动再动。"
  };
  var LEVEL_CLASS = { "上上": "", "上吉": "", "中吉": "lv-mid", "中平": "lv-mid", "下下": "lv-bad" };

  var qianState = { question: "", n: 0, q: null, saved: false };

  // 提问输入
  var qianInput = $("qian-q");
  qianInput.addEventListener("input", function () {
    $("qian-counter").textContent = qianInput.value.length + "/60";
  });
  Array.prototype.forEach.call($("qian-chips").querySelectorAll(".chip"), function (chip) {
    chip.addEventListener("click", function () {
      qianInput.value = chip.textContent;
      qianInput.dispatchEvent(new Event("input"));
    });
  });

  // 摇签
  var tube = $("qian-tube");
  tube.addEventListener("click", function () {
    if (tube.classList.contains("shaking")) return;
    var asked = qianInput.value.trim();
    // 必须先写下问题：签文要落到具体的事上才读得懂，空手摇签只会得到一段泛泛的韵文
    if (!asked) {
      toast("先把想问的事写下来，再摇签");
      try { qianInput.focus(); } catch (e) {}
      return;
    }
    qianState.question = asked;
    qianState.saved = false;
    $("qian-result").innerHTML = "";

    tube.classList.add("shaking");
    $("qian-status").innerHTML = "签筒摇动中…<b>想着你写下的那件事</b>";

    setTimeout(function () {
      tube.classList.remove("shaking");
      var n = 1 + Math.floor(Math.random() * Math.max(QIAN.length, 1));
      var q = QIAN.filter(function (x) { return x.n === n; })[0] || QIAN[0];
      qianState.n = n;
      qianState.q = q;
      renderQian(q);
    }, 1500);
  });

  function renderQian(q) {
    var box = $("qian-result");
    var lines = q.p.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    var lvCls = LEVEL_CLASS[q.l] || "";
    box.innerHTML =
      '<div class="qian-card">' +
        '<div class="qhead">' +
          '<div class="no">第 ' + q.n + ' 签</div>' +
          '<div class="lv ' + lvCls + '">' + esc(q.l) + "</div>" +
          '<div class="topic">主题 · ' + esc(q.t) + "</div>" +
        "</div>" +
        '<div class="qian-poem">' + lines + "</div>" +
        '<div class="jie"><h4>— 解 曰 —</h4>' + esc(q.j) + "</div>" +
        '<div class="jie" style="margin-top:10px"><h4>— 提 示 —</h4>' + esc(LEVEL_TEXT[q.l] || "") + "</div>" +
        '<div class="result-actions" style="margin-top:12px">' +
          '<button class="btn ai-btn" id="btn-qian-ai">AI 解读（灵感视角）</button>' +
        "</div>" +
        '<div class="ai-box" id="qian-ai-box" style="display:none"></div>' +
        '<div class="result-actions" style="margin-top:14px">' +
          '<button class="btn gold" id="btn-qian-save">存入历史</button>' +
          '<button class="btn ghost" id="btn-qian-again">再摇一次</button>' +
        "</div>" +
        '<p class="gen-note">签文为传统劝善韵文 · 仅供娱乐与自我探索</p>' +
      "</div>";

    $("qian-status").innerHTML = "签已落定 · <b>第 " + q.n + " 签</b>";
    // 出签后停掉静止轻摇，不然结果页一直在动
    tube.classList.add("done");
    $("btn-qian-save").addEventListener("click", saveQian);
    $("btn-qian-again").addEventListener("click", function () {
      $("qian-result").innerHTML = "";
      $("qian-status").innerHTML = "写下想问的事，再<b>点击签筒</b>摇出一支签";
      tube.classList.remove("done");
      window.scrollTo(0, 0);
    });
    // AI 解读：只上传签诗与解曰，不上传吉凶等级，避免模型据此下判定
    if (window.WenxingOracleAI) {
      window.WenxingOracleAI.attach({
        btnId: "btn-qian-ai",
        boxId: "qian-ai-box",
        kind: "qian",
        question: function () { return qianState.question; },
        data: function () {
          return { no: q.n, topic: q.t, poem: q.p, note: q.j };
        },
        fallback: (q.j || "") + " " + (LEVEL_TEXT[q.l] || "")
      });
    }
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveQian() {
    var q = qianState.q;
    if (!q) return;
    var rec = { t: Date.now(), q: qianState.question, n: q.n, l: q.l, topic: q.t };
    var list = load(QIAN_KEY);
    list.unshift(rec);
    if (save(QIAN_KEY, list)) {
      $("btn-qian-save").disabled = true;
      $("btn-qian-save").textContent = "已存入 ✓";
      renderQianHistory();
    } else {
      toast("保存失败：本机存储不可用");
    }
  }

  function renderQianHistory() {
    var list = load(QIAN_KEY);
    var box = $("qian-history");
    var block = $("qian-history-block");
    box.innerHTML = "";
    block.style.display = list.length ? "block" : "none";
    list.forEach(function (rec, i) {
      var el = document.createElement("div");
      el.className = "bz-hist";
      el.innerHTML =
        '<div class="r1"><span class="nm">第 ' + rec.n + ' 签 · ' + esc(rec.l) + '</span><span class="tm">' + fmtTime(rec.t) + "</span></div>" +
        '<div class="pz">主题：' + esc(rec.topic) + "</div>" +
        '<div style="font-size:12.5px;color:#a49dc2;margin-top:5px">' + (rec.q ? "「" + esc(rec.q) + "」" : "（默想）") + "</div>" +
        '<div class="ops"><button data-i="' + i + '">删除</button></div>';
      el.querySelector("button").addEventListener("click", function () {
        var l = load(QIAN_KEY);
        l.splice(i, 1);
        save(QIAN_KEY, l);
        renderQianHistory();
      });
      box.appendChild(el);
    });
  }
  renderQianHistory();
  $("btn-clear-qian").addEventListener("click", function () {
    if (confirm("确定清空全部签文记录吗？此操作不可恢复。")) {
      localStorage.removeItem(QIAN_KEY);
      renderQianHistory();
    }
  });

  // =========================================================
  // 二、六爻
  // =========================================================
  // 三枚铜钱：背（阳）记 1，字（阴）记 0
  // 三背=老阳（阳动○） 二背=少阴（阴静） 一背=少阳（阳静） 无背=老阴（阴动×）
  var COIN_TYPE = [
    null,
    { name: "少阳", yang: 1, mv: false, mk: "", sym: "—" },   // 1 背
    { name: "少阴", yang: 0, mv: false, mk: "", sym: "- -" }, // 2 背
    { name: "老阳", yang: 1, mv: true, mk: "○", sym: "—" },   // 3 背
    { name: "老阴", yang: 0, mv: true, mk: "×", sym: "- -" }  // 0 背 → 索引 0 未用，单独处理
  ];
  function typeOf(backs) {
    if (backs === 3) return COIN_TYPE[3];
    if (backs === 2) return COIN_TYPE[2];
    if (backs === 1) return COIN_TYPE[1];
    return { name: "老阴", yang: 0, mv: true, mk: "×", sym: "- -" };
  }
  var YAO_POS = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"];

  // 三爻成卦：初爻为高位（先天八卦二进制 000坤 → 111乾）
  function trigram(a, b, c) {
    var v = (a ? 4 : 0) + (b ? 2 : 0) + (c ? 1 : 0);
    return 8 - v; // 1乾 2兑 3离 4震 5巽 6坎 7艮 8坤
  }
  function baguaOf(k) {
    for (var i = 0; i < BAGUA.length; i++) if (BAGUA[i].k === k) return BAGUA[i];
    return { k: k, name: "?", xiang: "?", xing: "?" };
  }
  function findGua(up, down) {
    for (var i = 0; i < GUA.length; i++) if (GUA[i].up === up && GUA[i].down === down) return GUA[i];
    return null;
  }

  var lyState = { question: "", yaos: [], busy: false, saved: false };

  var lyInput = $("ly-q");
  lyInput.addEventListener("input", function () {
    $("ly-counter").textContent = lyInput.value.length + "/60";
  });
  Array.prototype.forEach.call($("ly-chips").querySelectorAll(".chip"), function (chip) {
    chip.addEventListener("click", function () {
      lyInput.value = chip.textContent;
      lyInput.dispatchEvent(new Event("input"));
    });
  });

  function resetLiuyao() {
    lyState.yaos = [];
    lyState.saved = false;
    $("ly-yaos").innerHTML = "";
    $("ly-result").innerHTML = "";
    $("btn-ly-roll").style.display = "block";
    $("btn-ly-roll").textContent = "摇第 1 爻";
    $("btn-ly-roll").disabled = false;
    $("ly-status").innerHTML = "共需摇 <b>6</b> 次，自下而上依次成爻";
    Array.prototype.forEach.call($("ly-coins").querySelectorAll(".coin"), function (c) {
      c.className = "coin"; c.textContent = "字";
    });
  }

  // 摇一爻
  $("btn-ly-roll").addEventListener("click", function () {
    if (lyState.busy) return;
    lyState.busy = true;
    lyState.question = lyInput.value.trim();
    var btn = $("btn-ly-roll");
    btn.disabled = true;
    var idx = lyState.yaos.length;

    var coins = $("ly-coins").querySelectorAll(".coin");
    Array.prototype.forEach.call(coins, function (c) {
      c.classList.add("rolling");
      c.textContent = "";
    });
    $("ly-status").innerHTML = "铜钱落下…<b>第 " + (idx + 1) + " 爻</b>";

    setTimeout(function () {
      var backs = 0;
      Array.prototype.forEach.call(coins, function (c) {
        var isBack = Math.random() < 0.5;
        if (isBack) backs++;
        c.classList.remove("rolling");
        c.className = "coin" + (isBack ? " back" : "");
        c.textContent = isBack ? "背" : "字";
      });
      var tp = typeOf(backs);
      lyState.yaos.push(tp);
      renderYao(idx, tp);
      lyState.busy = false;

      if (lyState.yaos.length < 6) {
        btn.disabled = false;
        btn.textContent = "摇第 " + (lyState.yaos.length + 1) + " 爻";
        $("ly-status").innerHTML = "已摇 <b>" + lyState.yaos.length + "</b> 爻 · 再摇 <b>" + (6 - lyState.yaos.length) + "</b> 次";
      } else {
        btn.style.display = "none";
        $("ly-status").innerHTML = "六爻已成 · <b>查看卦象</b>";
        renderLiuyaoResult();
      }
    }, 780);
  });

  function renderYao(idx, tp) {
    var stack = $("ly-yaos");
    var el = document.createElement("div");
    el.className = "yao-item";
    var sym = tp.yang
      ? '<i class="yang"></i>'
      : '<i class="yin"></i><i class="yin"></i>';
    el.innerHTML =
      '<span class="pos">' + YAO_POS[idx] + "</span>" +
      '<span class="sym">' + sym + "</span>" +
      '<span class="txt' + (tp.mv ? " moving" : "") + '">' + tp.name + (tp.mv ? " " + tp.mk : "") + "</span>";
    stack.insertBefore(el, stack.firstChild); // 自下而上：新爻插在顶部
  }

  function guaFig(yaos, marks) {
    var rows = "";
    for (var i = 5; i >= 0; i--) {
      var y = yaos[i];
      var mk = (marks && y.mv) ? y.mk : "";
      var inner = y.yang
        ? '<i class="' + (mk ? "mk" : "") + '"' + (mk ? ' data-mk="' + mk + '"' : "") + "></i>"
        : '<i class="' + (mk ? "mk" : "") + '"' + (mk ? ' data-mk="' + mk + '"' : "") + "></i><i></i>";
      rows += '<div class="yrow">' + inner + "</div>";
    }
    return '<div class="gua-fig">' + rows + "</div>";
  }

  function guaBlock(g, yaos, title, marks) {
    if (!g) return '<div class="gua-block"><div class="gt">卦象未收录</div></div>';
    var up = baguaOf(g.up), dn = baguaOf(g.down);
    return '<div class="gua-block">' +
      '<div class="gt">' + esc(g.name) + "　<span style=\"font-size:11px;color:#a49dc2\">" + esc(title) + "</span></div>" +
      '<div class="gs">第 ' + g.no + " 卦 · 上" + esc(up.xiang) + "下" + esc(dn.xiang) +
        " · " + esc(up.name + up.xiang) + "／" + esc(dn.name + dn.xiang) + "</div>" +
      guaFig(yaos, marks) +
      '<div class="ci">「' + esc(g.ci) + "」</div>" +
      '<div class="jie">' + esc(g.jie) + "</div>" +
      "</div>";
  }

  function renderLiuyaoResult() {
    var Y = lyState.yaos;
    var downK = trigram(Y[0].yang, Y[1].yang, Y[2].yang);
    var upK = trigram(Y[3].yang, Y[4].yang, Y[5].yang);
    var ben = findGua(upK, downK);

    var moved = [];
    Y.forEach(function (y, i) { if (y.mv) moved.push(i); });
    var bian = null, bianYaos = null;
    if (moved.length) {
      bianYaos = Y.map(function (y) {
        return { yang: y.mv ? (y.yang ? 0 : 1) : y.yang, mv: false, mk: "", name: y.name };
      });
      var bDown = trigram(bianYaos[0].yang, bianYaos[1].yang, bianYaos[2].yang);
      var bUp = trigram(bianYaos[3].yang, bianYaos[4].yang, bianYaos[5].yang);
      bian = findGua(bUp, bDown);
    }

    // 动爻提示
    var mvHtml = "";
    if (moved.length === 0) {
      mvHtml = '<div class="ly-note"><h4>— 动 爻 —</h4>六爻皆静，没有动爻。事态相对稳定，照本卦的走势走即可，不必自己加戏。</div>';
    } else {
      var items = moved.map(function (i) {
        return '<div style="padding:5px 0;line-height:1.8"><b style="color:#c4bbff">' + YAO_POS[i] + "</b>（" +
          Y[i].name + " " + Y[i].mk + "）：" + esc(YAO_NOTE[i] || "") + "</div>";
      }).join("");
      var head = moved.length >= 3
        ? "动爻多达 " + moved.length + " 个，事情正在剧烈变化，此时任何结论都只是快照，等尘埃落定再判断更稳。"
        : "变化的关节在下面这几爻，把注意力放在这里：";
      mvHtml = '<div class="ly-note"><h4>— 动 爻 · ' + moved.length + " 个 —</h4>" + esc(head) +
        '<div style="margin-top:6px">' + items + "</div></div>";
    }

    // 综合
    var trendTxt = { "吉": "整体偏吉，顺势而为更省力", "中": "吉凶参半，宜稳不宜急", "凶": "阻力偏大，宜守宜退、先减损" };
    var sum = "本卦「" + (ben ? ben.name : "—") + "」，" + (trendTxt[ben && ben.tend] || "") + "。";
    if (moved.length === 0) {
      sum += "六爻安静，短期内不会有大的转折，把手上的事做扎实就是最好的应对。";
    } else if (bian) {
      sum += "有 " + moved.length + " 个动爻，事情会从本卦走向之卦「" + bian.name +
        "」——变化是确定的，方向写在之卦里，别拿本卦的状态当终点。";
    }
    sum += "　卦象是古人观察变化的模型，告诉你的是「势」与「位」，怎么走仍在你手里。";

    $("ly-result").innerHTML =
      guaBlock(ben, Y, "本卦", true) +
      (bian ? guaBlock(bian, bianYaos, "之卦（变后）", false) : "") +
      mvHtml +
      '<div class="ly-note" style="margin-top:12px"><h4>— 综 合 —</h4>' + esc(sum) + "</div>" +
      '<div class="result-actions" style="margin-top:12px">' +
        '<button class="btn ai-btn" id="btn-ly-ai">AI 解读（灵感视角）</button>' +
      "</div>" +
      '<div class="ai-box" id="ly-ai-box" style="display:none"></div>' +
      '<div class="result-actions" style="margin-top:14px">' +
        '<button class="btn gold" id="btn-ly-save">存入历史</button>' +
        '<button class="btn ghost" id="btn-ly-again">重新摇卦</button>' +
      "</div>" +
      '<p class="gen-note">卦象与卦辞源自《周易》 · 仅供娱乐与自我探索</p>';

    $("btn-ly-save").addEventListener("click", saveLiuyao);
    $("btn-ly-again").addEventListener("click", function () {
      resetLiuyao();
      window.scrollTo(0, 0);
    });
    // AI 解读：传本卦 / 之卦 / 动爻辞意，不传吉凶趋势
    if (window.WenxingOracleAI) {
      window.WenxingOracleAI.attach({
        btnId: "btn-ly-ai",
        boxId: "ly-ai-box",
        kind: "liuyao",
        question: function () { return lyState.question; },
        data: function () {
          return {
            ben: ben ? ben.name : "",
            bian: bian ? bian.name : "",
            moving: moved.map(function (i) { return YAO_POS[i]; }),
            yaoNotes: moved.map(function (i) {
              return YAO_POS[i] + "（" + Y[i].name + " " + Y[i].mk + "）：" + (YAO_NOTE[i] || "");
            })
          };
        },
        fallback: sum
      });
    }
    $("ly-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveLiuyao() {
    var Y = lyState.yaos;
    if (Y.length < 6) return;
    var downK = trigram(Y[0].yang, Y[1].yang, Y[2].yang);
    var upK = trigram(Y[3].yang, Y[4].yang, Y[5].yang);
    var ben = findGua(upK, downK);
    var rec = {
      t: Date.now(),
      q: lyState.question,
      ben: ben ? ben.name : "—",
      tend: ben ? ben.tend : "中",
      mv: Y.map(function (y, i) { return y.mv ? i : -1; }).filter(function (i) { return i >= 0; })
    };
    var list = load(LY_KEY);
    list.unshift(rec);
    if (save(LY_KEY, list)) {
      $("btn-ly-save").disabled = true;
      $("btn-ly-save").textContent = "已存入 ✓";
      renderLyHistory();
    } else {
      toast("保存失败：本机存储不可用");
    }
  }

  function renderLyHistory() {
    var list = load(LY_KEY);
    var box = $("ly-history");
    var block = $("ly-history-block");
    box.innerHTML = "";
    block.style.display = list.length ? "block" : "none";
    list.forEach(function (rec, i) {
      var el = document.createElement("div");
      el.className = "bz-hist";
      var mv = (rec.mv && rec.mv.length)
        ? rec.mv.map(function (k) { return YAO_POS[k]; }).join("、") + " 动"
        : "六爻安静";
      el.innerHTML =
        '<div class="r1"><span class="nm">' + esc(rec.ben) + "　<span style=\"color:#a49dc2;font-size:12px\">" + esc(rec.tend) + "</span></span>" +
        '<span class="tm">' + fmtTime(rec.t) + "</span></div>" +
        '<div class="pz">' + esc(mv) + "</div>" +
        '<div style="font-size:12.5px;color:#a49dc2;margin-top:5px">' + (rec.q ? "「" + esc(rec.q) + "」" : "（默想）") + "</div>" +
        '<div class="ops"><button data-i="' + i + '">删除</button></div>';
      el.querySelector("button").addEventListener("click", function () {
        var l = load(LY_KEY);
        l.splice(i, 1);
        save(LY_KEY, l);
        renderLyHistory();
      });
      box.appendChild(el);
    });
  }
  renderLyHistory();
  $("btn-clear-ly").addEventListener("click", function () {
    if (confirm("确定清空全部卦象记录吗？此操作不可恢复。")) {
      localStorage.removeItem(LY_KEY);
      renderLyHistory();
    }
  });

})();
