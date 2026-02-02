import {
  resolveServerEnv,
  sanitizeEnv,
  validateArgs,
  validateCommand,
  validateTimeout
} from "../chunk-P6ZLD7I5.mjs";

// src/client/local-client.ts
var localModuleLoaders = /* @__PURE__ */ new Map();
function registerLocalModuleLoader(moduleName, loader) {
  localModuleLoaders.set(moduleName, loader);
}
function isToolDefinition(value) {
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return typeof candidate.name === "string" && typeof candidate.description === "string" && typeof candidate.parameters === "object";
}
function normalizeToolset(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  if (isToolDefinition(candidate)) {
    const tool = candidate;
    return { [tool.name]: tool };
  }
  const record = candidate;
  const toolset = {};
  for (const value of Object.values(record)) {
    if (isToolDefinition(value)) {
      toolset[value.name] = value;
    }
  }
  return Object.keys(toolset).length > 0 ? toolset : null;
}
async function loadLocalToolset(config) {
  const loader = localModuleLoaders.get(config.module);
  if (!loader) {
    throw new Error(
      `Local MCP module '${config.module}' is not registered. Call registerLocalModuleLoader("${config.module}", () => import("${config.module}")) before connecting.`
    );
  }
  const moduleExports = await loader();
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
  const merged = {};
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
    `Local MCP module '${config.module}' did not export any tools`
  );
}
function createLocalClient(config) {
  let toolset = null;
  let isConnected = false;
  const ensureToolset = async () => {
    if (!toolset) {
      toolset = await loadLocalToolset(config);
    }
    return toolset;
  };
  return {
    config,
    get connected() {
      return isConnected;
    },
    async connect() {
      if (isConnected) return;
      await ensureToolset();
      isConnected = true;
    },
    async disconnect() {
      toolset = null;
      isConnected = false;
    },
    async listTools() {
      const tools = await ensureToolset();
      return Object.values(tools).map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema ?? { type: "object" }
      }));
    },
    async callTool(name, args, _options) {
      const tools = await ensureToolset();
      const tool = tools[name];
      if (!tool?.execute) {
        throw new Error(`Local tool '${name}' does not have an execute()`);
      }
      const result = await tool.execute(args);
      const text = typeof result === "string" ? result : JSON.stringify(result);
      return {
        content: [{ type: "text", text }],
        structuredContent: result
      };
    },
    async listPrompts() {
      return [];
    },
    async getPrompt() {
      return [];
    },
    async listResources() {
      return [];
    },
    async readResource() {
      return [];
    }
  };
}

// src/client/sdk-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
var CompatibleHTTPClientTransport = class extends StreamableHTTPClientTransport {
  setProtocolVersion(version) {
  }
};
function createSdkClient(config) {
  let sdkClient = null;
  let isConnected = false;
  return {
    config,
    get connected() {
      return isConnected;
    },
    async connect() {
      if (isConnected && sdkClient) {
        return;
      }
      sdkClient = new Client({
        name: `json-render-mcp-${config.id}`,
        version: "1.0.0"
      });
      let transport;
      if (config.transport === "stdio") {
        const commandValidation = validateCommand(config.command);
        if (!commandValidation.valid) {
          throw new Error(
            `MCP Security: ${commandValidation.error}`
          );
        }
        if (config.args) {
          const argsValidation = validateArgs(config.args);
          if (!argsValidation.valid) {
            throw new Error(
              `MCP Security: ${argsValidation.error}`
            );
          }
        }
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: sanitizeEnv(config.env),
          cwd: config.cwd
        });
      } else if (config.transport === "http") {
        transport = new CompatibleHTTPClientTransport(new URL(config.url), {
          requestInit: {
            headers: config.headers
          }
        });
      } else {
        throw new Error(
          `Unknown transport type: ${config.transport}`
        );
      }
      await sdkClient.connect(transport);
      isConnected = true;
    },
    async disconnect() {
      if (sdkClient && isConnected) {
        await sdkClient.close();
        sdkClient = null;
        isConnected = false;
      }
    },
    async listTools() {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }
      const result = await sdkClient.listTools();
      return result.tools.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
    },
    async callTool(name, args, options) {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }
      const timeoutMs = validateTimeout(options?.timeoutMs);
      const callPromise = sdkClient.callTool({ name, arguments: args });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`MCP tool '${name}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      const result = await Promise.race([callPromise, timeoutPromise]);
      return {
        content: result.content.map((c) => {
          if (c.type === "text") {
            return { type: "text", text: c.text ?? "" };
          }
          if (c.type === "image") {
            return {
              type: "image",
              data: c.data ?? "",
              mimeType: c.mimeType ?? ""
            };
          }
          return {
            type: "resource",
            resource: c.resource
          };
        }),
        structuredContent: result.structuredContent,
        isError: result.isError
      };
    },
    async listPrompts() {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }
      const result = await sdkClient.listPrompts();
      return result.prompts.map((prompt) => ({
        name: prompt.name,
        title: prompt.title,
        description: prompt.description,
        arguments: prompt.arguments?.map((arg) => ({
          name: arg.name,
          description: arg.description,
          required: arg.required
        }))
      }));
    },
    async getPrompt(name, args) {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }
      const result = await sdkClient.getPrompt({ name, arguments: args });
      return result.messages.map((msg) => {
        const content = msg.content;
        if (content.type === "text") {
          return {
            role: msg.role,
            content: { type: "text", text: content.text }
          };
        }
        if (content.type === "image") {
          return {
            role: msg.role,
            content: {
              type: "image",
              data: content.data,
              mimeType: content.mimeType
            }
          };
        }
        return {
          role: msg.role,
          content: {
            type: "resource",
            resource: content.resource
          }
        };
      });
    },
    async listResources() {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }
      const result = await sdkClient.listResources();
      return result.resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }));
    },
    async readResource(uri) {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }
      const result = await sdkClient.readResource({ uri });
      return result.contents.map((content) => ({
        uri: content.uri,
        mimeType: content.mimeType,
        text: content.text,
        blob: content.blob
      }));
    }
  };
}

// src/client/client.ts
function createMcpClient(config) {
  const resolvedConfig = resolveServerEnv(config);
  if (resolvedConfig.transport === "local") {
    return createLocalClient(resolvedConfig);
  }
  return createSdkClient(resolvedConfig);
}

// src/client/connection.ts
function createConnectionManager(registry, config) {
  const connectionConfig = {
    strategy: config?.strategy ?? registry.connectionConfig.strategy,
    healthCheckInterval: config?.healthCheckInterval ?? registry.connectionConfig.healthCheckInterval,
    maxIdleTime: config?.maxIdleTime ?? registry.connectionConfig.maxIdleTime,
    reconnectAttempts: config?.reconnectAttempts ?? registry.connectionConfig.reconnectAttempts
  };
  const clients = /* @__PURE__ */ new Map();
  let healthCheckInterval = null;
  function updateState(serverId, status, error) {
    try {
      registry.setStatus(serverId, status, error);
    } catch {
    }
  }
  async function refreshToolsForClient(serverId, client) {
    try {
      const tools = await client.listTools();
      registry.setTools(serverId, tools);
      try {
        const prompts = await client.listPrompts();
        registry.setPrompts(serverId, prompts);
      } catch {
      }
      try {
        const resources = await client.listResources();
        registry.setResources(serverId, resources);
      } catch {
      }
    } catch (error) {
      console.error(`Error refreshing tools for ${serverId}:`, error);
    }
  }
  const manager = {
    async getClient(serverId) {
      const existing = clients.get(serverId);
      if (existing?.connected) {
        return existing;
      }
      const serverConfig = registry.getServer(serverId);
      if (!serverConfig) {
        throw new Error(`Server ${serverId} not found in registry`);
      }
      if (serverConfig.enabled === false) {
        throw new Error(`Server ${serverId} is disabled`);
      }
      const client = createMcpClient(serverConfig);
      clients.set(serverId, client);
      updateState(serverId, "connecting");
      try {
        await client.connect();
        updateState(serverId, "connected");
        await refreshToolsForClient(serverId, client);
        return client;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        updateState(serverId, "error", errorMessage);
        clients.delete(serverId);
        throw error;
      }
    },
    isConnected(serverId) {
      const client = clients.get(serverId);
      return client?.connected ?? false;
    },
    async disconnect(serverId) {
      const client = clients.get(serverId);
      if (client) {
        try {
          await client.disconnect();
        } catch (error) {
          console.error(`Error disconnecting ${serverId}:`, error);
        }
        clients.delete(serverId);
        updateState(serverId, "disconnected");
      }
    },
    async disconnectAll() {
      const disconnectPromises = [];
      const serverIds = Array.from(clients.keys());
      for (let i = 0; i < serverIds.length; i++) {
        const serverId = serverIds[i];
        if (serverId) {
          disconnectPromises.push(manager.disconnect(serverId));
        }
      }
      await Promise.all(disconnectPromises);
    },
    async refreshTools(serverId) {
      const client = clients.get(serverId);
      if (client?.connected) {
        await refreshToolsForClient(serverId, client);
      }
    },
    startHealthChecks() {
      if (healthCheckInterval) {
        return;
      }
      const interval = connectionConfig.healthCheckInterval ?? 6e4;
      healthCheckInterval = setInterval(async () => {
        const entries = Array.from(clients.entries());
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (!entry) continue;
          const [serverId, client] = entry;
          if (!client.connected) {
            try {
              await client.connect();
              updateState(serverId, "connected");
              await refreshToolsForClient(serverId, client);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              updateState(serverId, "error", errorMessage);
            }
          } else {
            try {
              await client.listTools();
            } catch {
              updateState(serverId, "disconnected");
            }
          }
        }
      }, interval);
    },
    stopHealthChecks() {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }
    }
  };
  registry.on((event) => {
    if (event.type === "server:removed") {
      manager.disconnect(event.serverId).catch(() => {
      });
    }
  });
  return manager;
}
export {
  createConnectionManager,
  createMcpClient,
  registerLocalModuleLoader
};
//# sourceMappingURL=index.mjs.map