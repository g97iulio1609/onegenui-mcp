import { readFileSync, existsSync, watch as fsWatch } from "fs";
import type {
  McpServerConfig,
  McpServerState,
  McpConfigFile,
  McpConnectionConfig,
  McpSelectionConfig,
  McpRegistryEvent,
  McpRegistryEventHandler,
  McpRegistryOptions,
  McpToolWireFormat,
  McpPromptDefinition,
  McpResourceDefinition,
} from "./types";

import {
  parseServerConfig,
  createServerState,
  computeMetadata,
} from "./registry/config-parser";

// Re-exports now come from registry/ directory
// Use: import { resolveEnvVars, resolveServerEnv } from '@onegenui/mcp/registry'

/**
 * MCP Registry manages server configurations and their states.
 */
export interface McpRegistry {
  add(server: McpServerConfig): void;
  remove(serverId: string): void;
  update(serverId: string, config: Partial<McpServerConfig>): void;

  getServer(id: string): McpServerConfig | undefined;
  getServerState(id: string): McpServerState | undefined;
  listServers(): McpServerConfig[];
  listServerStates(): Map<string, McpServerState>;
  hasServer(id: string): boolean;

  setTools(serverId: string, tools: McpToolWireFormat[]): void;
  setPrompts(serverId: string, prompts: McpPromptDefinition[]): void;
  setResources(serverId: string, resources: McpResourceDefinition[]): void;

  setStatus(
    serverId: string,
    status: McpServerState["status"],
    error?: string,
  ): void;

  loadFromConfig(path: string): void;
  watchConfig(path: string): void;
  stopWatching(): void;

  on(handler: McpRegistryEventHandler): () => void;
  emit(event: McpRegistryEvent): void;

  readonly connectionConfig: McpConnectionConfig;
  readonly selectionConfig: McpSelectionConfig;
}

/**
 * Create an MCP registry instance.
 */
export function createMcpRegistry(
  options: McpRegistryOptions = {},
): McpRegistry {
  const {
    configPath,
    watchConfig = false,
    connection = {},
    selection = {},
  } = options;

  const servers = new Map<string, McpServerConfig>();
  const states = new Map<string, McpServerState>();
  const handlers: McpRegistryEventHandler[] = [];
  let watchController: { close: () => void } | null = null;

  const connectionConfig: McpConnectionConfig = {
    strategy: connection.strategy ?? "persistent",
    healthCheckInterval: connection.healthCheckInterval ?? 60000,
    maxIdleTime: connection.maxIdleTime ?? 300000,
    reconnectAttempts: connection.reconnectAttempts ?? 3,
  };

  const selectionConfig: McpSelectionConfig = {
    maxToolsPerRequest: selection.maxToolsPerRequest ?? 10,
    strategy: selection.strategy ?? "keyword",
    priorityDomains: selection.priorityDomains,
  };

  function emit(event: McpRegistryEvent): void {
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in registry event handler:", error);
      }
    }
  }

  const registry: McpRegistry = {
    connectionConfig,
    selectionConfig,

    add(server: McpServerConfig): void {
      if (servers.has(server.id)) {
        throw new Error(`Server ${server.id} already exists`);
      }

      servers.set(server.id, server);
      states.set(server.id, createServerState(server));

      emit({ type: "server:added", serverId: server.id, config: server });
    },

    remove(serverId: string): void {
      if (!servers.has(serverId)) {
        return;
      }

      servers.delete(serverId);
      states.delete(serverId);

      emit({ type: "server:removed", serverId });
    },

    update(serverId: string, updates: Partial<McpServerConfig>): void {
      const existing = servers.get(serverId);
      if (!existing) {
        throw new Error(`Server ${serverId} does not exist`);
      }

      const updated = {
        ...existing,
        ...updates,
        id: serverId,
      } as McpServerConfig;
      servers.set(serverId, updated);

      const state = states.get(serverId);
      if (state) {
        state.config = updated;
      }

      emit({ type: "server:updated", serverId, config: updated });
    },

    getServer(id: string): McpServerConfig | undefined {
      return servers.get(id);
    },

    getServerState(id: string): McpServerState | undefined {
      return states.get(id);
    },

    listServers(): McpServerConfig[] {
      return Array.from(servers.values());
    },

    listServerStates(): Map<string, McpServerState> {
      return new Map(states);
    },

    hasServer(id: string): boolean {
      return servers.has(id);
    },

    setTools(serverId: string, tools: McpToolWireFormat[]): void {
      const state = states.get(serverId);
      if (!state) {
        throw new Error(`Server ${serverId} does not exist`);
      }

      state.tools = tools;
      state.metadata = computeMetadata(
        tools,
        state.config.domain,
        state.config.tags,
      );

      emit({ type: "tools:changed", serverId });
    },

    setPrompts(serverId: string, prompts: McpPromptDefinition[]): void {
      const state = states.get(serverId);
      if (!state) {
        throw new Error(`Server ${serverId} does not exist`);
      }

      state.prompts = prompts;
    },

    setResources(serverId: string, resources: McpResourceDefinition[]): void {
      const state = states.get(serverId);
      if (!state) {
        throw new Error(`Server ${serverId} does not exist`);
      }

      state.resources = resources;
    },

    setStatus(
      serverId: string,
      status: McpServerState["status"],
      error?: string,
    ): void {
      const state = states.get(serverId);
      if (!state) {
        throw new Error(`Server ${serverId} does not exist`);
      }

      const previousStatus = state.status;
      state.status = status;
      state.error = error;

      if (status === "connected" && previousStatus !== "connected") {
        emit({ type: "server:connected", serverId });
      } else if (status === "disconnected" && previousStatus === "connected") {
        emit({ type: "server:disconnected", serverId });
      } else if (status === "error") {
        emit({
          type: "server:error",
          serverId,
          error: error ?? "Unknown error",
        });
      }
    },

    loadFromConfig(path: string): void {
      if (!existsSync(path)) {
        throw new Error(`Config file not found: ${path}`);
      }

      const content = readFileSync(path, "utf-8");
      const config = JSON.parse(content) as McpConfigFile;

      if (!config.servers || typeof config.servers !== "object") {
        throw new Error("Config file must have a 'servers' object");
      }

      const currentIds = new Set(servers.keys());
      const newIds = new Set<string>();

      for (const [id, input] of Object.entries(config.servers)) {
        newIds.add(id);

        try {
          const serverConfig = parseServerConfig(id, input);

          if (currentIds.has(id)) {
            registry.update(id, serverConfig);
          } else {
            registry.add(serverConfig);
          }
        } catch (error) {
          console.error(`Error processing server ${id}:`, error);
        }
      }

      const currentIdsArray = Array.from(currentIds);
      for (let i = 0; i < currentIdsArray.length; i++) {
        const id = currentIdsArray[i];
        if (id && !newIds.has(id)) {
          registry.remove(id);
        }
      }

      if (config.selection) {
        Object.assign(selectionConfig, config.selection);
      }

      if (config.connection) {
        Object.assign(connectionConfig, config.connection);
      }
    },

    watchConfig(path: string): void {
      registry.stopWatching();

      if (!existsSync(path)) {
        console.warn(
          `Config file not found, watching will start when created: ${path}`,
        );
      }

      const watcher = fsWatch(path, { persistent: false }, (eventType) => {
        if (eventType === "change") {
          console.log(`MCP config changed, reloading: ${path}`);
          try {
            registry.loadFromConfig(path);
          } catch (error) {
            console.error("Error reloading config:", error);
          }
        }
      });

      watchController = { close: () => watcher.close() };
    },

    stopWatching(): void {
      if (watchController) {
        watchController.close();
        watchController = null;
      }
    },

    on(handler: McpRegistryEventHandler): () => void {
      handlers.push(handler);

      return () => {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      };
    },

    emit,
  };

  if (configPath && existsSync(configPath)) {
    registry.loadFromConfig(configPath);

    if (watchConfig) {
      registry.watchConfig(configPath);
    }
  }

  return registry;
}
