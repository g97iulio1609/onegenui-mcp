/**
 * Bridge between @onegenui/mcp and @onegenui/deep-agents.
 * Provides the executor function that OnegenUiMcpAdapter needs
 * to delegate tool calls to the MCP connection manager.
 */

import type { McpConnectionManager } from "../client/connection";

const DEFAULT_TOOL_TIMEOUT_MS = 45_000;

interface DeepAgentsToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/**
 * Creates an executor function compatible with OnegenUiMcpAdapter.
 *
 * Uses the connection manager to obtain a live MCP client and
 * delegates tool execution via `client.callTool()`.
 *
 * @example
 * ```ts
 * import { createConnectionManager, createMcpRegistry } from "@onegenui/mcp";
 * import { createMcpExecutor } from "@onegenui/mcp/integration";
 * import { OnegenUiMcpAdapter } from "@onegenui/deep-agents";
 *
 * const registry = createMcpRegistry({ servers: [...] });
 * const connectionManager = createConnectionManager(registry);
 * const executor = createMcpExecutor(connectionManager);
 *
 * const adapter = new OnegenUiMcpAdapter({ registry, executor });
 * ```
 */
export function createMcpExecutor(connectionManager: McpConnectionManager) {
  return async (
    serverId: string,
    toolName: string,
    args: unknown,
  ): Promise<DeepAgentsToolResult> => {
    try {
      const client = await connectionManager.getClient(serverId);
      const timeoutMs = client.config.timeout ?? DEFAULT_TOOL_TIMEOUT_MS;

      const result = await client.callTool(
        toolName,
        (args ?? {}) as Record<string, unknown>,
        { timeoutMs },
      );

      if (result.isError) {
        const errorText = result.content
          .filter((c) => c.type === "text")
          .map((c) => (c as { type: "text"; text: string }).text)
          .join("\n");
        return {
          content: [{ type: "text", text: errorText || "Tool returned an error" }],
          isError: true,
        };
      }

      // Prefer structured content when available
      if (result.structuredContent !== undefined) {
        return {
          content: [{ type: "text", text: JSON.stringify(result.structuredContent) }],
          isError: false,
        };
      }

      const textContent = result.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("\n");

      return {
        content: [{ type: "text", text: textContent || "" }],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: error instanceof Error ? error.message : String(error) },
        ],
        isError: true,
      };
    }
  };
}
