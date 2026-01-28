import type { McpToolWireFormat, ScoredTool, McpServerState } from "../types";

// =============================================================================
// Prompt Generation
// =============================================================================

/**
 * Generate a prompt section describing available MCP tools.
 *
 * This can be included in system prompts to help the LLM understand
 * what tools are available without using function calling.
 *
 * @example
 * ```ts
 * const toolsPrompt = generateMcpToolsPrompt(selectedTools);
 * const systemPrompt = `You are an AI assistant.
 *
 * ${toolsPrompt}
 *
 * Use tools when appropriate to help the user.`;
 * ```
 */
export function generateMcpToolsPrompt(
  tools: ScoredTool[] | McpToolWireFormat[],
): string {
  if (tools.length === 0) {
    return "";
  }

  const lines: string[] = [
    "## Available Tools",
    "",
    "You have access to the following tools:",
    "",
  ];

  for (const item of tools) {
    const tool = "tool" in item ? item.tool : item;

    lines.push(`### ${tool.name}`);
    if (tool.description) {
      lines.push(tool.description);
    }

    // Add parameter info
    if (tool.inputSchema.properties) {
      const props = tool.inputSchema.properties as Record<
        string,
        { type?: string; description?: string }
      >;
      const required = (tool.inputSchema.required as string[]) || [];

      lines.push("");
      lines.push("**Parameters:**");

      for (const [name, schema] of Object.entries(props)) {
        const isRequired = required.includes(name);
        const typeStr = schema.type ?? "any";
        const descStr = schema.description ? ` - ${schema.description}` : "";
        const reqStr = isRequired ? " (required)" : "";
        lines.push(`- \`${name}\`: ${typeStr}${reqStr}${descStr}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate a compact tools summary for context-limited prompts.
 */
export function generateToolsSummary(
  tools: ScoredTool[] | McpToolWireFormat[],
): string {
  if (tools.length === 0) {
    return "No tools available.";
  }

  const toolNames = tools.map((item) => {
    const tool = "tool" in item ? item.tool : item;
    return tool.name;
  });

  return `Available tools: ${toolNames.join(", ")}`;
}

/**
 * Generate a prompt section for tool results.
 */
export function generateToolResultPrompt(
  toolName: string,
  result: unknown,
  isError = false,
): string {
  const prefix = isError ? "Tool Error" : "Tool Result";
  const resultStr =
    typeof result === "string" ? result : JSON.stringify(result, null, 2);

  return `### ${prefix}: ${toolName}\n\n\`\`\`\n${resultStr}\n\`\`\``;
}

/**
 * Options for generating server status prompt.
 */
export interface ServerStatusPromptOptions {
  /** Include tool counts */
  includeToolCounts?: boolean;
  /** Include connection status */
  includeStatus?: boolean;
  /** Include domains */
  includeDomains?: boolean;
}

/**
 * Generate a prompt section describing MCP server status.
 */
export function generateServerStatusPrompt(
  serverStates: Map<string, McpServerState> | Record<string, McpServerState>,
  options: ServerStatusPromptOptions = {},
): string {
  const {
    includeToolCounts = true,
    includeStatus = true,
    includeDomains = true,
  } = options;

  const lines: string[] = ["## MCP Servers", ""];

  const entries =
    serverStates instanceof Map
      ? Array.from(serverStates.entries())
      : Object.entries(serverStates);

  for (const [id, state] of entries) {
    const parts: string[] = [];

    if (includeStatus) {
      parts.push(`status: ${state.status}`);
    }

    if (includeDomains && state.config.domain) {
      parts.push(`domain: ${state.config.domain}`);
    }

    if (includeToolCounts && state.metadata) {
      parts.push(`tools: ${state.metadata.toolCount}`);
    }

    const name = state.config.name ?? id;
    lines.push(`- **${name}** (${parts.join(", ")})`);
  }

  return lines.join("\n");
}
