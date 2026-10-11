/* 问星 · 首页功能图标（手绘 SVG，currentColor 着色，零依赖）
   设计原则：一线一形，12px 下仍可辨识；统一 24x24 视图框、1.6 描边、圆角端点。 */
window.WX_ICONS = (function () {
  var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

  function wrap(inner) { return S + inner + "</svg>"; }

  return {
    // 塔罗：两张交叠的牌 + 星
    tarot: wrap(
      '<rect x="4" y="5" width="11" height="15" rx="1.6" transform="rotate(-8 9.5 12.5)"/>' +
      '<rect x="9" y="4.5" width="11" height="15" rx="1.6" fill="currentColor" fill-opacity=".12"/>' +
      '<path d="M14.5 8.2l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="currentColor" stroke="none"/>'
    ),
    // 八字：四柱竖排干支（四个短竖 + 横线）
    bazi: wrap(
      '<rect x="3" y="4" width="4" height="16" rx="1"/>' +
      '<rect x="8.6" y="4" width="4" height="16" rx="1"/>' +
      '<rect x="14.2" y="4" width="4" height="16" rx="1"/>' +
      '<rect x="19.8" y="4" width="1.2" height="16" rx=".6" fill="currentColor" fill-opacity=".45"/>' +
      '<path d="M4.2 8.5h1.6M9.8 8.5h1.6M15.4 8.5h1.6" stroke-opacity=".5"/>'
    ),
    // 紫微：十二宫圆环 + 中心主星
    ziwei: wrap(
      '<circle cx="12" cy="12" r="8.4"/>' +
      '<circle cx="12" cy="12" r="3.1" fill="currentColor" fill-opacity=".14"/>' +
      '<path d="M12 6.4v2.5M12 15.1v2.5M6.4 12h2.5M15.1 12h2.5M8.1 8.1l1.7 1.7M14.2 14.2l1.7 1.7M15.9 8.1l-1.7 1.7M9.8 14.2l-1.7 1.7" stroke-opacity=".7"/>' +
      '<circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>'
    ),
    // 黄历：日历册 + 日轮
    huangli: wrap(
      '<rect x="4.2" y="5.4" width="15.6" height="14.4" rx="2"/>' +
      '<path d="M4.2 9.6h15.6"/>' +
      '<rect x="7.4" y="7.1" width="1.8" height="3.2" rx=".8" fill="currentColor" stroke="none"/>' +
      '<rect x="14.8" y="7.1" width="1.8" height="3.2" rx=".8" fill="currentColor" stroke="none"/>' +
      '<circle cx="12" cy="14.6" r="2.5" stroke-opacity=".65"/>' +
      '<path d="M12 13.3v1.3l.9.7" stroke-opacity=".9"/>'
    ),
    // 灵签：签筒 + 露出的签
    qian: wrap(
      '<path d="M7.6 11.2h8.8l-.9 8.2a1.4 1.4 0 0 1-1.4 1.2h-4.2a1.4 1.4 0 0 1-1.4-1.2z"/>' +
      '<path d="M9.2 11.2l.7-6.1M12 11.2V4.6M14.8 11.2l-.7-6.1" stroke-opacity=".85"/>' +
      '<circle cx="9.9" cy="5.1" r=".9" fill="currentColor" stroke="none" fill-opacity=".7"/>' +
      '<path d="M7.6 14.4h8.8" stroke-opacity=".5"/>'
    ),
    // 六爻：六条爻线（阴阳交错）
    liuyao: wrap(
      '<path d="M5.2 5.2h13.6"/>' +
      '<path d="M5.2 8.2h5.3M13.5 8.2h5.3"/>' +
      '<path d="M5.2 11.2h13.6"/>' +
      '<path d="M5.2 14.2h5.3M13.5 14.2h5.3"/>' +
      '<path d="M5.2 17.2h13.6" stroke-opacity=".55"/>'
    ),
    // 梅花：五瓣梅 + 卦象
    meihua: wrap(
      '<circle cx="12" cy="10.4" r="1.5" fill="currentColor" stroke="none"/>' +
      '<path d="M12 8.9c0-1.9-1-3.3-2.6-3.6M12 8.9c0-1.9 1-3.3 2.6-3.6M10.7 11.5c-1.6-1-2.9-.9-4 .2M13.3 11.5c1.6-1 2.9-.9 4 .2M12 12.6c0 1.7.8 3 2.2 3.6"/>' +
      '<path d="M7.2 19.4h9.6M9.6 21.4h4.8" stroke-opacity=".6"/>'
    ),
    // 起名：毛笔 + 方格名帖
    name: wrap(
      '<rect x="4.2" y="13.2" width="15.6" height="6.6" rx="1.4"/>' +
      '<path d="M8 16.5h2.4M12.2 16.5h3.8" stroke-opacity=".55"/>' +
      '<path d="M15.2 3.6l4 4-7 7-4.6 1.2 1.2-4.6z"/>' +
      '<path d="M13.7 5.1l4 4" stroke-opacity=".55"/>'
    ),
    // 奇门：九宫格 + 方位指针
    qimen: wrap(
      '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2"/>' +
      '<path d="M9.4 4.2v15.6M14.6 4.2v15.6M4.2 9.4h15.6M4.2 14.6h15.6" stroke-opacity=".45"/>' +
      '<circle cx="12" cy="12" r="2.4" fill="currentColor" fill-opacity=".14"/>' +
      '<path d="M12 7.6l1.1 2.4h-2.2z" fill="currentColor" stroke="none"/>'
    )
  };
})();
