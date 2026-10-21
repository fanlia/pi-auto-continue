# Changelog

## 0.2.0 — 2026-10-21

- 移除 Bun 依赖，改用 Node.js 原生工具链：`node --test` + 原生 TypeScript type stripping。
- 要求 Node.js > 24；CI 使用 Node 26；提交 `package-lock.json`。
- npm 包名改为 `@ailnaf/pi-auto-continue`。

## 0.1.0 — 2026-10-21

首个公开版本。

- 假设驱动的价值交付循环：SWOT → OKR → 用户故事地图 → PDCA → 证据。
- `agent_settled` 时在同一 session 自动续跑，不新开会话、不派 subagent。
- 只读解析 `plan/<主题>.md`，回灌 OKR / 地图 / SWOT 锚点。
- 三道收口门：Do 后必须 Check；OKR 无未达成 KR；地图无未完成叶子。
- 收口门聚合反馈；支持 `-` / `*` / `+` 勾选与大小写 SWOT。
- 代码块里的 `[PDCA]` 示例不计入本轮结论。
- 卡住重置、上下文预算压缩、会话体积保护。
- 行为测试覆盖原则注入、引导、阶段推进、三道门、陈旧状态、预算压缩与解析容错。
