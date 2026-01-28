import type {
  McpServerConfig,
  McpServerConfigInput,
  McpServerState,
  McpToolWireFormat,
  McpDomain,
  McpServerMetadata,
} from "../types";

/**
 * Parse config input to full server config
 */
export function parseServerConfig(
  id: string,
  input: McpServerConfigInput,
): McpServerConfig {
  const base = {
    id,
    name: input.name,
    domain: input.domain,
    tags: input.tags,
    enabled: input.enabled ?? true,
    timeout: input.timeout,
  };

  if (input.transport === "stdio") {
    if (!input.command) {
      throw new Error(`Server ${id}: stdio transport requires 'command'`);
    }
    return {
      ...base,
      transport: "stdio",
      command: input.command,
      args: input.args,
      env: input.env,
      cwd: input.cwd,
    };
  }

  if (input.transport === "local") {
    if (!input.module) {
      throw new Error(`Server ${id}: local transport requires 'module'`);
    }
    return {
      ...base,
      transport: "local",
      module: input.module,
      toolsetExport: input.toolsetExport,
    };
  }

  if (input.transport === "http") {
    if (!input.url) {
      throw new Error(`Server ${id}: http transport requires 'url'`);
    }
    return {
      ...base,
      transport: "http",
      url: input.url,
      headers: input.headers,
    };
  }

  throw new Error(`Server ${id}: unknown transport '${input.transport}'`);
}

/**
 * Create initial server state
 */
export function createServerState(config: McpServerConfig): McpServerState {
  return {
    config,
    status: "disconnected",
  };
}

/**
 * Compute metadata from tools
 */
export function computeMetadata(
  tools: McpToolWireFormat[],
  serverDomain?: McpDomain,
  serverTags?: string[],
): McpServerMetadata {
  const domains: Record<string, true> = {};
  const tags: Record<string, true> = {};
  const toolNames: string[] = [];

  if (serverDomain) {
    domains[serverDomain] = true;
  }

  if (serverTags) {
    for (const tag of serverTags) {
      tags[tag] = true;
    }
  }

  for (const tool of tools) {
    toolNames.push(tool.name);
  }

  return {
    toolCount: tools.length,
    domains: Object.keys(domains) as McpDomain[],
    tags: Object.keys(tags),
    toolNames,
    lastRefreshed: new Date(),
  };
}
