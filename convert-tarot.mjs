// convert-tarot.mjs —— 把 78 张 RWS PNG 转为 WebP q78，按 n 值命名输出到 assets/tarot/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "__tarot-img", "package", "images");
const OUT = path.join(__dirname, "assets", "tarot");
fs.mkdirSync(OUT, { recursive: true });

// 大阿卡纳 0-21：文件名 -> n
const MAJOR_ORDER = [
  "00-TheFool", "01-TheMagician", "02-TheHighPriestess", "03-TheEmpress", "04-TheEmperor",
  "05-TheHierophant", "06-TheLovers", "07-TheChariot", "08-Strength", "09-TheHermit",
  "10-WheelOfFortune", "11-Justice", "12-TheHangedMan", "13-Death", "14-Temperance",
  "15-TheDevil", "16-TheTower", "17-TheStar", "18-TheMoon", "19-TheSun",
  "20-Judgement", "21-TheWorld",
];
const SUIT_BASE = { Wands: 100, Cups: 200, Swords: 300, Pentacles: 400 };

const map = {}; // n -> outName
MAJOR_ORDER.forEach((base, n) => { map[n] = base; });
for (const [suit, base] of Object.entries(SUIT_BASE)) {
  for (let i = 1; i <= 14; i++) {
    map[base + i] = suit + String(i).padStart(2, "0");
  }
}

let done = 0, totalIn = 0, totalOut = 0;
const missing = [];
for (const [n, base] of Object.entries(map)) {
  const srcFile = path.join(SRC, base + ".png");
  if (!fs.existsSync(srcFile)) { missing.push(base); continue; }
  const NN = String(n).padStart(3, "0");
  const outFile = path.join(OUT, NN + "-" + base.replace(/^\d+-/, "").toLowerCase() + ".webp");
  await sharp(srcFile).webp({ quality: 78, effort: 5 }).toFile(outFile);
  totalIn += fs.statSync(srcFile).size;
  totalOut += fs.statSync(outFile).size;
  done++;
}

console.log("转换完成:", done, "张");
console.log("输入:", (totalIn / 1048576).toFixed(2), "MB");
console.log("输出:", (totalOut / 1048576).toFixed(2), "MB");
if (missing.length) console.log("缺失:", missing.join(", "));
console.log("输出目录:", OUT);
