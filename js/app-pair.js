// js/app-pair.js —— 双人合盘（好友助力）
//
// 玩法：关系之镜抽完先不解锁「关系解读」，把邀请链接发给 TA；
// TA 用同一个问题也抽一次，两边都抽完，合盘解读才对双方开放。
//
// 为什么要有服务端：跨设备握手没法只靠前端。房间只存「问题 + 牌面」，
// 24 小时过期，不存 IP、不存 UA、不存任何能定位到人的东西（见 ai-proxy/pair.js）。
(function () {
  "use strict";

  var ROOMS_KEY = "wenxing_pair_rooms";   // 我发起的合盘（含我的牌面，只存本机）
  var API_TIMEOUT = 9000;
  var NAME_MAP = null;

  var joining = null;   // 正在加入的房间：{ code, spread, question, spreadName }
  var current = null;   // 当前展示的房间数据

  function $(id) { return document.getElementById(id); }
  function toast(m) { if (window.AppView && window.AppView.toast) window.AppView.toast(m); }
  function showView(n) { if (window.AppView) window.AppView.show(n); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // location 在脚本加载阶段就该拿得到，但校验脚本（linkedom）里没有。
  // 直接裸写在 boot() 里抛错会打断后续逻辑，所以统一从这里取。
  function search() {
    try { return (typeof location !== "undefined" && location.search) || ""; } catch (e) { return ""; }
  }

  function siteUrl() {
    try {
      if (typeof location === "undefined" || !location.origin) return "/";
      return location.origin + location.pathname.replace(/[^/]*$/, "");
    } catch (e) { return "/"; }
  }

  function cardNo(n) { return n == null ? "" : n; }

  function nameToCard(name) {
    if (!NAME_MAP) {
      NAME_MAP = {};
      (window.TAROT_MAJOR || []).concat(window.TAROT_MINOR || []).forEach(function (c) {
        NAME_MAP[c.name] = c;
      });
    }
    return NAME_MAP[name] || null;
  }

  // ---------- 本地记录（只在本机，用于「我发起过哪些合盘」） ----------
  function myRooms() {
    try { return JSON.parse(localStorage.getItem(ROOMS_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveRoom(room) {
    var list = myRooms().filter(function (r) { return r.code !== room.code; });
    list.unshift(room);
    try { localStorage.setItem(ROOMS_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) {}
  }
  function findRoom(code) {
    return myRooms().filter(function (r) { return r.code === code; })[0] || null;
  }
  function isMine(code) { return !!findRoom(code); }

  // ---------- 接口 ----------
  function api(path, body) {
    var opt = { method: body ? "POST" : "GET", headers: {} };
    if (body) {
      opt.headers["Content-Type"] = "application/json";
      opt.body = JSON.stringify(body);
    }
    var timer = null;
    var timeout = new Promise(function (_, rej) {
      timer = setTimeout(function () { rej(new Error("timeout")); }, API_TIMEOUT);
    });
    return Promise.race([
      fetch(path, opt).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j && j.error ? j.error : ("HTTP " + r.status));
          return j;
        });
      }),
      timeout
    ]).then(function (v) { clearTimeout(timer); return v; },
      function (e) { clearTimeout(timer); throw e; });
  }

  // ---------- 结果页：合盘入口 ----------
  // 只有关系之镜（五牌）适合合盘：它本来就有「对方怎么想」这一位。
  var PAIRABLE = { relation: 1, three: 1, choice: 1 };

  function mountResult(ctx) {
    var box = $("pair-block");
    if (!box) return;
    current = null;
    if (!PAIRABLE[ctx.spreadKey]) { box.style.display = "none"; return; }
    box.style.display = "block";

    // 之前发起过、但还没完成的合盘，回到页面时还能接着看
    var mine = myRooms().filter(function (r) {
      return r.spread === ctx.spreadKey && r.question === ctx.question;
    })[0];

    if (mine) {
      box.innerHTML = pairWaitingHtml(mine);
      bindWaiting(mine.code);
      checkState(mine.code);
      return;
    }

    box.innerHTML =
      '<div class="pair-head"><b>双人合盘</b><span class="pair-tag">好友助力</span></div>' +
      '<p class="pair-desc">关系里的另一半想法，单方面抽牌看不全。把链接发给 TA，' +
        '<b>TA 用同一个问题也抽一次</b>，双方都抽完才会解锁「关系解读」。</p>' +
      '<button class="btn gold" id="btn-pair-create">生成邀请链接</button>' +
      '<button class="btn ghost pair-enter" id="btn-pair-enter">我有邀请码</button>' +
      '<p class="pair-note">合盘会把<b>问题与双方牌面</b>暂存在服务器 24 小时用于配对，不带任何个人信息，到期自动删除。</p>';
    $("btn-pair-create").addEventListener("click", function () { createInvite(ctx); });
    $("btn-pair-enter").addEventListener("click", promptCode);
  }

  function pairWaitingHtml(room) {
    return '<div class="pair-head"><b>双人合盘</b><span class="pair-tag">等待对方</span></div>' +
      '<p class="pair-desc">邀请已生成，等 TA 抽完就能看合盘解读。</p>' +
      '<div class="pair-code-line">邀请码 <b>' + esc(room.code) + '</b></div>' +
      '<button class="btn gold" id="btn-pair-check">查看合盘结果</button>' +
      '<button class="btn ghost" id="btn-pair-reinvite">重新发送邀请</button>';
  }

  function bindWaiting(code) {
    var chk = $("btn-pair-check");
    if (chk) chk.addEventListener("click", function () { checkState(code, true); });
    var again = $("btn-pair-reinvite");
    if (again) again.addEventListener("click", function () {
      var room = findRoom(code);
      if (!room) return;
      showInvitePanel(room);
    });
  }

  function createInvite(ctx) {
    var btn = $("btn-pair-create");
    btn.disabled = true;
    btn.textContent = "生成中…";
    api("/pair/create", {
      spread: ctx.spreadKey,
      spreadName: ctx.spreadName,
      question: ctx.question,
      cards: ctx.picked.map(function (c) {
        return { name: c.name, orientation: c.orientation, keywords: c.keywords, gist: c.gist };
      })
    }).then(function (r) {
      saveRoom({
        code: r.code,
        spread: ctx.spreadKey,
        spreadName: ctx.spreadName,
        question: ctx.question,
        createdAt: Date.now()
      });
      showInvitePanel({ code: r.code, question: ctx.question });
      var box = $("pair-block");
      if (box) {
        box.innerHTML = pairWaitingHtml({ code: r.code });
        bindWaiting(r.code);
      }
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = "生成邀请链接";
      toast(e.message === "timeout" ? "服务器没响应，稍后再试" : ("生成失败：" + e.message));
    });
  }

  // ---------- 邀请面板（链接 + 邀请码 + 二维码） ----------
  function showInvitePanel(room) {
    var url = siteUrl() + "?pair=" + encodeURIComponent(room.code);
    var mask = $("pair-mask");
    if (!mask) {
      mask = document.createElement("div");
      mask.className = "share-mask";
      mask.id = "pair-mask";
      mask.innerHTML =
        '<div class="share-panel">' +
          '<div class="share-head"><b>把邀请发给 TA</b><button class="share-x" id="pair-x">✕</button></div>' +
          '<div class="share-body" id="pair-body"></div>' +
          '<p class="share-tip">对方打开链接（或扫码）后，用<b>同一个问题</b>抽一次即可合盘。</p>' +
          '<div class="share-actions"><button class="btn ghost" id="pair-copy">复制链接</button>' +
          '<button class="btn gold" id="pair-ok">好了</button></div>' +
        "</div>";
      document.body.appendChild(mask);
      mask.addEventListener("click", function (e) { if (e.target === mask) mask.classList.remove("show"); });
      mask.querySelector("#pair-x").addEventListener("click", function () { mask.classList.remove("show"); });
      mask.querySelector("#pair-ok").addEventListener("click", function () { mask.classList.remove("show"); });
    }
    var qrBox = "";
    try {
      var m = window.WenxingQR.matrix(url);
      qrBox = '<canvas id="pair-qr" class="pair-qr"></canvas>';
      mask.querySelector("#pair-body").innerHTML =
        '<div class="pair-invite-q">「' + esc(room.question || "") + "」</div>" +
        '<div class="pair-qr-wrap">' + qrBox + "</div>" +
        '<div class="pair-code-line">邀请码 <b>' + esc(room.code) + "</b></div>" +
        '<div class="pair-url">' + esc(url) + "</div>";
      // 画二维码
      var cv = mask.querySelector("#pair-qr");
      var q = 176, unit = q / (m.size + 8);
      cv.width = q; cv.height = q;
      cv.style.width = q + "px"; cv.style.height = q + "px";
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, q, q);
      ctx.fillStyle = "#140d2b";
      for (var y = 0; y < m.size; y++) {
        for (var x = 0; x < m.size; x++) {
          if (m.cells[y][x]) {
            ctx.fillRect((x + 4) * unit, (y + 4) * unit, Math.ceil(unit), Math.ceil(unit));
          }
        }
      }
    } catch (e) {
      mask.querySelector("#pair-body").innerHTML =
        '<div class="pair-code-line">邀请码 <b>' + esc(room.code) + "</b></div>" +
        '<div class="pair-url">' + esc(url) + "</div>";
    }
    var copy = mask.querySelector("#pair-copy");
    copy.onclick = function () {
      var text = url;
      var ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch (e) {}
      if (!ok) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); ok = true; } catch (e2) {}
        document.body.removeChild(ta);
      }
      copy.textContent = ok ? "已复制" : "复制失败，请长按链接";
      setTimeout(function () { copy.textContent = "复制链接"; }, 1600);
    };
    mask.classList.add("show");
  }

  // ---------- 查询房间状态 ----------
  function checkState(code, manual) {
    api("/pair/state?code=" + encodeURIComponent(code) + "&full=1").then(function (r) {
      if (!r || !r.found) { if (manual) toast("邀请不存在或已过期"); return; }
      if (!r.room.done) { if (manual) toast("TA 还没抽完，稍后再看"); return; }
      showPairResult(r.room);
    }).catch(function (e) {
      if (manual) toast(e.message === "timeout" ? "服务器没响应" : ("查询失败：" + e.message));
    });
  }

  // ---------- 加入：?pair=CODE ----------
  function openFromUrl() {
    var m = /[?&]pair=([A-Za-z0-9]+)/.exec(search());
    if (!m) return false;
    var code = m[1].toUpperCase();
    api("/pair/state?code=" + encodeURIComponent(code) + "&full=1").then(function (r) {
      if (!r || !r.found) {
        showInviteDead("链接已失效", "这个合盘邀请不存在，或者已经超过 24 小时。可以让 TA 重新发一次。");
        return;
      }
      if (r.room.done) { showPairResult(r.room); return; }
      showJoinInvite(r.room);
    }).catch(function () {
      showInviteDead("暂时打不开合盘", "连不上服务器。合盘需要联网，稍后再试一次。");
    });
    return true;
  }

  function showJoinInvite(room) {
    var view = $("view-pair");
    view.innerHTML = pairNav("双人合盘") +
      '<div class="pair-invite">' +
        '<div class="pair-invite-icon">✦</div>' +
        '<h3>有人想和你合一次盘</h3>' +
        '<p class="pair-invite-q">「' + esc(room.question) + "」</p>" +
        '<p class="hint" style="margin-top:10px">TA 已经抽好了，就等你。<br>' +
          "用同一个问题抽一次「" + esc(room.spreadName || "同一个牌阵") + "」，抽完就能看到双方的关系解读。</p>" +
        '<button class="btn gold" id="btn-pair-join" style="margin-top:16px">我也抽一次</button>' +
      "</div>" +
      '<p class="gen-note">合盘只同步「问题与牌面」，不含任何个人信息 · 24 小时后自动删除</p>';
    showView("pair");
    $("btn-pair-back").addEventListener("click", function () { showView("home"); });
    $("btn-pair-join").addEventListener("click", function () {
      joining = {
        code: room.code,
        spread: room.spread,
        question: room.question,
        spreadName: room.spreadName
      };
      if (window.AppTarot) {
        window.AppTarot.drawFor(room.spread, room.question, "双人合盘 · " + (room.spreadName || ""));
      }
    });
  }

  function showInviteDead(title, desc) {
    var view = $("view-pair");
    view.innerHTML = pairNav("双人合盘") +
      '<div class="pair-invite"><div class="pair-invite-icon">✕</div>' +
      "<h3>" + esc(title) + "</h3><p class='hint'>" + esc(desc) + "</p>" +
      '<button class="btn ghost" id="btn-pair-home" style="margin-top:16px">回首页</button></div>';
    showView("pair");
    $("btn-pair-back").addEventListener("click", function () { showView("home"); });
    $("btn-pair-home").addEventListener("click", function () { showView("home"); });
  }

  // 抽完牌后由 app.js 调用；返回 true 表示已接管
  function consumeJoin() {
    if (!joining) return false;
    var cards = window.AppTarot.pickedNow().map(function (c) {
      return { name: c.name, orientation: c.orientation, keywords: c.keywords, gist: c.gist };
    });
    var code = joining.code;
    joining = null;
    api("/pair/join", { code: code, cards: cards }).then(function () {
      return api("/pair/state?code=" + encodeURIComponent(code) + "&full=1");
    }).then(function (r) {
      if (r && r.found && r.room.done) showPairResult(r.room);
      else toast("合盘没成功，稍后再试");
    }).catch(function (e) {
      toast(e.message === "timeout" ? "服务器没响应" : ("合盘失败：" + e.message));
    });
    return true;
  }

  // ---------- 合盘结果 ----------
  function pairNav(title) {
    return '<div class="nav-top"><button class="back" id="btn-pair-back">‹</button>' +
      '<span class="title">' + esc(title) + "</span></div>";
  }

  function columnHtml(title, cards, role) {
    var rows = cards.map(function (c, i) {
      var card = nameToCard(c.name);
      var img = card && window.AppTarot ? window.AppTarot.imageOf(card.n) : "";
      var rev = c.orientation === "reversed";
      return '<div class="pair-card">' +
        (img ? '<img src="' + img + '" alt="' + esc(c.name) + '"' + (rev ? ' class="rev-img"' : "") + ">" :
          '<span class="pair-card-ph">' + esc(c.name.slice(0, 2)) + "</span>") +
        '<div class="pair-card-meta"><b>' + esc(c.name) + "</b>" +
        '<i class="' + (rev ? "rev" : "up") + '">' + (rev ? "逆位" : "正位") + "</i>" +
        "<s>" + esc((c.keywords || []).slice(0, 3).join("·")) + "</s></div>" +
        "</div>";
    }).join("");
    return '<div class="pair-col"><div class="pair-col-head">' + esc(title) + "</div>" + rows + "</div>";
  }

  function mySide(room) {
    // 我发起的房间：a 是我；别人发起的：b 是我
    return isMine(room.code) ? { mine: room.aCards, theirs: room.bCards, myLabel: "你", taLabel: "TA" }
      : { mine: room.bCards, theirs: room.aCards, myLabel: "你", taLabel: "发起人" };
  }

  function showPairResult(room) {
    current = room;
    var sides = mySide(room);
    var view = $("view-pair");
    view.innerHTML = pairNav("双人合盘") +
      '<div class="result-head"><div class="q">「' + esc(room.question) + "」</div>" +
      '<div class="s">' + esc(room.spreadName || "关系之镜") + " · 双方各抽一次</div></div>" +
      '<div class="pair-cols">' +
        columnHtml(sides.myLabel, sides.mine, "me") +
        columnHtml(sides.taLabel, sides.theirs, "ta") +
      "</div>" +
      '<div class="pair-ai">' +
        '<button class="btn gold" id="btn-pair-ai">生成关系解读</button>' +
        '<div class="ai-box" id="pair-ai-box" style="display:none"></div>' +
      "</div>" +
      '<div class="result-actions row2" style="margin-top:14px">' +
        '<button class="btn ghost" id="btn-pair-share">分享卡片</button>' +
        '<button class="btn ghost" id="btn-pair-home2">回首页</button>' +
      "</div>" +
      '<p class="gen-note">合盘由双方牌面按规则组合生成 · 仅供娱乐与自我探索，不构成任何决策建议</p>';
    showView("pair");
    $("btn-pair-back").addEventListener("click", function () { showView("home"); });
    $("btn-pair-home2").addEventListener("click", function () { showView("home"); });
    $("btn-pair-share").addEventListener("click", function () { sharePairResult(room, sides); });
    $("btn-pair-ai").addEventListener("click", function () { runPairAI(room, sides, this); });
  }

  function runPairAI(room, sides, btn) {
    var box = $("pair-ai-box");
    box.style.display = "block";
    btn.disabled = true;
    btn.textContent = "解读生成中…";
    box.innerHTML = '<div class="ai-loading">正在读你们两个人的牌…</div>';
    if (!window.WenxingAI) {
      box.innerHTML = '<div class="ai-mark">离线综合解读 · 娱乐参考</div>' + localPairText(room, sides);
      btn.textContent = "重新解读";
      btn.disabled = false;
      return;
    }
    window.WenxingAI.interpret({
      type: "oracle",
      kind: "pair",
      question: room.question,
      data: {
        a: sides.mine.map(pairPayloadOf),
        b: sides.theirs.map(pairPayloadOf)
      }
    }).then(function (r) {
      box.innerHTML = '<div class="ai-mark">AI 生成 · 娱乐参考' + (r.mock ? " · 离线示例" : "") + "</div>" +
        paragraphs(r.text);
      btn.textContent = "重新解读";
      btn.disabled = false;
    }).catch(function () {
      box.innerHTML = '<div class="ai-mark">离线综合解读 · 娱乐参考</div>' + localPairText(room, sides);
      btn.textContent = "重新解读";
      btn.disabled = false;
      toast("AI 服务暂不可用，已切换本地解读");
    });
  }

  function pairPayloadOf(c) {
    return { name: c.name, orientation: c.orientation, keywords: c.keywords || [], gist: c.gist || "" };
  }

  function paragraphs(text) {
    if (window.WenxingAIText) return window.WenxingAIText.paragraphs(text);
    return "<p class='ai-text'>" + esc(text).replace(/\n/g, "<br>") + "</p>";
  }

  // 离线兜底：把双方牌面按「正逆比例 + 是否有同一花色」这些可解释的维度说一遍
  function localPairText(room, sides) {
    var mine = sides.mine || [], theirs = sides.theirs || [];
    var revOf = function (list) { return list.filter(function (c) { return c.orientation === "reversed"; }).length; };
    var kwOf = function (list) { return list.slice(0, 2).map(function (c) { return c.name; }).join("、"); };
    var l1 = "你这边 " + mine.length + " 张牌，" + (revOf(mine) ? "有 " + revOf(mine) + " 张逆位" : "全是正位") +
      "；TA 那边 " + theirs.length + " 张，" + (revOf(theirs) ? "有 " + revOf(theirs) + " 张逆位" : "全是正位") + "。";
    var l2 = "先从两边的落牌看：你落在「" + kwOf(mine) + "」，TA 落在「" + kwOf(theirs) + "」。" +
      "两个人看同一件事的入口不一样，这往往才是摩擦的来源，而不是谁对谁错。";
    var diff = Math.abs(revOf(mine) - revOf(theirs));
    var l3 = diff >= 2
      ? "两边正逆位的比例差得比较明显，说明这一段里一方更想往前推、另一方更想先稳一稳。别把节奏差异解读成态度问题。"
      : "两边正逆位比例接近，说明你们对这段关系的体感其实在同一档上，卡住的更像是具体做法，而不是方向。";
    var l4 = "合盘只是把两个人的视角并排放出来，不是一个结论。挑一件这周就能一起做的小事，比反复对牌面更有用。";
    return paragraphs([l1, l2, l3, l4].join("\n\n"));
  }

  // ---------- 分享卡片 ----------
  function shareCardsOf(list) {
    return (list || []).map(function (c) {
      var card = nameToCard(c.name);
      return {
        name: c.name,
        reversed: c.orientation === "reversed",
        imgSrc: card && window.AppTarot ? window.AppTarot.imageOf(card.n) : ""
      };
    });
  }

  function bindResultShare() {
    var btn = $("btn-share");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!window.WenxingShare || !window.AppTarot) return;
      var st = window.AppTarot.state;
      var sp = window.AppTarot.spreads[st.spread];
      var summary = $("r-summary") ? $("r-summary").textContent : "";
      window.WenxingShare.open({
        question: st.question,
        spreadName: sp ? sp.name : "",
        time: Date.now(),
        cards: window.AppTarot.pickedNow().map(function (c) {
          return { name: c.name, reversed: c.orientation === "reversed", imgSrc: window.AppTarot.imageOf(c.n) };
        }),
        excerpt: summary,
        url: siteUrl()
      }).catch(function () { toast("卡片生成失败，稍后再试"); });
    });
  }

  function sharePairResult(room, sides) {
    if (!window.WenxingShare) return;
    var aiText = $("pair-ai-box") ? $("pair-ai-box").textContent : "";
    var excerpt = aiText || ("你落在「" + (sides.mine[0] || {}).name + "」，TA 落在「" + (sides.theirs[0] || {}).name + "」。");
    window.WenxingShare.open({
      question: room.question,
      spreadName: (room.spreadName || "关系之镜") + " · 双人合盘",
      time: Date.now(),
      cards: shareCardsOf(sides.mine).concat(shareCardsOf(sides.theirs)).slice(0, 3),
      excerpt: excerpt,
      url: siteUrl()
    }).catch(function () { toast("卡片生成失败，稍后再试"); });
  }

  // ---------- 手动输入邀请码 ----------
  function promptCode() {
    var code = window.prompt("输入对方给你的 6 位邀请码：");
    if (!code) return;
    var c = String(code).trim().toUpperCase();
    if (c.length < 4) { toast("邀请码不对"); return; }
    api("/pair/state?code=" + encodeURIComponent(c) + "&full=1").then(function (r) {
      if (!r || !r.found) { toast("邀请不存在或已过期"); return; }
      if (r.room.done) { showPairResult(r.room); return; }
      showJoinInvite(r.room);
    }).catch(function () { toast("连不上服务器，稍后再试"); });
  }

  // ---------- 启动 ----------
  function boot() {
    bindResultShare();
    window.WenxingPair = {
      mountResult: mountResult,
      consumeJoin: consumeJoin,
      openFromUrl: openFromUrl,
      promptCode: promptCode,
      showPairResult: showPairResult,
      siteUrl: siteUrl,
      _isMine: isMine
    };
    // 带 ?pair= 进来时优先处理邀请
    if (openFromUrl()) return;
    // 之前发起过合盘、且对方可能已经抽完 → 静默探一次（不打扰）
    var pending = myRooms().filter(function (r) { return Date.now() - r.createdAt < 24 * 3600 * 1000; })[0];
    if (pending) {
      api("/pair/state?code=" + encodeURIComponent(pending.code)).then(function (r) {
        if (r && r.found && r.room.done && $("pair-block") && $("pair-block").style.display !== "none") {
          var b = $("btn-pair-check");
          if (b) b.textContent = "查看合盘结果（TA 已抽完）";
        }
      }).catch(function () {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
