/* 问星 · 首页功能图标（手绘 SVG，currentColor 着色，零依赖）
   设计原则：每个功能一个明确的主体物象（牌 / 柱 / 宫 / 历 / 签 / 爻 / 梅 / 笔 / 盘），
   配色由首页卡片的 --ac 主色决定，图形 + 色相双重区分。
   统一 24x24 视图框、1.5 描边、圆角端点。 */
window.WX_ICONS = (function () {
  var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

  function wrap(inner) { return S + inner + "</svg>"; }

  return {
    // 塔罗：两张摊开的牌，前面一张印着星月纹
    tarot: wrap(
      '<rect x="2.5" y="5.1" width="9.6" height="13.6" rx="1.6" transform="rotate(-10 7.3 11.9)"/>' +
      '<rect x="9.1" y="4.3" width="11.1" height="15.3" rx="1.8" fill="currentColor" fill-opacity=".15"/>' +
      '<path d="M14.7 6.7l.95 2.35 2.35.95-2.35.95-.95 2.35-.95-2.35-2.35-.95 2.35-.95z" fill="currentColor" stroke="none"/>' +
      '<path d="M16.9 13.3a2.05 2.05 0 1 1-4.1 0 3.15 3.15 0 0 0 4.1 0z" stroke-opacity=".85"/>' +
      '<path d="M11.9 17.2h6.6" stroke-opacity=".45"/>' +
      '<circle cx="3.8" cy="3.9" r=".65" fill="currentColor" stroke="none" fill-opacity=".7"/>'
    ),
    // 八字：四根柱子（四柱），每柱上下分干、支，落一条基线
    bazi: wrap(
      '<rect x="3.4" y="4.4" width="3.6" height="14.4" rx="1.4"/>' +
      '<rect x="8.3" y="4.4" width="3.6" height="14.4" rx="1.4"/>' +
      '<rect x="13.2" y="4.4" width="3.6" height="14.4" rx="1.4"/>' +
      '<rect x="18.1" y="4.4" width="3.6" height="14.4" rx="1.4" fill="currentColor" fill-opacity=".16"/>' +
      '<path d="M4.9 9.6h2.6M9.8 9.6h2.6M14.7 9.6h2.6M19.6 9.6h2.6" stroke-opacity=".55"/>' +
      '<path d="M2.4 20.8h19.2" stroke-opacity=".45"/>'
    ),
    // 紫微：十二宫圆环 + 内圈虚线 + 四正星 + 中心主星
    ziwei: wrap(
      '<circle cx="12" cy="12" r="8.7" stroke-opacity=".85"/>' +
      '<circle cx="12" cy="12" r="4.7" stroke-opacity=".45" stroke-dasharray="1.5 2.1"/>' +
      '<circle cx="12" cy="3.3" r=".95" fill="currentColor" stroke="none"/>' +
      '<circle cx="12" cy="20.7" r=".95" fill="currentColor" stroke="none"/>' +
      '<circle cx="3.3" cy="12" r=".95" fill="currentColor" stroke="none"/>' +
      '<circle cx="20.7" cy="12" r=".95" fill="currentColor" stroke="none"/>' +
      '<circle cx="12" cy="12" r="2.3" fill="currentColor" fill-opacity=".2"/>' +
      '<path d="M12 9.9l.58 1.45 1.45.58-1.45.58-.58 1.45-.58-1.45-1.45-.58 1.45-.58z" fill="currentColor" stroke="none"/>'
    ),
    // 黄历：历书封面（装订环 + 顶部日期条 + 中间日格）
    huangli: wrap(
      '<rect x="3.8" y="4.8" width="16.4" height="15.4" rx="2"/>' +
      '<path d="M3.8 9.2h16.4"/>' +
      '<rect x="6.9" y="2.6" width="1.9" height="4.2" rx=".95" fill="currentColor" stroke="none"/>' +
      '<rect x="15.2" y="2.6" width="1.9" height="4.2" rx=".95" fill="currentColor" stroke="none"/>' +
      '<rect x="8" y="11.6" width="8" height="6.4" rx="1.2" fill="currentColor" fill-opacity=".15" stroke-opacity=".7"/>' +
      '<path d="M9.9 14.4h4.2M9.9 16.4h2.7" stroke-opacity=".65"/>'
    ),
    // 灵签：签筒 + 三支露出的签 + 星
    qian: wrap(
      '<path d="M7.1 10.9h9.8l-.95 8.7a1.5 1.5 0 0 1-1.5 1.35h-4.9a1.5 1.5 0 0 1-1.5-1.35z" fill="currentColor" fill-opacity=".12"/>' +
      '<path d="M8.5 10.9l.9-6.5M12 10.9V4.2M15.5 10.9l-.9-6.5"/>' +
      '<path d="M6.9 14.7h10.2" stroke-opacity=".45"/>' +
      '<path d="M4.1 6.4l.36.92.92.36-.92.36-.36.92-.36-.92-.92-.36.92-.36z" fill="currentColor" stroke="none" fill-opacity=".75"/>' +
      '<path d="M19.9 4.4l.3.75.75.3-.75.3-.3.75-.3-.75-.75-.3.75-.3z" fill="currentColor" stroke="none" fill-opacity=".5"/>'
    ),
    // 六爻：六条爻线（阴阳交错）+ 铜钱
    liuyao: wrap(
      '<path d="M4.2 4.6h10.6"/>' +
      '<path d="M4.2 7.7h4.3M10.5 7.7h4.3"/>' +
      '<path d="M4.2 10.8h10.6"/>' +
      '<path d="M4.2 13.9h4.3M10.5 13.9h4.3"/>' +
      '<path d="M4.2 17h10.6"/>' +
      '<path d="M4.2 20.1h6.8" stroke-opacity=".32"/>' +
      '<circle cx="18.4" cy="16.6" r="3.1" stroke-opacity=".8"/>' +
      '<rect x="16.9" y="15.1" width="3" height="3" rx=".45" stroke-opacity=".5"/>'
    ),
    // 梅花：梅枝 + 两朵五瓣梅 + 三爻卦
    meihua: wrap(
      '<path d="M4.3 20.6c1.5-4.7 3.3-7.6 5.6-9.9 1.6-1.6 3-2.7 4.3-3.3"/>' +
      '<circle cx="8.4" cy="12.6" r="1.15" fill="currentColor" stroke="none"/>' +
      '<path d="M8.4 11.4c.25-1.45-.4-2.5-1.7-2.9M8.4 11.4c.25-1.45 1.35-2.15 2.7-2.15M7.4 13.4c-1.35-.4-2.5.1-3.1 1.15M9.4 13.4c1.35-.4 2.5.1 3.1 1.15"/>' +
      '<circle cx="16.6" cy="8.2" r=".85" fill="currentColor" stroke="none" fill-opacity=".7"/>' +
      '<path d="M16.6 7.35c.15-1.05-.3-1.8-1.2-2.1M16.6 7.35c.15-1.05.95-1.6 1.9-1.6"/>' +
      '<path d="M14.4 17.1h6.4M14.4 19.4h2.7M18.1 19.4h2.7"/>'
    ),
    // 起名：名帖 + 毛笔 + 印章框
    name: wrap(
      '<rect x="3.3" y="12.8" width="13" height="7.8" rx="1.7" fill="currentColor" fill-opacity=".1"/>' +
      '<path d="M6.2 16.3h2.6M10.4 16.3h3.2" stroke-opacity=".5"/>' +
      '<path d="M14.3 3.3l4.4 4.4-7.5 7.5-4.9 1.4 1.4-4.9z"/>' +
      '<path d="M12.8 4.8l4.4 4.4" stroke-opacity=".45"/>' +
      '<rect x="17" y="15.6" width="3.9" height="3.9" rx=".9" stroke-opacity=".7" stroke-dasharray="1.7 1.5"/>'
    ),
    // 奇门：九宫盘 + 中心指针（上阳下阴）
    qimen: wrap(
      '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2.3"/>' +
      '<path d="M9.1 3.4v17.2M14.9 3.4v17.2M3.4 9.1h17.2M3.4 14.9h17.2" stroke-opacity=".35"/>' +
      '<circle cx="12" cy="12" r="3.5" fill="currentColor" fill-opacity=".13"/>' +
      '<path d="M12 8.2l1.55 3.2-1.55-.78-1.55.78z" fill="currentColor" stroke="none"/>' +
      '<path d="M12 15.8l-1.55-3.2 1.55.78 1.55-.78z" fill="currentColor" stroke="none" fill-opacity=".38"/>'
    )
  };
})();
