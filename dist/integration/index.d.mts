import { S as ScoredTool, z as McpRegistry, g as McpToolWireFormat, e as McpServerState } from '../registry-BbMCFsfH.mjs';
import { b as McpConnectionManager } from '../connection-DfoRTjiH.mjs';
import { ToolSet } from 'ai';
import 'zod';

/**
 * Tool execution context.
 */
interface ToolExecutionContext {
    /** Server ID the tool belongs to */
    serverId: string;
    /** Tool name */
    toolName: string;
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
declare function createToolsetFromMcp(connectionManager: McpConnectionManager, selectedTools: ScoredTool[]): Promise<ToolSet>;
/**
 * Create an AI SDK toolset from all registered MCP tools.
 * Use this when you want to expose all tools without selection.
 */
declare function createFullToolsetFromMcp(registry: McpRegistry, connectionManager: McpConnectionManager): Promise<ToolSet>;
/**
 * Options for loading MCP tools into AI SDK.
 */
interface LoadMcpToolsOptions {
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
declare function loadMcpTools(options: LoadMcpToolsOptions): Promise<ToolSet>;

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
declare function generateMcpToolsPrompt(tools: ScoredTool[] | McpToolWireFormat[]): string;
/**
 * Generate a compact tools summary for context-limited prompts.
 */
declare function generateToolsSummary(tools: ScoredTool[] | McpToolWireFormat[]): string;
/**
 * Generate a prompt section for tool results.
 */
declare function generateToolResultPrompt(toolName: string, result: unknown, isError?: boolean): string;
/**
 * Options for generating server status prompt.
 */
interface ServerStatusPromptOptions {
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
declare function generateServerStatusPrompt(serverStates: Map<string, McpServerState> | Record<string, McpServerState>, options?: ServerStatusPromptOptions): string;

export { type LoadMcpToolsOptions, type ServerStatusPromptOptions, type ToolExecutionContext, createFullToolsetFromMcp, createToolsetFromMcp, generateMcpToolsPrompt, generateServerStatusPrompt, generateToolResultPrompt, generateToolsSummary, loadMcpTools };
