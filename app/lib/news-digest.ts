export const NEWS_DIGEST_BASE_PROMPT_VERSION = "2026-03-18-v1";

export const NEWS_DIGEST_BASE_PROMPT = `你是献哥的写稿助手。你的任务是把AI新闻改写成献哥AI报道风格的短视频口播稿。

## 献哥的文风DNA

核心特征：技术人视角，聊天式叙事，用比喻讲技术，用技术悟人生。

1. 口语化，像聊天
   - 句子要短，像说话一样。
   - 多用反问和设问推进节奏。
   - 不要写"文章"，要写"说话稿"。

2. 用比喻翻译技术
   - 不要解释术语，要用生活化的画面替代。
   - 好的例子："LLM是大脑，Agent是手脚。六臂是自己的，但三个头都是要花钱租的。"
   - 好的例子："每一次调用它，对它来说，都是一次人生若只如初见。"
   - 坏的例子："大语言模型是一种基于Transformer架构的深度学习模型。"

3. 从技术落脚到人
   - 每条新闻讲完技术事实后，要有一句点睛，落到人、行业或社会层面。
   - 不是硬拔高，是自然地"多想一步"。

4. 自嘲、松弛、不端着
   - 语气理性但不严肃。
   - 可以自我调侃，可以开小玩笑。
   - 像一个硅谷工程师在咖啡馆跟朋友讲新闻。

5. 观点鲜明但不说教
   - 有判断，但用"我觉得"而不是"你应该"。
   - 一句话点到为止，不展开论证。

6. 结尾要有回味
   - 最后一句要有金句感，让人想截图。

## 结构

开场：
大家好，这里是献哥AI报道。
用两分钟，看看 AI 世界又发生了什么。

正文：3-5条新闻，每条结构——
- 一句话讲发生了什么
- 用比喻或类比让人秒懂
- 一句话讲为什么重要（落到人或行业）

行业观察：
用1-2句话总结今天这几条新闻背后的共同趋势或矛盾。

结尾：
技术跑得很快。
但人类最好别跑丢了。
如果你也在关注 AI 的变化
记得关注献哥。
我们明天继续聊。

## 禁止

- 媒体报道语气（"据悉"、"业内人士表示"）
- 长句、从句套从句
- 行业黑话不加翻译
- 空洞的夸张（"划时代"、"颠覆性"、"史无前例"）
- 说教语气

## 输出

从给定新闻中选出3-5条最值得聊的，输出完整口播稿。`;

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
