// 族 B：排盘工具（黄历查询 + 八字排盘）
// 数据仅在本机计算与存储，不上传
(function () {
  "use strict";

  var BAZI_KEY = "wenxing_bazi_history";
  var CONSENT_KEY = "wenxing_bazi_consent";
  var WX_LIST = ["木", "火", "土", "金", "水"];
  var WX_COLOR = { "木": "#63b26b", "火": "#e0665f", "土": "#c9a75e", "金": "#b8b8c8", "水": "#5b8fd6" };
  // 干支本气五行：用于按四柱统计五行分布（与命语 pillars 口径一致）
  var GAN_WX = { "甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土", "己": "土", "庚": "金", "辛": "金", "壬": "水", "癸": "水" };
  var ZHI_WX = { "子": "水", "丑": "土", "寅": "木", "卯": "木", "辰": "土", "巳": "火", "午": "火", "未": "土", "申": "金", "酉": "金", "戌": "土", "亥": "水" };
  var SHENG = { "木": "火", "火": "土", "土": "金", "金": "水", "水": "木" }; // 我生者 · 相生链
  var BE_SHENG = { "木": "水", "火": "木", "土": "火", "金": "土", "水": "金" }; // 生我者

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // 兼容不同版本 API：取不到就返回默认值
  function safe(fn, def) {
    try {
      var v = fn();
      return (v === undefined || v === null || v === "") ? def : v;
    } catch (e) { return def; }
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  // 十神等接口可能返回字符串或数组，统一成数组处理
  function toArr(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") return v ? v.split(/[,，]/) : [];
    return [];
  }
  function toast(m) { if (window.AppView && window.AppView.toast) window.AppView.toast(m); }
  function showView(n) { if (window.AppView) window.AppView.show(n); }

  // ================= 生辰工具：农历解析 / 公历农历互转 / 真太阳时 =================
  // 暴露为 window.BirthUtil，供八字、紫微、起名共用（生辰只在本机计算，不外传）
  var CN_NUM = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  function cnMonthToNum(s) {
    if (s === "十") return 10;
    if (s === "十一") return 11;
    if (s === "十二") return 12;
    if (s === "冬") return 11;
    if (s === "腊") return 12;
    return CN_NUM[s] || null;
  }
  function cnDayToNum(s) {
    if (s === "卅" || s === "三十") return 30;
    if (s === "十") return 10;
    if (/^初/.test(s)) s = s.slice(1);
    if (/^十/.test(s)) return 10 + (CN_NUM[s.slice(1)] || 0);     // 十一..十九
    if (/^廿/.test(s)) return 20 + (CN_NUM[s.slice(1)] || 0);      // 廿一..廿九
    if (/^二十/.test(s)) return 20 + (CN_NUM[s.slice(2)] || 0);    // 二十..二十九
    if (/^三十/.test(s)) return 30;                               // 三十
    return CN_NUM[s] || null;
  }
  // 解析农历文本：支持「1990年八月初五」「1990年闰八月初五」「1990-08-05」「1990年8月5日」
  function parseLunar(raw) {
    if (!raw) return null;
    var s = String(raw).trim().replace(/[号]/g, "日").replace(/[年日\/\-\.\s]/g, "");
    var ym = s.match(/(\d{4})/);
    if (!ym) return null;
    var y = +ym[1];
    var rest = s.slice(ym.index + 4);
    var isLeap = /闰/.test(rest);
    rest = rest.replace(/闰/g, "");
    var m = null, d = null;
    // 月：阿拉伯「数字月」优先，否则中文月（月字可省）
    var mm = rest.match(/(\d{1,2})月/);
    if (mm) { m = +mm[1]; rest = rest.slice(rest.indexOf(mm[0]) + mm[0].length); }
    else {
      var cm = rest.match(/([正一二三四五六七八九十冬腊]+)/);
      if (cm) { m = cnMonthToNum(cm[1]); rest = rest.slice(cm.index + cm[0].length); }
    }
    if (!m || m < 1 || m > 12) {
      var dd = rest.match(/^(\d{1,2})(\d{1,2})$/);   // 兜底：纯数字 MMDD（如 0805）
      if (dd) { m = +dd[1]; d = +dd[2]; }
      else return null;
    }
    rest = rest.replace(/月/g, "");
    if (d == null) {
      var dm = rest.match(/(\d{1,2})/);
      if (dm) d = +dm[1];
    }
    if (!d || d < 1 || d > 30) {
      var cd = rest.match(/(初[一二三四五六七八九十]+|十[一二三四五六七八九]?|二十[一二三四五六七八九]?|廿[一二三四五六七八九]?|三十|卅)/);
      if (cd) d = cnDayToNum(cd[0]);
    }
    if (!d || d < 1 || d > 30) return null;
    return { y: y, m: m, d: d, isLeap: isLeap };
  }
  // 公历 / 农历 二选一 → 统一返回公历 y/m/d（农历先转公历再喂排盘引擎）
  function resolveDate(solarVal, lunarVal) {
    if (solarVal) {
      var p = String(solarVal).split("-");
      if (p.length < 3 || !p[0] || !p[1] || !p[2]) return { error: "公历日期格式不正确" };
      return { y: +p[0], m: +p[1], d: +p[2], from: "solar" };
    }
    if (lunarVal) {
      var lp = parseLunar(lunarVal);
      if (!lp) return { error: "农历日期无法识别，请按「1990年八月初五」或「1990-08-05」格式填写" };
      try {
        var lu = window.Lunar.fromYmd(lp.y, lp.m, lp.d, lp.isLeap);
        var so = lu.getSolar();
        return { y: so.getYear(), m: so.getMonth(), d: so.getDay(), from: "lunar", lunar: lp };
      } catch (e) {
        try {
          var lu2 = window.Lunar.fromYmd(lp.y, lp.m, lp.d);
          var so2 = lu2.getSolar();
          return { y: so2.getYear(), m: so2.getMonth(), d: so2.getDay(), from: "lunar", lunar: lp };
        } catch (e2) { return { error: "农历日期无效（可能为不存在的闰月或日期）" }; }
      }
    }
    return { error: "请填写公历或农历出生日期" };
  }
  // 主要城市经度表（东经为正，单位：度），用于真太阳时校正
  var CITY_LNG = {
    "北京": 116.41, "上海": 121.47, "广州": 113.26, "深圳": 114.06, "成都": 104.07, "重庆": 106.55,
    "杭州": 120.15, "武汉": 114.30, "西安": 108.95, "南京": 118.80, "天津": 117.20, "苏州": 120.62,
    "郑州": 113.65, "长沙": 112.94, "沈阳": 123.43, "哈尔滨": 126.63, "大连": 121.62, "济南": 117.00,
    "青岛": 120.38, "厦门": 118.09, "福州": 119.30, "昆明": 102.71, "贵阳": 106.71, "南宁": 108.37,
    "兰州": 103.83, "太原": 112.55, "石家庄": 114.51, "合肥": 117.27, "南昌": 115.86, "海口": 110.33,
    "三亚": 109.51, "乌鲁木齐": 87.62, "拉萨": 91.11, "呼和浩特": 111.75, "银川": 106.27, "西宁": 101.78,
    "香港": 114.17, "澳门": 113.55, "台北": 121.56, "桂林": 110.29, "泉州": 118.68, "温州": 120.65,
    "宁波": 121.55, "无锡": 120.30, "常州": 119.95, "佛山": 113.12, "东莞": 113.75, "唐山": 118.18,
    "徐州": 117.18, "绍兴": 120.58, "嘉兴": 120.76, "南通": 120.86, "保定": 115.46, "洛阳": 112.45,
    "烟台": 121.39, "潍坊": 119.10, "临沂": 118.35, "淄博": 118.05, "昆明": 102.71
  };
  function normalizeCity(s) {
    return String(s || "").replace(/[市省县区州特别行政区\s]/g, "");
  }
  function lookupLng(city) {
    if (!city) return null;
    var n = normalizeCity(city);
    if (CITY_LNG[n] != null) return CITY_LNG[n];
    for (var k in CITY_LNG) { if (n.indexOf(k) >= 0 || k.indexOf(n) >= 0) return CITY_LNG[k]; }
    return null;
  }
  function dayOfYear(y, m, d) {
    var start = new Date(y, 0, 1);
    var cur = new Date(y, m - 1, d);
    return Math.floor((cur - start) / 86400000) + 1;
  }
  // 均时差近似（分钟）：真太阳时 = 平太阳时 + 均时差
  function equationOfTime(doy) {
    var B = 360 / 365 * (doy - 81) * Math.PI / 180;
    return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  }
  // 校正后的钟点 → 时辰对应的偶数 hour 值（与表单一致：0子 2丑 … 22亥）
  function hourToEven(h) {
    if (h === 23 || h === 0) return 0;
    if (h === 1 || h === 2) return 2;
    if (h === 3 || h === 4) return 4;
    if (h === 5 || h === 6) return 6;
    if (h === 7 || h === 8) return 8;
    if (h === 9 || h === 10) return 10;
    if (h === 11 || h === 12) return 12;
    if (h === 13 || h === 14) return 14;
    if (h === 15 || h === 16) return 16;
    if (h === 17 || h === 18) return 18;
    if (h === 19 || h === 20) return 20;
    if (h === 21 || h === 22) return 22;
    return 0;
  }
  // 真太阳时校正：以所选时辰中心代表钟点，按出生地经度重排（含跨日）
  function trueSolarAdjust(y, m, d, evenHour, city, useTrueSun) {
    if (!useTrueSun) return { y: y, m: m, d: d, h: evenHour, shifted: false };
    var lng = lookupLng(city);
    if (lng == null) return { y: y, m: m, d: d, h: evenHour, shifted: false, noCity: true };
    var baseMin = evenHour * 60;                 // 时辰中心代表分钟
    var doy = dayOfYear(y, m, d);
    var eot = equationOfTime(doy);               // 均时差（分钟）
    var tst = baseMin - (120 - lng) * 4 + eot;   // 真太阳时（分钟，东经120°为基准）
    var dd = new Date(y, m - 1, d);
    var dayDelta = Math.floor(tst / 1440);
    var rem = ((tst % 1440) + 1440) % 1440;
    dd.setDate(dd.getDate() + dayDelta);
    var ch = Math.floor(rem / 60);
    return { y: dd.getFullYear(), m: dd.getMonth() + 1, d: dd.getDate(), h: hourToEven(ch), shifted: true, lng: lng };
  }
  window.BirthUtil = {
    parseLunar: parseLunar, resolveDate: resolveDate, lookupLng: lookupLng,
    trueSolarAdjust: trueSolarAdjust, CITY_LNG: CITY_LNG,
    dayOfYear: dayOfYear, equationOfTime: equationOfTime
  };

  // ================= 黄历查询 =================
  function todayStr() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function shiftStr(s, days) {
    var p = s.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function hlTip(yi, ji, gods, bads) {
    function isNone(a) { return !a || a.length === 0 || (a.length === 1 && (a[0] === "无" || a[0] === "")); }
    if (isNone(ji)) return "今天忌事很少，宜事安排得挺满——适合推进那些一直拖着没动的事。";
    if (isNone(yi)) return "今天宜事偏少，更适合休整、整理和收尾，不必硬开新局。";
    if (gods.length >= bads.length) return "吉神略占上风，整体气场偏顺；重要的事可以安排上，但别贪多。";
    return "凶煞略多，今天更适合稳：把手头的事做好，避开冲动决策和高风险操作。";
  }

  // ---- 今日穿衣颜色：以当日「日干五行」为参照，按五行生克分吉忌 ----
  // 生我者（贵人）、同我者（助力）宜穿；我克者（财）平；我生者（泄气）、克我者（相冲）少穿
  var STEM_WX = { "甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土", "己": "土", "庚": "金", "辛": "金", "壬": "水", "癸": "水" };
  var WX_SHENG = { "木": "火", "火": "土", "土": "金", "金": "水", "水": "木" };  // 我生
  var WX_KE = { "木": "土", "土": "水", "水": "火", "火": "金", "金": "木" };     // 我克
  var WX_COLOR = {
    "木": [["绿", "#4e9d68", 0], ["青", "#4f9d97", 0], ["翠", "#2f9e6e", 0]],
    "火": [["红", "#c74b4b", 0], ["橙", "#cf7440", 0], ["紫", "#8f63bf", 0]],
    "土": [["黄", "#c9a44e", 1], ["棕", "#8a6a4a", 0], ["米", "#cdbb98", 1]],
    "金": [["白", "#e9e5da", 1], ["银", "#b9bcc6", 1], ["金", "#d4b96a", 1]],
    "水": [["黑", "#3b3b47", 0], ["蓝", "#4a72ad", 0], ["灰蓝", "#6d8199", 0]]
  };
  function revWx(map, v) { for (var k in map) { if (map[k] === v) return k; } return ""; }

  function renderWear(dayGZ) {
    var stem = String(dayGZ || "").charAt(0);
    var me = STEM_WX[stem];
    if (!me) return "";
    var guiRen = revWx(WX_SHENG, me);   // 生我 → 贵人色
    var tongQi = me;                    // 同我 → 助力色
    var caiSe = WX_KE[me];              // 我克 → 财色（得财但费力）
    var haoQi = WX_SHENG[me];           // 我生 → 泄气色
    var chong = revWx(WX_KE, me);       // 克我 → 相冲色

    function chips(el) {
      return (WX_COLOR[el] || []).map(function (c) {
        return '<span class="cchip' + (c[2] ? " dark" : "") + '" style="background:' + c[1] + ";color:" +
          (c[2] ? "#2b2440" : "#fff") + '">' + esc(c[0]) + "</span>";
      }).join("");
    }
    var rows = [
      ["g1", "大吉 · 贵人色", guiRen],
      ["g2", "次吉 · 助力色", tongQi],
      ["mid", "平 · 财色", caiSe],
      ["b1", "少穿 · 泄气色", haoQi],
      ["b2", "忌 · 相冲色", chong]
    ];

    return '<div class="hl-sec"><h4>穿衣颜色</h4>' +
      '<div class="hl-wear">' +
        rows.map(function (r) {
          return '<div class="wr"><span class="wl ' + r[0] + '">' + esc(r[1]) + "</span>" +
            '<span class="wc">' + chips(r[2]) + "</span></div>";
        }).join("") +
      "</div>" +
      '<p class="hl-wear-note">以今日日干 <b>' + esc(stem) + "（" + esc(me) + "）</b> 为「我」：" +
        esc(guiRen) + "生" + esc(me) + "为大吉，" + esc(me) + "同气为助力，" +
        esc(me) + "克" + esc(caiSe) + "为财、" + esc(me) + "生" + esc(haoQi) + "为泄气，" +
        esc(chong) + "克" + esc(me) + "为相冲。颜色是给心情用的，不必为它换掉整柜衣服。</p>" +
      "</div>";
  }

  function renderHuangLi() {
    var v = $("hl-date").value || todayStr();
    var p = v.split("-");
    var solar = Solar.fromYmd(+p[0], +p[1], +p[2]);
    var lunar = Lunar.fromSolar(solar);

    var yi = toArr(safe(function () { return lunar.getDayYi(); }, []));
    var ji = toArr(safe(function () { return lunar.getDayJi(); }, []));
    var gods = toArr(safe(function () { return lunar.getDayJiShen(); }, []));
    var bads = toArr(safe(function () { return lunar.getDayXiongSha(); }, []));
    var jq = safe(function () { return lunar.getJieQi(); }, "");
    var chong = safe(function () { return lunar.getDayChongDesc(); }, "");
    var pengG = safe(function () { return lunar.getPengZuGan(); }, "");
    var pengZ = safe(function () { return lunar.getPengZuZhi(); }, "");

    var html = '<div class="hl-card">' +
      '<div class="hl-head">' +
        '<div class="d1">' + esc(safe(function () { return lunar.getDayInChinese(); }, "")) + "</div>" +
        '<div class="d2">' + esc(v) + " 星期" + esc(safe(function () { return lunar.getWeekInChinese(); }, "")) + "<br>" +
        "农历" + esc(safe(function () { return lunar.getMonthInChinese(); }, "")) + "月" +
        esc(safe(function () { return lunar.getDayInChinese(); }, "")) + " · " +
        esc(safe(function () { return lunar.getYearInGanZhi(); }, "")) + "年" +
        esc(safe(function () { return lunar.getMonthInGanZhi(); }, "")) + "月" +
        esc(safe(function () { return lunar.getDayInGanZhi(); }, "")) + "日" +
        " · 生肖" + esc(safe(function () { return lunar.getYearShengXiao(); }, "")) + "</div>" +
      "</div>" +
      '<div class="hl-sec"><h4>宜</h4><div class="tag-wall">' +
        (yi.length ? yi.map(function (t) { return '<span class="tag yi">' + esc(t) + "</span>"; }).join("") : '<span class="tag ji">无</span>') +
      "</div></div>" +
      '<div class="hl-sec"><h4>忌</h4><div class="tag-wall">' +
        (ji.length ? ji.map(function (t) { return '<span class="tag ji">' + esc(t) + "</span>"; }).join("") : '<span class="tag yi">无</span>') +
      "</div></div>" +
      renderWear(safe(function () { return lunar.getDayInGanZhi(); }, ""));

    var rows = [];
    if (jq) rows.push(["节气", jq]);
    if (chong) rows.push(["冲煞", "冲" + chong]);
    if (pengG) rows.push(["彭祖", pengG]);
    if (pengZ) rows.push(["　", pengZ]);
    if (gods.length) rows.push(["吉神", gods.join("、")]);
    if (bads.length) rows.push(["凶煞", bads.join("、")]);
    rows.push(["财神 / 喜神", safe(function () { return lunar.getDayPositionCai(); }, "-") + " / " + safe(function () { return lunar.getDayPositionXi(); }, "-")]);
    rows.push(["福神 / 阳贵", safe(function () { return lunar.getDayPositionFu(); }, "-") + " / " + safe(function () { return lunar.getDayPositionYangGui(); }, "-")]);

    html += '<div class="hl-sec"><h4>当日信息</h4>' +
      rows.map(function (r) {
        return '<div class="hl-row"><span class="k">' + esc(r[0]) + '</span><span class="v">' + esc(r[1]) + "</span></div>";
      }).join("") + "</div>" +
      '<div class="hl-tip">' + esc(hlTip(yi, ji, gods, bads)) + "<br>宜忌出自传统历书，是古人的生活经验，不是束缚——重要的事，还是交给你的判断。</div>" +
      "</div>";

    $("hl-result").innerHTML = html;
  }

  // ================= 八字排盘 =================
  var gender = 1;
  var baziState = null; // 排好盘后的结构化数据，供 AI 解读使用（绝不含生辰/姓名）
  var mingyuDeep = null; // 命语深度分析结果（格局/用神/神煞/调候/精确大运），本地计算

  // ---- 命语 mingyu-core/bazi 懒加载（1MB vendor 包，按需加载，不拖累首屏）----
  var MINGYU_SRC = "js/vendor/mingyu-bazi.js";
  var mingyuLoading = null;
  function ensureMingyu() {
    if (window.MingyuBazi) return Promise.resolve(window.MingyuBazi);
    if (mingyuLoading) return mingyuLoading;
    mingyuLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = MINGYU_SRC;
      s.async = true;
      s.onload = function () { window.MingyuBazi ? resolve(window.MingyuBazi) : reject(new Error("MingyuBazi 未挂载")); };
      s.onerror = function () { mingyuLoading = null; reject(new Error("命语脚本加载失败")); };
      document.head.appendChild(s);
    });
    return mingyuLoading;
  }

  // 表单时辰（偶数小时）→ 命语 timeIndex（0=早子 1=丑 … 11=亥 12=晚子）
  function hourToTimeIndex(h) {
    // 表单：0=子 2=丑 4=寅 … 22=亥；时辰不确定时按午时(12)
    if (!(h >= 0)) h = 12;
    if (h === 0) return 0;              // 子时按早子
    return Math.round(h / 2);           // 2→1 丑, 4→2 寅, … 22→11 亥
  }

  // 五行计数：按四柱「天干本气 + 地支本气」共 8 字统计，与命语 pillars 口径一致
  function wuXingCount(pillars) {
    var cnt = { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };
    pillars.forEach(function (pl) {
      String(pl.wx || "").split("").forEach(function (c) { if (cnt[c] !== undefined) cnt[c]++; });
    });
    return cnt;
  }

  // ---- 命语深度分析的渲染块（格局 / 用神喜忌 / 神煞 / 调候 / 精确大运）----
  // 入参 deep 为 window.MingyuBazi.calculateBazi 的返回对象
  function renderMingyuDeep(deep) {
    if (!deep) return "";
    var an = deep.analysis || {};
    var mg = an.mingGe || {};
    var ug = an.usefulGod || {};
    var cl = deep.climate || {};
    var lk = deep.luckInfo || {};
    var html = '<div class="bz-sec my-deep">';

    // 1) 格局
    if (mg.pattern) {
      var ful = mg.fulfillment || {};
      html += '<div class="bz-item"><b>格局 · ' + esc(mg.pattern) + "</b>" +
        (ful.status ? '<p style="margin-top:4px">成破判定：<b>' + esc(ful.status) + "</b>" +
          (ful.decisionDetail ? "，" + esc(ful.decisionDetail) : "") + "</p>" : "") +
        (mg.basis ? "<p>" + esc(mg.basis) + "</p>" : "") +
        "</div>";
    }

    // 2) 日主强弱（命语口径）
    var dms = an.dayMasterStrength;
    if (dms && dms.status) {
      // 注：命语字段名为 details（复数）
      var dmsd = dms.details || dms.detail || {};
      html += '<div class="bz-item"><b>日主旺衰 · ' + esc(dms.status) + "</b>" +
        (dmsd.seasonalEffect ? "<p>月令" + esc(dmsd.seasonalEffect) +
          "，司令" + esc(dmsd.commanderEffect || "-") + "</p>" : "") +
        "</div>";
    }

    // 3) 用神喜忌（十神 + 五行）
    var fav = toArr(ug.favorableWuxing), un = toArr(ug.unfavorableWuxing);
    if (ug.useful || fav.length || un.length) {
      html += '<div class="bz-item"><b>用神喜忌</b><p>' +
        (ug.useful ? "喜用十神：" + esc(ug.useful) + "；" : "") +
        (ug.avoid ? "所忌十神：" + esc(ug.avoid) + "；" : "") +
        (fav.length ? "喜用五行：" + esc(fav.join("、")) + "；" : "") +
        (un.length ? "所忌五行：" + esc(un.join("、")) : "") +
        "</p>" +
        (ug.primaryReason ? "<p>" + esc(ug.primaryReason) + "</p>" : "") +
        "</div>";
    }

    // 4) 调候
    if (cl.summary) {
      html += '<div class="bz-item"><b>调候</b><p>' + esc(cl.summary) + "</p>" +
        (cl.medicine ? "<p>取用：" + esc(Array.isArray(cl.medicine) ? cl.medicine.join("、") : cl.medicine) + "</p>" : "") +
        "</div>";
    }

    // 5) 神煞（按柱）
    var ss = deep.shensha || {};
    var ssLabels = { year: "年柱", month: "月柱", day: "日柱", hour: "时柱" };
    var ssRows = ["year", "month", "day", "hour"].filter(function (k) {
      return toArr(ss[k]).length > 0;
    }).map(function (k) {
      return '<div class="dy-row"><span class="gz">' + esc(ssLabels[k]) + "</span><span class=\"age\">" +
        esc(toArr(ss[k]).join("、")) + "</span></div>";
    }).join("");
    if (ssRows) {
      html += '<div class="bz-item"><b>神煞</b>' + ssRows + "</div>";
    }

    // 6) 精确大运（命语：含精确起运时刻、小运、逐年十神）
    var cycles = toArr(lk.cycles).filter(function (c) { return !c.isXiaoyun; });
    if (lk.startInfo) {
      html += '<div class="bz-item"><b>精确起运</b><p>' + esc(lk.startInfo) + "</p></div>";
    }
    if (cycles.length) {
      html += '<div class="bz-item"><b>大运（逐年十神）</b>' +
        cycles.slice(0, 8).map(function (c) {
          var yr = toArr(c.years);
          return '<div class="my-dayun"><div class="my-dayun-h"><span class="gz">' + esc(c.ganZhi || "") +
            '</span><span class="age">' + esc(c.age != null ? c.age + " 岁起" : "") +
            (c.startSolarTime ? " · " + esc(c.startSolarTime.year) : "") + "</span></div>" +
            (yr.length ? '<div class="my-dayun-body">' + yr.slice(0, 10).map(function (y) {
              return '<span class="my-yr">' + esc(y.year) + " " + esc(y.ganZhi) +
                (y.tenGod ? '<i>' + esc(y.tenGod) + "</i>" : "") + "</span>";
            }).join("") + "</div>" : "") +
            "</div>";
        }).join("") +
        "</div>";
    }

    // 7) 兆候 / 警示
    if (toArr(deep.warnings).length) {
      html += '<div class="bz-item"><b>需留意</b><p>' + esc(toArr(deep.warnings).join("；")) + "</p></div>";
    }

    html += '<p class="gen-note">深度解读由命语（mingyu-core，AGPL-3.0）本地计算，提供结构化参考，不构成命运判定。</p>';
    html += "</div>";
    return html;
  }

  // ============ 四柱数据源：命语（主） / lunar（兜底） ============
  // 命语口径：干支、天干十神、地支藏干十神、纳音 全部取自 mingyu-core/bazi
  function pillarsFromMingyu(deep) {
    var p = deep.pillars || {}, tg = deep.tenGods || {}, ht = deep.hiddenTenGods || {}, ny = deep.nayin || {};
    return [["year", "年柱"], ["month", "月柱"], ["day", "日柱"], ["hour", "时柱"]].map(function (o) {
      var k = o[0], gz = (p[k] && p[k].ganZhi) || "";
      return {
        lab: o[1], gz: gz,
        g: tg[k] || "",
        z: toArr(ht[k]),
        ny: ny[k] || "",
        wx: (GAN_WX[gz.charAt(0)] || "") + (ZHI_WX[gz.charAt(1)] || "")
      };
    });
  }
  // lunar 口径：仅在命语不可用时兜底
  function pillarsFromLunar(ec) {
    return [
      { lab: "年柱", gz: safe(function () { return ec.getYear(); }, ""), g: safe(function () { return ec.getYearShiShenGan(); }, ""), z: safe(function () { return ec.getYearShiShenZhi(); }, ""), ny: safe(function () { return ec.getYearNaYin(); }, ""), wx: safe(function () { return ec.getYearWuXing(); }, "") },
      { lab: "月柱", gz: safe(function () { return ec.getMonth(); }, ""), g: safe(function () { return ec.getMonthShiShenGan(); }, ""), z: safe(function () { return ec.getMonthShiShenZhi(); }, ""), ny: safe(function () { return ec.getMonthNaYin(); }, ""), wx: safe(function () { return ec.getMonthWuXing(); }, "") },
      { lab: "日柱", gz: safe(function () { return ec.getDay(); }, ""), g: safe(function () { return ec.getDayShiShenGan(); }, ""), z: safe(function () { return ec.getDayShiShenZhi(); }, ""), ny: safe(function () { return ec.getDayNaYin(); }, ""), wx: safe(function () { return ec.getDayWuXing(); }, "") },
      { lab: "时柱", gz: safe(function () { return ec.getTime(); }, ""), g: safe(function () { return ec.getTimeShiShenGan(); }, ""), z: safe(function () { return ec.getTimeShiShenZhi(); }, ""), ny: safe(function () { return ec.getTimeNaYin(); }, ""), wx: safe(function () { return ec.getTimeWuXing(); }, "") }
    ];
  }

  // 统一模型：两种数据源共用同一套派生逻辑（五行分布 / 强弱 / 十神集合）
  function composeBaziModel(pillars, x) {
    var dmGan = x.dmGan || "";
    var dm = window.BAZI_LIB.dayMaster[dmGan] || { el: "", trait: "", tip: "" };
    var cnt = wuXingCount(pillars);
    var monthZhiWx = (pillars[1].wx || "").charAt(1); // 月支五行（得令判断）
    // 日主强弱（简化参考）
    var party = (cnt[dm.el] || 0) + (cnt[BE_SHENG[dm.el]] || 0);
    var deLing = (monthZhiWx === dm.el || monthZhiWx === BE_SHENG[dm.el]);
    if (deLing) party += 1;
    var strengthKey = party >= 5 ? "strong" : (party <= 3 ? "weak" : "balance");
    // 十神收集（天干 + 地支藏干）
    var ssSet = [];
    pillars.forEach(function (pl) {
      [pl.g, pl.z].forEach(function (s) {
        toArr(s).forEach(function (one) {
          one = String(one).trim();
          if (one && one !== "日主" && ssSet.indexOf(one) < 0) ssSet.push(one);
        });
      });
    });
    return {
      pillars: pillars, dmGan: dmGan, dm: dm, cnt: cnt, monthZhiWx: monthZhiWx,
      deLing: deLing, strengthKey: strengthKey, ssSet: ssSet,
      gzStr: pillars.map(function (pl) { return pl.gz; }).join(" "),
      lunarText: x.lunarText || "", yearGZ: x.yearGZ || "", shengXiao: x.shengXiao || "",
      taiYuan: x.taiYuan || "-", mingGong: x.mingGong || "-",
      yunStart: x.yunStart || "", daYun: x.daYun || [], source: x.source || "lunar"
    };
  }

  function modelFromLunar(ec, lunar, ctx) {
    var yun = safe(function () { return ec.getYun(ctx.gender); }, null);
    var yunStart = "", daYun = [];
    if (yun) {
      var startSolar = safe(function () { return yun.getStartSolar().toYmd(); }, "");
      yunStart = safe(function () { return yun.getStartYear(); }, 0) + "年" +
        safe(function () { return yun.getStartMonth(); }, 0) + "月" +
        safe(function () { return yun.getStartDay(); }, 0) + "天后起运" +
        (startSolar ? "（约 " + startSolar + "）" : "");
      daYun = safe(function () { return yun.getDaYun(); }, []).filter(function (d) {
        return safe(function () { return d.getGanZhi(); }, "") !== "";
      }).slice(0, 10).map(function (d) {
        return {
          gz: safe(function () { return d.getGanZhi(); }, ""),
          age: safe(function () { return d.getStartAge(); }, ""),
          year: safe(function () { return d.getStartYear(); }, "")
        };
      });
    }
    return composeBaziModel(pillarsFromLunar(ec), {
      dmGan: safe(function () { return ec.getDayGan(); }, ""),
      lunarText: safe(function () { return lunar.getMonthInChinese() + lunar.getDayInChinese(); }, ""),
      yearGZ: safe(function () { return lunar.getYearInGanZhi(); }, ""),
      shengXiao: safe(function () { return lunar.getYearShengXiao(); }, ""),
      taiYuan: safe(function () { return ec.getTaiYuan(); }, "-"),
      mingGong: safe(function () { return ec.getMingGong(); }, "-"),
      yunStart: yunStart, daYun: daYun, source: "lunar"
    });
  }

  function modelFromMingyu(deep, ctx) {
    var ld = deep.lunarDate || {};
    var lk = deep.luckInfo || {};
    var daYun = toArr(lk.cycles).filter(function (c) { return !c.isXiaoyun; }).slice(0, 10).map(function (c) {
      return { gz: c.ganZhi || "", age: c.age != null ? c.age : "" };
    });
    return composeBaziModel(pillarsFromMingyu(deep), {
      dmGan: (deep.dayMaster && deep.dayMaster.gan) ||
        (deep.pillars && deep.pillars.day && deep.pillars.day.gan) || "",
      lunarText: (ld.monthName || "") + (ld.dayName || ""),
      yearGZ: (deep.pillars && deep.pillars.year && deep.pillars.year.ganZhi) || "",
      shengXiao: deep.zodiac || "",
      taiYuan: deep.taiYuan || "-",
      mingGong: deep.mingGong || "-",
      yunStart: lk.startInfo ? String(lk.startInfo) : "", daYun: daYun, source: "mingyu"
    });
  }

  // 结果卡片渲染：基础四柱 + 派生分析 + （可选）命语深度解读
  // 可折叠小节：默认收起，减少首屏长度与视觉噪音
  function foldSec(title, inner) {
    return '<details class="bz-fold"><summary>' + esc(title) + "</summary>" +
      '<div class="bz-fold-body">' + inner + "</div></details>";
  }

  function renderBaziHtml(m, ctx, deep) {
    var html = '<div class="bz-card">' +
      '<div class="bz-title">' + esc(ctx.name ? ctx.name + " 的命盘" : "您的命盘") + "</div>" +
      '<div class="bz-sub">' + esc(ctx.dateStr) + " " + pad(ctx.h) + ":00（" + (ctx.unknown ? "时辰不确定 · 按午时" : "时辰") + "）<br>" +
      "农历" + esc(m.lunarText) + " · " + esc(m.yearGZ) + "年 · 生肖" + esc(m.shengXiao) + " · " + (ctx.gender === 1 ? "男" : "女") + "</div>" +
      '<div class="pillar-row">' +
      m.pillars.map(function (pl) {
        return '<div class="pillar"><div class="lab">' + esc(pl.lab) + '</div>' +
          '<div class="gz"><span>' + esc(pl.gz.charAt(0)) + "</span><span>" + esc(pl.gz.charAt(1)) + "</span></div>" +
          '<div class="ss">' + esc(toArr(pl.g).join("·")) + "<br>" + esc(toArr(pl.z).join("·")) + "</div>" +
          '<div class="ny">' + esc(pl.ny) + "</div></div>";
      }).join("") +
      "</div>" +
      '<div class="bz-sec"><h4>五行分布</h4>' +
        '<div class="wx-bar">' +
          WX_LIST.filter(function (w) { return (m.cnt[w] || 0) > 0; }).map(function (w) {
            var c = m.cnt[w] || 0;
            return '<i style="width:' + (c / 8 * 100).toFixed(2) + "%;background:" + WX_COLOR[w] + '" title="' + w + c + '"></i>';
          }).join("") +
        "</div>" +
        '<div class="wx-legend">' +
          WX_LIST.map(function (w) {
            var c = m.cnt[w] || 0;
            return '<span' + (c ? "" : ' class="zero"') + '><i style="background:' + WX_COLOR[w] + '"></i>' +
              w + " <b>" + c + "</b></span>";
          }).join("") +
        "</div>" +
      "</div>" +
      '<div class="bz-sec"><h4>日主 · ' + esc(m.dmGan) + (m.dm.el ? "（" + esc(m.dm.el) + "）" : "") + "</h4>" +
        '<div class="bz-dm">' +
          '<div class="row"><span class="k">气质</span><span class="v">' + esc(m.dm.trait) + "</span></div>" +
          '<div class="row"><span class="k">提醒</span><span class="v">' + esc(String(m.dm.tip || "").replace(/^提醒[:：]\s*/, "")) + "</span></div>" +
          '<div class="row"><span class="k">强弱参考</span><span class="v">' + esc(window.BAZI_LIB.strength[m.strengthKey]) +
          (m.deLing ? "日主得月令，先天底气较足。" : "日主不得月令，更依赖后天的环境与积累。") + "</span></div>" +
        "</div>" +
      "</div>";

    // 十神速览（折叠）
    var shiInner = m.ssSet.length ? m.ssSet.slice(0, 6).map(function (s) {
      var d = window.BAZI_LIB.shiShen[s];
      return d ? '<div class="bz-item"><b>' + esc(s) + "</b><p>" + esc(d) + "</p></div>" : "";
    }).join("") : '<div class="bz-item"><p>未取到十神信息</p></div>';
    html += foldSec("十神速览", shiInner);

    // 五行提示（折叠）
    var wxInner = WX_LIST.filter(function (w) { return (m.cnt[w] || 0) >= 3 || (m.cnt[w] || 0) === 0; }).map(function (w) {
      var t = window.BAZI_LIB.wuXing[w];
      return '<div class="bz-item"><b>' + esc(w) + "（" + (m.cnt[w] || 0) + "）</b><p>" +
        esc((m.cnt[w] || 0) === 0 ? t.few : t.many) + "</p></div>";
    }).join("") || '<div class="bz-item"><p>五行分布较均衡，暂无特别需要补的。</p></div>';
    html += foldSec("五行提示", wxInner);

    // 大运（折叠）
    if (m.daYun.length) {
      var dyInner = (m.yunStart ? '<div class="bz-item"><b>起运</b><p>' + esc(m.yunStart) + "</p></div>" : "") +
        m.daYun.map(function (d) {
          return '<div class="dy-row"><span class="gz">' + esc(d.gz) + '</span><span class="age">' +
            esc(d.age !== "" && d.age != null ? d.age + " 岁起" : "") +
            (d.year ? " · " + esc(d.year) : "") + "</span></div>";
        }).join("") +
        '<div class="bz-item" style="margin-top:10px"><p>' + esc(window.BAZI_LIB.daYunNote) + "</p></div>";
      html += foldSec("大运", dyInner);
    }

    // 其他（折叠）
    html += foldSec("其他（胎元 · 命宫）",
      '<div class="dy-row"><span class="gz">胎元</span><span class="age">' + esc(m.taiYuan) + "</span></div>" +
      '<div class="dy-row"><span class="gz">命宫</span><span class="age">' + esc(m.mingGong) + "</span></div>");

    // 命语深度解读（折叠，内容较长默认收起）
    if (deep) html += foldSec("深度解读（命语）", renderMingyuDeep(deep));

    html += '<p class="gen-note" style="margin-top:14px">' + esc(window.BAZI_LIB.note) + "</p>" +
      '<div class="result-actions" style="margin-top:12px"><button class="btn ai-btn" id="btn-bazi-ai">AI 解读（灵感视角）</button></div>' +
      '<div class="ai-box" id="bazi-ai-box" style="display:none"></div>' +
      '<button class="btn gold" id="btn-bazi-save" style="margin-top:14px">存入「我的命盘」</button>' +
      "</div>";
    return html;
  }

  // 渲染并绑定事件：用 onclick 覆盖赋值，反复排盘不会重复绑定
  function paintBazi(m, ctx, deep) {
    var prevState = baziState;
    // 记录结构化命盘（供 AI 解读；不含生辰/姓名，只传干支/五行/十神）
    baziState = {
      pillars: m.pillars, dmGan: m.dmGan, dm: m.dm, cnt: m.cnt,
      strengthKey: m.strengthKey, deLing: m.deLing, ssSet: m.ssSet,
      daYun: m.daYun.map(function (d) {
        return {
          gz: d.gz, startAge: d.age
          // 注：不放年份（会暴露原始出生年，违反"生辰不上云"）
        };
      }),
      taiYuan: m.taiYuan, mingGong: m.mingGong,
      meta: { name: ctx.name, gender: ctx.gender, date: ctx.dateStr, hour: ctx.h, unknown: ctx.unknown, gz: m.gzStr, dm: m.dmGan + (m.dm.el || "") }
    };
    if (prevState && prevState.aiText) baziState.aiText = prevState.aiText;

    // 命语升级会重绘结果区，保留用户已生成的解读，避免被清掉
    var oldBox = $("bazi-ai-box");
    var keepHtml = oldBox && oldBox.innerHTML ? oldBox.innerHTML : "";
    var keepShown = !!(oldBox && oldBox.style.display === "block");

    $("bazi-result").innerHTML = renderBaziHtml(m, ctx, deep);

    // 结果区每次重绘都会产生全新的按钮元素，故直接绑定即可（不会重复叠加）
    var saveBtn = $("btn-bazi-save");
    if (saveBtn) saveBtn.addEventListener("click", onSaveBazi);
    var aiBtn = $("btn-bazi-ai");
    if (aiBtn) aiBtn.addEventListener("click", function () { requestBaziAI(aiBtn); });
    var newBox = $("bazi-ai-box");
    if (newBox && keepHtml) {
      newBox.innerHTML = keepHtml;
      if (keepShown) newBox.style.display = "block";
    }
  }

  function onSaveBazi() {
    if (!baziState || !baziState.meta) return;
    var mt = baziState.meta;
    var rec = { t: Date.now(), name: mt.name, gender: mt.gender, date: mt.date, hour: mt.hour, unknown: mt.unknown, gz: mt.gz, dm: mt.dm };
    var list = loadBazi();
    list.unshift(rec);
    try {
      localStorage.setItem(BAZI_KEY, JSON.stringify(list.slice(0, 20)));
      var b = $("btn-bazi-save");
      if (b) { b.disabled = true; b.textContent = "已存入 ✓"; }
      renderBaziHistory();
    } catch (e) { toast("保存失败：本机存储不可用"); }
  }

  function doBazi() {
    var solarVal = $("bz-date").value;
    var lunarVal = ($("bz-lunar").value || "").trim();
    var city = ($("bz-city").value || "").trim();
    var useTrueSun = $("bz-truesun") && $("bz-truesun").checked;

    // 公历 / 农历 二选一 → 统一公历年月日
    var rd = window.BirthUtil.resolveDate(solarVal, lunarVal);
    if (rd.error) { toast(rd.error); return; }

    var hourVal = parseInt($("bz-hour").value, 10);
    var unknown = !(hourVal >= 0);   // -1（时辰待定）或取值异常，都按午时兜底
    var h = unknown ? 12 : hourVal;

    // 真太阳时校正（勾选且能识别出生地时生效；识别不到城市仍按北京时间，提示但不阻断）
    var adj = window.BirthUtil.trueSolarAdjust(rd.y, rd.m, rd.d, h, city, useTrueSun);
    if (useTrueSun && adj.noCity) toast("未找到「" + city + "」的经度，已按北京时间排盘");

    var cy = adj.y, cm = adj.m, cd = adj.d, ch = adj.h;
    var dateStr = cy + "-" + pad(cm) + "-" + pad(cd);
    var ctx = { name: $("bz-name").value.trim(), dateStr: dateStr + (adj.shifted ? "（真太阳时）" : ""), h: ch, unknown: unknown, gender: gender };

    var solar = Solar.fromYmdHms(cy, cm, cd, ch, 0, 0);
    var lunar = Lunar.fromSolar(solar);
    var ec = safe(function () { return lunar.getEightChar(); }, null);
    if (!ec) { toast("排盘失败，请检查日期"); return; }

    mingyuDeep = null;

    // ① 先用 lunar 同步出盘：结果秒出，命语未就绪时也不空窗
    paintBazi(modelFromLunar(ec, lunar, ctx), ctx, null);

    // ② 命语就绪后原地升级：四柱与深度解读同源（同一次 calculateBazi）
    var upgrade = function (MY) {
      var deep = MY.calculateBazi({
        year: cy, month: cm, day: cd,
        timeIndex: hourToTimeIndex(ch),
        gender: gender === 1 ? "male" : "female"
      });
      mingyuDeep = deep;
      paintBazi(modelFromMingyu(deep, ctx), ctx, deep);
    };
    if (window.MingyuBazi) {
      upgrade(window.MingyuBazi);
    } else {
      ensureMingyu().then(upgrade).catch(function () {
        // 命语不可用时保留 lunar 基础盘
        console.warn("[mingyu] 排盘引擎加载失败，已保留基础排盘");
      });
    }
  }

  // AI 解读：只把结构化命盘（干支/五行/十神等）发给后端，绝不传生辰/姓名
  function buildBaziChartPayload() {
    var chart = {
      pillars: baziState.pillars.map(function (p) {
        return { lab: p.lab, gz: p.gz, ganSS: toArr(p.g).join("·"), zhiSS: toArr(p.z).join("·"), naya: p.ny, wx: p.wx };
      }),
      dayMaster: { gan: baziState.dmGan, el: baziState.dm.el, trait: baziState.dm.trait, tip: baziState.dm.tip },
      wuXing: baziState.cnt,
      strength: baziState.strengthKey,
      deLing: baziState.deLing,
      shiShen: baziState.ssSet,
      daYun: baziState.daYun,
      taiYuan: baziState.taiYuan,
      mingGong: baziState.mingGong
    };
    // 附加命语深度信息（若已加载），仍只含结构化命盘内容，不含生辰/姓名
    // 合规要点：命语返回的 luckInfo 含逐年 year / startSolarTime.year（会暴露原始出生年），
    //           故此处只用白名单字段重建，绝不整体透传。
    if (mingyuDeep) {
      var an = mingyuDeep.analysis || {};
      var lk = mingyuDeep.luckInfo || {};
      // 大运：只保留干支 + 起始年龄 + 各步十神，剔除所有年份数字
      var dyBrief = toArr(lk.cycles).filter(function (c) { return !c.isXiaoyun; }).slice(0, 8).map(function (c) {
        return {
          gz: c.ganZhi || "",
          startAge: c.age != null ? c.age : null,
          years: toArr(c.years).slice(0, 10).map(function (y) {
            return { ganZhi: y.ganZhi || "", tenGod: y.tenGod || "", tenGodZhi: y.tenGodZhi || "" };
          })
        };
      });
      chart.deep = {
        pattern: an.mingGe && an.mingGe.pattern,
        patternStatus: an.mingGe && an.mingGe.fulfillment && an.mingGe.fulfillment.status,
        patternBasis: an.mingGe && an.mingGe.basis,
        dayMasterStrength: an.dayMasterStrength && an.dayMasterStrength.status,
        usefulGod: an.usefulGod ? {
          useful: an.usefulGod.useful, avoid: an.usefulGod.avoid,
          favorableWuxing: an.usefulGod.favorableWuxing, unfavorableWuxing: an.usefulGod.unfavorableWuxing
        } : null,
        climate: mingyuDeep.climate && mingyuDeep.climate.summary,
        shensha: mingyuDeep.shensha,
        luckStartText: lk.startInfo ? String(lk.startInfo).replace(/\d{4}/g, "") : "",
        daYun: dyBrief,
        warnings: mingyuDeep.warnings
      };
    }
    return { type: "chart", domain: "bazi", chart: chart };
  }
  function requestBaziAI(btn) {
    if (!baziState) { toast("命盘尚未排好"); return; }
    var payload = buildBaziChartPayload();
    btn.disabled = true; btn.textContent = "解读生成中…";
    var box = $("bazi-ai-box");
    box.style.display = "block";
    box.innerHTML = '<div class="ai-loading">正在生成你的专属解读…</div>';
    if (!window.WenxingAI) { baziAiFallback(box, btn); return; }
    window.WenxingAI.interpret(payload).then(function (r) {
      baziState.aiText = r.text;
      box.innerHTML = '<div class="ai-mark">AI 生成 · 娱乐参考' + (r.mock ? " · 离线示例" : "") + '</div>' +
        aiParas(r.text);
      btn.textContent = "重新解读"; btn.disabled = false;
    }).catch(function () { baziAiFallback(box, btn); });
  }
  function baziAiFallback(box, btn) {
    baziState.aiText = baziLocalSummary();
    box.innerHTML = '<div class="ai-mark">离线综合解读 · 娱乐参考</div>' +
      aiParas(baziState.aiText);
    btn.textContent = "重新解读"; btn.disabled = false;
    if (window.AppView && window.AppView.toast) window.AppView.toast("AI 服务暂不可用，已切换本地综合解读");
  }
  // 段落渲染统一走 ai.js 的公共函数（空行分段）
  function aiParas(text) {
    if (window.WenxingAIText) return window.WenxingAIText.paragraphs(text);
    return '<p class="ai-text">' + esc(text) + '</p>';
  }
  function baziLocalSummary() {
    var s = "命盘显示出日主" + baziState.dmGan + (baziState.dm.el ? "（" + baziState.dm.el + "）" : "") + "。";
    s += baziState.dm.tip || "";
    var mx = "", mv = -1;
    for (var k in baziState.cnt) { if (baziState.cnt[k] > mv) { mv = baziState.cnt[k]; mx = k; } }
    if (mx) s += "五行里" + mx + "偏旺，可留意平衡。";
    s += "命盘是帮你看清自己的镜子，不是替你定下结局的裁判。";
    return s;
  }

  function loadBazi() {
    try {
      var v = JSON.parse(localStorage.getItem(BAZI_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function renderBaziHistory() {
    var list = loadBazi();
    var block = $("bazi-history-block");
    block.style.display = list.length ? "block" : "none";
    var box = $("bazi-history");
    box.innerHTML = "";
    list.forEach(function (rec, i) {
      var el = document.createElement("div");
      el.className = "bz-hist";
      el.innerHTML = '<div class="r1"><span class="nm">' + esc(rec.name ? rec.name + " 的命盘" : "我的命盘") +
        '</span><span class="tm">' + esc((rec.date || "") + " " + pad(rec.hour) + ":00" + (rec.unknown ? "（时辰待定）" : "")) + "</span></div>" +
        '<div class="pz">' + esc(rec.gz) + " · 日主" + esc(rec.dm) + "</div>" +
        '<div class="ops"><button data-i="' + i + '">删除</button></div>';
      el.querySelector("button").addEventListener("click", function () {
        var l = loadBazi();
        l.splice(i, 1);
        localStorage.setItem(BAZI_KEY, JSON.stringify(l));
        renderBaziHistory();
      });
      box.appendChild(el);
    });
  }

  // ================= 事件绑定 =================
  $("hl-date").value = todayStr();
  renderHuangLi();
  renderBaziHistory();

  $("hl-date").addEventListener("change", renderHuangLi);
  $("hl-prev").addEventListener("click", function () { $("hl-date").value = shiftStr($("hl-date").value || todayStr(), -1); renderHuangLi(); });
  $("hl-next").addEventListener("click", function () { $("hl-date").value = shiftStr($("hl-date").value || todayStr(), 1); renderHuangLi(); });
  $("hl-today").addEventListener("click", function () { $("hl-date").value = todayStr(); renderHuangLi(); });

  Array.prototype.forEach.call(document.querySelectorAll("#bz-gender .seg-btn"), function (b) {
    b.addEventListener("click", function () {
      gender = parseInt(b.getAttribute("data-g"), 10);
      Array.prototype.forEach.call(document.querySelectorAll("#bz-gender .seg-btn"), function (x) { x.classList.remove("on"); });
      b.classList.add("on");
    });
  });

  $("btn-bazi-go").addEventListener("click", function () {
    if (localStorage.getItem(CONSENT_KEY) !== "1") {
      $("sheet-consent").classList.add("show");
      return;
    }
    doBazi();
  });
  $("btn-consent-yes").addEventListener("click", function () {
    try { localStorage.setItem(CONSENT_KEY, "1"); } catch (e) {}
    $("sheet-consent").classList.remove("show");
    // 八字与紫微共用同一份「生辰单独同意」，回调由发起方决定
    if (window.__consentCb) { var f = window.__consentCb; window.__consentCb = null; f(); }
    else doBazi();
  });
  $("btn-consent-no").addEventListener("click", function () { $("sheet-consent").classList.remove("show"); });
  $("sheet-consent").addEventListener("click", function (e) { if (e.target === this) this.classList.remove("show"); });

  $("btn-clear-bazi").addEventListener("click", function () {
    if (confirm("确定清空全部命盘记录吗？此操作不可恢复。")) {
      localStorage.removeItem(BAZI_KEY);
      renderBaziHistory();
    }
  });

  // 暴露给其他模块
  window.Fortune = { renderHuangLi: renderHuangLi, renderBaziHistory: renderBaziHistory };
})();
