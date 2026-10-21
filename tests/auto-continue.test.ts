/**
 * auto-continue 行为测试：驱动扩展工厂（mock pi/ctx），断言模型真实收到的消息内容。
 * 只断言用户可见的价值（消息文本），不断言内部调用次数——防 mock 假绿。
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import autoContinue from "../src/auto-continue.ts";

type Handler = (event: never, ctx: never) => void | Promise<void>;

interface Harness {
	pi: ExtensionAPI & {
		fire(ev: string, event?: unknown, ctx?: ExtensionContext): Promise<void>;
	};
	sent: string[];
	notifies: string[];
	flags: Record<string, string | boolean>;
}

function makeHarness(): Harness {
	const handlers = new Map<string, Handler[]>();
	const flags: Record<string, string | boolean> = {
		"auto-continue-off": false,
		"auto-continue-limit": "1000",
		"auto-continue-stuck": "4",
		"auto-continue-reset": "2",
		"auto-continue-plan": "",
		"auto-continue-compact-at": "0",
		"auto-continue-session-mb": "0",
	};
	const sent: string[] = [];
	const notifies: string[] = [];
	const pi = {
		registerFlag: () => {},
		getFlag: (name: string) => flags[name],
		registerCommand: () => {},
		appendEntry: () => {},
		sendUserMessage: (m: string) => {
			sent.push(m);
		},
		on: (ev: string, h: Handler) => {
			handlers.set(ev, [...(handlers.get(ev) ?? []), h]);
		},
		fire: async (ev: string, event?: unknown, ctx?: ExtensionContext) => {
			for (const h of handlers.get(ev) ?? []) await h(event as never, ctx as never);
		},
	} as unknown as Harness["pi"];
	return { pi, sent, notifies, flags };
}

function makeCtx(cwd: string, branch: unknown[], notifies: string[]): ExtensionContext {
	return {
		cwd,
		isIdle: () => true,
		ui: {
			setStatus: () => {},
			notify: (msg: string) => notifies.push(msg),
			theme: { fg: (_k: string, s: string) => s },
		},
		sessionManager: {
			getBranch: () => branch,
			getSessionFile: () => undefined,
		},
		getContextUsage: () => ({ tokens: 0 }),
		compact: () => {},
	} as unknown as ExtensionContext;
}

const assistant = (text: string, stopReason = "stop") => ({
	type: "message",
	message: { role: "assistant", stopReason, content: [{ type: "text", text }] },
});

/** 建一个临时 plan/ 目录并写入计划文件 */
async function makePlanDir(krs: string, map?: string, extra?: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "ac-test-"));
	await mkdir(join(dir, "plan"));
	const sections = [
		"# 测试计划",
		"",
		"## 目标（Objective）",
		"O：交付可验证的价值",
		"",
		"## 关键结果（Key Results）",
		krs,
	];
	if (map !== undefined) sections.push("", "## 用户故事地图", map);
	if (extra !== undefined) sections.push("", extra);
	await writeFile(join(dir, "plan", "测试.md"), sections.join("\n"));
	return dir;
}

/** 多轮会话：session_start 只恢复一次，之后每轮追加 assistant 回复并 settle */
async function makeSession(cwd: string) {
	const h = makeHarness();
	const branch: unknown[] = [];
	const ctx = makeCtx(cwd, branch, h.notifies);
	autoContinue(h.pi);
	await h.pi.fire("session_start", {}, ctx);
	const round = async (text: string): Promise<void> => {
		branch.push(assistant(text));
		await h.pi.fire("agent_start", {}, ctx);
		await h.pi.fire("tool_execution_start", {}, ctx);
		await h.pi.fire("agent_settled", {}, ctx);
	};
	return { h, ctx, round };
}

/** 标准流程：建工厂 → session_start 恢复 → agent_start + 一次工具调用 → agent_settled */
async function settle(h: Harness, ctx: ExtensionContext): Promise<void> {
	await h.pi.fire("session_start", {}, ctx);
	await h.pi.fire("agent_start", {}, ctx);
	await h.pi.fire("tool_execution_start", {}, ctx);
	await h.pi.fire("agent_settled", {}, ctx);
}

describe("auto-continue 假设驱动的价值循环", () => {
	test("before_agent_start：3 条价值循环原则注入 system prompt", async () => {
		const h = makeHarness();
		const ctx = makeCtx("/tmp", [], h.notifies);
		autoContinue(h.pi);
		await h.pi.fire("session_start", {}, ctx);
		const options = { promptGuidelines: [] as string[] };
		await h.pi.fire("before_agent_start", { systemPromptOptions: options }, ctx);
		expect(options.promptGuidelines.length).toBe(3);
		const joined = options.promptGuidelines.join("\n");
		expect(joined).toContain("持续交付用户可感知的价值");
		expect(joined).toContain("把计划当作可被证据改写的假设集");
		expect(joined).toContain("SWOT 记录已知/未知");
		expect(joined).toContain("OKR 把本轮假设写成可证伪的结果");
		expect(joined).toContain("Check 是证伪");
		expect(joined).toContain("优先 TDD");
		expect(joined).toContain("精准跑与本次变更相关的测试");
		expect(joined).toContain("没有价值的内容不算验证");
		expect(joined).toContain("收口时 OKR/地图无未完成项");
	});

	test("无计划文件且有实际动作：发送「假设 → 证据」引导", async () => {
		const h = makeHarness();
		const ctx = makeCtx("/tmp/no-plan", [assistant("做了点事。\n[PDCA] do")], h.notifies);
		autoContinue(h.pi);
		await settle(h, ctx);
		expect(h.sent.length).toBe(1);
		expect(h.sent[0]).toContain("「假设 → 证据」循环推进");
		expect(h.sent[0]).toContain("SWOT 记录信念边界");
		expect(h.sent[0]).toContain("OKR 把假设写成可证伪的承诺");
		expect(h.sent[0]).toContain("TDD 测试 Check 过");
	});

	test("do 之后：Check 指令要求证伪＋精准测试不跑全量", async () => {
		const h = makeHarness();
		const cwd = await makePlanDir("- [x] KR1：覆盖率 0% → 100%");
		try {
			const ctx = makeCtx(cwd, [assistant("改完了。\n[PDCA] do")], h.notifies);
			autoContinue(h.pi);
			await settle(h, ctx);
			expect(h.sent.length).toBe(1);
			const body = h.sent[0];
			expect(body).toContain("Check 是证伪，不是自证");
			expect(body).toContain("优先 TDD：先写失败测试");
			expect(body).toContain("精准验证：只跑与本次变更相关的测试，别每次跑全量");
			expect(body).toContain("函数是否存在、字数多少这类没有意义的内容不算验证");
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	test("complete 但 Do 后无 Check：打回并要求 TDD＋精准验证", async () => {
		const h = makeHarness();
		const cwd = await makePlanDir("- [x] KR1：覆盖率 0% → 100%");
		try {
			const ctx = makeCtx(cwd, [assistant("做完了。\n[PDCA] do\n[PDCA] complete")], h.notifies);
			autoContinue(h.pi);
			await settle(h, ctx);
			expect(h.sent.length).toBe(1);
			const body = h.sent[0];
			expect(body).toContain("Check 绝不跳过");
			expect(body).toContain("证伪，不是自证");
			expect(body).toContain("TDD 测试验证 OKR 的交付价值");
			expect(body).toContain("精准验证：只跑与本次变更相关的测试");
			expect(body).toContain("没有意义的内容不算验证");
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	test("do+check+complete 且 KR 全达成：收口并报告价值交付完成", async () => {
		const h = makeHarness();
		const cwd = await makePlanDir("- [x] KR1：覆盖率 0% → 100%");
		try {
			const ctx = makeCtx(
				cwd,
				[assistant("做完了。\n[PDCA] do\n[PDCA] check\n[PDCA] complete")],
				h.notifies,
			);
			autoContinue(h.pi);
			await settle(h, ctx);
			expect(h.sent.length).toBe(0);
			expect(h.notifies.join("\n")).toContain("价值交付完成");
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	test("do+check+complete 但 KR 未达成：OKR 门打回", async () => {
		const h = makeHarness();
		const cwd = await makePlanDir("- [ ] KR1：覆盖率 0% → 100%");
		try {
			const ctx = makeCtx(
				cwd,
				[assistant("做完了。\n[PDCA] do\n[PDCA] check\n[PDCA] complete")],
				h.notifies,
			);
			autoContinue(h.pi);
			await settle(h, ctx);
			expect(h.sent.length).toBe(1);
			expect(h.sent[0]).toContain("OKR 还有 1 条关键结果未达成");
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	test("do+check+complete 但地图有未完成叶子：地图门打回", async () => {
		const h = makeHarness();
		const cwd = await makePlanDir(
			"- [x] KR1：覆盖率 0% → 100%",
			"- [ ] 1. 价值体验切片",
		);
		try {
			const ctx = makeCtx(
				cwd,
				[assistant("做完了。\n[PDCA] do\n[PDCA] check\n[PDCA] complete")],
				h.notifies,
			);
			autoContinue(h.pi);
			await settle(h, ctx);
			expect(h.sent.length).toBe(1);
			expect(h.sent[0]).toContain("用户故事地图还有 1 个未完成");
			expect(h.sent[0]).toContain("可复跑的证据");
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	test("complete 时一次反馈所有未通过的门，且兼容 * / + 勾选", async () => {
		const h = makeHarness();
		const cwd = await makePlanDir("* [ ] KR1：覆盖率 0% → 100%", "+ [ ] 1. 价值体验切片");
		try {
			const ctx = makeCtx(cwd, [assistant("做完了。\n[PDCA] complete")], h.notifies);
			autoContinue(h.pi);
			await settle(h, ctx);
			expect(h.sent.length).toBe(1);
			const body = h.sent[0];
			expect(body).toContain("OKR（承诺）");
			expect(body).toContain("地图（路径）");
			expect(body).toContain("Check 绝不跳过");
			expect(body).toContain("OKR 还有 1 条关键结果未达成");
			expect(body).toContain("用户故事地图还有 1 个未完成");
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	test("计划文件消失：不再用陈旧 OKR/地图状态收口", async () => {
		const cwd = await makePlanDir("- [x] KR1：覆盖率 0% → 100%");
		try {
			const { h, round } = await makeSession(cwd);
			await round("做完了。\n[PDCA] do\n[PDCA] check");
			expect(h.sent.length).toBe(1);
			expect(h.sent[0]).toContain("Act");

			await rm(join(cwd, "plan"), { recursive: true, force: true });
			await round("完成。\n[PDCA] complete");

			expect(h.notifies.join("\n")).not.toContain("价值交付完成");
			expect(h.sent.length).toBe(1); // 没有用陈旧状态发打回/引导消息
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	test("SWOT 标签大小写兼容：Planning 时刻回灌快照", async () => {
		const h = makeHarness();
		const cwd = await makePlanDir(
			"- [x] KR1：覆盖率 0% → 100%",
			undefined,
			["## SWOT", "s：已验证的价值优势", "w：尚未验证的未知", "o：最省力的反馈路径", "t：价值交付风险"].join("\n"),
		);
		try {
			const ctx = makeCtx(cwd, [assistant("计划更新完了。\n[PDCA] act")], h.notifies);
			autoContinue(h.pi);
			await settle(h, ctx);
			expect(h.sent.length).toBe(1);
			expect(h.sent[0]).toContain("SWOT（信念）S 已验证的价值优势");
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	test("预算压缩压不下去时不再每轮重复压缩", async () => {
		const cwd = await makePlanDir("- [ ] KR1：覆盖率 0% → 100%");
		try {
			const { h, ctx, round } = await makeSession(cwd);
			h.flags["auto-continue-compact-at"] = "100";
			let compacts = 0;
			(ctx as any).getContextUsage = () => ({ tokens: 999, contextWindow: 1000, percent: 99 });
			(ctx as any).compact = (options: { onError?: (error: Error) => void }) => {
				compacts += 1;
				options.onError?.(new Error("nothing to compact"));
			};

			await round("做完了。\n[PDCA] do");
			await round("验证完了。\n[PDCA] check");
			expect(compacts).toBe(1); // 第二轮不再重复尝试压缩
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	test("代码块里的阶段标记不算本轮结论", async () => {
		const h = makeHarness();
		const cwd = await makePlanDir("- [ ] KR1：覆盖率 0% → 100%");
		try {
			const text = ["示例：", "```", "[PDCA] complete", "```", "仍在推进。"].join("\n");
			const ctx = makeCtx(cwd, [assistant(text)], h.notifies);
			autoContinue(h.pi);
			await settle(h, ctx);
			expect(h.sent.length).toBe(1);
			expect(h.sent[0]).toContain("继续「假设 → 证据」循环");
			expect(h.sent[0]).not.toContain("不能收口");
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});
});
