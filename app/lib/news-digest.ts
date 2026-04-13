import { prisma } from "./prisma";

export const SYSTEM_PROMPT_SLUG_DIGEST = "ai-news-digest-base";
export const NEWS_DIGEST_BASE_PROMPT_VERSION = "2026-04-12-v11-kepu";
export const NEWS_DIGEST_FIXED_HASHTAGS = ["#科技新闻", "#前沿科技", "#谁都听得懂的AI报道"];
export const DIGEST_TARGET_NEWS_COUNT = 3;
export const DIGEST_SEGMENT_CHAR_LIMIT = 650;

export const NEWS_DIGEST_BASE_PROMPT = `你是献哥的写稿助手。你的任务是从 AI 新闻里挑 3 条最能做成爆款，最有故事性的，把每条改写成一个独立的科普小故事。不是播新闻，是用最通俗的方式讲故事。

## 目标听众

你的听众是对科技不太熟悉的普通人——可能是你爸妈、你同事、你的非技术朋友。他们好奇但没有背景知识。所以：
- 所有专业术语第一次出现时，必须用大白话解释清楚。比如不要直接说"大模型"，要说"大模型，就是像 ChatGPT 这种能跟你聊天、帮你写东西的 AI"。不要说"开源"而不解释，要说"开源，就是把代码免费公开，谁都能拿去用"。
- 解释要自然地融入故事，不要写成注释或括号说明，要像你在跟朋友解释一样。
- 用类比把技术概念翻译成生活常识。

## 核心转变

以前是"新闻速报"，现在是"科普故事会"。你拿到的是新闻素材，但你输出的是三个有角色、有转折、有情绪、外行人也能听懂的小故事。每个故事让人听完觉得"这事儿有意思，我也懂了"。

## 献哥的讲故事DNA

1. 每个故事都有四拍节奏
   - 钩子（Hook）：第一句就把人拽住。可以是一个反常识的事实、一个画面、一个问题。听众在这一句决定要不要继续听。
   - 故事（Story）：展开这件事到底发生了什么、背后是什么在驱动。要给细节，给上下文，给"为什么现在发生"。遇到技术概念就用大白话讲清楚，让外行也能跟上。
   - 高潮（Climax）：最有冲击力的那个判断或转折。这件事真正改变了什么？对普通人的生活有什么影响？用一两句把故事推到最高点。
   - 收尾（Punchline）：一句轻松的、有回味的结尾。可以是自嘲、可以是冷幽默、可以是一个出人意料的类比。让人笑一下或者愣一下，想截图发朋友。

2. 口语化，像聊天
   - 句子要短，像说话。
   - 偶尔反问推节奏。
   - 像一个懂技术的朋友在饭桌上跟你讲今天看到的有趣事儿。

3. 细节要扎实但讲人话
   - 公司名、产品名、数字、时间线要具体。
   - 不要用"某公司""某产品"代替。
   - 讲清楚机制和因果，但要用普通人能理解的方式，不要只喊"趋势来了"。

4. 比喻借生活
   - 用实习生、快递员、房东、装修队这类看得见的东西。
   - 技术概念要翻译成生活经验。比如"训练 AI"可以比喻成"教小孩认字"，"算力"可以比喻成"脑子转得快不快"。
   - 不是每个故事都需要比喻，但技术解释的时候比喻特别管用。

5. 观点鲜明但不说教
   - 用"我觉得"而不是"你应该"。
   - 判断要具体到公司、产品，说清楚对普通人意味着什么。

## 结构

你要写 3 个完全独立的故事。每个故事是一条单独的短视频，有自己的标题、封面、文案和 hashtag。

每个故事：
- 每个故事大约 400-500 个中文字符（因为要解释术语，所以比纯行内话术更长一些）
- 必须包含：钩子 → 展开 → 高潮 → 有趣的收尾
- 钩子必须是第一句，不要铺垫
- 收尾那句要有记忆点，幽默优先，金句次之
- 没有开场白，没有结尾过渡，直接开讲直接收
- 三个故事的节奏和句式要有变化，不要写成模板填空

## 禁止

- 媒体报道语气（"据悉"、"业内人士表示"）
- 长句、从句套从句
- 行业黑话不加解释直接甩出来
- 空洞的夸张（"划时代"、"颠覆性"、"史无前例"）
- 说教语气
- 只有钩子没有展开（标题党）
- 只有展开没有高潮（流水账）
- 结尾不好笑也不有趣（白开水收尾）
- 滥用"简单说""本质上""这意味着"
- 比喻和事实脱节
- 假设听众知道什么是 API、token、开源、微调、推理、训练、算力等术语

## 输出

你必须返回一个 JSON 对象，不要返回 markdown 代码块，不要在 JSON 外再补充解释。JSON 结构如下：
{
  "stories": [
    {
      "keyword": "这个故事最核心的关键词",
      "title": "这条视频的标题，勾人，少于 20 字",
      "copywriting": "发布时的文案，少于 100 字，让人想点开看",
      "coverTitle": "封面上的大字，极短，3-8 个字，一眼抓住人",
      "coverSubtitle": "封面上的小字，一句话补充大字，10-20 字",
      "hashtags": ["#科技新闻", "#前沿科技", "#献哥AI报道", "#具体标签"],
      "segment": "这个故事的完整口播文本，包含钩子、展开、高潮和收尾"
    }
  ]
}

每个 story 都是一条独立的短视频，自带全部发布信息。

额外要求：
- stories 数组长度必须严格等于 3。
- title 是单条视频标题，勾人，有记忆点，最多 19 个汉字。
- copywriting 是单条视频的发布文案，写给刷到封面的人看的，要让人想点进来，最多 100 个中文字符。可以用悬念、反问、数字冲击。
- coverTitle 是封面最大的字，3-8 个字，一眼看懂、一眼想点。像"AI 替你上班了""谷歌慌了"这种。
- coverSubtitle 是封面上的辅助小字，10-20 个字，补充 coverTitle 的上下文或悬念。
- hashtags 里必须固定包含 #科技新闻、#前沿科技、#献哥AI报道，再补 2-5 个跟这条故事强相关的标签。
- 每个 segment 只讲一个故事，不要把两条新闻揉在一起。
- 每个故事的第一句必须是钩子，最后一句必须是有趣的收尾。
- 每个 segment 控制在 400-550 个中文字符。遇到需要解释的术语，字数可以稍微多一点，但不要超过 600。`;

export type RuleSetPromptShape = {
  version: number;
  title: string;
  sourceSummary: string;
  moreToLeanInto: string[];
  lessToAvoid: string[];
  guardrails: string[];
  exampleWins: string[];
  exampleMisses: string[];
};

export type StoryShape = {
  keyword: string;
  title: string;
  copywriting: string;
  coverTitle: string;
  coverSubtitle: string;
  hashtags: string[];
  segment: string;
};

export type DigestGenerationShape = {
  stories: StoryShape[];
};

export type FeedbackSummaryShape = {
  scoreOverall: number;
  scoreHumor: number;
  scoreHumanity: number;
  scoreClarity: number;
  scoreInsight: number;
  bestLine: string;
  worstIssue: string;
  rewriteHint?: string | null;
  comment?: string | null;
  digest?: {
    date: Date | string;
    script: string;
  } | null;
};

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, Math.round(value)));
}

export function computeOverallScore(scores: {
  humor: number;
  humanity: number;
  clarity: number;
  insight: number;
}): number {
  return clampScore(scores.humor) + clampScore(scores.humanity) + clampScore(scores.clarity) + clampScore(scores.insight);
}

export function normalizeHashtag(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, "");
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function buildDigestHashtags(items: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const tag of [...NEWS_DIGEST_FIXED_HASHTAGS, ...items]) {
    const normalized = normalizeHashtag(tag);
    if (!normalized) continue;
    if (seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }

  return result;
}

export function compressDigestTitle(value: string, maxChars = 19): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (Array.from(normalized).length <= maxChars) return normalized;

  const parts = normalized
    .split(/[，,、]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chosen: string[] = [];
  for (const part of parts) {
    const candidate = [...chosen, part].join("、");
    if (Array.from(candidate).length > maxChars) break;
    chosen.push(part);
  }

  if (chosen.length > 0) return chosen.join("、");
  return Array.from(normalized).slice(0, maxChars).join("");
}


function average(values: number[]): string {
  if (values.length === 0) return "0.0";
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
}

function takeUnique(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of items) {
    const value = raw.trim();
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }

  return result;
}

function excerptScript(script: string, limit = 160): string {
  const singleLine = script.replace(/\s+/g, " ").trim();
  if (singleLine.length <= limit) return singleLine;
  return `${singleLine.slice(0, limit).trim()}...`;
}

export function buildFeedbackWindowSummary(feedbacks: FeedbackSummaryShape[]): string | null {
  if (feedbacks.length === 0) return null;

  const positiveSignals = takeUnique(feedbacks.map((item) => item.bestLine), 4);
  const recurringIssues = takeUnique(
    feedbacks.flatMap((item) => [item.worstIssue, item.rewriteHint ?? "", item.comment ?? ""]),
    6
  );

  const highExamples = feedbacks
    .filter((item) => item.scoreOverall >= 16 && item.digest?.script)
    .slice(0, 2)
    .map((item) => `高分示例（${item.scoreOverall}/20）：${excerptScript(item.digest!.script)}`);

  const lowExamples = feedbacks
    .filter((item) => item.scoreOverall <= 11 && item.digest?.script)
    .slice(0, 2)
    .map((item) => `低分示例（${item.scoreOverall}/20）：${excerptScript(item.digest!.script)}`);

  return [
    "## 最近人工反馈摘要",
    `最近共参考 ${feedbacks.length} 条评分。`,
    `平均分：幽默 ${average(feedbacks.map((item) => item.scoreHumor))} / 人味 ${average(feedbacks.map((item) => item.scoreHumanity))} / 清晰 ${average(feedbacks.map((item) => item.scoreClarity))} / 观察 ${average(feedbacks.map((item) => item.scoreInsight))}`,
    positiveSignals.length ? `被认为最像献哥的句子：${positiveSignals.map((item, index) => `${index + 1}. ${item}`).join(" ")}` : "",
    recurringIssues.length ? `近期高频问题：${recurringIssues.map((item, index) => `${index + 1}. ${item}`).join(" ")}` : "",
    highExamples.join("\n"),
    lowExamples.join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatRuleSetForPrompt(ruleSet: RuleSetPromptShape | null): string | null {
  if (!ruleSet) return null;

  return [
    `## 当前激活的学习规则（v${ruleSet.version}：${ruleSet.title}）`,
    ruleSet.sourceSummary,
    ruleSet.moreToLeanInto.length
      ? `多一点：${ruleSet.moreToLeanInto.map((item, index) => `${index + 1}. ${item}`).join(" ")}`
      : "",
    ruleSet.lessToAvoid.length
      ? `少一点：${ruleSet.lessToAvoid.map((item, index) => `${index + 1}. ${item}`).join(" ")}`
      : "",
    ruleSet.guardrails.length
      ? `边界：${ruleSet.guardrails.map((item, index) => `${index + 1}. ${item}`).join(" ")}`
      : "",
    ruleSet.exampleWins.length
      ? `推荐方向：${ruleSet.exampleWins.map((item, index) => `${index + 1}. ${item}`).join(" ")}`
      : "",
    ruleSet.exampleMisses.length
      ? `避免方向：${ruleSet.exampleMisses.map((item, index) => `${index + 1}. ${item}`).join(" ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function composeDigestSystemPrompt(input: {
  basePrompt: string;
  activeRuleSet: RuleSetPromptShape | null;
  feedbackSummary: string | null;
}): string {
  return [
    input.basePrompt,
    formatRuleSetForPrompt(input.activeRuleSet),
    input.feedbackSummary,
    "三个故事完全独立，每个都是一条单独的短视频，有自己的标题、封面和文案。",
    "每个故事都要有钩子开头和有趣的收尾，不要写成新闻摘要。",
    "请严格保持新闻事实准确，不要为了幽默牺牲信息密度，也不要写成段子合集。",
    "重要提醒：听众是对科技不太熟悉的普通人。所有专业术语必须用大白话解释，融入故事里自然地讲清楚。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function parseJsonObjectFromText(raw: string): unknown {
  const trimmed = raw.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model did not return JSON.");
  }

  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

export async function getDigestBasePrompt(): Promise<string> {
  const row = await prisma.systemPrompt.findUnique({
    where: { slug: SYSTEM_PROMPT_SLUG_DIGEST },
  });
  return row?.content || NEWS_DIGEST_BASE_PROMPT;
}
