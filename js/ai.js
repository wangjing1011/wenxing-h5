// 问星 H5 · AI 解读前端封装
// 只把「结构化牌面」发给后端代理，绝不发送任何生辰或个人信息。
// 后端已做红线词后置过滤；前端只负责请求、超时、降级渲染。
(function () {
  "use strict";

  // 部署时把后端代理地址配到 window.AI_PROXY_URL；本地联调同域则留空走 /interpret。
  var ENDPOINT = window.AI_PROXY_URL || "/interpret";

  // payload: { spread, spreadName, question, cards:[{position,name,orientation,keywords,gist}] }
  function interpret(payload) {
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, 15000);
    var p;
    try {
      p = fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
    } catch (e) {
      clearTimeout(to);
      return Promise.reject(e);
    }
    return p.then(function (res) {
      if (!res.ok) throw new Error("bad status " + res.status);
      return res.json();
    }).then(function (data) {
      if (!data || typeof data.text !== "string" || !data.text.trim()) {
        throw new Error("empty ai text");
      }
      return { text: data.text, mock: !!data.mock };
    }).catch(function (e) {
      throw e;
    }).finally(function () { clearTimeout(to); });
  }

  window.WenxingAI = { interpret: interpret, endpoint: ENDPOINT };
})();
