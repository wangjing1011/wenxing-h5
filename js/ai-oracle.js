// 问星 H5 · 签卦与起名的 AI 解读挂载器
// 灵签 / 六爻 / 梅花 / 起名 四个板块共用这一份请求与降级逻辑。
// 只上传结构化结果（签诗、卦名、动爻、名字构成），不上传任何生辰或身份信息。
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg) {
    if (window.AppView && window.AppView.toast) { window.AppView.toast(msg); return; }
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
  function resolve(v) { return typeof v === "function" ? v() : v; }

  // opts: { btnId, boxId, kind, question?, data, fallback }
  //   kind  —— qian | liuyao | meihua | name
  //   data  —— 对象或返回对象的函数（点击时才取值，保证用最新的盘面）
  function attach(opts) {
    var btn = $(opts.btnId);
    var box = $(opts.boxId);
    if (!btn || !box) return;

    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.textContent = "解读生成中…";
      box.style.display = "block";
      box.innerHTML = '<div class="ai-loading">正在生成你的专属解读…</div>';

      var payload = {
        type: "oracle",
        kind: opts.kind,
        question: resolve(opts.question) || "",
        data: resolve(opts.data) || {}
      };

      var fallback = function () {
        box.innerHTML =
          '<div class="ai-mark">离线综合解读 · 娱乐参考</div>' +
          '<p class="ai-text">' + esc(resolve(opts.fallback) || "") + "</p>";
        btn.textContent = "重新解读";
        btn.disabled = false;
        toast("AI 服务暂不可用，已切换本地解读");
      };

      if (!window.WenxingAI) { fallback(); return; }

      window.WenxingAI.interpret(payload).then(function (r) {
        box.innerHTML =
          '<div class="ai-mark">AI 生成 · 娱乐参考' + (r.mock ? " · 离线示例" : "") + "</div>" +
          '<p class="ai-text">' + esc(r.text).replace(/\n/g, "<br>") + "</p>";
        btn.textContent = "重新解读";
        btn.disabled = false;
      }).catch(fallback);
    });
  }

  window.WenxingOracleAI = { attach: attach };
})();
