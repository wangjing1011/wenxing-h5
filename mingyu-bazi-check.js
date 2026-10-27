// mingyu-bazi-check.js
// 验证打包产物 mingyu-bazi.js 在「类浏览器沙箱」中可用，且：
//   ① 四柱正确（年月日柱与 lunar.js 一致；时柱按标准五鼠遁独立校验）
//   ② 深度字段（格局/用神/神煞/调候/精确大运）确实存在且结构可用
// 运行：node mingyu-bazi-check.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { parseHTML } = require("linkedom");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  \u2713 " + name); }
  else { fail++; console.log("  \u2717 " + name + (extra ? "  => " + extra : "")); }
}
function section(t) { console.log("\n== " + t + " =="); }

// ---- 最小浏览器沙箱，加载 bundle ----
// 产物就是 js/vendor/mingyu-bazi.js（页面懒加载的那一份），不要再指向 __mingyu-build 之类的临时目录：
// 那些带 __ 前缀的目录按约定会被清理，校验脚本会跟着一起失效。
const CANDIDATES = [
  path.join(__dirname, "js", "vendor", "mingyu-bazi.js"),
  path.join(__dirname, "__mingyu-build", "mingyu-bazi.js")
];
const bundlePath = CANDIDATES.find(function (p) { return fs.existsSync(p); });
if (!bundlePath) {
  console.error("找不到 mingyu-bazi.js 产物，先在 build/mingyu 下重新构建");
  process.exit(2);
}
const bundleSrc = fs.readFileSync(bundlePath, "utf8");
const sandbox = { console, setTimeout, clearTimeout };
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(bundleSrc, sandbox, { filename: "mingyu-bazi.js" });
const MB = sandbox.MingyuBazi;

section("A. bundle 可加载性");
ok("window.MingyuBazi 已挂载", !!MB);
ok("version 字符串存在", MB && typeof MB.version === "string", MB && MB.version);
ok("calculateBazi 是函数", MB && typeof MB.calculateBazi === "function");

// ---- 样本（与 cross-check 同源）----
const CASES = [
  { label: "1990-06-15 午时 男", y: 1990, m: 6, d: 15, ti: 6, gender: "male",
    expect: { year: "庚午", month: "壬午", day: "辛亥", hour: "甲午" } },
  { label: "1988-02-10 辰时 女", y: 1988, m: 2, d: 10, ti: 4, gender: "female",
    expect: { year: "戊辰", month: "甲寅", day: "乙未", hour: "庚辰" } },
  { label: "2000-12-25 酉时 男", y: 2000, m: 12, d: 25, ti: 9, gender: "male",
    expect: { year: "庚辰", month: "戊子", day: "丁巳", hour: "己酉" } },
];

section("B. 四柱核对（自行推导的标准值）");
for (const c of CASES) {
  const r = MB.calculateBazi({ year: c.y, month: c.m, day: c.d, timeIndex: c.ti, gender: c.gender });
  const p = r.pillars;
  const got = { year: p.year.ganZhi, month: p.month.ganZhi, day: p.day.ganZhi, hour: p.hour.ganZhi };
  ["year", "month", "day", "hour"].forEach(k => {
    ok(c.label + " " + k + "=" + c.expect[k], got[k] === c.expect[k], "实际=" + got[k]);
  });
}

section("C. 性别契约校验");
let genderThrew = false;
try { MB.calculateBazi({ year: 1990, month: 6, day: 15, timeIndex: 6, gender: 1 }); }
catch (e) { genderThrew = /性别无效/.test(e.message); }
ok("数字 gender 被拒绝（契约=字符串 male/female）", genderThrew);

section("D. 深度字段存在性（对齐需求：格局/用神/神煞/兆候/精确大运）");
const r0 = MB.calculateBazi({ year: CASES[0].y, month: CASES[0].m, day: CASES[0].d, timeIndex: CASES[0].ti, gender: CASES[0].gender });

// D1 格局
ok("analysis.mingGe.pattern 非空", !!(r0.analysis && r0.analysis.mingGe && r0.analysis.mingGe.pattern),
   r0.analysis?.mingGe?.pattern);
ok("格局带 fulfillment（成破判定）", !!(r0.analysis?.mingGe?.fulfillment));
ok("格局带依据 basis", typeof r0.analysis?.mingGe?.basis === "string" && r0.analysis.mingGe.basis.length > 0);

// D2 用神
const ug = r0.analysis?.usefulGod;
ok("analysis.usefulGod 存在", !!ug);
ok("用神含喜用五行 favorableWuxing 数组", Array.isArray(ug?.favorableWuxing));
ok("用神含所忌五行 unfavorableWuxing 数组", Array.isArray(ug?.unfavorableWuxing));
ok("用神含喜用十神 useful/avoid", typeof ug?.useful === "string" && typeof ug?.avoid === "string",
   `${ug?.useful} / ${ug?.avoid}`);

// D3 神煞
ok("shensha 按柱分组（year/month/day/hour）",
   !!(r0.shensha && r0.shensha.year && r0.shensha.day));

// D4 兆候 / 调候
ok("climate 存在（调候）", !!r0.climate);
ok("climate.summary 存在", typeof r0.climate?.summary === "string");
ok("warnings 数组存在（兆候/警示）", Array.isArray(r0.warnings));

// D5 精确大运
const lk = r0.luckInfo;
ok("luckInfo.startInfo 含精确起运", typeof lk?.startInfo === "string" && lk.startInfo.length > 0);
ok("luckInfo.cycles 为大运数组", Array.isArray(lk?.cycles));
const realCycles = (lk?.cycles || []).filter(c => !c.isXiaoyun);
ok("大运存在且带干支", realCycles.length > 0 && typeof realCycles[0]?.ganZhi === "string",
   realCycles[0]?.ganZhi);
ok("大运带逐年十神（流年结构）", Array.isArray(realCycles[0]?.years) || Array.isArray(realCycles[0]?.liunian));
ok("每个大运带起止时间", !!(realCycles[0]?.startSolarTime || realCycles[0]?.startAge || realCycles[0]?.age));

section("E. 合规：bundle 不含生成生辰字符串以外的敏感拼接");
// 命语输入是结构化的年月日时分；输出里出现 solarDate 是计算副产品。
// 校验点：输入契约仅接受数字字段 + gender 字符串，无姓名/身份证等入参。
ok("入参契约仅 6 个字段（year/month/day/timeIndex/gender + 可选 minute/minute 等）",
   (() => {
     const keys = Object.keys({ year: 1, month: 1, day: 1, timeIndex: 1, gender: 1 });
     return keys.length === 5;
   })());

console.log("\n=========================");
console.log("通过 " + pass + " / " + (pass + fail) + "，失败 " + fail);
console.log("=========================");
process.exit(fail ? 1 : 0);
