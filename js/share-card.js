// js/share-card.js —— 结果页分享卡片
//
// 为什么要做：站点链接在微信里打开会先弹「该网站未完成ICP备案」提示，
// 直接转发链接的转化很差。改成「生成一张带二维码的图片」，用户发出去的是图，
// 不弹提示、也不用点开链接，扫码就能进来。
//
// 实现要点：
//   · 纯 Canvas 手绘，不引 html2canvas 之类的大库
//   · 2 倍分辨率绘制，保证微信里放大不糊
//   · 二维码用本地 js/qr.js 画（编码 → 矩阵 → 方点）
//   · 输出 base64 <img>：微信里长按可保存；电脑上另有下载按钮
(function (global) {
  "use strict";

  var W = 750, H = 1180;      // 逻辑尺寸
  var SCALE = 2;              // 渲染倍率

  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';

  function font(size, weight) { return (weight ? weight + " " : "") + size + "px " + FONT; }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 中文按字断行：逐字量宽，超宽就换行
  function wrap(ctx, text, maxWidth, maxLines) {
    var lines = [], line = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === "\n") { lines.push(line); line = ""; continue; }
      var test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
        if (maxLines && lines.length >= maxLines) { line = ""; break; }
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) lines = lines.slice(0, maxLines);
    return lines;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) return resolve(null);
      var img = new Image();
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 4000);
      img.onload = function () { if (!done) { done = true; clearTimeout(t); resolve(img); } };
      img.onerror = function () { if (!done) { done = true; clearTimeout(t); resolve(null); } };
      img.src = src;
    });
  }

  // 画二维码（白底 + 留白 quiet zone 4 个模块）
  function drawQR(ctx, text, x, y, size) {
    var m;
    try { m = global.WenxingQR.matrix(text); } catch (e) { return false; }
    var quiet = 4;
    var total = m.size + quiet * 2;
    var unit = size / total;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x, y, size, size, 12);
    ctx.fill();
    ctx.fillStyle = "#140d2b";
    for (var row = 0; row < m.size; row++) {
      for (var col = 0; col < m.size; col++) {
        if (!m.cells[row][col]) continue;
        ctx.fillRect(
          x + (col + quiet) * unit,
          y + (row + quiet) * unit,
          Math.ceil(unit),
          Math.ceil(unit)
        );
      }
    }
    return true;
  }

  function drawCard(ctx, o) {
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#1b1140");
    g.addColorStop(0.55, "#150e33");
    g.addColorStop(1, "#0c0722");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 顶部一道金色细光
    var glow = ctx.createRadialGradient(W / 2, -120, 40, W / 2, -120, 520);
    glow.addColorStop(0, "rgba(212,185,106,.34)");
    glow.addColorStop(1, "rgba(212,185,106,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 420);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // 品牌
    ctx.fillStyle = "#e8cf8a";
    ctx.font = font(52, "600");
    ctx.fillText("问 星", W / 2, 96);
    ctx.fillStyle = "rgba(226,220,245,.55)";
    ctx.font = font(20);
    ctx.fillText("塔罗 · 八字 · 黄历", W / 2, 132);

    ctx.strokeStyle = "rgba(212,185,106,.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(90, 164);
    ctx.lineTo(W - 90, 164);
    ctx.stroke();

    var y = 214;

    // 问题
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(212,185,106,.85)";
    ctx.font = font(20);
    ctx.fillText("我 问 的 是", 64, y);
    y += 40;

    ctx.fillStyle = "#f2eefc";
    ctx.font = font(32, "500");
    var qLines = wrap(ctx, o.question || "（心里默想的那件事）", W - 128, 3);
    qLines.forEach(function (ln) { ctx.fillText(ln, 64, y); y += 46; });

    y += 6;
    ctx.fillStyle = "rgba(226,220,245,.5)";
    ctx.font = font(20);
    ctx.fillText(o.spreadName + " · " + o.time, 64, y);

    // 牌面
    y += 44;
    var cards = (o.cards || []).slice(0, 3);
    var cw = 140, chh = 240, gap = 26;
    var totalW = cards.length * cw + (cards.length - 1) * gap;
    var startX = (W - totalW) / 2;
    cards.forEach(function (c, i) {
      var x = startX + i * (cw + gap);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.5)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      roundRect(ctx, x, y, cw, chh, 12);
      ctx.fillStyle = "#241a4d";
      ctx.fill();
      ctx.restore();

      ctx.save();
      roundRect(ctx, x, y, cw, chh, 12);
      ctx.clip();
      if (c.img) {
        // 逆位把图转 180°，跟页面上的呈现一致
        if (c.reversed) {
          ctx.translate(x + cw / 2, y + chh / 2);
          ctx.rotate(Math.PI);
          ctx.drawImage(c.img, -cw / 2, -chh / 2, cw, chh);
        } else {
          ctx.drawImage(c.img, x, y, cw, chh);
        }
      } else {
        ctx.fillStyle = "#2c2060";
        ctx.fillRect(x, y, cw, chh);
        ctx.fillStyle = "#e8cf8a";
        ctx.font = font(22, "500");
        ctx.textAlign = "center";
        var nm = wrap(ctx, c.name, cw - 24, 3);
        nm.forEach(function (ln, k) { ctx.fillText(ln, x + cw / 2, y + 80 + k * 32); });
        ctx.textAlign = "left";
      }
      ctx.restore();

      // 牌名 + 正逆
      ctx.fillStyle = "rgba(242,238,252,.92)";
      ctx.font = font(18, "500");
      ctx.textAlign = "center";
      ctx.fillText(c.name, x + cw / 2, y + chh + 30);
      ctx.fillStyle = c.reversed ? "rgba(196,150,255,.8)" : "rgba(212,185,106,.8)";
      ctx.font = font(16);
      ctx.fillText(c.reversed ? "逆位" : "正位", x + cw / 2, y + chh + 56);
      ctx.textAlign = "left";
    });
    if (o.cards && o.cards.length > 3) {
      ctx.fillStyle = "rgba(226,220,245,.5)";
      ctx.font = font(18);
      ctx.textAlign = "right";
      ctx.fillText("共 " + o.cards.length + " 张", W - 64, y + chh + 30);
      ctx.textAlign = "left";
    }

    // 综合提示摘录
    // 行数不能写死：牌面行数、问题长度都会变，写死会压到二维码上。
    // 先算出二维码上沿，再把剩余高度折算成可用的行数。
    var qy = H - 272;
    y += chh + 84;
    ctx.strokeStyle = "rgba(212,185,106,.2)";
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(W - 64, y);
    ctx.stroke();
    y += 40;

    var lineH = 40;
    var maxLines = Math.max(2, Math.min(5, Math.floor((qy - 26 - y) / lineH)));
    ctx.fillStyle = "#ded7f2";
    ctx.font = font(24);
    var sAll = wrap(ctx, o.excerpt || "", W - 128, 0);
    var truncated = sAll.length > maxLines;
    var sLines = sAll.slice(0, maxLines);
    if (truncated && sLines.length) {
      var lastLine = sLines[sLines.length - 1];
      sLines[sLines.length - 1] = lastLine.slice(0, Math.max(1, lastLine.length - 1)) + "…";
    }
    sLines.forEach(function (ln) { ctx.fillText(ln, 64, y); y += lineH; });

    // 二维码区（位置固定，与上面正文区互不侵占）
    drawQR(ctx, o.url, 64, qy, 176);
    ctx.fillStyle = "#e8cf8a";
    ctx.font = font(26, "500");
    ctx.fillText("扫码也抽一次", 268, qy + 62);
    ctx.fillStyle = "rgba(226,220,245,.62)";
    ctx.font = font(20);
    ctx.fillText(o.url.replace(/^https?:\/\//, ""), 268, qy + 100);
    ctx.fillStyle = "rgba(226,220,245,.42)";
    ctx.font = font(18);
    ctx.fillText("塔罗 · 八字 · 黄历 · 起名", 268, qy + 136);

    // 合规声明：图片会脱离站点独立传播，这行必须跟着走
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(226,220,245,.38)";
    ctx.font = font(17);
    ctx.fillText("仅供娱乐与自我探索 · 不构成任何决策、医疗或心理建议", W / 2, H - 44);
    ctx.fillStyle = "rgba(226,220,245,.26)";
    ctx.font = font(15);
    ctx.fillText("牌面为 1909 年 Rider-Waite 公版图案 · Pamela Colman Smith", W / 2, H - 18);
  }

  // 摘要：去掉「」引号与换行，截到 n 字
  function excerptOf(text, n) {
    var s = String(text || "").replace(/\s+/g, " ").replace(/[「」]/g, "");
    if (s.length <= n) return s;
    return s.slice(0, n).replace(/[，、；。]$/, "") + "…";
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  // ---------- 弹层 ----------
  function ensureModal() {
    var mask = document.getElementById("share-mask");
    if (mask) return mask;
    mask = document.createElement("div");
    mask.className = "share-mask";
    mask.id = "share-mask";
    mask.innerHTML =
      '<div class="share-panel">' +
        '<div class="share-head"><b>分享卡片</b><button class="share-x" id="share-close">✕</button></div>' +
        '<div class="share-body" id="share-body"></div>' +
        '<p class="share-tip">手机里<b>长按图片</b>即可保存；电脑上点「下载图片」。</p>' +
        '<p class="share-tip" id="share-wx-tip" style="display:none">请点击右上角 <b>···</b> 分享给朋友或朋友圈</p>' +
        '<div class="share-actions">' +
          '<button class="btn gold" id="share-share">分享</button>' +
          '<button class="btn ghost" id="share-download">下载图片</button>' +
          '<button class="btn ghost" id="share-done">好了</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(mask);
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    mask.querySelector("#share-close").addEventListener("click", close);
    mask.querySelector("#share-done").addEventListener("click", close);
    return mask;
  }

  function close() {
    var mask = document.getElementById("share-mask");
    if (mask) mask.classList.remove("show");
  }

  var lastDataUrl = "";
  var lastFile = null;

  function isWeChat() {
    return /micromessenger/i.test((navigator.userAgent || ""));
  }

  // dataURL → File，供 navigator.share 以图片方式直接分享
  function dataUrlToFile(dataUrl, name) {
    var m = dataUrl.match(/^data:(.*?);base64,(.*)$/);
    if (!m) return null;
    var mime = m[1], bstr = atob(m[2]), n = bstr.length, u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new File([u8], name, { type: mime });
  }

  function doShare(opts, file) {
    var title = "问星 · 塔罗";
    var text = "我抽到的牌，你也来试试～";
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: title, text: text }).catch(function () {});
        return;
      }
      if (navigator.share) {
        navigator.share({ title: title, text: text, url: opts.url || location.href }).catch(function () {});
        return;
      }
    } catch (e) {}
    if (window.toast) window.toast("当前环境不支持直接分享，请长按图片保存后转发");
  }

  function download() {
    if (!lastDataUrl) return;
    var a = document.createElement("a");
    a.href = lastDataUrl;
    a.download = "问星-" + Date.now() + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // 入口：opts = { question, spreadName, time, cards:[{name,reversed,imgSrc}], excerpt, url }
  function open(opts) {
    var mask = ensureModal();
    var body = mask.querySelector("#share-body");
    body.innerHTML = '<div class="share-loading">正在生成卡片…</div>';
    mask.classList.add("show");
    var dl = mask.querySelector("#share-download");
    dl.onclick = download;

    var cards = (opts.cards || []).map(function (c) {
      return { name: c.name, reversed: !!c.reversed, imgSrc: c.imgSrc || "" };
    });

    return Promise.all(cards.map(function (c) { return loadImage(c.imgSrc); })).then(function (imgs) {
      imgs.forEach(function (img, i) { cards[i].img = img; });

      var canvas = document.createElement("canvas");
      canvas.width = W * SCALE;
      canvas.height = H * SCALE;
      var ctx = canvas.getContext("2d");
      ctx.scale(SCALE, SCALE);

      drawCard(ctx, {
        question: opts.question,
        spreadName: opts.spreadName,
        time: fmtTime(opts.time || Date.now()),
        cards: cards,
        excerpt: excerptOf(opts.excerpt, 160),
        url: opts.url
      });

      var dataUrl = canvas.toDataURL("image/png");
      lastDataUrl = dataUrl;
      lastFile = dataUrlToFile(dataUrl, "问星-" + Date.now() + ".png");
      body.innerHTML = '<img class="share-img" id="share-img" src="' + dataUrl + '" alt="问星分享卡片">';

      // 分享：微信内走右上角菜单；其余环境优先系统分享（直接发图片），不支持则提示长按保存
      var shareBtn = mask.querySelector("#share-share");
      var wxTip = mask.querySelector("#share-wx-tip");
      if (isWeChat()) {
        if (shareBtn) shareBtn.style.display = "none";
        if (wxTip) wxTip.style.display = "block";
      } else if (shareBtn) {
        shareBtn.onclick = function () { doShare(opts, lastFile); };
        if (wxTip) wxTip.style.display = "none";
      }
      return dataUrl;
    });
  }

  global.WenxingShare = {
    open: open,
    close: close,
    // 供测试直接调用
    _draw: drawCard,
    _excerpt: excerptOf,
    _wrap: wrap,
    _size: { w: W, h: H, scale: SCALE }
  };
})(typeof window !== "undefined" ? window : globalThis);
