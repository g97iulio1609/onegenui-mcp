/**
 * Tool Selection for MCP Servers
 *
 * This module provides intelligent tool selection using keyword and domain matching.
 * It uses modular components from ./tool-selection/ for each concern:
 * - keyword-extractor: Extract keywords from text
 * - domain-inferrer: Infer domains from keywords
 * - tool-scorer: Score tools against context
 */

import type {
  McpToolWireFormat,
  McpDomain,
  McpServerState,
  ToolSelectionContext,
  ToolSelectionOptions,
  ScoredTool,
} from "./types";

// Import modular components
import { extractKeywords } from "./tool-selection/keyword-extractor";
import {
  inferDomains,
  DOMAIN_KEYWORDS,
} from "./tool-selection/domain-inferrer";
import { STOP_WORDS } from "./tool-selection/constants";

// Re-export for convenience
export { extractKeywords, inferDomains, DOMAIN_KEYWORDS, STOP_WORDS };

// =============================================================================
// Tool Scoring
// =============================================================================

/**
 * Score a tool against the selection context.
 */
function scoreTool(
  tool: McpToolWireFormat,
  serverId: string,
  serverDomain: McpDomain | undefined,
  serverTags: string[] | undefined,
  promptKeywords: string[],
  inferredDomains: McpDomain[],
  context: ToolSelectionContext,
): ScoredTool {
  let score = 0;
  const matchReasons: string[] = [];

  // Extract tool keywords
  const toolKeywords: string[] = [];

  // From name
  const nameParts = tool.name.split("_");
  for (const part of nameParts) {
    toolKeywords.push(part.toLowerCase());
  }

  // From description
  if (tool.description) {
    const descKeywords = extractKeywords(tool.description);
    for (const kw of descKeywords) {
      toolKeywords.push(kw);
    }
  }

  // From title
  if (tool.title) {
    const titleKeywords = extractKeywords(tool.title);
    for (const kw of titleKeywords) {
      toolKeywords.push(kw);
    }
  }

  // 1. Keyword matching (max 0.5)
  let keywordMatches = 0;
  for (const promptKw of promptKeywords) {
    for (const toolKw of toolKeywords) {
      if (promptKw === toolKw) {
        keywordMatches++;
        matchReasons.push(`exact: ${promptKw}`);
      } else if (promptKw.includes(toolKw) || toolKw.includes(promptKw)) {
        keywordMatches += 0.5;
        matchReasons.push(`partial: ${promptKw}~${toolKw}`);
      }
    }
  }
  score += Math.min(keywordMatches * 0.1, 0.5);

  // 2. Domain matching (max 0.3)
  const effectiveDomain = serverDomain;
  if (effectiveDomain && inferredDomains.includes(effectiveDomain)) {
    const domainIndex = inferredDomains.indexOf(effectiveDomain);
    // Higher score for first inferred domain
    score += 0.3 - domainIndex * 0.05;
    matchReasons.push(`domain: ${effectiveDomain}`);
  }

  // 3. Tag matching (max 0.2)
  if (serverTags && serverTags.length > 0) {
    let tagMatches = 0;
    for (const tag of serverTags) {
      for (const promptKw of promptKeywords) {
        if (tag.toLowerCase() === promptKw) {
          tagMatches++;
          matchReasons.push(`tag: ${tag}`);
        }
      }
    }
    score += Math.min(tagMatches * 0.1, 0.2);
  }

  // 4. Include domain boost (if specified in context)
  if (context.includeDomains && effectiveDomain) {
    if (context.includeDomains.includes(effectiveDomain)) {
      score += 0.2;
      matchReasons.push(`include: ${effectiveDomain}`);
    }
  }

  // 5. Exclude domain penalty
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

// =============================================================================
// Main Selection Function
// =============================================================================

/**
 * Select relevant tools for a prompt using keyword matching.
 *
 * This implements a Copilot-style tool selection strategy:
 * 1. Extract keywords from the prompt
 * 2. Infer relevant domains from keywords
 * 3. Score each tool based on keyword, domain, and tag matching
 * 4. Return top N tools sorted by score
 *
 * @example
 * ```ts
 * const selectedTools = selectToolsForPrompt(
 *   serverStates,
 *   {
 *     prompt: 'Read the package.json file and update the version',
 *     currentFile: 'package.json',
 *   },
 *   { maxTools: 10 }
 * );
 * ```
 */
export function selectToolsForPrompt(
  serverStates: Map<string, McpServerState> | Record<string, McpServerState>,
  context: ToolSelectionContext,
  options: ToolSelectionOptions = {},
): ScoredTool[] {
  const {
    maxTools = 10,
    minScore = 0.1,
    includePriorityDomains = true,
  } = options;

  // Extract keywords from prompt
  const promptKeywords = extractKeywords(context.prompt);

  // Add keywords from current file if available
  if (context.currentFile) {
    const fileKeywords = extractKeywords(context.currentFile);
    for (const kw of fileKeywords) {
      promptKeywords.push(kw);
    }
  }

  // Add keywords from user intent if available
  if (context.userIntent) {
    const intentKeywords = extractKeywords(context.userIntent);
    for (const kw of intentKeywords) {
      promptKeywords.push(kw);
    }
  }

  // Infer domains from keywords
  const inferredDomains = inferDomains(promptKeywords);

  // Score all tools
  const scoredTools: ScoredTool[] = [];

  // Handle both Map and Record
  const entries =
    serverStates instanceof Map
      ? Array.from(serverStates.entries())
      : Object.entries(serverStates);

  for (const [serverId, state] of entries) {
    // Skip disabled or disconnected servers
    if (state.config.enabled === false) continue;
    if (state.status === "error") continue;

    // Skip if no cached tools
    if (!state.tools || state.tools.length === 0) continue;

    for (const tool of state.tools) {
      const scored = scoreTool(
        tool,
        serverId,
        state.config.domain,
        state.config.tags,
        promptKeywords,
        inferredDomains,
        context,
      );

      if (scored.score >= minScore) {
        scoredTools.push(scored);
      }
    }
  }

  // Sort by score descending
  scoredTools.sort((a, b) => b.score - a.score);

  // Return top N
  return scoredTools.slice(0, maxTools);
}

/**
 * Get all tools from server states (no filtering).
 */
export function getAllTools(
  serverStates: Map<string, McpServerState> | Record<string, McpServerState>,
): { tool: McpToolWireFormat; serverId: string }[] {
  const tools: { tool: McpToolWireFormat; serverId: string }[] = [];

  const entries =
    serverStates instanceof Map
      ? Array.from(serverStates.entries())
      : Object.entries(serverStates);

  for (const [serverId, state] of entries) {
    if (state.config.enabled === false) continue;
    if (!state.tools) continue;

    for (const tool of state.tools) {
      tools.push({ tool, serverId });
    }
  }

  return tools;
}

/**
 * Get tools by domain.
 */
export function getToolsByDomain(
  serverStates: Map<string, McpServerState> | Record<string, McpServerState>,
  domain: McpDomain,
): { tool: McpToolWireFormat; serverId: string }[] {
  const tools: { tool: McpToolWireFormat; serverId: string }[] = [];

  const entries =
    serverStates instanceof Map
      ? Array.from(serverStates.entries())
      : Object.entries(serverStates);

  for (const [serverId, state] of entries) {
    if (state.config.enabled === false) continue;
    if (state.config.domain !== domain) continue;
    if (!state.tools) continue;

    for (const tool of state.tools) {
      tools.push({ tool, serverId });
    }
  }

  return tools;
}
