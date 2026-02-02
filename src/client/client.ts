import type {
  McpServerConfig,
  McpToolWireFormat,
  McpToolResult,
  McpPromptDefinition,
  McpPromptMessage,
  McpResourceDefinition,
  McpResourceContent,
} from "../types";
import { resolveServerEnv } from "../registry/env-resolver";
import { createLocalClient, registerLocalModuleLoader } from "./local-client";
import { createSdkClient } from "./sdk-client";

// Re-export
export { registerLocalModuleLoader };

/**
 * Options for tool call execution
 */
export interface McpToolCallOptions {
  /** Timeout in milliseconds (default: 30000, max: 300000) */
  timeoutMs?: number;
}

/**
 * Wrapper around the MCP SDK client with simpler API.
 */
export interface McpClient {
  readonly config: McpServerConfig;
  readonly connected: boolean;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  listTools(): Promise<McpToolWireFormat[]>;
  callTool(
    name: string,
    args: Record<string, unknown>,
    options?: McpToolCallOptions,
  ): Promise<McpToolResult>;

  listPrompts(): Promise<McpPromptDefinition[]>;
  getPrompt(
    name: string,
    args?: Record<string, string>,
  ): Promise<McpPromptMessage[]>;

  listResources(): Promise<McpResourceDefinition[]>;
  readResource(uri: string): Promise<McpResourceContent[]>;
}

/**
 * Create an MCP client for a server configuration.
 */
export function createMcpClient(config: McpServerConfig): McpClient {
  const resolvedConfig = resolveServerEnv(config);

  if (resolvedConfig.transport === "local") {
    return createLocalClient(resolvedConfig);
  }

  return createSdkClient(resolvedConfig);
}
