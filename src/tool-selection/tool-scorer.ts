/**
 * Tool scoring utilities
 */

import type { McpDomain, McpToolWireFormat } from "../types";

export interface ScoredTool {
  tool: McpToolWireFormat;
  serverId: string;
  score: number;
  matchReasons: string[];
}

export interface ToolSelectionContext {
  prompt: string;
  currentFile?: string;
  userIntent?: string;
  priorityDomains?: McpDomain[];
  excludeDomains?: McpDomain[];
}

/**
 * Score a single tool against keywords and domains
 */
export function scoreTool(
  tool: McpToolWireFormat,
  serverId: string,
  serverDomain: McpDomain | undefined,
  serverTags: string[] | undefined,
  keywords: string[],
  inferredDomains: McpDomain[],
  context: ToolSelectionContext,
): ScoredTool {
  let score = 0;
  const matchReasons: string[] = [];

  // 1. Keyword matching against tool name and description (0.1-0.3 per match)
  const toolText = `${tool.name} ${tool.description || ""}`.toLowerCase();

  for (const keyword of keywords) {
    // Exact match in name: 0.3
    if (tool.name.toLowerCase().includes(keyword)) {
      score += 0.3;
      matchReasons.push(`name:${keyword}`);
    }
    // Match in description: 0.1
    else if (toolText.includes(keyword)) {
      score += 0.1;
      matchReasons.push(`desc:${keyword}`);
    }
  }

  // 2. Domain matching (0.2-0.4)
  const effectiveDomain = serverDomain;

  if (effectiveDomain && inferredDomains.includes(effectiveDomain)) {
    // Primary inferred domain: 0.4
    // Secondary inferred domain: 0.2
    const domainRank = inferredDomains.indexOf(effectiveDomain);
    if (domainRank === 0) {
      score += 0.4;
      matchReasons.push(`domain:${effectiveDomain}(primary)`);
    } else {
      score += 0.2;
      matchReasons.push(`domain:${effectiveDomain}(secondary)`);
    }
  }

  // 3. Tag matching (0.1 per tag)
  if (serverTags) {
    for (const tag of serverTags) {
      const tagLower = tag.toLowerCase();
      for (const keyword of keywords) {
        if (tagLower.includes(keyword) || keyword.includes(tagLower)) {
          score += 0.1;
          matchReasons.push(`tag:${tag}`);
          break; // Only count each tag once
        }
      }
    }
  }

  // 4. Priority domain boost (0.3)
  if (
    context.priorityDomains &&
    effectiveDomain &&
    context.priorityDomains.includes(effectiveDomain)
  ) {
    score += 0.3;
    matchReasons.push(`priority:${effectiveDomain}`);
  }

  // 5. Exclude domain filter (set score to 0)
  if (context.excludeDomains && effectiveDomain) {
    if (context.excludeDomains.includes(effectiveDomain)) {
      score = 0;
      matchReasons.length = 0;
      matchReasons.push(`excluded: ${effectiveDomain}`);
    }
  }

  return {
    tool,
    serverId,
    score: Math.min(score, 1), // Cap at 1
    matchReasons,
  };
}

/**
 * Sort and filter scored tools
 */
export function filterAndSortTools(
  scoredTools: ScoredTool[],
  minScore: number,
  maxTools: number,
): ScoredTool[] {
  return scoredTools
    .filter((t) => t.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTools);
}
