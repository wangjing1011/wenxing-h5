// 打包入口：只暴露八字能力，避免引入全量（不含西方星盘 caelus 等）
import { baziCalculator } from "mingyu-core/bazi";

// 统一出口：挂到 window.MingyuBazi
const api = {
  // 排盘主入口
  calculateBazi(input) {
    return baziCalculator.calculateBazi(input);
  },
  version: "mingyu-core/bazi@0.4.2"
};

if (typeof window !== "undefined") { window.MingyuBazi = api; }
export default api;
