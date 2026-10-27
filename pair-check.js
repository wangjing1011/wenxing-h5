// pair-check.js —— 双人合盘：房间生命周期 + 解读提示词
//
// 合盘最容易出事的地方不是 UI，而是「谁说能看到对方的牌」：
// 没抽完就泄牌、同一个人反复加入、房间永不过期、过期房间还能看，
// 这些都会变成隐私或体验问题，所以在这里逐条卡住。
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const pair = require(path.join(ROOT, "ai-proxy/pair.js"));
const prompt = require(path.join(ROOT, "ai-proxy/prompt.js"));

const log = [];
const errs = [];
const ok = (c, m) => { log.push((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push(m); };

const CARDS_A = [
  { name: "恋人", orientation: "upright", keywords: ["选择", "靠近"], gist: "关系里的靠近" },
  { name: "宝剑三", orientation: "reversed", keywords: ["缓解"], gist: "痛感在退" }
];
const CARDS_B = [
  { name: "月亮", orientation: "upright", keywords: ["不安", "猜测"], gist: "看不清" }
];

pair._clear();

// ---------- 创建 ----------
const bad1 = pair.createRoom({ spread: "celtic", question: "还在一起吗", cards: CARDS_A });
ok(!!bad1.error, "十牌凯尔特十字不开放合盘，被拒：" + (bad1.error || "-"));

const bad2 = pair.createRoom({ spread: "relation", question: "   ", cards: CARDS_A });
ok(!!bad2.error, "没写问题时不能创建房间");

const bad3 = pair.createRoom({ spread: "relation", question: "还在一起吗", cards: [] });
ok(!!bad3.error, "没有牌面时不能创建房间");

const c1 = pair.createRoom({ spread: "relation", spreadName: "五牌 · 关系之镜", question: "我们还在一起吗", cards: CARDS_A });
ok(c1.ok && /^[2-9A-Z]{6}$/.test(c1.code), "创建成功并返回 6 位邀请码（" + c1.code + "）");
ok(c1.code.split("").every((ch) => pair._codeAlphabet.indexOf(ch) >= 0), "邀请码字符都在易读字母表内");
ok(!/[01OI]/.test(c1.code), "邀请码不含 0 / O / 1 / I 这类易混字符");
ok(c1.expiresAt - Date.now() > 23 * 3600 * 1000, "有效期约 24 小时");

// 连续创建不应撞码
const codes = {};
let dup = 0;
for (let i = 0; i < 60; i++) {
  const r = pair.createRoom({ spread: "three", question: "要不要继续" + i, cards: CARDS_A });
  if (codes[r.code]) dup++;
  codes[r.code] = 1;
}
ok(dup === 0, "连续创建 60 个房间无重复邀请码");

// ---------- 未完成时的可见性 ----------
const before = pair.getRoom(c1.code, true);
ok(before.found && before.room.done === false, "刚创建时房间状态为「未完成」");
ok(!before.room.aCards && !before.room.bCards, "没抽完时不下发任何一方牌面");
ok(!JSON.stringify(before).includes("恋人"), "未完成状态下响应里不含发起人牌名");

// ---------- 加入 ----------
const j1 = pair.joinRoom(c1.code.toLowerCase(), { cards: CARDS_B });
ok(j1.ok, "小写邀请码也能加入（自动转大写）");
const after = pair.getRoom(c1.code, true);
ok(after.room.done === true, "双方都抽完后房间标记完成");
ok(after.room.aCards.length === 2 && after.room.bCards.length === 1, "完成后可下发双方牌面（2 张 / 1 张）");

const j2 = pair.joinRoom(c1.code, { cards: CARDS_B });
ok(!!j2.error && /完成/.test(j2.error), "房间完成后不允许再被第三个人加入：" + (j2.error || "-"));

const j3 = pair.joinRoom("ZZZZZZ", { cards: CARDS_B });
ok(!!j3.error && /不存在|过期/.test(j3.error), "不存在的邀请码给出明确提示：" + (j3.error || "-"));

// ---------- 过期 ----------
const c2 = pair.createRoom({ spread: "relation", question: "过期测试", cards: CARDS_A });
pair._rooms.get(c2.code).createdAt = Date.now() - pair._ttl - 1000;
const expired = pair.getRoom(c2.code, true);
ok(!expired.found, "超过 24 小时的房间查不到（已清理）");
ok(!pair._rooms.has(c2.code), "过期房间已从内存移除");

// ---------- 容量上限 ----------
pair._clear();
for (let i = 0; i < pair._maxRooms + 5; i++) {
  pair.createRoom({ spread: "three", question: "压测" + i, cards: CARDS_A });
}
ok(pair._rooms.size <= pair._maxRooms, "房间数不超过上限（" + pair._rooms.size + " ≤ " + pair._maxRooms + "）");

// ---------- 隐私 ----------
pair._clear();
const c3 = pair.createRoom({ spread: "relation", question: "隐私检查", cards: CARDS_A });
const raw = JSON.stringify(pair._rooms.get(c3.code));
ok(!/ip|ua|useragent|userId|nickname|birth|生日|姓名/i.test(raw), "房间记录里没有任何身份/设备字段");
ok(Object.keys(pair._rooms.get(c3.code)).sort().join(",") === "a,b,code,createdAt,question,spread,spreadName",
  "房间只存问题与牌面等必要字段，实得：" + Object.keys(pair._rooms.get(c3.code)).sort().join(","));

// ---------- 字段长度收敛 ----------
const longQ = "问".repeat(200);
const c4 = pair.createRoom({ spread: "three", question: longQ, cards: CARDS_A });
ok(pair._rooms.get(c4.code).question.length <= 80, "超长问题被截断到 80 字以内");
const longCard = [{ name: "名".repeat(80), orientation: "upright" }];
const c5 = pair.createRoom({ spread: "three", question: "长度", cards: longCard });
ok(pair._rooms.get(c5.code).a[0].name.length <= 24, "超长牌名被截断");

// ---------- 解读提示词 ----------
const msgs = prompt.buildOracleMessages({
  type: "oracle",
  kind: "pair",
  question: "我们还在一起吗",
  data: { a: CARDS_A, b: CARDS_B }
});
const sys = msgs[0].content;
const user = msgs[1].content;
ok(sys === prompt.SYSTEM_ROLE_PAIR, "合盘走专属角色提示词（不是通用签卦角色）");
ok(/不站队|谁对谁错/.test(sys), "提示词明确禁止站队");
ok(/不预测|分手|复合/.test(sys), "提示词禁止预测关系结局");
ok(/第一段[\s\S]{0,60}第二段[\s\S]{0,60}第三段/.test(sys), "提示词强制四段结构（回应 / 你 / TA / 互相作用）");
ok(user.includes("塔罗双人合盘"), "载荷标明这是合盘");
ok(user.includes("恋人") && user.includes("月亮"), "双方牌面都进了提示词");
ok(/【你抽到的牌】[\s\S]*【对方抽到的牌】/.test(user), "双方牌面分列，不会混成一组");
ok(user.includes("逆位"), "正逆位信息保留");
ok(user.includes("我们还在一起吗"), "问题原文进提示词");
ok(!/birth|生日|姓名|出生/.test(user), "提示词里没有任何生辰/姓名（合规）");

// 通用签卦角色不能被改动
const qianMsgs = prompt.buildOracleMessages({ type: "oracle", kind: "qian", question: "q", data: { topic: "t" } });
ok(qianMsgs[0].content === prompt.SYSTEM_ROLE_ORACLE, "灵签仍走原通用角色，未被合盘逻辑影响");

// ---------- 离线兜底 ----------
const { mockOracleInterpret } = require(path.join(ROOT, "ai-proxy/server.js"));
const mockText = mockOracleInterpret({ kind: "pair", data: { a: CARDS_A, b: CARDS_B } });
ok(mockText.includes("合盘"), "离线兜底文案点明这是合盘");
ok(mockText.includes("恋人") && mockText.includes("月亮"), "离线兜底会引用双方第一张牌");
ok(!/吉|凶|注定|一定/.test(mockText), "离线兜底不含吉凶判词");

pair._clear();

console.log(log.join("\n"));
if (errs.length) {
  console.log("\nFAIL: 双人合盘校验未通过（" + errs.length + " 项）");
  process.exit(1);
}
console.log("\nOK: 双人合盘房间与解读提示词校验全部通过");
