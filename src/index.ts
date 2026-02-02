// =============================================================================
// @onegenui/mcp - Model Context Protocol integration
// =============================================================================

// Types
export type {
  // Core types
  McpDomain,
  JsonSchema,
  // Tool types
  McpToolDefinition,
  McpToolWireFormat,
  McpToolResult,
  McpToolResultContent,
  // Prompt types
  McpPromptDefinition,
  McpPromptArgument,
  McpPromptMessage,
  // Resource types
  McpResourceDefinition,
  McpResourceContent,
  // Server types
  McpTransportType,
  McpServerConfig,
  McpServerConfigBase,
  McpServerConfigStdio,
  McpServerConfigHttp,
  McpServerMetadata,
  McpServerState,
  // Config types
  McpSelectionConfig,
  McpConnectionConfig,
  McpServerConfigInput,
  McpConfigFile,
  // Registry types
  McpRegistryEvent,
  McpRegistryEventHandler,
  McpRegistryOptions,
  // Selection types
  ToolSelectionContext,
  ToolSelectionOptions,
  ScoredTool,
} from "./types";

// Schema utilities
export {
  zodToMcpSchema,
  emptyInputSchema,
  mergeSchemas,
  validateMcpSchema,
  extractSchemaMetadata,
  type ZodToMcpSchemaOptions,
} from "./schema";

// Define helpers
export {
  defineMcpTool,
  defineMcpPrompt,
  defineMcpServer,
  toolFromWireFormat,
  extractToolMetadata,
  type DefineMcpToolConfig,
  type DefineMcpPromptConfig,
  type DefineMcpServerConfig,
  type InferToolParams,
} from "./define";

// Registry
export { createMcpRegistry, type McpRegistry } from "./registry";
export { resolveEnvVars, resolveServerEnv } from "./registry/env-resolver";

// Selection
export {
  selectToolsForPrompt,
  getAllTools,
  getToolsByDomain,
} from "./selection";

// Security
export {
  ALLOWED_COMMANDS,
  validateCommand,
  validateArgs,
  sanitizeEnv,
  validateTimeout,
  allowCommand,
  isCommandAllowed,
  DEFAULT_TOOL_TIMEOUT_MS,
  MAX_TOOL_TIMEOUT_MS,
  type SecurityValidationResult,
} from "./security";

// Re-export client and integration from subpaths
// Users can also import directly from '@onegenui/mcp/client'
// and '@onegenui/mcp/integration'
