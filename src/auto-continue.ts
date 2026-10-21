/**
 * auto-continue —— 假设驱动的价值交付循环
 *
 * 一句话：把计划当作「可被证据改写的假设集」，用小步实验持续把假设变成用户可感知的价值。
 *
 * 四个框架回答四个问题，不是四道流程关卡：
 *
 *   SWOT —— 我们现在相信什么？
 *     S 已被证据支持 / W 尚未验证的未知 / O 最省力的验证机会 / T 最可能推翻计划的风险。
 *     它是「信念边界」，不是价值清单；扩展只读解析，在 Plan 与复盘时回灌当前快照，
 *     让新一轮从更新后的信念出发，而不是重复旧假设。
 *
 *   OKR —— 这一轮要改变什么可观测的结果？
 *     O 一句话说明要交付的用户价值；KR 2–4 条可证伪的结果（基线 → 目标）。
 *     KR 是「价值是否发生」的证据，不是任务清单。扩展只读进度数字（x/y、%），
 *     收口时守门：未达成 → 做完（- [x]）、显式取消（- [-] 理由）或改写 KR；OKR 不撒谎。
 *
 *   用户故事地图 —— 用户按什么顺序感知到这些改变？
 *     顶层=切片，第一片=最小端到端价值闭环，同级按用户旅程排序。
 *     扩展只读解析，回灌「下一片」，收口时守门：未完成叶子要么做完，要么 - [-] 显式取消；
 *     地图不撒谎。
 *
 *   PDCA —— 怎样用最小代价验证假设？
 *     Plan（更新假设与下一步）→ Do（一次一个变量）→ Check（可复跑的证据）→
 *     Act（证据支持就标准化，否则改写计划）。
 *     Check 是证伪，不是自证：优先 TDD——先写失败测试，再实现，测试转绿；
 *     精准跑与本次变更相关的测试；检查函数是否存在、字数多少等不算证据。
 *     扩展在 agent 真正停下来等输入时（agent_settled），解析上一轮报告的阶段，
 *     往同一 session 追加一条用户消息，把它推进到下一阶段。不新开 session、不派 subagent。
 *
 * 统一模型：
 *
 *   信念（SWOT）→ 承诺（OKR）→ 路径（地图）→ 实验（PDCA）→ 证据
 *       ↑                                              │
 *       └────────────── 用证据更新信念 ←──────────────┘
 *
 *   价值 = 用户可感知的状态改变；证据 = 可复跑、可观测、与 KR 对应的结果；
 *   进度 = 计划文件里的勾选与数字，不是聊天里的汇报；
 *   完成 = 每个承诺都有证据，或已被显式取消并留下理由。
 *
 * 扩展的角色是节拍器、记忆锚点和门禁：只读计划文件、回灌锚点、推进阶段、守住收口；
 * 它不替模型思考，也不改写事实源（plan/<主题>.md 是唯一事实源）。
 *
 * 阶段协议（模型每轮回复最后一行报告；扩展只认最后一个标记）：
 *   [PDCA] plan      更新假设与下一步
 *   [PDCA] do        执行一个最小变量，有实际动作
 *   [PDCA] check     用可复跑证据验证（Do 后必须 Check）
 *   [PDCA] act       按证据收口：标准化，或改写计划
 *   [PDCA] complete  所有承诺有证据 / 地图与 OKR 已收口 / Do 后 Check 过
 *   [PDCA] blocked: <原因>  确实无法安全推进
 * 旧 `@坐标` 后缀、`[MAP]` 行、旧协议 [PLAN] working/complete/blocked 仍被容忍。
 * 没写标记 → 按未完成处理（提醒协议后继续）。
 *
 * 强制规则：
 *   - Check 是证伪，不是自证：complete 若自上次 Do 后没有 Check → 打回；Check 必须给出
 *     可复跑的行为/结果证据（优先 TDD），精准跑相关测试；无价值的内容不算；
 *   - 收口门一次说完：Check / OKR / 地图同时未过时合并成一条反馈，不逐轮挤牙膏；
 *   - 事实源消失即清空：plan/ 下没有计划文件时不再用上次解析的 OKR/地图做判定；
 *   - 解析容错：勾选兼容 `-` / `*` / `+`，SWOT 兼容 `S：` 与 `s：`，忽略代码块里的示例标记；
 *   - OKR 不撒谎 / 地图不撒谎：未达成项要么做完，要么显式取消；
 *   - Act 是更新信念：证据支持就标准化，否则改计划；扩展从不改写计划文件。
 *
 * 激活范围：plan/ 下存在计划文件（*.md，plan.md 除外）时生效。
 *
 * 用法：
 *   /auto                开关（切换）
 *   /auto on | off       显式开/关（关闭在当前会话内有效；新会话默认又开启）
 *   /auto status         查看状态、计划文件、OKR/地图进度、Check 门
 *   启动即默认开启，无需 /auto；pi --auto-continue-off 可本次启动关闭
 *   pi --auto-continue-limit 1000 本轮最多自动续跑多少次（默认 1000）
 *   pi --auto-continue-stuck 4    连续 N 轮「没调用任何工具」即视为卡住（默认 4）
 *   pi --auto-continue-reset 2    卡住后压缩历史重新 Plan 的最大次数（默认 2）
 *   pi --auto-continue-plan xxx   固定跟踪 plan/xxx.md（默认取最新修改的计划）
 *   pi --auto-continue-compact-at 150000  上下文超该 token 数就先压缩再续跑（默认 0=关闭，沿用 pi 阈值）
 *   pi --auto-continue-session-mb 40      会话文件超该 MB 数就暂停并提醒换新会话（默认 0=关闭）
 *
 * 内存保护（可选）：同一 session 长期连跑时，pi 的 append-only 历史与当前上下文都常驻内存，
 *   压缩只改 LLM 上下文、不释放旧 entries（实测 19MB 会话 ≈ 66MB heap / 218MB RSS）。
 *   compact-at 把峰值上下文压到预算内；session-mb 在会话文件过大时暂停并建议 /new 换新会话
 *   （计划文件已落盘，重开新会话后继续）。
 *
 * 卡住重置（小步快跑）：连续 stuckLimit 轮没有任何工具调用（＝空谈没做事），
 *   触发一次上下文压缩（同一 session，不新开文件）——丢掉无效探索历史，
 *   然后带着计划文件要求模型重新 Plan；最多重置 resetLimit 次，再卡住才暂停。
 *
 * 停止条件（任一命中即停）：
 *   1. 模型自答 [PDCA] complete（Check 过了；地图无未完成叶子；OKR 无未达成 KR）
 *   2. 达到 maxContinues
 *   3. 重置 resetLimit 次后仍连续卡住
 *   4. 上一轮是用户 Esc 中止（stopReason === "aborted"）或运行出错
 *   5. plan/ 下没有计划文件 → 不动作
 *   6. 会话文件超过 session-mb 上限（旧历史常驻内存，提示换新会话）
 *
 * 开关状态存 custom entry（不进 LLM context）。
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const EXT = "auto-continue";
const PLAN_DIR = "plan";
const SPEC_FILE = "plan.md"; // plan/plan.md 是写作规范，不是计划本身

// 计划文件四个框架（扩展只读解析，从不写回）
const OKR_O_HEADING_RE = /^#{2,3}[ \t]*(?:目标|Objective|Objectives)(?:[（(].*[）)])?[ \t]*$/i;
const OKR_KR_HEADING_RE = /^#{2,3}[ \t]*(?:关键结果|Key[ \t]+Results?)(?:[（(].*[）)])?[ \t]*$/i;
const SWOT_HEADING_RE = /^#{2,3}[ \t]*SWOT[^#]*$/i;
const MAP_HEADING = "用户故事地图"; // 顶层=切片
const MAP_HEADINGS = [MAP_HEADING, "故事地图", "任务地图"]; // 旧名兼容
const MAP_HEADING_RE = new RegExp(`^#{2,3}[ \\t]*(?:${MAP_HEADINGS.join("|")})`);
const MAP_NUDGE_AFTER = 3; // 连续这么多轮还没地图，就软提示一次

const DEFAULT_LIMIT = 1000;
const DEFAULT_STUCK = 4;
const DEFAULT_RESET = 2;
const DEFAULT_COMPACT_AT = 0; // 0 = 关闭（沿用 pi 的压缩阈值）
const DEFAULT_SESSION_MB = 0; // 0 = 关闭（不做会话体积保护）

/** 每轮注入的鼓励语（正向反馈——轮换使用，避免重复到麻木） */
const PRAISE = [
	"非常好！",
	"太棒了！",
	"干得漂亮！",
	"做得好！",
	"进展很好！",
	"漂亮，继续保持！",
	"非常棒，你的推进很扎实！",
	"厉害！",
	"稳步前进，很好！",
	"很好，就这样继续！",
];
let praiseIndex = 0;

function praise(): string {
	const p = PRAISE[praiseIndex % PRAISE.length] ?? "非常好！";
	praiseIndex += 1;
	return p;
}

/**
 * 注入 system prompt 的价值交付原则（before_agent_start 并入 promptGuidelines）。
 * 只讲一个模型：信念（SWOT）→ 承诺（OKR）→ 路径（地图）→ 实验（PDCA）→ 证据，
 * 再用证据更新信念。原则只指方向，不替模型思考。
 */
const PRINCIPLES = [
	"目标是持续交付用户可感知的价值；把计划当作可被证据改写的假设集：SWOT 记录已知/未知（信念），OKR 把本轮假设写成可证伪的结果（承诺），用户故事地图排出用户可感知的最小切片（路径），PDCA 用小实验验证（实验）。",
	"Check 是证伪，不是自证：优先 TDD——先写失败测试，再实现；精准跑与本次变更相关的测试，测试转绿＋可复跑证据才算通过；检查函数是否存在、字数多少等没有价值的内容不算验证。",
	"每轮只推对 KR 证据影响最大的下一步；Do 后必须 Check；收口时 OKR/地图无未完成项（做完或 `- [-]` 显式取消）；最后一行报 [PDCA] plan|do|check|act，交付完毕报 [PDCA] complete，无法安全推进报 [PDCA] blocked: <原因>。",
];

function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** 计划文件里的勾选行：兼容 `-` / `*` / `+` 三种列表符号 */
const CHECKBOX_RE = /^([ \t]*)[-*+][ \t]*\[([ xX\-~])\][ \t]*(.*)$/;

/** Check 的精准验证口径（多处复用，避免文本漂移） */
const PRECISE_CHECK =
	"精准验证：只跑与本次变更相关的测试，别每次跑全量——检查函数是否存在、字数多少这类没有意义的内容不算验证";

// ---------------------------------------------------------------- 计划文件

/** 找 plan/ 下最新修改的计划文件；没有则返回 undefined */
async function findPlanFile(cwd: string, pinned: string): Promise<string | undefined> {
	const dir = join(cwd, PLAN_DIR);
	let names: string[];
	try {
		names = (await readdir(dir, { withFileTypes: true }))
			.filter((e) => !e.isDirectory() && e.name.endsWith(".md") && e.name !== SPEC_FILE)
			.map((e) => e.name);
	} catch {
		return undefined;
	}
	if (pinned) {
		const want = pinned.replace(/\.md$/, "");
		names = names.filter((n) => n === `${want}.md` || n === pinned);
	}
	let best: { file: string; mtime: number } | undefined;
	for (const name of names) {
		const path = join(dir, name);
		try {
			const info = await stat(path);
			if (!best || info.mtimeMs > best.mtime) best = { file: path, mtime: info.mtimeMs };
		} catch {
			// 并发编辑/删除，跳过
		}
	}
	return best?.file;
}

/** 取某段正文（标题行到下一个标题行之间）；没有该段返回 undefined */
function sectionBody(content: string, heading: RegExp): string | undefined {
	const lines = content.split("\n");
	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		if (heading.test(lines[i])) {
			start = i;
			break;
		}
	}
	if (start < 0) return undefined;
	const body: string[] = [];
	for (let i = start + 1; i < lines.length; i++) {
		if (/^#{1,3}[ \t]/.test(lines[i])) break; // 下一节
		body.push(lines[i]);
	}
	return body.join("\n");
}

/** 去掉行首列表/引用符号与包裹的反引号/星号等装饰 */
function cleanLine(raw: string): string {
	return raw
		.replace(/^[\s>`*_#\-+]*/, "")
		.replace(/[`*_]+$/, "")
		.trim();
}

// ---------------------------------------------------------------- OKR（只读）

type KrState = "open" | "done" | "cancelled";

interface KrItem {
	title: string;
	state: KrState;
	progress?: string; // 从标题里提取的可度量进度，如 "3/10"、"37%"
}

interface Okr {
	objective?: string; // 一句话 O
	krs: KrItem[]; // 勾选 KR 条目（用于锚点与收口闸门）
}

function krStateFrom(mark: string): KrState {
	const m = mark.toLowerCase();
	return m === "x" ? "done" : m === " " ? "open" : "cancelled";
}

/** 从 KR 标题里提取进度数字（x/y 或百分比） */
function krProgress(title: string): string | undefined {
	const ratio = title.match(/(\d+(?:\.\d+)?)[ \t]*[/／][ \t]*(\d+(?:\.\d+)?)/);
	if (ratio) return `${ratio[1]}/${ratio[2]}`;
	const pct = title.match(/(\d+(?:\.\d+)?)[ \t]*%/);
	if (pct) return `${pct[1]}%`;
	return undefined;
}

/** 只读解析 `## 目标（Objective）` + `## 关键结果（Key Results）`；扩展不写回 */
function parseOkr(content: string): Okr {
	const result: Okr = { krs: [] };

	const krBody = sectionBody(content, OKR_KR_HEADING_RE);
	if (krBody !== undefined) {
		for (const raw of krBody.split("\n")) {
			if (/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/.test(raw)) break; // 分隔线
			const m = raw.match(CHECKBOX_RE);
			if (!m) continue;
			const title = m[3].trim().replace(/[`*_]+$/, "").trim();
			if (!title) continue;
			result.krs.push({ title, state: krStateFrom(m[2]), progress: krProgress(title) });
		}
	}

	const oBody = sectionBody(content, OKR_O_HEADING_RE);
	if (oBody !== undefined) {
		for (const raw of oBody.split("\n")) {
			const line = cleanLine(raw);
			if (!line) continue;
			result.objective = line.replace(/^(?:O|目标)[ \t]*[：:][ \t]*/i, "").trim();
			if (result.objective) break; // 第一句有意义的话就是 O
		}
	}
	return result;
}

/** 勾选 KR 汇总（取消的不算达成也不算待办） */
function okrSummary(okr: Okr): { alive: number; done: number; open: KrItem[] } | undefined {
	if (okr.krs.length === 0) return undefined;
	const alive = okr.krs.filter((k) => k.state !== "cancelled");
	return {
		alive: alive.length,
		done: alive.filter((k) => k.state === "done").length,
		open: alive.filter((k) => k.state === "open"),
	};
}

// ---------------------------------------------------------------- SWOT（只读）

interface Swot {
	s?: string; // 优势（已验证）
	w?: string; // 劣势（未知）
	o?: string; // 机会（最省力的真实反馈路径）
	t?: string; // 威胁（风险与关键假设）
}

const SWOT_LABELS: Record<string, keyof Swot> = {
	S: "s",
	优势: "s",
	W: "w",
	劣势: "w",
	O: "o",
	机会: "o",
	T: "t",
	威胁: "t",
};

/** 只读解析 `## SWOT`（S/W/O/T 各一行；扩展不写回） */
function parseSwot(content: string): Swot {
	const swot: Swot = {};
	const body = sectionBody(content, SWOT_HEADING_RE);
	if (body === undefined) return swot;
	for (const raw of body.split("\n")) {
		if (/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/.test(raw)) break;
		const line = cleanLine(raw);
		const m = line.match(/^(优势|劣势|机会|威胁|[SWOT])[ \t]*[：:][ \t]*(.+)$/i);
		if (!m) continue;
		const key = SWOT_LABELS[m[1]] ?? SWOT_LABELS[m[1].toUpperCase()];
		if (!key || swot[key]) continue; // 每格取第一行
		swot[key] = m[2].trim();
	}
	return swot;
}

// ---------------------------------------------------------------- 用户故事地图（只读）

interface MapNode {
	path: number[];
	title: string;
	state: KrState;
	children: MapNode[];
}

/** 只读解析 `## 用户故事地图` 勾选清单（模型维护；扩展不写回） */
function parseStoryMap(content: string): MapNode | undefined {
	const body = sectionBody(content, MAP_HEADING_RE);
	if (body === undefined) return undefined;
	const root: MapNode = { path: [], title: "", state: "open", children: [] };
	const nodes: MapNode[] = [root];
	const indents: number[] = [-1];
	for (const raw of body.split("\n")) {
		if (/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/.test(raw)) break; // 分隔线
		const m = raw.match(CHECKBOX_RE);
		if (!m) continue;
		const indent = m[1].replace(/\t/g, "  ").length;
		const state: KrState = krStateFrom(m[2]);
		const title = m[3]
			.trim()
			.replace(/^[\d][\d./]*[ \t]+/, "")
			.replace(/[（(][ \t]*(?:取消|已取消)[:：].*$/, "")
			.trim();
		while (indents.length > 1 && indent <= indents[indents.length - 1]) {
			indents.pop();
			nodes.pop();
		}
		const parent = nodes[nodes.length - 1];
		if (!parent) continue;
		const node: MapNode = { path: [...parent.path, parent.children.length + 1], title, state, children: [] };
		parent.children.push(node);
		indents.push(indent);
		nodes.push(node);
	}
	return root.children.length > 0 ? root : undefined;
}

/** 文档顺序的叶子（剪掉取消子树） */
function collectMapLeaves(node: MapNode, out: MapNode[] = []): MapNode[] {
	if (node.state === "cancelled") return out;
	if (node.children.length === 0) {
		out.push(node);
		return out;
	}
	for (const child of node.children) collectMapLeaves(child, out);
	return out;
}

interface MapSummary {
	total: number;
	done: number;
	open: MapNode[];
	next?: MapNode;
}

function mapSummary(root: MapNode | undefined): MapSummary | undefined {
	if (!root) return undefined;
	const leaves = collectMapLeaves(root);
	const open = leaves.filter((n) => n.state !== "done");
	return { total: leaves.length, done: leaves.length - open.length, open, next: open[0] };
}

// ---------------------------------------------------------------- 模型自答解析（PDCA 协议）

interface LastAssistant {
	stopReason: string;
	text: string;
}

/** 上一轮 assistant：结束原因（aborted → 用户 Esc）+ 文本（解析阶段标记） */
function lastAssistant(ctx: ExtensionContext): LastAssistant | undefined {
	const branch = ctx.sessionManager.getBranch();
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type === "message" && entry.message.role === "assistant") {
			const parts: string[] = [];
			for (const block of entry.message.content) {
				if (block.type === "text") parts.push(block.text);
			}
			return { stopReason: entry.message.stopReason, text: parts.join("\n") };
		}
	}
	return undefined;
}

type Phase = "plan" | "do" | "check" | "act";

type Marker =
	| { kind: "phase"; phase: Phase }
	| { kind: "complete" }
	| { kind: "blocked"; reason: string };

/** 按出现顺序解析回复里的阶段标记；最后的标记即本轮结论。`@坐标`/`[MAP]` 只为兼容旧回复而容忍 */
function parseReply(text: string): Marker[] {
	const markers: Marker[] = [];
	let fence: string | undefined; // 忽略代码块里的示例标记
	for (const raw of text.split("\n")) {
		const f = raw.match(/^[ \t]*(`{3,}|~{3,})/);
		if (f) {
			const marker = f[1];
			if (!fence) fence = marker;
			else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
			continue;
		}
		if (fence) continue;

		const line = cleanLine(raw);
		if (!line) continue;

		let m = line.match(
			/^\[PDCA\][ \t]+(plan|do|check|act|complete|blocked)(?:[ \t]+@[ \t]*[\d./]+)?[ \t]*:?[ \t]*(.*)$/i,
		);
		if (m) {
			const kind = m[1].toLowerCase();
			if (kind === "blocked") {
				markers.push({ kind: "blocked", reason: m[2]?.trim().replace(/[`*_]+$/, "") || "模型报告被阻塞" });
			} else if (kind === "complete") {
				markers.push({ kind: "complete" });
			} else {
				markers.push({ kind: "phase", phase: kind as Phase });
			}
			continue;
		}
		m = line.match(/^\[PLAN\][ \t]+(working|complete|blocked|continue)[ \t]*:?[ \t]*(.*)$/i);
		if (m) {
			const kind = m[1].toLowerCase();
			if (kind === "blocked") markers.push({ kind: "blocked", reason: m[2]?.trim() || "模型报告被阻塞" });
			else if (kind === "complete") markers.push({ kind: "complete" });
			else markers.push({ kind: "phase", phase: "do" }); // 旧协议：working ≈ 本轮在 Do
		}
	}
	return markers;
}

// ---------------------------------------------------------------- 扩展

export default function autoContinue(pi: ExtensionAPI): void {
	let enabled = false;
	let continues = 0;
	let staleRounds = 0;
	let resets = 0;
	let toolCallsThisRun = 0;
	let cycles = 0; // 已完成的 PDCA 轮数（Act 次数）
	let checkedSinceDo = false; // Check 绝不跳过：Do 之后必须 Check 过才能 complete
	let lastPhase: Phase | undefined;
	let planPath: string | undefined; // 当前跟踪的计划文件（状态栏/消息用）
	let okr: Okr = { krs: [] }; // 只读解析的 OKR
	let swot: Swot = {}; // 只读解析的 SWOT
	let mapRoot: MapNode | undefined; // 只读解析的故事地图
	let planCache: { file: string; mtimeMs: number; okr: Okr; swot: Swot; map: MapNode | undefined } | undefined;
	let mapNudged = false; // 无地图时是否已软提示过（每会话一次）
	let bootstrapped = false; // 无计划文件时是否已做过一次引导（每会话一次）
	let budgetCompactionFailed = false; // 预算压缩已压不下去时，避免每轮重复尝试

	pi.registerFlag("auto-continue", {
		description: "（已默认开启；保留仅为兼容旧命令行）",
		type: "boolean",
		default: true,
	});
	pi.registerFlag("auto-continue-off", {
		description: "本次启动关闭 auto-continue（默认开启）",
		type: "boolean",
		default: false,
	});
	pi.registerFlag("auto-continue-limit", {
		description: `每轮最多自动续跑次数（默认 ${DEFAULT_LIMIT}）`,
		type: "string",
		default: String(DEFAULT_LIMIT),
	});
	pi.registerFlag("auto-continue-stuck", {
		description: `连续多少轮没有任何工具调用就触发重置（默认 ${DEFAULT_STUCK}）`,
		type: "string",
		default: String(DEFAULT_STUCK),
	});
	pi.registerFlag("auto-continue-reset", {
		description: `卡住后压缩历史重新 Plan 的最大次数（默认 ${DEFAULT_RESET}）`,
		type: "string",
		default: String(DEFAULT_RESET),
	});
	pi.registerFlag("auto-continue-plan", {
		description: "固定跟踪的 plan/<name>.md（默认取最新修改的计划）",
		type: "string",
		default: "",
	});
	pi.registerFlag("auto-continue-compact-at", {
		description: "上下文超过该 token 数就先压缩再续跑（0=关闭，默认 0）",
		type: "string",
		default: String(DEFAULT_COMPACT_AT),
	});
	pi.registerFlag("auto-continue-session-mb", {
		description: "会话文件超过该 MB 数就暂停并提醒换新会话（0=关闭，默认 0）",
		type: "string",
		default: String(DEFAULT_SESSION_MB),
	});

	const positives = (name: string, fallback: number): number => {
		const raw = pi.getFlag(name);
		const n = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
		return Number.isFinite(n) && n > 0 ? n : fallback;
	};
	const limit = (): number => positives("auto-continue-limit", DEFAULT_LIMIT);
	const stuckLimit = (): number => positives("auto-continue-stuck", DEFAULT_STUCK);
	const resetLimit = (): number => positives("auto-continue-reset", DEFAULT_RESET);
	const pinned = (): string => {
		const raw = pi.getFlag("auto-continue-plan");
		return typeof raw === "string" ? raw : "";
	};
	/** 0/非法值 = 关闭（用于可选闸门） */
	const optional = (name: string): number => {
		const raw = pi.getFlag(name);
		const n = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
		return Number.isFinite(n) && n > 0 ? n : 0;
	};
	const compactAt = (): number => optional("auto-continue-compact-at");
	const sessionMbLimit = (): number => optional("auto-continue-session-mb");

	const findPlan = (ctx: ExtensionContext): Promise<string | undefined> => findPlanFile(ctx.cwd, pinned());

	/** 每条续跑消息的统一抬头 */
	const header = (n: number): string => `${praise()} [auto-continue ${n}/${limit()}]`;
	/** 计划文件在消息里的显示路径 */
	const planRef = (ctx: ExtensionContext, planFile: string | undefined): string =>
		planFile ? relative(ctx.cwd, planFile) : PLAN_DIR;

	function resetCounters(): void {
		continues = 0;
		staleRounds = 0;
		resets = 0;
		toolCallsThisRun = 0;
		cycles = 0;
		checkedSinceDo = false;
		lastPhase = undefined;
	}

	function persist(): void {
		pi.appendEntry(EXT, { enabled });
	}

	/** 只读同步计划文件：一次读取，同时解析 OKR / SWOT / 故事地图（mtime 缓存；扩展从不写文件） */
	async function syncPlan(): Promise<void> {
		const file = planPath;
		if (!file) {
			okr = { krs: [] };
			swot = {};
			mapRoot = undefined;
			planCache = undefined;
			return;
		}
		if (planCache?.file === file) {
			try {
				const info = await stat(file);
				if (info.mtimeMs === planCache.mtimeMs) {
					okr = planCache.okr;
					swot = planCache.swot;
					mapRoot = planCache.map;
					return;
				}
			} catch {
				// 落到重读
			}
		}
		try {
			const content = await readFile(file, "utf8");
			const info = await stat(file);
			okr = parseOkr(content);
			swot = parseSwot(content);
			mapRoot = parseStoryMap(content);
			planCache = { file, mtimeMs: info.mtimeMs, okr, swot, map: mapRoot };
		} catch {
			okr = { krs: [] };
			swot = {};
			mapRoot = undefined;
			planCache = { file, mtimeMs: 0, okr, swot, map: undefined };
		}
	}

	// ------------------------------------------------------------ 锚点（只读回灌）

	/** OKR 锚点：O 一句话＋KR 勾选进度（有 OKR 内容时每轮注入首行） */
	function okrAnchor(): string | undefined {
		if (!okr.objective && okr.krs.length === 0) return undefined;
		const parts: string[] = [];
		if (okr.objective) parts.push(`O：${truncate(okr.objective, 64)}`);
		if (okr.krs.length > 0) {
			const shown = okr.krs
				.slice(0, 3)
				.map((k) => {
					const mark = k.state === "done" ? "✓" : k.state === "cancelled" ? "✗" : "◻";
					const prog = k.progress && !k.title.includes(k.progress) ? `（${k.progress}）` : "";
					return `${mark} ${truncate(k.title, 36)}${prog}`;
				})
				.join(" ｜ ");
			const more = okr.krs.length > 3 ? ` ｜ +${okr.krs.length - 3}` : "";
			parts.push(`KR：${shown}${more}`);
		}
		return `OKR（承诺）${parts.join(" ｜ ")}`;
	}

	/** 地图锚点：x/y 进度＋下一个切片（只有存在地图时才有） */
	function mapAnchor(): string | undefined {
		const sum = mapSummary(mapRoot);
		if (!sum || sum.total === 0) return undefined;
		const next = sum.next ? `${sum.next.path.join(".")} ${sum.next.title}` : "无";
		return `地图（路径）${sum.done}/${sum.total} ｜ 下一片：${next}`;
	}

	/** SWOT 锚点：当前 S/W/O/T 快照（Planning 时刻回灌，让新 Plan 建立在更新过的认知上） */
	function swotAnchor(): string | undefined {
		const parts = (
			[
				["s", "S"],
				["w", "W"],
				["o", "O"],
				["t", "T"],
			] as const
		)
			.map(([key, label]) => (swot[key] ? `${label} ${truncate(swot[key], 40)}` : undefined))
			.filter((p): p is string => p !== undefined);
		if (parts.length === 0) return undefined;
		return `SWOT（信念）${parts.join(" ｜ ")}`;
	}

	// ------------------------------------------------------------ 状态与消息

	function updateStatus(ctx: ExtensionContext): void {
		if (!enabled) {
			ctx.ui.setStatus(EXT, undefined);
			return;
		}
		if (!planPath) {
			ctx.ui.setStatus(EXT, ctx.ui.theme.fg("muted", "pdca: 无计划文件"));
			return;
		}
		const oSum = okrSummary(okr);
		const mSum = mapSummary(mapRoot);
		const okrProg = oSum ? ` · OKR ${oSum.done}/${oSum.alive}` : "";
		const mapProg = mSum && mSum.total > 0 ? ` · 地图 ${mSum.done}/${mSum.total}` : "";
		ctx.ui.setStatus(
			EXT,
			ctx.ui.theme.fg("accent", `pdca ▶ ${lastPhase ?? "…"}${okrProg}${mapProg} · ${basename(planPath)}`),
		);
	}

	/** 无计划文件时的唯一一次引导：教会「假设 → 证据」循环与计划落位，之后交给模型自己建 */
	function bootstrapMessage(): string {
		return [
			`${praise()} auto-continue 已开启（默认自动续跑）：本会话按「假设 → 证据」循环推进——SWOT 记录信念边界 → OKR 把假设写成可证伪的承诺 → 用户故事地图排出价值抵达的路径 → PDCA 用小实验验证。`,
			"1. 先把计划写进项目 `plan/<主题>.md`（不存在就创建；一主题一文件；`plan/plan.md` 是写作规范，不是计划）；",
			"2. `## SWOT`：S 已被证据支持 / W 尚未验证的未知 / O 最省力的验证机会 / T 最可能推翻计划的风险——各一行；它是信念边界，不是价值清单；",
			"3. `## 目标（Objective）`：一句话 O＝用户可感知的价值改变；`## 关键结果（Key Results）` 2–4 条可证伪的 KR（基线 → 目标），是证据不是任务；",
			"4. `## 用户故事地图`（可选）：用户按什么顺序感知到改变——顶层=切片，第一片=最小端到端价值闭环，同级按用户旅程排序；",
			"5. 其余内容边做边记：执行实录、证据、决策与判负——计划文件是唯一事实源（扩展只读解析，用于锚点与收口）；",
			"6. 每轮最后一行报 `[PDCA] plan|do|check|act`；完成 → `[PDCA] complete`（Do 后必须用 TDD 测试 Check 过）；推不动 → `[PDCA] blocked: <原因>`。",
		].join("\n");
	}

	/** 没写阶段标记时的通用续跑：回到「假设 → 证据」，别停 */
	function continueMessage(ctx: ExtensionContext, planFile: string | undefined, n: number): string {
		const file = planRef(ctx, planFile);
		return [
			`${header(n)} 继续「假设 → 证据」循环（计划文件：${file}）。`,
			"1. 不要询问是否继续——直接做下一步；",
			"2. 每轮只推对 KR 证据影响最大的一个变量；没让证据状态变化的动作不算产出；",
			"3. 按 PDCA 推进，最后一行报阶段：",
			"   - [PDCA] plan|do|check|act",
			"   - 完成 → [PDCA] complete（Do 之后必须用 TDD 测试 Check 过）",
			"   - 确实无法安全推进 → [PDCA] blocked: <原因>",
			"4. 进度、证据、决策、判负都写进计划文件（SWOT/OKR/地图同步维护）；遇到岔路口，自行选最合理、可回退、风险最低的默认方案——不要等确认。",
		].join("\n");
	}

	/** 阶段教练：模型报告“本轮完成的阶段”，扩展把它推进到下一阶段——每一阶段都是循环的一步 */
	function phaseMessage(ctx: ExtensionContext, planFile: string | undefined, n: number, phase: Phase): string {
		const file = planRef(ctx, planFile);
		const head = header(n);
		switch (phase) {
			case "plan":
				return [
					`${head} Plan 收到：假设已更新，进入 Do——用最小变量验证它：`,
					"1. 一次只动一个变量，只推对 KR 证据影响最大的主目标；",
					"2. 不要询问是否继续——直接做；",
					"3. 最后一行报 [PDCA] do；做不下去 → [PDCA] blocked: <原因>；",
					"4. 卡住时：重读需求、查 diff、从头追错、加日志、回滚、简化——失败是证据，跳过才是真失败。",
				].join("\n");
			case "do":
				return [
					`${head} Do 收到，进入 Check——Check 是证伪，不是自证：`,
					"1. 优先 TDD：先写失败测试，再实现；测试断言 KR 的价值是否真的发生（行为/结果）；",
					"2. " + PRECISE_CHECK + "；测试转绿＋可复跑证据（命令＋关键输出摘要）才算通过；",
					"3. 复检 SWOT：信念边界有变化就更新计划文件，再决定下一步；",
					"4. 最后一行报 [PDCA] check。",
				].join("\n");
			case "check":
				return [
					`${head} Check 收到，进入 Act——按证据更新计划：`,
					"1. 证据支持 → 标准化：提交/记录，更新 KR 进度（勾选与数字）并写进计划文件；",
					"2. 证据不支持 → 改写假设/计划，不盲目打补丁；",
					"3. 复盘：给 KR 打分（0–1，0.7 达标），再问继续、调整，还是停？结论写进计划文件；",
					"4. 最后一行报 [PDCA] act；若已无剩余工作，直接报 [PDCA] complete。",
				].join("\n");
			case "act":
				return [
					`${head} Act 收到（第 ${cycles} 轮学习完成），进入下一轮 Plan——重新问四个问题：`,
					"1. SWOT：信念边界更新——S 已被证据支持 / W 尚未验证 / O 最省力的验证机会 / T 最可能推翻计划的风险；",
					"2. OKR：把下一步写成可证伪的承诺——O 一句话；2–4 条 KR（基线 → 目标），是结果不是任务；",
					"3. 地图：下一个最小切片是什么？",
					`4. 更新计划文件（${file}）：本轮证据、下一步、决策与判负；`,
					`5. 最后一行报 [PDCA] plan；若无剩余工作 → [PDCA] complete（且 Check 过）。`,
				].join("\n");
		}
	}

	/** 收口门：一次列出所有未通过的检查（Check / OKR / 地图），避免一轮只修一个门 */
	function closureMessage(
		ctx: ExtensionContext,
		planFile: string | undefined,
		n: number,
		blockers: { check: boolean; okr: KrItem[]; map: MapNode[] },
	): string {
		const reasons: string[] = [];
		if (blockers.check) reasons.push("自上次 Do 之后还没 Check（Check 绝不跳过）");
		if (blockers.okr.length > 0) {
			const list = blockers.okr
				.slice(0, 3)
				.map((k) => k.title)
				.join("、");
			const more = blockers.okr.length > 3 ? ` 等 ${blockers.okr.length} 项` : "";
			reasons.push(`OKR 还有 ${blockers.okr.length} 条关键结果未达成——${list}${more}`);
		}
		if (blockers.map.length > 0) {
			const list = blockers.map
				.slice(0, 3)
				.map((x) => `${x.path.join(".")} ${x.title}`)
				.join("、");
			const more = blockers.map.length > 3 ? ` 等 ${blockers.map.length} 项` : "";
			reasons.push(`用户故事地图还有 ${blockers.map.length} 个未完成——${list}${more}`);
		}

		const sections: string[][] = [];
		if (blockers.check) {
			sections.push([
				"Check——必须用 TDD 测试验证 OKR 的交付价值（证伪，不是自证）：",
				"   - 测试断言 KR 的价值是否真的发生（行为/结果）；",
				`   - ${PRECISE_CHECK}；`,
				"   - 测试转绿＋可复跑证据（命令＋关键输出摘要）才算通过；不通过 → 报 [PDCA] act 改计划再循环。",
			]);
		}
		if (blockers.okr.length > 0) {
			sections.push([
				"OKR 收口（承诺不撒谎），三条路自选其一并写回计划文件：",
				"   - 做完：继续推进直到指标达标，勾 `- [x]`；",
				"   - 砍掉：确实不该做 → `- [-]`（取消：理由），留墓碑；",
				"   - 改写：目标/口径变了 → 改写 KR（仍须可度量、是结果不是任务）。",
			]);
		}
		if (blockers.map.length > 0) {
			sections.push([
				"地图收口（路径不撒谎）：做完的勾 `- [x]`，不做的用 `- [-]`（取消：理由）显式取消。",
			]);
		}
		const steps = sections.flatMap((lines, i) =>
			lines.map((line, j) => (j === 0 ? `${i + 1}. ${line}` : line)),
		);
		return [
			`${header(n)} 收口被门禁拦下：${reasons.join("；")}。`,
			...steps,
			"不要用“看起来没问题”代替可复跑的证据（优先 TDD 测试）。",
			`计划文件：${planRef(ctx, planFile)}`,
		].join("\n");
	}

	/** 模型报 blocked：不把不确定性交回用户，而是要求它做一个可回退的决定并写回计划 */
	function selfResolveMessage(ctx: ExtensionContext, planFile: string | undefined, n: number, reason: string): string {
		const file = planRef(ctx, planFile);
		return [
			`${header(n)} 你报告了 blocked（原因：${reason}）。blocked 不是把不确定性交回给我，而是需要你做一个可回退的决定：`,
			"1. 需要拍板的岔路口：选最合理、可回退、风险最低的默认方案继续执行；",
			`2. 把决定、理由和影响写进计划文件（${file}）；`,
			"3. 能推进的其它部分先推进（一次一个变量），并把计划文件更新到最新；",
			"4. 只有所有剩余工作都确实无法安全推进时，才再写 [PDCA] blocked: <原因>。",
		].join("\n");
	}

	/** 卡住后的重启指令：假设太大、证据太远——把循环切小，重新 Plan */
	function restartMessage(ctx: ExtensionContext, planFile: string | undefined, n: number): string {
		const file = planRef(ctx, planFile);
		return [
			`${header(n)} 刚才卡住了（连续几轮没有实际动作），历史已压缩。卡住通常不是能力问题，而是假设太大、证据太远——把循环切小：`,
			`1. 重读计划文件 ${file}（如果它存在；不存在就以任务目标为准）——重点看 KR 的证据缺口与地图的下一片；`,
			"2. 用一句话重写当前假设：我们相信什么？哪条证据能推翻它？",
			"3. 把下一步拆成“一次工具调用或一轮就能完成、且能独立验证”的最小实验；",
			"4. 一轮只推进一步，完成就用证据更新计划，然后立即做下一步；",
			"5. 不要询问是否继续；需要拍板时自选可回退的默认方案并记录理由；",
			"6. 最后一行报 [PDCA] plan（或 do / blocked: <原因>）。",
		].join("\n");
	}

	/** 当前会话文件大小（MB）；拿不到时返回 0 */
	async function sessionSizeMb(ctx: ExtensionContext): Promise<number> {
		const file = ctx.sessionManager.getSessionFile();
		if (!file) return 0;
		try {
			return (await stat(file)).size / (1024 * 1024);
		} catch {
			return 0;
		}
	}

	/** 压缩时要求摘要保留的交接信息（卡住重置与预算压缩共用） */
	function handoffInstructions(
		ctx: ExtensionContext,
		planFile: string | undefined,
		reason: string,
		stuck: boolean,
	): string {
		const file = planRef(ctx, planFile);
		const oSum = okrSummary(okr);
		const mSum = mapSummary(mapRoot);
		const okrLine = oSum ? `OKR（承诺）${oSum.done}/${oSum.alive}` : undefined;
		const mapLine = mSum && mSum.total > 0 ? `地图（路径）${mSum.done}/${mSum.total}` : undefined;
		return [
			`这是 auto-continue 的「${reason}」，摘要必须保留：`,
			"1) 当前信念（SWOT）与承诺/路径（OKR/地图进度）；",
			"2) 已有证据（Check 结果、测试/指标）与仍缺的证据；",
			stuck ? "3) 剩余工作，以及具体卡在哪里；" : "3) 剩余工作与当前进度；",
			`4) 计划文件路径 ${file}${okrLine ? `（${okrLine}${mapLine ? `，${mapLine}` : ""}）` : ""}——注明「重新读取该文件继续」；`,
			"5) 可复用的关键文件/命令/结论。",
			"丢弃：重复的失败尝试、与剩余工作无关的探索细节。",
		].join("\n");
	}

	function pause(ctx: ExtensionContext, reason: string): void {
		enabled = false;
		resetCounters();
		persist();
		updateStatus(ctx);
		ctx.ui.notify(`auto-continue 已暂停：${reason}—— /auto 重新开启`, "warning");
	}

	/** 正常收口（完成），与“暂停”区分语气 */
	function finish(ctx: ExtensionContext, message: string): void {
		enabled = false;
		resetCounters();
		persist();
		updateStatus(ctx);
		ctx.ui.notify(message, "info");
	}

	/** 同一 session 内压缩历史（不新开 session），完成后发重启指令 */
	function resetContext(ctx: ExtensionContext, planFile: string | undefined, n: number): void {
		ctx.ui.notify(
			`auto-continue：连续无进展——压缩历史并重新 Plan（第 ${resets}/${resetLimit()} 次）`,
			"warning",
		);
		ctx.compact({
			customInstructions: handoffInstructions(ctx, planFile, "卡住重置", true),
			onComplete: () => {
				pi.sendUserMessage(restartMessage(ctx, planFile, n));
			},
			onError: (error) => {
				if (/nothing to compact|already compacted/i.test(error.message)) {
					// 本来就没多少历史可压——直接重新 Plan
					pi.sendUserMessage(restartMessage(ctx, planFile, n));
					return;
				}
				pause(ctx, `压缩失败：${error.message}`);
			},
		});
	}

	// ------------------------------------------------------------ 命令

	pi.registerCommand("auto", {
		description: "auto-continue：假设驱动的价值交付循环（/auto | on | off | status）",
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();

			if (arg === "status") {
				await showStatus(ctx);
				return;
			}
			if (arg && arg !== "on" && arg !== "off") {
				ctx.ui.notify(`用法：/auto [on|off|status]（收到 "${args.trim()}"）`, "warning");
				return;
			}

			enabled = arg === "on" ? true : arg === "off" ? false : !enabled;
			resetCounters();
			bootstrapped = false;
			persist();
			planPath = enabled ? await findPlan(ctx) : undefined;
			await syncPlan();
			updateStatus(ctx);

			if (!enabled) {
				ctx.ui.notify("auto-continue 关闭", "info");
			} else if (!planPath) {
				ctx.ui.notify("auto-continue 开启（假设 → 承诺 → 路径 → 实验）：plan/ 下没有计划文件——首次任务会自动引导建计划", "warning");
			} else {
				ctx.ui.notify(`auto-continue 开启（假设 → 承诺 → 路径 → 实验）：跟踪 ${basename(planPath)}`, "info");
			}
		},
	});

	async function showStatus(ctx: ExtensionContext): Promise<void> {
		if (!enabled) {
			ctx.ui.notify("auto-continue：off", "info");
			return;
		}
		planPath = await findPlan(ctx);
		await syncPlan();
		const oSum = okrSummary(okr);
		const summary = mapSummary(mapRoot);
		const sizeMb = await sessionSizeMb(ctx);
		const lines = [
			`auto-continue（假设 → 承诺 → 路径 → 实验）：on`,
			`计划文件：${planPath ? relative(ctx.cwd, planPath) : "（无——把计划写进 plan/<主题>.md）"}`,
			`OKR（承诺）：${
				oSum
					? `${oSum.done}/${oSum.alive} 达成${okr.objective ? ` ｜ O：${truncate(okr.objective, 48)}` : ""}`
					: "（无勾选 KR——零仪式；要进度就在 `## 关键结果（Key Results）` 下写 `- [ ] KR1：可度量指标（基线 → 目标）`）"
			}`,
			`地图（路径）：${
				summary && summary.total > 0
					? `${summary.done}/${summary.total}${summary.next ? ` ｜ 下一个：${summary.next.path.join(".")} ${summary.next.title}` : " ｜ 全部完成"}`
					: "（无——零仪式；要进度就加 `## 用户故事地图` 勾选清单）"
			}`,
			`SWOT（信念）：${swot.s || swot.w || swot.o || swot.t ? "已维护（Planning 时刻会回灌快照）" : "（无——建议在 `## SWOT` 下写 S/W/O/T 各一行）"}`,
			`本轮：已续跑 ${continues}/${limit()}，连续无动作 ${staleRounds}/${stuckLimit()}，重置 ${resets}/${resetLimit()}，PDCA 轮数 ${cycles}`,
			`上下文预算：${compactAt() > 0 ? `${compactAt()} tok（超出先压缩再续跑）` : "关闭"} ｜ 会话文件：${
				sizeMb > 0 ? `${sizeMb.toFixed(1)}MB` : "（内存）"
			}${sessionMbLimit() > 0 ? `（上限 ${sessionMbLimit()}MB）` : ""}`,
			`判定：回复最后一行 [PDCA] plan|do|check|act / complete / blocked；Check ${checkedSinceDo ? "已过" : "未过"}`,
		];
		ctx.ui.notify(lines.join("\n"), "info");
	}

	// ------------------------------------------------------------ 事件

	// 原则写入 system prompt：并入 promptGuidelines（结构化补丁，只动变更的 section，缓存友好）
	pi.on("before_agent_start", async (event) => {
		if (!enabled) return;
		const guidelines = event.systemPromptOptions.promptGuidelines;
		for (const p of PRINCIPLES) {
			if (!guidelines.includes(p)) guidelines.push(p);
		}
	});

	// 用户自己发消息 → 计数重置（不重置开关本身）
	pi.on("input", async (event) => {
		if (event.source === "extension") return;
		resetCounters();
	});

	// 「本轮有没有实际动作」——进展信号
	pi.on("agent_start", async () => {
		toolCallsThisRun = 0;
	});
	pi.on("tool_execution_start", async () => {
		toolCallsThisRun += 1;
	});

	/*
	 * 关键事件：agent_settled（不是 agent_end）。
	 * agent_end 之后 pi 还可能自动重试 / 自动压缩重试 / 消费排队的 followUp；
	 * agent_settled 才是“真的没有后续、正在等用户输入”的时刻。
	 */
	pi.on("agent_settled", async (_event, ctx) => {
		if (!enabled) return;
		if (!ctx.isIdle()) return; // 别的 extension 已启动新一轮，别抢

		const last = lastAssistant(ctx);
		const markers = last ? parseReply(last.text) : [];
		const verdict = markers[markers.length - 1];

		// 阶段状态推进（同一轮 do→check→act→complete 都算数）
		for (const m of markers) {
			if (m.kind !== "phase") continue;
			lastPhase = m.phase;
			if (m.phase === "do") checkedSinceDo = false;
			if (m.phase === "check") checkedSinceDo = true;
			if (m.phase === "act") cycles += 1;
		}

		// 只读同步计划文件：OKR / SWOT / 地图（无计划文件时必须清空，避免陈旧状态误收口）
		planPath = await findPlan(ctx);
		await syncPlan();
		const planFile = planPath;

		// 激活范围：plan/ 下有计划文件才动作（避免在闲聊里无限续跑）；
		// 无计划文件时只做一次引导（本轮有实际工具动作才算任务），之后静默
		if (!planFile) {
			if (
				!bootstrapped &&
				toolCallsThisRun > 0 &&
				last !== undefined &&
				last.stopReason === "stop" &&
				continues < limit()
			) {
				bootstrapped = true;
				continues += 1;
				updateStatus(ctx);
				pi.sendUserMessage(bootstrapMessage());
				return;
			}
			updateStatus(ctx);
			return;
		}
		bootstrapped = true; // 已跟踪计划，删除/改名后不再重复引导

		const oSum = okrSummary(okr);
		const summary = mapSummary(mapRoot);
		const mapOpen = (summary?.open.length ?? 0) > 0;
		const okrOpen = (oSum?.open.length ?? 0) > 0;

		// 完成判定：模型判断 + Check 门 + 地图门 + OKR 门；未过则一次列出所有门
		if (verdict?.kind === "complete" && checkedSinceDo && !mapOpen && !okrOpen) {
			finish(ctx, "auto-continue：模型报告价值交付完成 [PDCA] complete ✓（Check 已过，地图与 OKR 已收口）");
			return;
		}

		// 用户 Esc / 运行错误 → 不续跑，且暂停（避免误以为 auto 还在工作）
		if (!last || last.stopReason === "aborted" || last.stopReason === "error") {
			pause(ctx, !last ? "没有可判断的回复" : last.stopReason === "aborted" ? "用户中止" : "上一轮运行出错");
			return;
		}
		if (last.stopReason !== "stop" && last.stopReason !== "length") return; // toolUse/deferred 等交给 pi 自己继续

		if (continues >= limit()) {
			pause(ctx, `已达上限 ${limit()} 次`);
			return;
		}

		// 会话体积保护：append-only 历史常驻内存，压缩不释放旧 entries → 过大就停下提醒换新会话
		const mbLimit = sessionMbLimit();
		if (mbLimit > 0) {
			const sizeMb = await sessionSizeMb(ctx);
			if (sizeMb > mbLimit) {
				pause(
					ctx,
					`会话文件 ${sizeMb.toFixed(1)}MB 超过上限 ${mbLimit}MB——旧历史常驻内存，建议 /new 换新会话（计划已落盘，重开后继续）`,
				);
				return;
			}
		}

		// 进展信号：本轮有没有工具调用
		if (toolCallsThisRun === 0) {
			staleRounds += 1;
		} else {
			staleRounds = 0;
		}

		// 卡住 → 先压缩历史 + 重新 Plan；重置预算用完还卡才暂停
		if (staleRounds >= stuckLimit()) {
			if (resets >= resetLimit()) {
				pause(ctx, `连续无动作，上下文重建 ${resets} 次后仍推不动`);
				return;
			}
			resets += 1;
			staleRounds = 0;
			continues += 1;
			checkedSinceDo = false; // 重新 Plan 后，完成前仍需 Check
			lastPhase = "plan";
			updateStatus(ctx);
			resetContext(ctx, planFile, continues);
			return;
		}

		continues += 1;
		updateStatus(ctx);

		// 同一 session 追加用户消息：前缀不变 → prompt cache 继续命中
		let body: string;
		if (verdict?.kind === "complete") {
			body = closureMessage(ctx, planFile, continues, {
				check: !checkedSinceDo,
				okr: oSum?.open ?? [],
				map: summary?.open ?? [],
			});
		} else if (verdict?.kind === "blocked") body = selfResolveMessage(ctx, planFile, continues, verdict.reason);
		else if (verdict?.kind === "phase") body = phaseMessage(ctx, planFile, continues, verdict.phase);
		else body = continueMessage(ctx, planFile, continues);

		// 循环锚点（只读回灌）：OKR 每轮都在；地图有才在；SWOT 在 Planning 时刻回灌
		const anchors: string[] = [];
		const okrA = okrAnchor();
		if (okrA) anchors.push(okrA);
		const mapA = mapAnchor();
		if (mapA) anchors.push(mapA);
		const atPlanning = verdict?.kind === "phase" && (verdict.phase === "plan" || verdict.phase === "act");
		if (atPlanning) {
			const swotA = swotAnchor();
			if (swotA) anchors.push(swotA);
		}
		if (anchors.length > 0) body = `${anchors.join("\n")}\n${body}`;

		// 无地图时的软提示（每会话一次）
		if (!mapA && !mapNudged && continues >= MAP_NUDGE_AFTER) {
			mapNudged = true;
			body +=
				"\n（提示：已连续推进几轮——建议在计划文件里加 `## 用户故事地图` 勾选清单（顶层=切片，第一片=最小端到端闭环，同级按旅程顺序）；扩展只读它来显示进度、并在收口时核对。）";
		}

		// 上下文预算：超过 compactAt 就先压缩再续跑（默认关闭，沿用 pi 的压缩阈值）
		const budget = compactAt();
		const usage = budget > 0 ? ctx.getContextUsage() : undefined;
		if (usage?.tokens && usage.tokens <= budget) budgetCompactionFailed = false; // 上下文降下来了，允许下次再试
		if (usage?.tokens && usage.tokens > budget && !budgetCompactionFailed) {
			ctx.ui.notify(
				`auto-continue：上下文 ${usage.tokens} tok 超过预算 ${budget}——先压缩再续跑`,
				"info",
			);
			ctx.compact({
				customInstructions: handoffInstructions(ctx, planFile, "上下文预算压缩", false),
				onComplete: () => pi.sendUserMessage(body),
				onError: (error) => {
					if (/nothing to compact|already compacted/i.test(error.message)) {
						budgetCompactionFailed = true; // 已无可压缩历史，别再每轮重试
						pi.sendUserMessage(body); // 没多少历史可压——直接续跑
						return;
					}
					pause(ctx, `预算压缩失败：${error.message}`);
				},
			});
			return;
		}
		pi.sendUserMessage(body);
	});

	// 恢复/持久化开关状态（按当前分支；tree/fork 切换后同步）
	const restore = async (ctx: ExtensionContext): Promise<void> => {
		// 默认开启；--auto-continue-off 显式关闭；会话内 /auto off 的决定持久在该分支内并优先
		enabled = pi.getFlag("auto-continue-off") !== true;
		if (enabled) {
			const branch = ctx.sessionManager.getBranch();
			for (let i = branch.length - 1; i >= 0; i--) {
				const entry = branch[i];
				if (entry.type === "custom" && entry.customType === EXT) {
					const data = entry.data as { enabled?: boolean } | undefined;
					if (typeof data?.enabled === "boolean") enabled = data.enabled;
					break;
				}
			}
		}
		resetCounters();
		bootstrapped = false;
		mapNudged = false;
		budgetCompactionFailed = false;
		okr = { krs: [] };
		swot = {};
		mapRoot = undefined;
		planCache = undefined;
		planPath = enabled ? await findPlan(ctx) : undefined;
		if (enabled) await syncPlan();
		updateStatus(ctx);
	};
	pi.on("session_start", async (_event, ctx) => {
		await restore(ctx);
	});
	pi.on("session_tree", async (_event, ctx) => {
		await restore(ctx);
	});
}
