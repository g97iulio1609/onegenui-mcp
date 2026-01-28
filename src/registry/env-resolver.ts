import type { McpServerConfig } from "../types";

/**
 * Resolve environment variables in a string.
 * Supports ${VAR_NAME} syntax.
 */
export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] ?? "";
  });
}

/**
 * Resolve environment variables in server config.
 */
export function resolveServerEnv(config: McpServerConfig): McpServerConfig {
  if (config.transport === "stdio") {
    const resolvedEnv: Record<string, string> = {};

    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        resolvedEnv[key] = resolveEnvVars(value);
      }
    }

    return {
      ...config,
      command: resolveEnvVars(config.command),
      args: config.args?.map(resolveEnvVars),
      env: Object.keys(resolvedEnv).length > 0 ? resolvedEnv : undefined,
    };
  }

  if (config.transport === "http") {
    const resolvedHeaders: Record<string, string> = {};

    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        resolvedHeaders[key] = resolveEnvVars(value);
      }
    }

    return {
      ...config,
      url: resolveEnvVars(config.url),
      headers:
        Object.keys(resolvedHeaders).length > 0 ? resolvedHeaders : undefined,
    };
  }

  if (config.transport === "local") {
    return {
      ...config,
      module: resolveEnvVars(config.module),
      toolsetExport: config.toolsetExport
        ? resolveEnvVars(config.toolsetExport)
        : undefined,
    };
  }

  return config;
}
