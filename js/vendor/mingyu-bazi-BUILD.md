# 构建溯源说明 —— mingyu-bazi.js

本文件为 **AGPL-3.0-only** 合规所需的源码说明（Corresponding Source），
依据 GNU AGPL v3 第 13 条：通过网络提供服务时须向用户提供源码获取入口。

## 1. 产物信息

| 项 | 值 |
| --- | --- |
| 产物文件 | `js/vendor/mingyu-bazi.js` |
| 体积 | 约 1.01 MB（minify 后） |
| 全局名 | `window.MingyuBazi` |
| 上游包 | `mingyu-core@0.4.2`（子入口 `mingyu-core/bazi`） |
| 上游仓库 | https://github.com/Brhiza/mingyu |
| 许可 | AGPL-3.0-only（见 `mingyu-bazi-LICENSE.txt`） |

## 2. 构建输入

- 入口仅 `mingyu-core/bazi`，**不引入全量**（不含西方星盘 caelus 等 47MB 星历数据）。
- 依赖链：`mingyu-core`（984KB）+ `astronomy-engine`（402KB，真太阳时/均时差必需）+ `tyme4ts`（287KB）。
- 打包时 **紫微仍走原有 iztro**，本产物只补八字能力（格局/用神/神煞/调候/精确大运）。

## 3. 构建步骤（可复现）

```bash
mkdir -p build && cd build
cat > package.json <<'EOF'
{ "name": "mingyu-build", "private": true, "version": "1.0.0", "type": "module" }
EOF
npm install mingyu-core@0.4.2 esbuild

cat > entry.js <<'EOF'
import { baziCalculator } from "mingyu-core/bazi";
const api = {
  calculateBazi(input) { return baziCalculator.calculateBazi(input); },
  version: "mingyu-core/bazi@0.4.2"
};
if (typeof window !== "undefined") { window.MingyuBazi = api; }
export default api;
EOF

npx esbuild entry.js \
  --bundle --format=iife --global-name=MingyuBaziBundle \
  --platform=browser --target=es2020 --minify \
  --outfile=mingyu-bazi.js
```

产物即为 `mingyu-bazi.js`（已复制到 `js/vendor/`）。

## 3.1 构建现场（本仓库内保留）

本次打包的完整现场保存在 **`build/mingyu/`**，属于 AGPL 要求的「对应源码」，**随开源仓库一并发布、请勿删除**：

| 文件 | 说明 |
| --- | --- |
| `entry.js` | 打包入口（仅引 `mingyu-core/bazi`，不含全量星历） |
| `package.json` / `package-lock.json` | 依赖声明与锁定版本 |
| `meta.json` | esbuild 打包清单（逐文件记录输入 / 输出字节数） |
| `mingyu-bazi.js` | 产物副本，与 `js/vendor/mingyu-bazi.js` 一致 |

> 复现方式即下方「构建步骤」，在 `build/mingyu/` 内执行即可（该目录不含 `node_modules`，按 `package-lock.json` 安装即可）。

## 4. 入参契约（重要）

```js
window.MingyuBazi.calculateBazi({
  year: 1990,        // 公历年（数字）
  month: 6,          // 公历月（数字）
  day: 15,           // 公历日（数字）
  timeIndex: 6,      // 0=早子 1=丑 2=寅 ... 11=亥 12=晚子
  gender: "male"     // 字符串 "male" / "female"，数字会抛错
});
```

**合规红线**：入参只有公历数字 + 性别字符串，**不含姓名、身份证、出生地**。
生辰在浏览器本地计算，不上云；AI 解读仅上传已算好的结构化命盘。

## 5. 许可义务（AGPL-3.0-only）

因本产物在浏览器端运行并向用户提供网络服务，触发 AGPL 开源义务：

- **须开源**：mingyu-core 的改动、本构建脚本、打包产物。
- **可自留**：`ai-proxy` 后端（独立服务，非 covered work）。
- **须提供源码入口**：站点页脚 / 关于页需放置显著源码获取链接。
  已落地：`index.html` 顶部 `window.WX_SOURCE_URL`（页脚 + 说明弹层两处「源码」链接共用该变量；留空时自动隐藏）。

> 注：`astronomy-engine` 为 MIT 许可，随包保留其许可声明即可（已内联于产物尾部注释）。
