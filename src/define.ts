import { z } from "zod";
import type {
  McpToolDefinition,
  McpPromptDefinition,
  McpPromptArgument,
  McpServerConfig,
  McpServerConfigStdio,
  McpServerConfigHttp,
  McpDomain,
  JsonSchema,
} from "./types";
import { zodToMcpSchema } from "./schema";

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Configuration for defining an MCP tool.
 */
export interface DefineMcpToolConfig<
  TParams extends z.ZodObject<z.ZodRawShape>,
> {
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
export function defineMcpTool<TParams extends z.ZodObject<z.ZodRawShape>>(
  config: DefineMcpToolConfig<TParams>,
): McpToolDefinition<TParams> {
  const { name, title, description, parameters, domain, tags, execute } =
    config;

  // Convert Zod schema to JSON Schema for MCP wire format
  const inputSchema = zodToMcpSchema(parameters);

  return {
    name,
    title,
    description,
    parameters,
    inputSchema,
    domain,
    tags,
    execute,
  };
}

/**
 * Infer the parameter type from a tool definition.
 */
export type InferToolParams<T extends McpToolDefinition> = z.infer<
  T["parameters"]
>;

// =============================================================================
// Prompt Definition
// =============================================================================

/**
 * Configuration for defining an MCP prompt.
 */
export interface DefineMcpPromptConfig {
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
export function defineMcpPrompt(
  config: DefineMcpPromptConfig,
): McpPromptDefinition {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    arguments: config.arguments,
  };
}

// =============================================================================
// Server Definition
// =============================================================================

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
export type DefineMcpServerConfig =
  | DefineMcpServerConfigStdio
  | DefineMcpServerConfigHttp;

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
export function defineMcpServer(
  config: DefineMcpServerConfig,
): McpServerConfig {
  if (config.transport === "stdio") {
    const stdioConfig: McpServerConfigStdio = {
      id: config.id,
      name: config.name,
      transport: "stdio",
      command: config.command,
      args: config.args,
      env: config.env,
      cwd: config.cwd,
      domain: config.domain,
      tags: config.tags,
      enabled: config.enabled ?? true,
      timeout: config.timeout,
    };
    return stdioConfig;
  }

  const httpConfig: McpServerConfigHttp = {
    id: config.id,
    name: config.name,
    transport: "http",
    url: config.url,
    headers: config.headers,
    domain: config.domain,
    tags: config.tags,
    enabled: config.enabled ?? true,
    timeout: config.timeout,
  };
  return httpConfig;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a tool definition from MCP wire format.
 * Useful when loading tools from a remote MCP server.
 */
export function toolFromWireFormat(
  wireFormat: {
    name: string;
    title?: string;
    description?: string;
    inputSchema: JsonSchema;
    outputSchema?: JsonSchema;
  },
  options?: {
    domain?: McpDomain;
    tags?: string[];
  },
): McpToolDefinition {
  // Create a passthrough Zod schema since we don't have the original
  const parameters = z.object({}).passthrough();

  return {
    name: wireFormat.name,
    title: wireFormat.title,
    description: wireFormat.description ?? "",
    parameters,
    inputSchema: wireFormat.inputSchema,
    outputSchema: wireFormat.outputSchema,
    domain: options?.domain,
    tags: options?.tags,
  };
}

/**
 * Extract tool metadata for selection optimization.
 */
export function extractToolMetadata(tool: McpToolDefinition): {
  name: string;
  description: string;
  domain?: McpDomain;
  tags: string[];
  keywords: string[];
} {
  // Extract keywords from name and description
  const keywords: string[] = [];

  // Add name parts (split by underscore)
  const nameParts = tool.name.split("_");
  for (const part of nameParts) {
    if (part.length > 2) {
      keywords.push(part.toLowerCase());
    }
  }

  // Add words from description
  if (tool.description) {
    const words = tool.description.toLowerCase().split(/\s+/);
    for (const word of words) {
      // Clean up word
      const cleaned = word.replace(/[^a-z0-9]/g, "");
      if (cleaned.length > 3) {
        keywords.push(cleaned);
      }
    }
  }

  // Add tags
  if (tool.tags) {
    for (const tag of tool.tags) {
      keywords.push(tag.toLowerCase());
    }
  }

  // Deduplicate
  const uniqueKeywords: Record<string, true> = {};
  for (const kw of keywords) {
    uniqueKeywords[kw] = true;
  }

  return {
    name: tool.name,
    description: tool.description,
    domain: tool.domain,
    tags: tool.tags ?? [],
    keywords: Object.keys(uniqueKeywords),
  };
}
