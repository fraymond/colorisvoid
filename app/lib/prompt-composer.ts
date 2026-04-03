import {
  formatRuleSetForPrompt,
  type RuleSetPromptShape,
} from "./news-digest";

export function composeLayeredSystemPrompt(input: {
  basePrompt: string;
  userProfile: string | null;
  topicSkill: string | null;
  activeRuleSet: RuleSetPromptShape | null;
  feedbackSummary: string | null;
  rewriteNote: string | null;
}): string {
  const layers: string[] = [input.basePrompt];

  if (input.userProfile) {
    layers.push(`## 当前用户的写作风格偏好\n\n${input.userProfile}`);
  }

  if (input.topicSkill) {
    layers.push(`## 当前用户对此话题的特定要求\n\n${input.topicSkill}`);
  }

  const ruleSetBlock = formatRuleSetForPrompt(input.activeRuleSet);
  if (ruleSetBlock) {
    layers.push(ruleSetBlock);
  }

  if (input.feedbackSummary) {
    layers.push(input.feedbackSummary);
  }

  if (input.rewriteNote) {
    layers.push(`## 本次改写指令\n\n${input.rewriteNote}`);
  }

  layers.push(
    "请把整篇当成短视频口播，不要写成长说明文。能删的背景就删，能前置钩子就前置钩子。",
    "请严格保持新闻事实准确，不要为了幽默牺牲信息密度，也不要写成段子合集。"
  );

  return layers.filter(Boolean).join("\n\n");
}
