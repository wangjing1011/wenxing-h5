// ai-proxy/pair.js —— 双人合盘房间
//
// 为什么需要服务端：合盘要求「双方都抽完才能看关系解读」，
// 纯前端做不到跨设备握手。但也不能为此引入数据库，所以用一个极简房间：
//   · 内存 Map + 落盘 JSON（服务重启不丢，单进程同步写，量很小）
//   · 24 小时自动过期；最多 500 个房间，超了淘汰最旧的
//   · 只存「问题 + 牌面」，不存 IP、不存 UA、不存任何能定位到人的东西
//   · 房间号 6 位，刻意去掉 0/O/1/I 这类易混字符，方便手输
"use strict";

const fs = require("fs");
const path = require("path");

const TTL = 24 * 3600 * 1000;
const MAX_ROOMS = 500;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LEN = 6;

// 只接受这些牌阵参与合盘：关系之镜（五牌）与三牌（时间之流 / 抉择）
const ALLOWED_SPREADS = ["relation", "three", "choice"];
const MAX_CARDS = 10;
const MAX_QUESTION = 80;
const MAX_NAME = 24;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "pairs.json");

/** @type {Map<string, any>} */
const rooms = new Map();

function now() { return Date.now(); }

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const obj = JSON.parse(raw);
    Object.keys(obj || {}).forEach((k) => {
      const r = obj[k];
      if (r && r.code && r.createdAt) rooms.set(k, r);
    });
    sweep();
  } catch (e) {
    // 文件不存在或损坏都无妨：从空房间开始
  }
}

let saveTimer = null;
function save(immediate) {
  if (saveTimer) clearTimeout(saveTimer);
  const write = () => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const obj = {};
      rooms.forEach((r, k) => { obj[k] = r; });
      // 先写临时文件再改名，避免写一半断电留下坏 JSON
      const tmp = DATA_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(obj), "utf8");
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) {
      console.error("[pair] 房间落盘失败：" + (e.code || e.message));
    }
  };
  if (immediate) write();
  else saveTimer = setTimeout(write, 300);
}

function sweep() {
  const t = now();
  let changed = false;
  rooms.forEach((r, k) => {
    if (t - r.createdAt > TTL) { rooms.delete(k); changed = true; }
  });
  if (changed) save();
}

function newCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LEN; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  // 极端情况（房间几乎占满）退化为带时间戳的号码，仍保证唯一
  return "X" + now().toString(36).slice(-5).toUpperCase();
}

function normalizeCards(list) {
  if (!Array.isArray(list) || !list.length || list.length > MAX_CARDS) return null;
  const out = [];
  for (const c of list) {
    if (!c || typeof c !== "object") return null;
    const name = String(c.name || "").slice(0, MAX_NAME);
    if (!name) return null;
    out.push({
      name,
      orientation: c.orientation === "reversed" ? "reversed" : "upright",
      keywords: Array.isArray(c.keywords) ? c.keywords.slice(0, 4).map((k) => String(k).slice(0, 12)) : [],
      gist: String(c.gist || "").slice(0, 160)
    });
  }
  return out;
}

function publicView(r) {
  return {
    code: r.code,
    spread: r.spread,
    spreadName: r.spreadName,
    question: r.question,
    done: !!r.b,
    createdAt: r.createdAt,
    expiresAt: r.createdAt + TTL
  };
}

function createRoom(payload) {
  const p = payload || {};
  if (ALLOWED_SPREADS.indexOf(p.spread) < 0) return { error: "这个牌阵暂不支持合盘" };
  const cards = normalizeCards(p.cards);
  if (!cards) return { error: "牌面数据不完整" };
  const question = String(p.question || "").slice(0, MAX_QUESTION);
  if (!question.trim()) return { error: "合盘需要一个共同的问题" };

  sweep();
  if (rooms.size >= MAX_ROOMS) {
    // 淘汰最旧的一个，保证内存不涨
    let oldest = null;
    rooms.forEach((r, k) => { if (!oldest || r.createdAt < oldest.createdAt) oldest = Object.assign({ key: k }, r); });
    if (oldest) rooms.delete(oldest.key);
  }

  const code = newCode();
  const room = {
    code,
    spread: p.spread,
    spreadName: String(p.spreadName || "").slice(0, 24),
    question,
    a: cards,
    b: null,
    createdAt: now()
  };
  rooms.set(code, room);
  save(true);
  return { ok: true, code, expiresAt: room.createdAt + TTL };
}

function joinRoom(code, payload) {
  const key = String(code || "").trim().toUpperCase();
  sweep();
  const room = rooms.get(key);
  if (!room) return { error: "邀请不存在或已过期" };
  if (room.b) return { error: "这个合盘已经完成了" };
  const cards = normalizeCards((payload || {}).cards);
  if (!cards) return { error: "牌面数据不完整" };

  room.b = cards;
  room.doneAt = now();
  save(true);
  return { ok: true, code: key, room: publicView(room) };
}

// full=true 时（仅房间已完成）额外返回双方牌面，用于渲染合盘
function getRoom(code, full) {
  const key = String(code || "").trim().toUpperCase();
  sweep();
  const room = rooms.get(key);
  if (!room) return { found: false };
  const view = publicView(room);
  if (room.b && full) {
    view.aCards = room.a;
    view.bCards = room.b;
  }
  return { found: true, room: view };
}

load();

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  // 测试用
  _rooms: rooms,
  _clear: () => { rooms.clear(); save(true); },
  _ttl: TTL,
  _maxRooms: MAX_ROOMS,
  _codeAlphabet: CODE_ALPHABET,
  _allowedSpreads: ALLOWED_SPREADS,
  _save: save
};
