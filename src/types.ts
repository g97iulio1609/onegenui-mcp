import type { z } from "zod";

// =============================================================================
// MCP Domains
// =============================================================================

/**
 * Semantic domain for tool categorization.
 * Used for tool selection optimization.
 */
export type McpDomain =
  | "files" // Filesystem operations
  | "vcs" // Version control (git, GitHub)
  | "web" // HTTP requests, scraping
  | "data" // Database, APIs
  | "ops" // System operations
  | "comm" // Email, messaging
  | "finance" // Payment, billing
  | "security" // Auth, secrets
  | "ai" // AI/ML operations
  | "travel" // Flights, hotels, bookings
  | "custom"; // User-defined

// =============================================================================
// JSON Schema Types (MCP Wire Format)
// =============================================================================

/**
 * JSON Schema representation for MCP inputSchema.
 * Follows JSON Schema draft-07 / 2020-12.
 */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema | JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  not?: JsonSchema;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  definitions?: Record<string, JsonSchema>;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  title?: string;
  [key: string]: unknown;
}

// =============================================================================
// MCP Tool Types
// =============================================================================

/**
 * MCP Tool definition with Zod schema for authoring.
 * The parameters field uses Zod for type-safe authoring,
 * which gets converted to JSON Schema for the MCP wire format.
 */
export interface McpToolDefinition<
  TParams extends z.ZodTypeAny = z.ZodTypeAny,
> {
  /** Unique tool name */
  readonly name: string;
  /** Human-readable title */
  readonly title?: string;
  /** Tool description for LLM */
  readonly description: string;
  /** Zod schema for parameters (authoring) */
  readonly parameters: TParams;
  /** JSON Schema for MCP wire format (auto-generated) */
  readonly inputSchema?: JsonSchema;
  /** Output schema (optional, for structured output) */
  readonly outputSchema?: JsonSchema;
  /** Semantic domain for tool selection */
  readonly domain?: McpDomain;
  /** Tags for keyword-based selection */
  readonly tags?: string[];
  /** Local execution function (optional) */
  readonly execute?: (params: z.infer<TParams>) => Promise<unknown>;
}

/**
 * MCP Tool as returned by listTools (wire format).
 */
export interface McpToolWireFormat {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
}

/**
 * Result of calling an MCP tool.
 */
export interface McpToolResult {
  content: McpToolResultContent[];
  structuredContent?: unknown;
  isError?: boolean;
}

export type McpToolResultContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; resource: McpResourceContent };

// =============================================================================
// MCP Prompt Types
// =============================================================================

/**
 * MCP Prompt argument definition.
 */
export interface McpPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * MCP Prompt definition.
 */
export interface McpPromptDefinition {
  /** Unique prompt name */
  readonly name: string;
  /** Human-readable title */
  readonly title?: string;
  /** Prompt description */
  readonly description?: string;
  /** Arguments the prompt accepts */
  readonly arguments?: McpPromptArgument[];
}

/**
 * MCP Prompt message content.
 */
export interface McpPromptMessage {
  role: "user" | "assistant";
  content:
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "resource"; resource: McpResourceContent };
}

// =============================================================================
// MCP Resource Types
// =============================================================================

/**
 * MCP Resource definition.
 */
export interface McpResourceDefinition {
  /** Resource URI */
  readonly uri: string;
  /** Human-readable name */
  readonly name: string;
  /** Resource description */
  readonly description?: string;
  /** MIME type */
  readonly mimeType?: string;
}

/**
 * MCP Resource content.
 */
export interface McpResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// =============================================================================
// MCP Server Configuration
// =============================================================================

/**
 * Transport type for MCP server communication.
 */
export type McpTransportType = "stdio" | "http" | "local";

/**
 * Base server configuration shared by all transport types.
 */
export interface McpServerConfigBase {
  /** Unique server identifier */
  readonly id: string;
  /** Human-readable server name */
  readonly name?: string;
  /** Transport protocol */
  readonly transport: McpTransportType;
  /** Semantic domain for the server's tools */
  readonly domain?: McpDomain;
  /** Tags for keyword-based selection */
  readonly tags?: string[];
  /** Whether this server is enabled */
  readonly enabled?: boolean;
  /** Request timeout in milliseconds */
  readonly timeout?: number;
}

/**
 * Stdio transport configuration.
 */
export interface McpServerConfigStdio extends McpServerConfigBase {
  readonly transport: "stdio";
  /** Command to spawn */
  readonly command: string;
  /** Command arguments */
  readonly args?: string[];
  /** Environment variables */
  readonly env?: Record<string, string>;
  /** Working directory */
  readonly cwd?: string;
}

/**
 * HTTP transport configuration.
 */
export interface McpServerConfigHttp extends McpServerConfigBase {
  readonly transport: "http";
  /** Server URL */
  readonly url: string;
  /** HTTP headers */
  readonly headers?: Record<string, string>;
}

/**
 * Local (in-process) transport configuration.
 */
export interface McpServerConfigLocal extends McpServerConfigBase {
  readonly transport: "local";
  /** Module path or package name to load toolset from */
  readonly module: string;
  /** Optional export name that contains the toolset */
  readonly toolsetExport?: string;
}

/**
 * Union type for all server configurations.
 */
export type McpServerConfig =
  | McpServerConfigStdio
  | McpServerConfigHttp
  | McpServerConfigLocal;

/**
 * Server metadata for tool optimization.
 */
export interface McpServerMetadata {
  /** Number of tools available */
  toolCount: number;
  /** Domains covered by tools */
  domains: McpDomain[];
  /** Aggregated tags from all tools */
  tags: string[];
  /** Tool names for quick lookup */
  toolNames: string[];
  /** Last time metadata was refreshed */
  lastRefreshed: Date;
}

/**
 * Server state including connection status and cached tools.
 */
export interface McpServerState {
  /** Server configuration */
  config: McpServerConfig;
  /** Connection status */
  status: "disconnected" | "connecting" | "connected" | "error";
  /** Error message if status is 'error' */
  error?: string;
  /** Cached metadata for tool selection */
  metadata?: McpServerMetadata;
  /** Cached tools */
  tools?: McpToolWireFormat[];
  /** Cached prompts */
  prompts?: McpPromptDefinition[];
  /** Cached resources */
  resources?: McpResourceDefinition[];
}

// =============================================================================
// MCP Configuration File
// =============================================================================

/**
 * Tool selection configuration.
 */
export interface McpSelectionConfig {
  /** Maximum tools to include per LLM request */
  maxToolsPerRequest?: number;
  /** Selection algorithm */
  strategy?: "keyword" | "semantic";
  /** Domains to prioritize */
  priorityDomains?: McpDomain[];
}

/**
 * Connection management configuration.
 */
export interface McpConnectionConfig {
  /** Connection lifecycle strategy */
  strategy?: "persistent" | "on-demand" | "pooled";
  /** Health check interval in ms */
  healthCheckInterval?: number;
  /** Max idle time before disconnect (pooled only) */
  maxIdleTime?: number;
  /** Reconnection attempts on failure */
  reconnectAttempts?: number;
}

/**
 * Server configuration as defined in mcp.config.json.
 * Note: 'id' is derived from the object key.
 */
export interface McpServerConfigInput {
  name?: string;
  transport: McpTransportType;
  command?: string;
  args?: string[];
  url?: string;
  module?: string;
  toolsetExport?: string;
  env?: Record<string, string>;
  cwd?: string;
  headers?: Record<string, string>;
  domain?: McpDomain;
  tags?: string[];
  enabled?: boolean;
  timeout?: number;
}

/**
 * Full MCP configuration file structure.
 */
export interface McpConfigFile {
  $schema?: string;
  servers: Record<string, McpServerConfigInput>;
  selection?: McpSelectionConfig;
  connection?: McpConnectionConfig;
}

// =============================================================================
// Registry Types
// =============================================================================

/**
 * Events emitted by the MCP registry.
 */
export type McpRegistryEvent =
  | { type: "server:added"; serverId: string; config: McpServerConfig }
  | { type: "server:removed"; serverId: string }
  | { type: "server:updated"; serverId: string; config: McpServerConfig }
  | { type: "server:connected"; serverId: string }
  | { type: "server:disconnected"; serverId: string }
  | { type: "server:error"; serverId: string; error: string }
  | { type: "tools:changed"; serverId: string };

/**
 * Event handler for registry events.
 */
export type McpRegistryEventHandler = (event: McpRegistryEvent) => void;

/**
 * Options for creating an MCP registry.
 */
export interface McpRegistryOptions {
  /** Path to mcp.config.json */
  configPath?: string;
  /** Watch config file for changes */
  watchConfig?: boolean;
  /** Connection configuration */
  connection?: McpConnectionConfig;
  /** Selection configuration */
  selection?: McpSelectionConfig;
}

// =============================================================================
// Tool Selection Types
// =============================================================================

/**
 * Context for tool selection.
 */
export interface ToolSelectionContext {
  /** User prompt or message */
  prompt: string;
  /** Current file being edited (optional) */
  currentFile?: string;
  /** Recent user actions (optional) */
  recentActions?: string[];
  /** Explicit user intent (optional) */
  userIntent?: string;
  /** Domains to include (optional, overrides priorityDomains) */
  includeDomains?: McpDomain[];
  /** Domains to exclude (optional) */
  excludeDomains?: McpDomain[];
}

/**
 * Options for tool selection.
 */
export interface ToolSelectionOptions {
  /** Maximum number of tools to return */
  maxTools?: number;
  /** Minimum relevance score (0-1) */
  minScore?: number;
  /** Include all tools from priority domains */
  includePriorityDomains?: boolean;
}

/**
 * Tool with relevance score from selection.
 */
export interface ScoredTool {
  /** Tool definition */
  tool: McpToolWireFormat;
  /** Server ID the tool belongs to */
  serverId: string;
  /** Relevance score (0-1) */
  score: number;
  /** Match reasons for debugging */
  matchReasons: string[];
}
