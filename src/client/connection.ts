import type { McpRegistry } from "../registry";
import type { McpConnectionConfig, McpServerState } from "../types";
import { createMcpClient, type McpClient } from "./client";

const DEFAULT_CONNECT_TIMEOUT_MS = 30000;
const DEFAULT_REFRESH_TIMEOUT_MS = 20000;
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 15000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

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
      },
    );
  });
}

// =============================================================================
// Connection Manager
// =============================================================================

/**
 * Connection manager for MCP clients.
 *
 * Features:
 * - Persistent connections with health checks
 * - Lazy initialization (connect on first use)
 * - Automatic reconnection
 * - listChanged notification handling
 */
export interface McpConnectionManager {
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
export function createConnectionManager(
  registry: McpRegistry,
  config?: Partial<McpConnectionConfig>,
): McpConnectionManager {
  const connectionConfig: McpConnectionConfig = {
    strategy: config?.strategy ?? registry.connectionConfig.strategy,
    healthCheckInterval:
      config?.healthCheckInterval ??
      registry.connectionConfig.healthCheckInterval,
    maxIdleTime: config?.maxIdleTime ?? registry.connectionConfig.maxIdleTime,
    reconnectAttempts:
      config?.reconnectAttempts ?? registry.connectionConfig.reconnectAttempts,
  };

  const clients = new Map<string, McpClient>();
  const pendingConnections = new Map<string, Promise<McpClient>>();
  let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  let healthCheckInFlight = false;

  // Helper to update server state
  function updateState(
    serverId: string,
    status: McpServerState["status"],
    error?: string,
  ): void {
    try {
      registry.setStatus(serverId, status, error);
    } catch {
      // Server might have been removed
    }
  }

  // Helper to refresh tools from a connected client
  async function refreshToolsForClient(
    serverId: string,
    client: McpClient,
  ): Promise<void> {
    try {
      const tools = await withTimeout(
        client.listTools(),
        DEFAULT_REFRESH_TIMEOUT_MS,
        `Refreshing tools timed out for ${serverId}`,
      );
      registry.setTools(serverId, tools);

      // Also refresh prompts and resources
      try {
        const prompts = await withTimeout(
          client.listPrompts(),
          DEFAULT_REFRESH_TIMEOUT_MS,
          `Refreshing prompts timed out for ${serverId}`,
        );
        registry.setPrompts(serverId, prompts);
      } catch {
        // Prompts might not be supported
      }

      try {
        const resources = await withTimeout(
          client.listResources(),
          DEFAULT_REFRESH_TIMEOUT_MS,
          `Refreshing resources timed out for ${serverId}`,
        );
        registry.setResources(serverId, resources);
      } catch {
        // Resources might not be supported
      }
    } catch (error) {
      console.error(`Error refreshing tools for ${serverId}:`, error);
    }
  }

  const manager: McpConnectionManager = {
    async getClient(serverId: string): Promise<McpClient> {
      // Check if already connected
      const existing = clients.get(serverId);
      if (existing?.connected) {
        return existing;
      }

      const pending = pendingConnections.get(serverId);
      if (pending) {
        return pending;
      }

      // Get server config
      const serverConfig = registry.getServer(serverId);
      if (!serverConfig) {
        throw new Error(`Server ${serverId} not found in registry`);
      }

      if (serverConfig.enabled === false) {
        throw new Error(`Server ${serverId} is disabled`);
      }

      const connectPromise = (async (): Promise<McpClient> => {
        const reusedClient = clients.get(serverId);
        const client = reusedClient ?? createMcpClient(serverConfig);
        clients.set(serverId, client);

        // Update state
        updateState(serverId, "connecting");

        try {
          // Connect
          await withTimeout(
            client.connect(),
            serverConfig.timeout ?? DEFAULT_CONNECT_TIMEOUT_MS,
            `Connection timed out for ${serverId}`,
          );
          updateState(serverId, "connected");

          // Refresh tools after connection
          await refreshToolsForClient(serverId, client);

          return client;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
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

    isConnected(serverId: string): boolean {
      const client = clients.get(serverId);
      return client?.connected ?? false;
    },

    async disconnect(serverId: string): Promise<void> {
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

    async disconnectAll(): Promise<void> {
      const disconnectPromises: Promise<void>[] = [];
      const serverIds = Array.from(clients.keys());

      for (let i = 0; i < serverIds.length; i++) {
        const serverId = serverIds[i];
        if (serverId) {
          disconnectPromises.push(manager.disconnect(serverId));
        }
      }

      await Promise.all(disconnectPromises);
    },

    async refreshTools(serverId: string): Promise<void> {
      const client = clients.get(serverId);
      if (client?.connected) {
        await refreshToolsForClient(serverId, client);
      }
    },

    startHealthChecks(): void {
      if (healthCheckInterval) {
        return;
      }

      const interval = connectionConfig.healthCheckInterval ?? 60000;

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
            const timeoutMs =
              serverConfig?.timeout ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;

            if (!client.connected) {
              // Try to reconnect
              try {
                await withTimeout(
                  client.connect(),
                  timeoutMs,
                  `Health-check reconnect timed out for ${serverId}`,
                );
                updateState(serverId, "connected");
                await refreshToolsForClient(serverId, client);
              } catch (error) {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                updateState(serverId, "error", errorMessage);
              }
            } else {
              // Verify connection is still alive by listing tools
              try {
                await withTimeout(
                  client.listTools(),
                  timeoutMs,
                  `Health-check listTools timed out for ${serverId}`,
                );
              } catch {
                updateState(serverId, "disconnected");
                // Will reconnect on next health check or getClient call
              }
            }
          }
        })()
          .catch((error) => {
            console.error("[MCP] Health check loop failed:", error);
          })
          .finally(() => {
            healthCheckInFlight = false;
          });
      }, interval);
    },

    stopHealthChecks(): void {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }
    },
  };

  // Listen for registry events
  registry.on((event) => {
    if (event.type === "server:removed") {
      // Disconnect removed servers
      manager.disconnect(event.serverId).catch(() => {
        // Ignore errors
      });
    }
  });

  return manager;
}
