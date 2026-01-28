import type { McpToolWireFormat, ScoredTool } from "../types";
import type { McpRegistry } from "../registry";
import type { McpConnectionManager } from "../client/connection";
import { tool, jsonSchema, type ToolSet, type JSONSchema7 } from "ai";

// =============================================================================
// AI SDK Integration
// =============================================================================

/**
 * Tool execution context.
 */
export interface ToolExecutionContext {
  /** Server ID the tool belongs to */
  serverId: string;
  /** Tool name */
  toolName: string;
}

/**
 * Convert MCP JSON Schema to AI SDK compatible schema using jsonSchema() wrapper.
 */
function convertToAiSdkSchema(mcpSchema: Record<string, unknown>) {
  // The jsonSchema() helper wraps a JSON Schema for AI SDK compatibility
  return jsonSchema(mcpSchema as JSONSchema7);
}

/**
 * Create a single AI SDK tool from an MCP tool definition.
 */
function createAiSdkTool(
  mcpTool: McpToolWireFormat,
  serverId: string,
  connectionManager: McpConnectionManager,
) {
  const toolName = mcpTool.name;

  return tool({
    description: mcpTool.description ?? "",
    inputSchema: convertToAiSdkSchema(
      (mcpTool.inputSchema as Record<string, unknown>) ?? { type: "object" },
    ),
    execute: async (args) => {
      console.log(`[MCP Tool] Calling: ${toolName}`, args);

      try {
        // Get client (connects if needed)
        const client = await connectionManager.getClient(serverId);
        console.log(`[MCP Tool] Got client for ${serverId}, calling tool...`);

        // Call the tool
        const result = await client.callTool(
          toolName,
          args as Record<string, unknown>,
        );

        console.log(`[MCP Tool] Result received for ${toolName}`);
        console.log(`[MCP Tool] Result content count:`, result.content?.length);

        // Return structured content if available
        if (result.structuredContent !== undefined) {
          console.log(`[MCP Tool] Using structuredContent`);
          return result.structuredContent;
        }

        // Concatenate text content
        const textContent = result.content
          .filter((c) => c.type === "text")
          .map((c) => (c as { type: "text"; text: string }).text)
          .join("\n");

        console.log(`[MCP Tool] Extracted text length:`, textContent?.length);

        // Try to parse as JSON for better model consumption
        if (textContent) {
          try {
            const parsed = JSON.parse(textContent);
            console.log(
              `[MCP Tool] Parsed JSON successfully, items:`,
              Array.isArray(parsed) ? parsed.length : "object",
            );
            return parsed;
          } catch {
            // Not valid JSON, return as-is
            console.log(
              `[MCP Tool] Text is not valid JSON, returning as string`,
            );
            return textContent;
          }
        }

        return result;
      } catch (error) {
        console.error(`[MCP Tool] Error calling ${toolName}:`, error);
        throw error;
      }
    },
  });
}

/**
 * Create an AI SDK toolset from selected MCP tools.
 *
 * This converts MCP tools to AI SDK v6 tool() format.
 * Each tool is wrapped with execution logic that calls the MCP server.
 *
 * @example
 * ```ts
 * import { streamText } from 'ai';
 * import { createToolsetFromMcp } from '@onegenui/mcp/integration';
 *
 * const toolset = await createToolsetFromMcp(
 *   connectionManager,
 *   selectedTools
 * );
 *
 * const result = await streamText({
 *   model: openai('gpt-4o'),
 *   tools: toolset,
 *   messages: [...],
 * });
 * ```
 */
export async function createToolsetFromMcp(
  connectionManager: McpConnectionManager,
  selectedTools: ScoredTool[],
): Promise<ToolSet> {
  const toolset: ToolSet = {};

  for (const { tool: mcpTool, serverId } of selectedTools) {
    toolset[mcpTool.name] = createAiSdkTool(
      mcpTool,
      serverId,
      connectionManager,
    );
  }

  return toolset;
}

/**
 * Create an AI SDK toolset from all registered MCP tools.
 * Use this when you want to expose all tools without selection.
 */
export async function createFullToolsetFromMcp(
  registry: McpRegistry,
  connectionManager: McpConnectionManager,
): Promise<ToolSet> {
  const toolset: ToolSet = {};
  const states = registry.listServerStates();

  const entries = Array.from(states.entries());
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const [serverId, state] = entry;
    if (state.config.enabled === false) continue;
    if (!state.tools) continue;

    for (const mcpTool of state.tools) {
      toolset[mcpTool.name] = createAiSdkTool(
        mcpTool,
        serverId,
        connectionManager,
      );
    }
  }

  return toolset;
}

/**
 * Options for loading MCP tools into AI SDK.
 */
export interface LoadMcpToolsOptions {
  /** Registry instance */
  registry: McpRegistry;
  /** Connection manager instance */
  connectionManager: McpConnectionManager;
  /** Server IDs to include (optional, includes all if not specified) */
  serverIds?: string[];
  /** Connect to servers before returning tools */
  connect?: boolean;
}

/**
 * Load MCP tools and return AI SDK compatible toolset.
 * This is a convenience function that handles connection.
 */
export async function loadMcpTools(
  options: LoadMcpToolsOptions,
): Promise<ToolSet> {
  const { registry, connectionManager, serverIds, connect = true } = options;

  const servers = registry.listServers();
  const targetServers = serverIds
    ? servers.filter((s) => serverIds.includes(s.id))
    : servers.filter((s) => s.enabled !== false);

  // Connect to servers if requested
  if (connect) {
    const connectPromises = targetServers.map((server) =>
      connectionManager.getClient(server.id).catch((error) => {
        console.error(`Failed to connect to ${server.id}:`, error);
        return null;
      }),
    );
    await Promise.all(connectPromises);
  }

  // Build toolset
  return createFullToolsetFromMcp(registry, connectionManager);
}
