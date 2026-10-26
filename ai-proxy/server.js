// 问星 H5 · AI 解读代理（合规中转）
// 职责：持有大模型 API Key、限流/缓存、组装提示词、内容后置过滤（红线词）、回传前端。
// 安全原则：前端（H5）绝不直连大模型；本服务是 H5 与模型之间唯一通道。
//
// 启动：
//   node server.js
// 配置（环境变量，均可不填，不填则走离线 mock）：
//   也可以写在同级目录的 .env 文件里（见 .env.example），启动时自动读取。
//   优先级：真实环境变量 > .env。
//   PORT          监听端口（默认 8787）
//   AI_KEY        大模型 API Key（必填才能调真实模型）
//   AI_MODEL      模型名（默认 deepseek-chat）
//   AI_BASE_URL   OpenAI 兼容的 chat/completions 端点
//                （默认 https://api.deepseek.com/v1/chat/completions ，可切通义/智谱等）
//   AI_SERVE_STATIC  1=同时托管上级 tarot-h5 静态资源（便于本地联调，默认 1）
//   AI_CACHE_TTL  缓存秒数（默认 21600 = 6 小时）
//
// 接口：
//   POST /interpret
//     · 塔罗： {spread, spreadName, question, cards:[{position,name,orientation,keywords,gist}]}
//     · 命盘： {type:"chart", domain:"bazi"|"ziwei", chart:{...结构化命盘，不含任何生辰/姓名}}
//     resp: {text, mock:false}
//   GET  /health       {ok:true}

"use strict";
var http = require("http");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var prompt = require("./prompt");
var redwords = require("./redwords");

// ---------------- 极简 .env 加载（零依赖） ----------------
// 为什么需要：部分托管平台（如 WorkBuddy Sites）不给传环境变量的入口，
// 只能把配置放在本目录的 .env 里随源码一起上传。
// 安全：.env 已被 .gitignore 忽略，不会进入公开仓库。
// 规则：KEY=VALUE / 忽略空行与 # 注释 / 已存在的环境变量优先（不覆盖）。
(function loadDotEnv() {
  var file = path.join(__dirname, ".env");
  var text;
  try { text = fs.readFileSync(file, "utf8"); } catch (e) { return; }
  text.split(/\r?\n/).forEach(function (line) {
    var s = line.trim();
    if (!s || s.charAt(0) === "#") return;
    var eq = s.indexOf("=");
    if (eq < 1) return;
    var k = s.slice(0, eq).trim();
    var v = s.slice(eq + 1).trim();
    if (v.length > 1 && (v.charAt(0) === '"' || v.charAt(0) === "'") && v.slice(-1) === v.charAt(0)) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  });
})();

var PORT = parseInt(process.env.PORT || "8787", 10);
// 监听地址：0.0.0.0 = 所有网卡（托管平台需要）；
// 自建服务器建议设为 127.0.0.1，只由 Caddy / Nginx 反向代理对外，避免绕过 HTTPS 直连。
var HOST = process.env.HOST || "0.0.0.0";
var CACHE_TTL = parseInt(process.env.AI_CACHE_TTL || "21600", 10) * 1000;
var SERVE_STATIC = (process.env.AI_SERVE_STATIC || "1") !== "0";
var ROOT = path.join(__dirname, ".."); // tarot-h5 根目录

// ---------------- 简单内存缓存（按请求指纹） ----------------
var cache = new Map();
function cacheKey(payload) {
  var norm = JSON.stringify({
    s: payload.spread,
    q: (payload.question || "").slice(0, 80),
    c: (payload.cards || []).map(function (x) {
      return [x.position, x.name, x.orientation].join("|");
    })
  });
  return crypto.createHash("sha1").update(norm).digest("hex");
}
function cacheGet(k) {
  var v = cache.get(k);
  if (v && Date.now() - v.t < CACHE_TTL) return v;
  if (v) cache.delete(k);
  return null;
}
function cacheSet(k, value) { cache.set(k, { t: Date.now(), value: value }); }

function cacheKeyChart(payload) {
  var norm = JSON.stringify({
    d: payload.domain,
    c: payload.chart
  });
  return crypto.createHash("sha1").update("chart:" + norm).digest("hex");
}

// ---------------- LLM 调用 ----------------
function buildEndpoint() {
  var url = (process.env.AI_BASE_URL || "https://api.deepseek.com/v1/chat/completions").trim();
  if (!/\/chat\/completions$/.test(url)) url = url.replace(/\/+$/, "") + "/chat/completions";
  return url;
}

function callModel(messages) {
  var key = process.env.AI_KEY;
  if (!key) return Promise.resolve(null); // 无 Key → 走 mock
  var url = buildEndpoint();
  var body = JSON.stringify({
    model: process.env.AI_MODEL || "deepseek-chat",
    messages: messages,
    temperature: 0.9,
    max_tokens: 600,
    stream: false
  });
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 20000);
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + key
    },
    body: body,
    signal: ctrl.signal
  }).then(function (res) {
    clearTimeout(timer);
    if (!res.ok) return res.text().then(function (t) { throw new Error("model " + res.status + ": " + t.slice(0, 200)); });
    return res.json();
  }).then(function (data) {
    var txt = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return txt || null;
  }).catch(function (e) {
    clearTimeout(timer);
    console.error("[ai-proxy] model call failed:", e.message);
    return null; // 失败 → 降级 mock
  });
}

// 离线 mock：当没有 Key 或模型调用失败时，给一段规则兜底文本（同样过红线过滤）
function mockInterpret(payload) {
  var cards = payload.cards || [];
  var names = cards.map(function (c) {
    return "「" + c.name + "（" + (c.orientation === "reversed" ? "逆位" : "正位") + "）」";
  }).join("、");
  var head = payload.question && payload.question.trim()
    ? "关于你问的「" + payload.question.trim() + "」，牌面递出的是 " + names + "。"
    : "凭直觉抽到的 " + names + "，是此刻想让你看见的画面。";
  var body = cards.map(function (c) {
    var orient = c.orientation === "reversed" ? "逆位" : "正位";
    var kw = (c.keywords || []).slice(0, 3).join("、");
    return "「" + c.name + "」" + orient + "，像在说：试着留意「" + kw + "」这一面——它或许正映出你心里某个没说出口的念头。";
  }).join(" ");
  var tail = "塔罗是一面让你看清自己的镜子，不是替你做决定的裁判。把牌面的意象带回去，答案会在你自己的节奏里慢慢显形。";
  return head + " " + body + " " + tail;
}

// 命盘离线 mock：基于结构化命盘给一段规则兜底（同样过红线过滤，且绝不含生辰）
function mockChartInterpret(payload) {
  var c = payload.chart || {};
  var head = payload.domain === "ziwei"
    ? "这是一张由排盘工具算出的紫微命盘快照。"
    : "这是一份由干支历法排盘工具算出的八字快照。";
  var body;
  if (payload.domain === "ziwei") {
    var soul = c.soul || {};
    var stars = (soul.majorStars || []).join("、");
    body = "命宫坐" + (stars ? stars : "空宫") +
      (stars ? "，是盘里最外显的一束气质；" : "，意味着这一宫需要借对宫星曜来参看；") +
      "它更像一张关于你外显气质与内在取向的地图。";
  } else {
    var dm = c.dayMaster || {};
    var wx = c.wuXing || {};
    var dist = ["木", "火", "土", "金", "水"].map(function (w) { return w + (wx[w] || 0); }).join("、");
    var sk = { "strong": "偏强", "weak": "偏弱", "balance": "中和" }[c.strength] || "";
    body = "日主" + (dm.gan || "") + (dm.el ? "（" + dm.el + "）" : "") +
      "，五行分布 " + dist + (sk ? "，整体" + sk : "") +
      "。它只是你出生那一刻天地干支的排列，是一张能量与性格的地图，而不是锁死的人生剧本。";
  }
  var tail = "你始终握有书写它的笔——命盘是帮你看清自己的镜子，不是替你定下结局的裁判。";
  return head + body + tail;
}

// ---------------- /interpret 处理 ----------------
function handleInterpret(req, res) {
  readJson(req).then(function (payload) {
    if (!payload) return sendJson(res, 400, { error: "invalid payload" });

    // 命盘解读：结构化盘（不含生辰）交给模型
    if (payload.type === "chart") {
      if (!payload.domain || !payload.chart) {
        return sendJson(res, 400, { error: "invalid chart payload: domain & chart required" });
      }
      if (payload.domain !== "bazi" && payload.domain !== "ziwei") {
        return sendJson(res, 400, { error: "unsupported chart domain: " + payload.domain });
      }
      var ckey = cacheKeyChart(payload);
      var ccached = cacheGet(ckey);
      if (ccached) {
        return sendJson(res, 200, { text: ccached.value.text, mock: ccached.value.mock, cached: true });
      }
      var cmessages = prompt.buildChartMessages(payload);
      return callModel(cmessages).then(function (raw) {
        var mock = false;
        if (!raw) { raw = mockChartInterpret(payload); mock = true; }
        var cfiltered = redwords.filter(raw);
        cacheSet(ckey, { text: cfiltered.text, mock: mock });
        if (cfiltered.dirty) console.warn("[ai-proxy] redword hit, sanitized.");
        return sendJson(res, 200, { text: cfiltered.text, mock: mock });
      });
    }

    // 塔罗解读
    if (!Array.isArray(payload.cards) || payload.cards.length === 0) {
      return sendJson(res, 400, { error: "invalid payload: cards required" });
    }
    var key = cacheKey(payload);
    var cached = cacheGet(key);
    if (cached) {
      return sendJson(res, 200, { text: cached.value.text, mock: cached.value.mock, cached: true });
    }

    var messages = prompt.buildMessages(payload);
    return callModel(messages).then(function (raw) {
      var mock = false;
      if (!raw) { raw = mockInterpret(payload); mock = true; }
      var filtered = redwords.filter(raw);
      var text = filtered.text;
      cacheSet(key, { text: text, mock: mock });
      // 审计日志（不含用户问题内容细节，仅命中标记）
      if (filtered.dirty) console.warn("[ai-proxy] redword hit, sanitized.");
      return sendJson(res, 200, { text: text, mock: mock });
    });
  }).catch(function (e) {
    console.error("[ai-proxy] interpret error:", e && e.message);
    return sendJson(res, 500, { error: "internal error" });
  });
}

// ---------------- 静态托管（本地联调用） ----------------
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};
function serveStatic(req, res, urlPath) {
  var rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  var filePath = path.normalize(path.join(ROOT, rel));
  if (filePath.indexOf(ROOT) !== 0) { // 防目录穿越
    res.writeHead(403); res.end("forbidden"); return;
  }
  fs.readFile(filePath, function (err, data) {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

// ---------------- 工具 ----------------
function readJson(req) {
  return new Promise(function (resolve, reject) {
    var buf = [];
    req.on("data", function (c) { buf.push(c); if (buf.length > 1e6) req.destroy(); });
    req.on("end", function () { try { resolve(buf.length ? JSON.parse(Buffer.concat(buf).toString("utf8")) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
function sendJson(res, code, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

// ---------------- 路由 ----------------
var server = http.createServer(function (req, res) {
  if (req.method === "OPTIONS") { sendJson(res, 204, {}); return; }
  var u = req.url || "/";

  if (u.indexOf("/interpret") === 0 && req.method === "POST") {
    return handleInterpret(req, res);
  }
  if (u.indexOf("/health") === 0) {
    return sendJson(res, 200, { ok: true, key: !!process.env.AI_KEY });
  }
  if (SERVE_STATIC) {
    return serveStatic(req, res, u);
  }
  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, function () {
  console.log("[ai-proxy] listening on http://" + (HOST === "0.0.0.0" ? "localhost" : HOST) + ":" + PORT +
    (process.env.AI_KEY ? " (MODEL: " + (process.env.AI_MODEL || "deepseek-chat") + ")" : " (NO AI_KEY → mock mode)"));
});
