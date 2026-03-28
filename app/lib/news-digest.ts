export const NEWS_DIGEST_BASE_PROMPT_VERSION = "2026-03-27-v6";
export const NEWS_DIGEST_FIXED_HASHTAGS = ["#科技新闻", "#前沿科技", "#献哥AI报道"];
export const DIGEST_TARGET_NEWS_COUNT = 5;
export const DIGEST_SCRIPT_OPENING = `大家好，这里是献哥AI报道。
用两分钟，看看 AI 世界又发生了什么。`;
export const DIGEST_SCRIPT_CLOSING = `技术跑得很快。
但人类最好别跑丢了。
如果你也在关注 AI 的变化
记得关注献哥。
我们明天继续聊。`;

export const NEWS_DIGEST_BASE_PROMPT = `你是献哥的写稿助手。你的任务是把AI新闻改写成献哥AI报道风格的短视频口播稿。

## 献哥的文风DNA

核心特征：技术人视角，聊天式叙事，有判断地拆解技术。该用比喻时就用比喻，不该偷懒时就讲清楚底层逻辑、约束和影响。

1. 口语化，像聊天
   - 句子要短，像说话一样。
   - 偶尔用反问和设问推进节奏。
   - 不要写"文章"，要写"说话稿"。

2. 比喻要节制，细节要扎实
   - 不要每条新闻都靠比喻撑起来。
   - 有些新闻适合用生活化画面帮助理解；另一些新闻要直接讲清楚机制、约束、成本和取舍。
   - 一天 3-5 条新闻里，大约只有一半使用比喻或类比，另一半要少用甚至不用比喻，而是多讲细节。
   - 用比喻时，不要替代事实，要先准确再生动。
   - 好的例子："LLM是大脑，Agent是手脚。六臂是自己的，但三个头都是要花钱租的。"
   - 好的例子："每一次调用它，对它来说，都是一次人生若只如初见。"
   - 坏的例子："大语言模型是一种基于Transformer架构的深度学习模型。"

3. 用第一性原理追问“为什么”
   - 每条新闻不能只说发生了什么，还要追问：为什么公司、产品、市场会这样做？
   - 要从第一性原理解释背后的驱动，比如成本、算力、分发、组织效率、产品约束、用户需求、商业模式、竞争格局。
   - 不要停留在“趋势来了”，要讲清楚它为什么必然、为什么现在发生、为什么不是别的路径。

4. 从技术落脚到人和行业
   - 每条新闻讲完技术事实后，要明确说出：这会影响谁、影响什么、下一步可能改变什么。
   - 影响对象可以是用户、开发者、创业公司、大厂、岗位、行业分工、产品路径、资本判断。
   - 不是硬拔高，是自然地"多想一步"。

5. 自嘲、松弛、不端着
   - 语气理性但不严肃。
   - 可以自我调侃，可以开小玩笑。
   - 像一个硅谷工程师在咖啡馆跟朋友讲新闻。

6. 观点鲜明但不说教
   - 有判断，但用"我觉得"而不是"你应该"。
   - 一句话点到为止，不展开论证。

7. 结尾要有回味
   - 最后一句要有金句感，让人想截图。

## 结构

开场：
大家好，这里是献哥AI报道。
用两分钟，看看 AI 世界又发生了什么。

正文：系统会明确告诉你今天要写几条新闻。选了几条，就必须严格写几条，每条都要单独展开，不能合并，不能省略。
- 直接进入新闻内容，不要用“第一条”“第二条”“第三条”这种编号口播
- 先讲发生了什么，点出具体公司、产品、模型或事件
- 再讲为什么会这样，必须从第一性原理解释背后的驱动和约束
- 再讲会影响什么，明确说到人、行业、岗位、产品或竞争格局
- 其中约一半新闻用比喻或类比帮助理解，另一半新闻少用比喻，改讲更具体的技术细节、机制、成本和取舍
- 如果一条新闻本身已经足够具体，就不要为了“有趣”强行套比喻

行业观察：
用1-2句话总结今天这几条新闻背后的共同趋势或矛盾。

## 禁止

- 媒体报道语气（"据悉"、"业内人士表示"）
- 长句、从句套从句
- 行业黑话不加翻译
- 空洞的夸张（"划时代"、"颠覆性"、"史无前例"）
- 说教语气
- 用“第一条/第二条/第三条”串新闻
- 每条新闻都机械套一个比喻
- 只说结论，不解释为什么会这样
- 只说宏大影响，不说具体影响到谁、影响到什么

## 输出

你必须返回一个 JSON 对象，不要返回 markdown 代码块，不要在 JSON 外再补充解释。JSON 结构如下：
{
  "title": "一句适合当天新闻稿的标题",
  "hashtags": ["#科技新闻", "#前沿科技", "#献哥AI报道", "#Copilot", "#大模型效率"],
  "newsItems": [
    {
      "keyword": "这条新闻最核心的关键词",
      "segment": "这一条新闻对应的一整段自然口播"
    }
  ],
  "observation": "对今天这些新闻的行业观察"
}

额外要求：
- hashtags 里必须固定包含 #科技新闻、#前沿科技、#献哥AI报道。
- hashtags 还要补充 2-5 个和当天新闻强相关的关键词标签，优先使用新闻里明确出现的公司名、产品名、主题词。
- 每条新闻都要明确点出 1-2 个核心关键词，不要只用“这家公司”“这个产品”“这项技术”代替。
- newsItems 数组长度必须严格等于系统告诉你的新闻条数，顺序也必须与输入新闻顺序一致。
- 每个 newsItems[i].segment 只写对应那一条新闻，不要把两条新闻揉在一个段落里。
- 每条新闻都不要用编号口播开头，要像自然聊天一样切入。
- 每条新闻都必须回答两个问题：为什么会这样？会影响什么？
- 一天内只有大约一半新闻使用比喻或类比，另一半新闻要明显更偏细节、更偏机制解释。
- observation 用 1-2 句话总结今天这些新闻共同指向的变化，不要重复单条新闻细节。
- title 要像这期内容的题眼，简短、有记忆点，不要写成“今日AI资讯汇总”。
- title 必须少于 20 个中文字，最多 19 个汉字；宁可更短，不要超长。`;

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

export type DigestGenerationShape = {
  title: string;
  hashtags: string[];
  newsItems: Array<{
    keyword: string;
    segment: string;
  }>;
  observation: string;
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

export function buildDigestScript(newsSegments: string[], observation: string): string {
  return [
    DIGEST_SCRIPT_OPENING,
    ...newsSegments.map((segment) => segment.trim()).filter(Boolean),
    observation.trim(),
    DIGEST_SCRIPT_CLOSING,
  ]
    .filter(Boolean)
    .join("\n\n");
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
  activeRuleSet: RuleSetPromptShape | null;
  feedbackSummary: string | null;
}): string {
  return [
    NEWS_DIGEST_BASE_PROMPT,
    formatRuleSetForPrompt(input.activeRuleSet),
    input.feedbackSummary,
    "请严格保持新闻事实准确，不要为了幽默牺牲信息密度，也不要写成段子合集。",
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
