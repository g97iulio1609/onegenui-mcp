import { J as JsonSchema, M as McpDomain, a as McpToolDefinition, b as McpPromptArgument, c as McpPromptDefinition, d as McpServerConfig, e as McpServerState, T as ToolSelectionContext, f as ToolSelectionOptions, S as ScoredTool, g as McpToolWireFormat } from './registry-BbMCFsfH.mjs';
export { u as McpConfigFile, s as McpConnectionConfig, j as McpPromptMessage, z as McpRegistry, v as McpRegistryEvent, w as McpRegistryEventHandler, x as McpRegistryOptions, l as McpResourceContent, k as McpResourceDefinition, r as McpSelectionConfig, n as McpServerConfigBase, p as McpServerConfigHttp, t as McpServerConfigInput, o as McpServerConfigStdio, q as McpServerMetadata, h as McpToolResult, i as McpToolResultContent, m as McpTransportType, y as createMcpRegistry } from './registry-BbMCFsfH.mjs';
import { z } from 'zod';

/**
 * Options for Zod to JSON Schema conversion.
 */
interface ZodToMcpSchemaOptions {
    /**
     * Target JSON Schema version.
     * @default "jsonSchema7"
     */
    target?: "jsonSchema7" | "jsonSchema2019-09" | "openApi3";
    /**
     * Enable support for recursive schemas using $ref.
     * @default false
     */
    useReferences?: boolean;
    /**
     * Name for the schema (used in $ref paths).
     */
    name?: string;
}
/**
 * Convert a Zod schema to JSON Schema format for MCP inputSchema.
 *
 * Uses zod-to-json-schema internally with MCP-optimized defaults.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { zodToMcpSchema } from '@onegenui/mcp';
 *
 * const params = z.object({
 *   location: z.string().describe('City name'),
 *   units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
 * });
 *
 * const jsonSchema = zodToMcpSchema(params);
 * // {
 * //   type: 'object',
 * //   properties: {
 * //     location: { type: 'string', description: 'City name' },
 * //     units: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' }
 * //   },
 * //   required: ['location']
 * // }
 * ```
 */
declare function zodToMcpSchema(schema: z.ZodTypeAny, options?: ZodToMcpSchemaOptions): JsonSchema;
/**
 * Create an empty object schema for tools with no parameters.
 * This follows the MCP specification recommendation.
 */
declare function emptyInputSchema(): JsonSchema;
/**
 * Merge multiple JSON schemas into a single object schema.
 * Useful for combining base schemas with extensions.
 */
declare function mergeSchemas(...schemas: JsonSchema[]): JsonSchema;
/**
 * Validate that a JSON Schema is compatible with MCP requirements.
 * Returns validation errors if any.
 */
declare function validateMcpSchema(schema: JsonSchema): {
    valid: boolean;
    errors: string[];
};
/**
 * Extract metadata from a Zod schema for tool selection.
 * Looks for .describe() calls and extracts keywords.
 */
declare function extractSchemaMetadata(schema: z.ZodTypeAny): {
    description?: string;
    keywords: string[];
};

/**
 * Configuration for defining an MCP tool.
 */
interface DefineMcpToolConfig<TParams extends z.ZodObject<z.ZodRawShape>> {
    /** Unique tool name (should be snake_case) */
    name: string;
    /** Human-readable title */
    title?: string;
    /** Tool description for LLM (be specific and detailed) */
    description: string;
    /** Zod schema for parameters */
    parameters: TParams;
    /** Semantic domain for tool selection */
    domain?: McpDomain;
    /** Tags for keyword-based selection */
    tags?: string[];
    /** Local execution function (optional) */
    execute?: (params: z.infer<TParams>) => Promise<unknown>;
}
/**
 * Define an MCP tool with full type inference.
 *
 * Uses Zod for type-safe parameter definition, which is automatically
 * converted to JSON Schema for the MCP wire format.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { defineMcpTool } from '@onegenui/mcp';
 *
 * const weatherTool = defineMcpTool({
 *   name: 'get_weather',
 *   description: 'Get the current weather for a location',
 *   parameters: z.object({
 *     location: z.string().describe('City name or coordinates'),
 *     units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
 *   }),
 *   domain: 'data',
 *   tags: ['weather', 'api', 'forecast'],
 *   execute: async ({ location, units }) => {
 *     // Implementation
 *     return { temperature: 22, units };
 *   },
 * });
 * ```
 */
declare function defineMcpTool<TParams extends z.ZodObject<z.ZodRawShape>>(config: DefineMcpToolConfig<TParams>): McpToolDefinition<TParams>;
/**
 * Infer the parameter type from a tool definition.
 */
type InferToolParams<T extends McpToolDefinition> = z.infer<T["parameters"]>;
/**
 * Configuration for defining an MCP prompt.
 */
interface DefineMcpPromptConfig {
    /** Unique prompt name */
    name: string;
    /** Human-readable title */
    title?: string;
    /** Prompt description */
    description?: string;
    /** Arguments the prompt accepts */
    arguments?: McpPromptArgument[];
}
/**
 * Define an MCP prompt template.
 *
 * @example
 * ```ts
 * const reviewPrompt = defineMcpPrompt({
 *   name: 'code_review',
 *   title: 'Code Review',
 *   description: 'Review code for best practices and potential issues',
 *   arguments: [
 *     { name: 'code', description: 'The code to review', required: true },
 *     { name: 'language', description: 'Programming language' },
 *   ],
 * });
 * ```
 */
declare function defineMcpPrompt(config: DefineMcpPromptConfig): McpPromptDefinition;
/**
 * Base configuration for defining an MCP server.
 */
interface DefineMcpServerConfigBase {
    /** Unique server identifier */
    id: string;
    /** Human-readable server name */
    name?: string;
    /** Semantic domain for the server's tools */
    domain?: McpDomain;
    /** Tags for keyword-based selection */
    tags?: string[];
    /** Whether this server is enabled */
    enabled?: boolean;
    /** Request timeout in milliseconds */
    timeout?: number;
}
/**
 * Stdio server configuration.
 */
interface DefineMcpServerConfigStdio extends DefineMcpServerConfigBase {
    transport: "stdio";
    /** Command to spawn */
    command: string;
    /** Command arguments */
    args?: string[];
    /** Environment variables */
    env?: Record<string, string>;
    /** Working directory */
    cwd?: string;
}
/**
 * HTTP server configuration.
 */
interface DefineMcpServerConfigHttp extends DefineMcpServerConfigBase {
    transport: "http";
    /** Server URL */
    url: string;
    /** HTTP headers */
    headers?: Record<string, string>;
}
/**
 * Union type for server configuration.
 */
type DefineMcpServerConfig = DefineMcpServerConfigStdio | DefineMcpServerConfigHttp;
/**
 * Define an MCP server configuration.
 *
 * @example
 * ```ts
 * // Stdio server (spawns a process)
 * const filesystemServer = defineMcpServer({
 *   id: 'filesystem',
 *   name: 'Filesystem Access',
 *   transport: 'stdio',
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/data'],
 *   domain: 'files',
 *   tags: ['read', 'write', 'directory'],
 * });
 *
 * // HTTP server
 * const apiServer = defineMcpServer({
 *   id: 'api',
 *   name: 'API Gateway',
 *   transport: 'http',
 *   url: 'http://localhost:3001/mcp',
 *   domain: 'data',
 * });
 * ```
 */
declare function defineMcpServer(config: DefineMcpServerConfig): McpServerConfig;
/**
 * Create a tool definition from MCP wire format.
 * Useful when loading tools from a remote MCP server.
 */
declare function toolFromWireFormat(wireFormat: {
    name: string;
    title?: string;
    description?: string;
    inputSchema: JsonSchema;
    outputSchema?: JsonSchema;
}, options?: {
    domain?: McpDomain;
    tags?: string[];
}): McpToolDefinition;
/**
 * Extract tool metadata for selection optimization.
 */
declare function extractToolMetadata(tool: McpToolDefinition): {
    name: string;
    description: string;
    domain?: McpDomain;
    tags: string[];
    keywords: string[];
};

/**
 * Resolve environment variables in a string.
 * Supports ${VAR_NAME} syntax.
 */
declare function resolveEnvVars(value: string): string;
/**
 * Resolve environment variables in server config.
 */
declare function resolveServerEnv(config: McpServerConfig): McpServerConfig;

/**
 * Tool Selection for MCP Servers
 *
 * This module provides intelligent tool selection using keyword and domain matching.
 * It uses modular components from ./tool-selection/ for each concern:
 * - keyword-extractor: Extract keywords from text
 * - domain-inferrer: Infer domains from keywords
 * - tool-scorer: Score tools against context
 */

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
declare function selectToolsForPrompt(serverStates: Map<string, McpServerState> | Record<string, McpServerState>, context: ToolSelectionContext, options?: ToolSelectionOptions): ScoredTool[];
/**
 * Get all tools from server states (no filtering).
 */
declare function getAllTools(serverStates: Map<string, McpServerState> | Record<string, McpServerState>): {
    tool: McpToolWireFormat;
    serverId: string;
}[];
/**
 * Get tools by domain.
 */
declare function getToolsByDomain(serverStates: Map<string, McpServerState> | Record<string, McpServerState>, domain: McpDomain): {
    tool: McpToolWireFormat;
    serverId: string;
}[];

/**
 * MCP Security Module
 *
 * Provides security controls for MCP command execution:
 * - Command whitelist validation
 * - Path sanitization
 * - Environment variable sandboxing
 * - Timeout enforcement
 */
/**
 * Allowed commands for stdio transport
 * Only these commands can be executed via MCP
 */
declare const ALLOWED_COMMANDS: Set<string>;
interface SecurityValidationResult {
    valid: boolean;
    error?: string;
}
/**
 * Validate a command for MCP execution
 */
declare function validateCommand(command: string): SecurityValidationResult;
/**
 * Validate command arguments
 */
declare function validateArgs(args: string[]): SecurityValidationResult;
/**
 * Sanitize environment variables for subprocess
 * Only allows safe variables
 */
declare function sanitizeEnv(env?: Record<string, string>): Record<string, string>;
/**
 * Default timeout for tool calls (30 seconds)
 */
declare const DEFAULT_TOOL_TIMEOUT_MS = 30000;
/**
 * Maximum timeout for tool calls (5 minutes)
 */
declare const MAX_TOOL_TIMEOUT_MS: number;
/**
 * Validate timeout value
 */
declare function validateTimeout(timeoutMs?: number): number;
/**
 * Add a command to the allowed list at runtime
 * Use with caution - should only be called during app initialization
 */
declare function allowCommand(command: string): void;
/**
 * Check if a command is allowed
 */
declare function isCommandAllowed(command: string): boolean;

export { ALLOWED_COMMANDS, DEFAULT_TOOL_TIMEOUT_MS, type DefineMcpPromptConfig, type DefineMcpServerConfig, type DefineMcpToolConfig, type InferToolParams, JsonSchema, MAX_TOOL_TIMEOUT_MS, McpDomain, McpPromptArgument, McpPromptDefinition, McpServerConfig, McpServerState, McpToolDefinition, McpToolWireFormat, ScoredTool, type SecurityValidationResult, ToolSelectionContext, ToolSelectionOptions, type ZodToMcpSchemaOptions, allowCommand, defineMcpPrompt, defineMcpServer, defineMcpTool, emptyInputSchema, extractSchemaMetadata, extractToolMetadata, getAllTools, getToolsByDomain, isCommandAllowed, mergeSchemas, resolveEnvVars, resolveServerEnv, sanitizeEnv, selectToolsForPrompt, toolFromWireFormat, validateArgs, validateCommand, validateMcpSchema, validateTimeout, zodToMcpSchema };
