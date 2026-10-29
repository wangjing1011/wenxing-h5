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
//     · 四板块： {type:"oracle", kind:"qian"|"liuyao"|"meihua"|"name", ...}
//     · 双人合盘： {type:"oracle", kind:"pair", question, a:[...], b:[...]}
//     resp: {text, mock:false}
//   GET  /health       {ok:true}
//   双人合盘房间（只存问题与牌面，24 小时过期，不存 IP/UA）：
//   POST /pair/create  {spread, spreadName, question, cards:[...]}  -> {ok, code, expiresAt}
//   POST /pair/join    {code, cards:[...]}                          -> {ok, room}
//   GET  /pair/state?code=XXXXXX                                   -> {found, room}

"use strict";
var http = require("http");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var pair = require("./pair.js");

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
// 自建服务器可设为 127.0.0.1，只由 Caddy / Nginx 反向代理对外，避免绕过 HTTPS 直连。
// 变量名故意用 BIND_HOST 而非 HOST —— 不少托管平台会预置 HOST，撞名会导致只绑回环地址、
// 外部探测不到端口而被判为「服务未启动」。
var BIND_HOST = process.env.BIND_HOST || "0.0.0.0";
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
    max_tokens: 1200,
    stream: false
  });
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 22000);
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
  if (payload.domain === "ziwei") {
    var soul = c.soul || {};
    var stars = (soul.majorStars || []).join("、");
    return "这是一张由排盘工具算出的紫微命盘快照。" +
      "命宫坐" + (stars ? stars : "空宫") +
      (stars ? "，是盘里最外显的一束气质；" : "，意味着这一宫需要借对宫星曜来参看；") +
      "它更像一张关于你外显气质与内在取向的地图。" +
      "你始终握有书写它的笔——命盘是帮你看清自己的镜子，不是替你定下结局的裁判。";
  }

  // 八字：按与 AI 版一致的五段结构做规则兜底。
  // 模型超时或断网时用户看到的就是这段，所以不能缩成一句话。
  var dm = c.dayMaster || {};
  var wx = c.wuXing || {};
  var ORD = ["木", "火", "土", "金", "水"];
  var dist = ORD.map(function (w) { return w + (wx[w] || 0); }).join("、");
  var sk = { "strong": "偏强", "weak": "偏弱", "balance": "中和" }[c.strength] || "";
  var top = ORD.slice().sort(function (a, b) { return (wx[b] || 0) - (wx[a] || 0); })[0];
  var miss = ORD.filter(function (w) { return !wx[w]; });
  var P = [];

  P.push("这份盘由干支历法排出，五行分布是 " + dist + "；日主" + (dm.gan || "") +
    (dm.el ? "，属" + dm.el : "") + (sk ? "，整体" + sk : "") + (c.deLing ? "，生在得令的月份" : "") +
    "。用白话说，" + (sk === "偏强"
      ? "你的自我比较足，不太容易被别人的意见带走，做起事来先动再想"
      : sk === "偏弱"
        ? "你对外界的分寸更敏感，常先看别人的反应再定自己的位置"
        : "你的力道收放比较均衡，既不硬顶也不一味退让") + "。");

  var ss = c.shiShen || [];
  if (ss.length) {
    var cnt = {};
    ss.forEach(function (s) { cnt[s] = (cnt[s] || 0) + 1; });
    var rank = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
    P.push("十神里出现最多的是" + rank.slice(0, 3).map(function (k) { return k + "（" + cnt[k] + "）"; }).join("、") +
      "。这一组配置通常落在这样的人身上：在意的事会自己先推一遍，不喜欢被安排；" +
      "面对压力时先收一收、观察一阵，再决定要不要出声。");
  } else {
    P.push("这张盘只留下了四柱与五行，十神的信息不完整。仍可以看出一件事：你面对压力时更倾向于先收一收、观察一阵，再决定要不要出声。");
  }

  P.push("优势在于" + (top ? "「" + top + "」这一行比较足，" : "") +
    "手里有资源时你能把事情真正推下去，不太需要外部一直给反馈。" +
    "容易踩的坑是另一面：铺开的时候容易一次铺太宽，收尾全靠意志力硬扛；" +
    (miss.length ? "五行里缺 " + miss.join("、") + "，对应到日常，往往是这一块的事你不太主动去碰，等到非碰不可时才补。" : "五行各有所在，反而不容易在某一块上过度用力。") );

  if ((c.daYun || []).length) {
    P.push("大运这一段是 " + c.daYun.length + " 步：" +
      c.daYun.slice(0, 4).map(function (dy) { return dy.startAge + "岁起 " + dy.gz; }).join("，") +
      (c.daYun.length > 4 ? "……" : "") +
      "。整体看，每隔七八年像换一次挡，换挡前后的一两年通常最磨人，不是事情变难了，而是旧办法开始不灵了。");
  }

  P.push("命盘是帮你看清自己的镜子，不是替你定下结局的裁判。你始终握有书写它的笔。");
  return P.join("\n\n");
}

// 签卦 / 起名离线 mock：按类型给一段规则兜底（同样过红线过滤，绝不下吉凶判断）
function mockOracleInterpret(p) {
  var d = p.data || {};
  var head = {
    qian: "这是一支从传统签诗中抽出的签。",
    liuyao: "这是一组由六爻起出的卦象。",
    meihua: "这是一组以梅花易数起出的卦象。",
    name: "这是几个按笔画与五行搭配出的名字备选。",
    pair: "这是一次双人合盘：同一个问题，两个人各抽了一组牌。"
  }[p.kind] || "";
  var body;
  if (p.kind === "qian") {
    body = (d.topic ? "签题讲的是「" + d.topic + "」。 " : "") +
      "签诗的意思往往不在字面，而在它给出的那个画面——你读到它时心里浮起的那句，通常比任何注解都更贴近你此刻的处境。";
  } else if (p.kind === "liuyao") {
    body = (d.ben ? "本卦「" + d.ben + "」" + (d.bian ? "，之卦「" + d.bian + "」" : "") + "。 " : "") +
      "卦象是古人观察变化的模型，讲的是「势」与「位」，不是给你下的判词。";
  } else if (p.kind === "meihua") {
    body = (d.ben ? "本卦「" + d.ben + "」" + (d.relName ? "，体用落在「" + d.relName + "」" : "") + "。 " : "") +
      "它更像一面照见当下处境的镜子，照见的是你在局中的位置，而不是结局。";
  } else if (p.kind === "name") {
    body = "名字的好，很少在于笔画算得多准。读音顺不顺口、写出来好不好看、家里人念着喜不喜欢，这些比任何格子都更实在。";
  } else if (p.kind === "pair") {
    var an = (d.a || [])[0], bn = (d.b || [])[0];
    var kw = function (c) { return (c && c.keywords && c.keywords.length) ? c.keywords.slice(0, 2).join("、") : "各自的关键词"; };
    body = (an ? "你这边第一张是「" + an.name + "」，落在「" + kw(an) + "」；" : "") +
      (bn ? "TA 那边第一张是「" + bn.name + "」，落在「" + kw(bn) + "」；" : "") +
      "两组牌摆在一起看，分歧常常不在方向，而在两个人看这件事的入口不一样。";
  } else {
    body = "这些符号更像一面镜子，映出的是你此刻的心境。";
  }
  return head + " " + body + " 它给的是一个看问题的角度，怎么走仍在你手里。";
}

// ---------------- /interpret 处理 ----------------
function handleInterpret(req, res) {
  readJson(req, res).then(function (payload) {
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

    // 签卦 / 起名解读：结构化占问结果（同样不含生辰与身份信息）
    if (payload.type === "oracle") {
      var OKINDS = { qian: 1, liuyao: 1, meihua: 1, name: 1, pair: 1 };
      if (!payload.kind || !OKINDS[payload.kind] || !payload.data) {
        return sendJson(res, 400, { error: "invalid oracle payload: kind & data required" });
      }
      var okey = crypto.createHash("sha1").update("oracle:" + JSON.stringify({
        k: payload.kind,
        q: (payload.question || "").slice(0, 80),
        d: payload.data
      })).digest("hex");
      var ocached = cacheGet(okey);
      if (ocached) {
        return sendJson(res, 200, { text: ocached.value.text, mock: ocached.value.mock, cached: true });
      }
      return callModel(prompt.buildOracleMessages(payload)).then(function (raw) {
        var omock = false;
        if (!raw) { raw = mockOracleInterpret(payload); omock = true; }
        var ofiltered = redwords.filter(raw);
        cacheSet(okey, { text: ofiltered.text, mock: omock });
        if (ofiltered.dirty) console.warn("[ai-proxy] redword hit, sanitized.");
        return sendJson(res, 200, { text: ofiltered.text, mock: omock });
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
    if (e && e.statusCode === 413) return sendJson(res, 413, { error: "payload too large" });
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

// 静态托管的禁区：本服务自身目录（含 .env 密钥与运行期房间数据）、依赖、部署脚本
// 之前只防了「越出根目录」，结果 /ai-proxy/.env、/.git/config 都能直接下——必须按目录挡
var DENY_PREFIX = ["/ai-proxy", "/node_modules", "/deploy", "/.git"];

function isBlockedPath(rel) {
  var low = rel.toLowerCase();
  for (var i = 0; i < DENY_PREFIX.length; i++) {
    if (low === DENY_PREFIX[i] || low.indexOf(DENY_PREFIX[i] + "/") === 0) return true;
  }
  // 任何以 . 开头的路径段（.env / .git / .DS_Store …）
  var segs = low.split("/");
  for (var j = 0; j < segs.length; j++) {
    if (segs[j].charAt(0) === ".") return true;
  }
  return false;
}

function serveStatic(req, res, urlPath) {
  var rel;
  try {
    rel = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  } catch (e) {
    // 畸形转义（如 /%）以前会抛 URIError 把整个进程带崩，这里必须兜住
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
    res.end("bad request");
    return;
  }
  if (rel.indexOf("\0") >= 0) { res.writeHead(400); res.end("bad request"); return; }
  if (rel === "/" || rel === "") rel = "/index.html";
  if (isBlockedPath(rel)) { res.writeHead(403); res.end("forbidden"); return; }

  var filePath = path.normalize(path.join(ROOT, rel));
  // 必须带分隔符比较，否则同名前缀的兄弟目录（tarot-h5-evil）也能通过
  if (filePath !== ROOT && filePath.indexOf(ROOT + path.sep) !== 0) {
    res.writeHead(403); res.end("forbidden"); return;
  }
  fs.readFile(filePath, function (err, data) {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    var ext = path.extname(filePath).toLowerCase();
    var head = {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=600"
    };
    if (ext === ".html") head["Content-Security-Policy"] = CSP;
    res.writeHead(200, head);
    res.end(data);
  });
}

// 前端没有外链资源、只有一处内联配置脚本，所以 script-src/style-src 需要 unsafe-inline；
// 关键是 object-src none / base-uri self / frame-ancestors self 这几条，能挡住注入挂载与点击劫持
var CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

// ---------------- 工具 ----------------
var MAX_BODY = 128 * 1024; // 128KB：正常载荷都在几 KB（最大的是八字深度盘），之前按「块数」算，实际能收几十 MB
function readJson(req, res) {
  return new Promise(function (resolve, reject) {
    var buf = [], size = 0, aborted = false;
    req.on("data", function (c) {
      if (aborted) return;
      size += c.length;
      if (size > MAX_BODY) {
        aborted = true;
        var e = new Error("payload too large");
        e.statusCode = 413;
        if (res) sendJson(res, 413, { error: "payload too large" }); // 先把话说完，再断连接
        req.destroy();
        reject(e);
        return;
      }
      buf.push(c);
    });
    req.on("end", function () {
      if (aborted) return;
      try { resolve(buf.length ? JSON.parse(Buffer.concat(buf).toString("utf8")) : {}); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
function sendJson(res, code, obj) {
  if (res.headersSent) return; // 已经回过（比如 413 先回了），别写第二次
  var body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "SAMEORIGIN"
    // 不设 Access-Control-Allow-Origin：前端与接口同源，放开 * 等于把自己的模型额度借给任何网站
  });
  res.end(body);
}

// ---------------- 简易限流（按 IP 滑动窗口） ----------------
// 目的：即使密钥泄露或被人拿到接口，也不至于被刷成账单炸弹；同时挡住房间码穷举
var RL = new Map();
function clientIp(req) {
  var xf = req.headers["x-forwarded-for"];
  // 取最后一段：Caddy 反代是把真实客户端 IP 追加到末尾，首段可被客户端自己伪造（伪造即绕过限流）
  if (xf) {
    var parts = String(xf).split(",");
    var last = parts[parts.length - 1].trim();
    if (last) return last;
  }
  return (req.socket && (req.socket.remoteAddress || "")) || "unknown";
}
function rateLimit(req, res, name, limit, windowMs) {
  // 桶按「IP + 用途 + 限额」分开：只按 limit/window 分的话，同限额的两个接口会共用一个桶
  // （/pair/create 与 /interpret 都是 20/分钟，实测互相吃掉额度）
  var k = clientIp(req) + "|" + name + "|" + limit + "|" + windowMs;
  var now = Date.now();
  var rec = RL.get(k);
  if (!rec || now - rec.t > windowMs) { RL.set(k, { n: 1, t: now }); return true; }
  rec.n++;
  if (rec.n > limit) {
    sendJson(res, 429, { error: "请求过于频繁，请稍后再试" });
    return false;
  }
  return true;
}
setInterval(function () {
  if (RL.size < 5000) return;
  var cutoff = Date.now() - 3600000;
  RL.forEach(function (v, k) { if (v.t < cutoff) RL.delete(k); });
}, 600000).unref();

// ---------------- 双人合盘房间 ----------------
function handlePairCreate(req, res) {
  readJson(req, res).then(function (body) {
    var r = pair.createRoom(body);
    if (r.error) return sendJson(res, 400, { error: r.error });
    sendJson(res, 200, r);
  }).catch(function () { sendJson(res, 400, { error: "请求格式不对" }); });
}

function handlePairJoin(req, res) {
  readJson(req, res).then(function (body) {
    var r = pair.joinRoom(body.code, body);
    if (r.error) return sendJson(res, 400, { error: r.error });
    sendJson(res, 200, r);
  }).catch(function () { sendJson(res, 400, { error: "请求格式不对" }); });
}

function handlePairState(req, res, u) {
  if (!rateLimit(req, res, "pair-state", 60, 60000)) return; // 挡房间码穷举
  var code = "";
  var qi = u.indexOf("?");
  if (qi >= 0) {
    u.slice(qi + 1).split("&").forEach(function (kv) {
      var p = kv.split("=");
      if (p[0] !== "code") return;
      try { code = decodeURIComponent(p[1] || ""); } catch (e) { code = ""; }
    });
  }
  var full = u.indexOf("full=1") >= 0;
  sendJson(res, 200, pair.getRoom(code, full));
}

// ---------------- 路由 ----------------
var server = http.createServer(function (req, res) {
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  var u = req.url || "/";

  if (u.indexOf("/interpret") === 0) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });
    if (!rateLimit(req, res, "interpret-m", 20, 60000) || !rateLimit(req, res, "interpret-h", 120, 3600000)) return;
    return handleInterpret(req, res);
  }
  if (u.indexOf("/pair/create") === 0) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });
    if (!rateLimit(req, res, "pair-create", 20, 60000)) return;
    return handlePairCreate(req, res);
  }
  if (u.indexOf("/pair/join") === 0) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });
    if (!rateLimit(req, res, "pair-join", 30, 60000)) return;
    return handlePairJoin(req, res);
  }
  if (u.indexOf("/pair/state") === 0) {
    return handlePairState(req, res, u);
  }
  if (u.indexOf("/health") === 0) {
    // 只回 ok：曾经还带 key 是否配置、合盘房间数——对外等于免费给攻击者做侦察
    // （判断值不值得刷、房间存量多少）。判「是否配了模型」改成看日志或内部排查。
    return sendJson(res, 200, { ok: true });
  }
  if (SERVE_STATIC) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJson(res, 405, { error: "method not allowed" });
    }
    return serveStatic(req, res, u);
  }
  sendJson(res, 404, { error: "not found" });
});

// 直接运行时才监听；被测试 require 时只导出纯函数，方便单测离线兜底文案
if (require.main === module) {
  server.listen(PORT, BIND_HOST, function () {
    console.log("[ai-proxy] listening on http://" + (BIND_HOST === "0.0.0.0" ? "localhost" : BIND_HOST) + ":" + PORT +
      (process.env.AI_KEY ? " (MODEL: " + (process.env.AI_MODEL || "deepseek-chat") + ")" : " (NO AI_KEY → mock mode)"));
  });
  // 监听失败要打出明确原因，否则托管平台只会报「端口未监听」，无从排查
  server.on("error", function (e) {
    console.error("[ai-proxy] 监听失败 " + BIND_HOST + ":" + PORT + " -> " + (e.code || e.message));
    process.exit(1);
  });
}

module.exports = { mockChartInterpret: mockChartInterpret, mockOracleInterpret: mockOracleInterpret };
