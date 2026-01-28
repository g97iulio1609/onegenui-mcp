import type {
  McpServerConfigLocal,
  McpToolDefinition,
  McpToolWireFormat,
  McpToolResult,
  McpPromptDefinition,
  McpPromptMessage,
  McpResourceDefinition,
  McpResourceContent,
} from "../types";
import type { McpClient } from "./client";

type LocalToolset = Record<string, McpToolDefinition>;
type ModuleLoader = () => Promise<unknown>;

// Registry for local module loaders
const localModuleLoaders: Map<string, ModuleLoader> = new Map();

/**
 * Register a local module loader for use with MCP local transport.
 */
export function registerLocalModuleLoader(
  moduleName: string,
  loader: ModuleLoader,
): void {
  localModuleLoaders.set(moduleName, loader);
}

function isToolDefinition(value: unknown): value is McpToolDefinition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    name?: unknown;
    description?: unknown;
    parameters?: unknown;
  };
  return (
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.parameters === "object"
  );
}

function normalizeToolset(candidate: unknown): LocalToolset | null {
  if (!candidate || typeof candidate !== "object") return null;

  if (isToolDefinition(candidate)) {
    const tool = candidate;
    return { [tool.name]: tool };
  }

  const record = candidate as Record<string, unknown>;
  const toolset: LocalToolset = {};

  for (const value of Object.values(record)) {
    if (isToolDefinition(value)) {
      toolset[value.name] = value;
    }
  }

  return Object.keys(toolset).length > 0 ? toolset : null;
}

async function loadLocalToolset(
  config: McpServerConfigLocal,
): Promise<LocalToolset> {
  const loader = localModuleLoaders.get(config.module);
  if (!loader) {
    throw new Error(
      `Local MCP module '${config.module}' is not registered. ` +
        `Call registerLocalModuleLoader("${config.module}", () => import("${config.module}")) before connecting.`,
    );
  }

  const moduleExports = (await loader()) as Record<string, unknown>;

  if (config.toolsetExport && config.toolsetExport in moduleExports) {
    const toolset = normalizeToolset(moduleExports[config.toolsetExport]);
    if (toolset) return toolset;
  }

  const preferredExports = ["webSearchTools", "mcpTools", "tools", "toolset"];

  for (const exportName of preferredExports) {
    if (exportName in moduleExports) {
      const toolset = normalizeToolset(moduleExports[exportName]);
      if (toolset) return toolset;
    }
  }

  const merged: LocalToolset = {};
  for (const value of Object.values(moduleExports)) {
    const toolset = normalizeToolset(value);
    if (!toolset) continue;
    for (const [name, tool] of Object.entries(toolset)) {
      merged[name] = tool;
    }
  }

  if (Object.keys(merged).length > 0) {
    return merged;
  }

  throw new Error(
    `Local MCP module '${config.module}' did not export any tools`,
  );
}

/**
 * Create an MCP client for local (in-process) modules.
 */
export function createLocalClient(config: McpServerConfigLocal): McpClient {
  let toolset: LocalToolset | null = null;
  let isConnected = false;

  const ensureToolset = async () => {
    if (!toolset) {
      toolset = await loadLocalToolset(config);
    }
    return toolset;
  };

  return {
    config,

    get connected(): boolean {
      return isConnected;
    },

    async connect(): Promise<void> {
      if (isConnected) return;
      await ensureToolset();
      isConnected = true;
    },

    async disconnect(): Promise<void> {
      toolset = null;
      isConnected = false;
    },

    async listTools(): Promise<McpToolWireFormat[]> {
      const tools = await ensureToolset();
      return Object.values(tools).map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema ?? { type: "object" },
      }));
    },

    async callTool(
      name: string,
      args: Record<string, unknown>,
    ): Promise<McpToolResult> {
      const tools = await ensureToolset();
      const tool = tools[name];
      if (!tool?.execute) {
        throw new Error(`Local tool '${name}' does not have an execute()`);
      }

      const result = await tool.execute(args);
      const text = typeof result === "string" ? result : JSON.stringify(result);

      return {
        content: [{ type: "text", text }],
        structuredContent: result,
      };
    },

    async listPrompts(): Promise<McpPromptDefinition[]> {
      return [];
    },

    async getPrompt(): Promise<McpPromptMessage[]> {
      return [];
    },

    async listResources(): Promise<McpResourceDefinition[]> {
      return [];
    },

    async readResource(): Promise<McpResourceContent[]> {
      return [];
    },
  };
}
