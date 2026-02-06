"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var client_exports = {};
__export(client_exports, {
  createConnectionManager: () => createConnectionManager,
  createMcpClient: () => createMcpClient,
  registerLocalModuleLoader: () => registerLocalModuleLoader
});
module.exports = __toCommonJS(client_exports);

// src/registry/env-resolver.ts
function resolveEnvVars(value) {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] ?? "";
  });
}
function resolveServerEnv(config) {
  if (config.transport === "stdio") {
    const resolvedEnv = {};
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        resolvedEnv[key] = resolveEnvVars(value);
      }
    }
    return {
      ...config,
      command: resolveEnvVars(config.command),
      args: config.args?.map(resolveEnvVars),
      env: Object.keys(resolvedEnv).length > 0 ? resolvedEnv : void 0
    };
  }
  if (config.transport === "http") {
    const resolvedHeaders = {};
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        resolvedHeaders[key] = resolveEnvVars(value);
      }
    }
    return {
      ...config,
      url: resolveEnvVars(config.url),
      headers: Object.keys(resolvedHeaders).length > 0 ? resolvedHeaders : void 0
    };
  }
  if (config.transport === "local") {
    return {
      ...config,
      module: resolveEnvVars(config.module),
      toolsetExport: config.toolsetExport ? resolveEnvVars(config.toolsetExport) : void 0
    };
  }
  return config;
}

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
var import_client = require("@modelcontextprotocol/sdk/client/index.js");
var import_stdio = require("@modelcontextprotocol/sdk/client/stdio.js");
var import_streamableHttp = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

// src/security.ts
var ALLOWED_COMMANDS = /* @__PURE__ */ new Set([
  // Node.js
  "node",
  "npx",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  // Python
  "python",
  "python3",
  "pip",
  "pip3",
  "uv",
  "uvx",
  // Other common runtimes
  "deno",
  "go",
  "ruby",
  // MCP-specific
  "mcp-server-fetch",
  "mcp-server-filesystem",
  "mcp-server-sqlite"
]);
var BLOCKED_ENV_VARS = /* @__PURE__ */ new Set([
  "PATH",
  // Prevent PATH manipulation
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH"
]);
var ALLOWED_ENV_VARS = /* @__PURE__ */ new Set([
  "NODE_ENV",
  "HOME",
  "USER",
  "LANG",
  "LC_ALL",
  "TZ",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY"
  // API keys are allowed (user's responsibility)
]);
function validateCommand(command) {
  const parts = command.split(/\s+/);
  const baseCommand = parts[0] ?? "";
  const pathParts = baseCommand.split("/");
  const commandName = pathParts[pathParts.length - 1] ?? baseCommand;
  if (!ALLOWED_COMMANDS.has(commandName)) {
    return {
      valid: false,
      error: `Command '${commandName}' is not in the allowed commands whitelist. Allowed: ${Array.from(ALLOWED_COMMANDS).join(", ")}`
    };
  }
  const dangerousPatterns = [
    /[;&|`$()]/,
    // Shell metacharacters
    /\.\./,
    // Path traversal
    /\/etc\//,
    // System paths
    /\/proc\//,
    /\/sys\//
  ];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return {
        valid: false,
        error: `Command contains potentially dangerous pattern: ${pattern.toString()}`
      };
    }
  }
  return { valid: true };
}
function validateArgs(args) {
  for (const arg of args) {
    if (/[;&|`$()]/.test(arg) && !arg.startsWith("-")) {
      return {
        valid: false,
        error: `Argument '${arg}' contains shell metacharacters`
      };
    }
    if (arg.includes("..") && !arg.startsWith("-")) {
      return {
        valid: false,
        error: `Argument '${arg}' contains path traversal`
      };
    }
  }
  return { valid: true };
}
function sanitizeEnv(env) {
  const sanitized = {};
  if (!env) return sanitized;
  for (const [key, value] of Object.entries(env)) {
    if (BLOCKED_ENV_VARS.has(key)) {
      continue;
    }
    if (ALLOWED_ENV_VARS.has(key) || key.startsWith("OPENAI_") || key.startsWith("ANTHROPIC_") || key.startsWith("GOOGLE_") || key.startsWith("GEMINI_") || key.startsWith("MCP_")) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
var DEFAULT_TOOL_TIMEOUT_MS = 3e4;
var MAX_TOOL_TIMEOUT_MS = 5 * 60 * 1e3;
function validateTimeout(timeoutMs) {
  if (timeoutMs === void 0) {
    return DEFAULT_TOOL_TIMEOUT_MS;
  }
  if (timeoutMs <= 0) {
    return DEFAULT_TOOL_TIMEOUT_MS;
  }
  return Math.min(timeoutMs, MAX_TOOL_TIMEOUT_MS);
}

// src/client/sdk-client.ts
var CompatibleHTTPClientTransport = class extends import_streamableHttp.StreamableHTTPClientTransport {
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
      sdkClient = new import_client.Client({
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
        transport = new import_stdio.StdioClientTransport({
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
var DEFAULT_CONNECT_TIMEOUT_MS = 3e4;
var DEFAULT_REFRESH_TIMEOUT_MS = 2e4;
var DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 15e3;
function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId = null;
  return new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    promise.then(
      (value) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}
function createConnectionManager(registry, config) {
  const connectionConfig = {
    strategy: config?.strategy ?? registry.connectionConfig.strategy,
    healthCheckInterval: config?.healthCheckInterval ?? registry.connectionConfig.healthCheckInterval,
    maxIdleTime: config?.maxIdleTime ?? registry.connectionConfig.maxIdleTime,
    reconnectAttempts: config?.reconnectAttempts ?? registry.connectionConfig.reconnectAttempts
  };
  const clients = /* @__PURE__ */ new Map();
  const pendingConnections = /* @__PURE__ */ new Map();
  let healthCheckInterval = null;
  let healthCheckInFlight = false;
  function updateState(serverId, status, error) {
    try {
      registry.setStatus(serverId, status, error);
    } catch {
    }
  }
  async function refreshToolsForClient(serverId, client) {
    try {
      const tools = await withTimeout(
        client.listTools(),
        DEFAULT_REFRESH_TIMEOUT_MS,
        `Refreshing tools timed out for ${serverId}`
      );
      registry.setTools(serverId, tools);
      try {
        const prompts = await withTimeout(
          client.listPrompts(),
          DEFAULT_REFRESH_TIMEOUT_MS,
          `Refreshing prompts timed out for ${serverId}`
        );
        registry.setPrompts(serverId, prompts);
      } catch {
      }
      try {
        const resources = await withTimeout(
          client.listResources(),
          DEFAULT_REFRESH_TIMEOUT_MS,
          `Refreshing resources timed out for ${serverId}`
        );
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
      const pending = pendingConnections.get(serverId);
      if (pending) {
        return pending;
      }
      const serverConfig = registry.getServer(serverId);
      if (!serverConfig) {
        throw new Error(`Server ${serverId} not found in registry`);
      }
      if (serverConfig.enabled === false) {
        throw new Error(`Server ${serverId} is disabled`);
      }
      const connectPromise = (async () => {
        const reusedClient = clients.get(serverId);
        const client = reusedClient ?? createMcpClient(serverConfig);
        clients.set(serverId, client);
        updateState(serverId, "connecting");
        try {
          await withTimeout(
            client.connect(),
            serverConfig.timeout ?? DEFAULT_CONNECT_TIMEOUT_MS,
            `Connection timed out for ${serverId}`
          );
          updateState(serverId, "connected");
          await refreshToolsForClient(serverId, client);
          return client;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          updateState(serverId, "error", errorMessage);
          clients.delete(serverId);
          throw error;
        }
      })();
      pendingConnections.set(serverId, connectPromise);
      try {
        return await connectPromise;
      } finally {
        pendingConnections.delete(serverId);
      }
    },
    isConnected(serverId) {
      const client = clients.get(serverId);
      return client?.connected ?? false;
    },
    async disconnect(serverId) {
      const client = clients.get(serverId);
      pendingConnections.delete(serverId);
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
      healthCheckInterval = setInterval(() => {
        if (healthCheckInFlight) return;
        healthCheckInFlight = true;
        void (async () => {
          const entries = Array.from(clients.entries());
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (!entry) continue;
            const [serverId, client] = entry;
            const serverConfig = registry.getServer(serverId);
            const timeoutMs = serverConfig?.timeout ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
            if (!client.connected) {
              try {
                await withTimeout(
                  client.connect(),
                  timeoutMs,
                  `Health-check reconnect timed out for ${serverId}`
                );
                updateState(serverId, "connected");
                await refreshToolsForClient(serverId, client);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                updateState(serverId, "error", errorMessage);
              }
            } else {
              try {
                await withTimeout(
                  client.listTools(),
                  timeoutMs,
                  `Health-check listTools timed out for ${serverId}`
                );
              } catch {
                updateState(serverId, "disconnected");
              }
            }
          }
        })().catch((error) => {
          console.error("[MCP] Health check loop failed:", error);
        }).finally(() => {
          healthCheckInFlight = false;
        });
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createConnectionManager,
  createMcpClient,
  registerLocalModuleLoader
});
//# sourceMappingURL=index.js.map