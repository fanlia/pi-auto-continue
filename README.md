# pi-auto-continue

[![CI](https://github.com/fanlia/pi-auto-continue/actions/workflows/ci.yml/badge.svg)](https://github.com/fanlia/pi-auto-continue/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> 假设驱动的价值交付循环：把计划当作可被证据改写的假设集，用小步实验持续把假设变成用户可感知的价值。

`pi-auto-continue` 是一个 [Pi](https://pi.dev) 扩展。它在 agent 真正停下来等待输入时，读取上一轮回复的阶段标记，向同一条会话追加一条用户消息，把 PDCA 循环推进到下一阶段；同时只读解析项目里的计划文件，用 SWOT / OKR / 用户故事地图作为锚点和收口门。

它不新开 session、不派 subagent、不改写计划文件。

## 为什么需要它

- **Agent 容易提前停**：做完一小步就等确认，循环断掉。
- **聊天历史会遗忘**：长会话里目标、证据、判负细节逐渐丢失。
- **“完成”容易自证**：没有证据也可能报告完成。

这三个问题分别用「自动续跑」「计划文件是唯一事实源」「收口门」解决。

## 理念

四个框架不是四道流程关卡，而是回答四个不同的问题：

| 框架 | 问题 | 在循环里的角色 |
|---|---|---|
| SWOT | 我们现在相信什么？ | 信念：已知 / 未知 / 验证机会 / 关键风险 |
| OKR | 这一轮要改变什么可观测的结果？ | 承诺：O＝用户价值，KR＝可证伪的结果 |
| 用户故事地图 | 用户按什么顺序感知到这些改变？ | 路径：最小端到端切片，按用户旅程排序 |
| PDCA | 怎样用最小代价验证假设？ | 实验：Plan → Do → Check → Act |

统一模型：

```text
信念（SWOT）→ 承诺（OKR）→ 路径（地图）→ 实验（PDCA）→ 证据
   ↑                                              │
   └────────────── 用证据更新信念 ←──────────────┘
```

三个定义：

- **价值** = 用户可感知的状态改变，不是活动量。
- **证据** = 可复跑的行为结果，或可观测的 KR 指标 / 用户反馈。
- **完成** = 每个承诺都有证据，或已被显式取消并留下理由。

**Check 是证伪，不是自证。** 代码行为优先用 TDD：先写失败测试，再实现；精准跑与本次变更相关的测试；检查“函数是否存在、字数多少”不算证据。

扩展自己的角色是节拍器、记忆锚点和门禁：只读计划文件、回灌锚点、推进阶段、守住收口。它不替模型思考。

## 安装

```bash
# 从 GitHub 安装
pi install git:github.com/fanlia/pi-auto-continue

# 或本地开发时直接安装
pi install /path/to/pi-auto-continue

# 从 npm 安装
pi install npm:@ailnaf/pi-auto-continue

# 只试用一次，不写入 settings
pi -e git:github.com/fanlia/pi-auto-continue
```

> 如果之前把 `auto-continue.ts` 直接放在 `~/.pi/agent/extensions/`，请先移除那个文件，再安装本包，避免同一个扩展被加载两次。

安装后启动 Pi，默认开启。`/auto status` 应显示 `假设 → 承诺 → 路径 → 实验`。

## 快速开始

1. 在项目里创建 `plan/<主题>.md`（`plan/plan.md` 是写作规范，不会被当作计划）。
2. 正常让 Pi 做事。
3. 每轮回复最后一行报告阶段：`[PDCA] plan|do|check|act`。
4. 扩展在 agent 停下时自动追加下一阶段的消息，直到 `[PDCA] complete` 或触发停止条件。

没有计划文件时，扩展会在第一次有实际工具调用的回合后引导一次创建计划；之后静默，不在闲聊里无限续跑。

完整的计划模板见 [`examples/plan/example.md`](examples/plan/example.md)。

## 计划文件格式

扩展只读解析以下四段，其余内容由模型自由维护：

```markdown
## SWOT
- S：已被证据支持的优势
- W：尚未验证的未知
- O：最省力的验证机会
- T：最可能推翻计划的风险

## 目标（Objective）
O：用户可感知的价值改变。

## 关键结果（Key Results）
- [ ] KR1：可度量结果（基线 → 目标）
- [ ] KR2：可度量结果（0/1 → 1/1）

## 用户故事地图
- [ ] 1. 最小端到端切片
  - [ ] 1.1 用户可感知的一步
  - [ ] 1.2 用户可感知的下一步
```

规则：

- KR / 地图使用 `- [ ]`、`- [x]`、`- [-]`（取消：理由）；也兼容 `*` / `+` 列表。
- 地图顶层是切片，第一片是最小端到端价值闭环；收口只检查叶子。
- KR 标题里的 `3/10`、`37%` 会被提取为进度锚点。
- 扩展从不写回计划文件。

## 命令与参数

| 命令 | 作用 |
|---|---|
| `/auto` | 开关切换 |
| `/auto on` / `/auto off` | 显式开启 / 关闭（当前会话有效） |
| `/auto status` | 查看计划文件、OKR / 地图进度、Check 门、预算 |

| 参数 | 默认 | 作用 |
|---|---|---|
| `--auto-continue-off` | `false` | 本次启动关闭 |
| `--auto-continue-limit` | `1000` | 本轮最多自动续跑次数 |
| `--auto-continue-stuck` | `4` | 连续 N 轮无工具调用视为卡住 |
| `--auto-continue-reset` | `2` | 卡住后压缩历史重新 Plan 的最大次数 |
| `--auto-continue-plan` | 空 | 固定跟踪 `plan/<name>.md`，默认取最新修改 |
| `--auto-continue-compact-at` | `0` | 上下文超过该 token 数先压缩再续跑（0=关闭） |
| `--auto-continue-session-mb` | `0` | 会话文件超过该 MB 数暂停并建议 `/new`（0=关闭） |

## 收口门

`[PDCA] complete` 不是模型说了算，还要过三道门：

1. **Check 门**：自上次 Do 后必须 Check 过。
2. **OKR 门**：没有未达成的 KR；做完、显式取消或改写。
3. **地图门**：没有未完成的叶子；做完或显式取消。

三道门同时未过时，扩展会把它们合并成一条反馈，一轮说清，避免逐轮挤牙膏。

## 卡住与内存保护

- 连续多轮没有工具调用 → 压缩历史、要求重新 Plan；最多重置 `reset` 次。
- `compact-at` 把峰值上下文压到预算内；压不下去后不会每轮重复尝试。
- `session-mb` 在会话文件过大时暂停，提示换新会话（计划已落盘，重开可继续）。

## 停止条件

- 模型报告 `[PDCA] complete` 且所有门通过
- 达到 `limit`
- 重置 `reset` 次后仍卡住
- 用户 Esc 中止或运行出错
- `plan/` 下没有计划文件
- 会话文件超过 `session-mb`

## 开发

要求：Node.js > 24（推荐 26 LTS）。不依赖 Bun。

```bash
npm install
npm run check      # tsc --noEmit && node --test
npm test
npm run typecheck
```

测试使用 Node 内置 `node:test` + 原生 TypeScript type stripping，无构建步骤。测试是行为级的：mock Pi / context，驱动扩展工厂，断言模型真实收到的消息文本，而不是内部调用次数。

```text
.
├── src/auto-continue.ts       # 扩展实现（单文件，无构建步骤）
├── tests/auto-continue.test.ts
├── examples/plan/example.md   # 计划模板
├── docs/design.md             # 设计说明
├── .github/workflows/ci.yml
├── package.json
└── tsconfig.json
```

更多设计细节见 [`docs/design.md`](docs/design.md)。

## License

[MIT](LICENSE) © 2026 fanlia
