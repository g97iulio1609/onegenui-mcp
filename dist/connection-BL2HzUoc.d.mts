import { d as McpServerConfig, g as McpToolWireFormat, h as McpToolResult, c as McpPromptDefinition, j as McpPromptMessage, k as McpResourceDefinition, l as McpResourceContent, z as McpRegistry, s as McpConnectionConfig } from './registry-BbMCFsfH.mjs';

/**
 * Wrapper around the MCP SDK client with simpler API.
 */
interface McpClient {
    readonly config: McpServerConfig;
    readonly connected: boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    listTools(): Promise<McpToolWireFormat[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
    listPrompts(): Promise<McpPromptDefinition[]>;
    getPrompt(name: string, args?: Record<string, string>): Promise<McpPromptMessage[]>;
    listResources(): Promise<McpResourceDefinition[]>;
    readResource(uri: string): Promise<McpResourceContent[]>;
}
/**
 * Create an MCP client for a server configuration.
 */
declare function createMcpClient(config: McpServerConfig): McpClient;

/**
 * Connection manager for MCP clients.
 *
 * Features:
 * - Persistent connections with health checks
 * - Lazy initialization (connect on first use)
 * - Automatic reconnection
 * - listChanged notification handling
 */
interface McpConnectionManager {
    /**
     * Get or create a client for a server.
     * Connects lazily on first use.
     */
    getClient(serverId: string): Promise<McpClient>;
    /**
     * Check if a client is connected.
     */
    isConnected(serverId: string): boolean;
    /**
     * Disconnect a specific server.
     */
    disconnect(serverId: string): Promise<void>;
    /**
     * Disconnect all servers.
     */
    disconnectAll(): Promise<void>;
    /**
     * Refresh tools for a server (after listChanged notification).
     */
    refreshTools(serverId: string): Promise<void>;
    /**
     * Start health check loop.
     */
    startHealthChecks(): void;
    /**
     * Stop health check loop.
     */
    stopHealthChecks(): void;
}
/**
 * Create a connection manager.
 */
declare function createConnectionManager(registry: McpRegistry, config?: Partial<McpConnectionConfig>): McpConnectionManager;

export { type McpConnectionManager as M, type McpClient as a, createConnectionManager as b, createMcpClient as c };
