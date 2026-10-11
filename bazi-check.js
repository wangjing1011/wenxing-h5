// bazi-check.js: 八字排盘引擎准确性校验
const { Solar, Lunar } = require("./js/vendor/lunar.js");

const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// 60 甲子表（干支奇偶必须一致）
const jiazi = new Set();
for (let i = 0; i < 60; i++) jiazi.add(GAN[i % 10] + ZHI[i % 12]);

function validGZ(gz) {
  return typeof gz === "string" && gz.length === 2 && jiazi.has(gz);
}
function nextGZ(gz) {
  const i = GAN.indexOf(gz[0]), j = ZHI.indexOf(gz[1]);
  return GAN[(i + 1) % 10] + ZHI[(j + 1) % 12];
}
// 五鼠遁：子时天干序号 = ((日干序号 % 5) * 2) % 10
function ziHourGanIdx(dayGanIdx) { return ((dayGanIdx % 5) * 2) % 10; }

let errors = [];
function check(ec, y, m, d, h) {
  const yP = ec.getYear(), mP = ec.getMonth(), dP = ec.getDay(), tP = ec.getTime();
  [["year", yP], ["month", mP], ["day", dP], ["time", tP]].forEach(([k, v]) => {
    if (!validGZ(v)) errors.push(`${y}-${m}-${d} ${k}柱非法: ${v}`);
  });
  let expectTimeGan, expectTimeZhi;
  const hourZhiIdx = Math.floor(((h + 1) % 24) / 2); // 23-1 点为子时(0)
  if (h === 23) {
    // 夜子时（晚子时）流派：日柱仍用当日，时柱按次日日干起子时
    const nd = new Date(y, m - 1, d); nd.setDate(nd.getDate() + 1);
    const nextDayGan = Lunar.fromSolar(Solar.fromYmdHms(nd.getFullYear(), nd.getMonth() + 1, nd.getDate(), 0, 0, 0)).getEightChar().getDay()[0];
    expectTimeGan = GAN[ziHourGanIdx(GAN.indexOf(nextDayGan))];
    expectTimeZhi = ZHI[0];
  } else {
    expectTimeGan = GAN[(ziHourGanIdx(GAN.indexOf(dP[0])) + hourZhiIdx) % 10];
    expectTimeZhi = ZHI[hourZhiIdx];
  }
  if (tP[0] !== expectTimeGan) {
    errors.push(`${y}-${m}-${d} h=${h} 时柱天干不符五鼠遁: 实=${tP[0]} 期=${expectTimeGan}`);
  }
  if (tP[1] !== expectTimeZhi) {
    errors.push(`${y}-${m}-${d} h=${h} 时柱地支不符: 实=${tP[1]} 期=${expectTimeZhi}`);
  }
  const yun = ec.getYun(1);
  yun.getDaYun().forEach((dy, i) => {
    const gz = dy.getGanZhi();
    if (gz && !validGZ(gz)) errors.push(`${y}-${m}-${d} 大运${i}非法: ${gz}`);
  });
}

// 1) 定点样本
const samples = [
  [1990, 5, 20, 14], [1985, 3, 15, 8], [2000, 1, 1, 0], [2024, 2, 4, 12],
  [1976, 12, 31, 23], [2008, 8, 8, 20], [2026, 10, 9, 16], [1959, 6, 6, 6]
];
samples.forEach(([y, m, d, h]) => {
  const ec = Lunar.fromSolar(Solar.fromYmdHms(y, m, d, h, 0, 0)).getEightChar();
  check(ec, y, m, d, h);
});

// 2) 随机 400 个时间点
for (let i = 0; i < 400; i++) {
  const y = 1960 + Math.floor(Math.random() * 70);
  const m = 1 + Math.floor(Math.random() * 12);
  const d = 1 + Math.floor(Math.random() * 28);
  const h = Math.floor(Math.random() * 24);
  const ec = Lunar.fromSolar(Solar.fromYmdHms(y, m, d, h, 0, 0)).getEightChar();
  check(ec, y, m, d, h);
}

// 3) 日柱连续性：连续 60 天的日柱必须依次递进
let prev = null, start = new Date(2020, 0, 1);
for (let i = 0; i < 60; i++) {
  const dt = new Date(start.getTime() + i * 86400000);
  const ec = Lunar.fromSolar(Solar.fromYmdHms(dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), 12, 0, 0)).getEightChar();
  const dP = ec.getDay();
  if (prev && dP !== nextGZ(prev)) errors.push(`日柱不连续: ${prev} -> ${dP}`);
  prev = dP;
}

if (errors.length) {
  console.error("FAIL " + errors.length + " errors");
  errors.slice(0, 10).forEach(e => console.error("  " + e));
  process.exit(1);
}
console.log("OK: bazi engine validated (8 samples + 400 random + 60-day continuity)");
