// src/integration/ai-sdk.ts
import { tool, jsonSchema } from "ai";
var DEBUG = process.env.NODE_ENV === "development";
var DEFAULT_TOOL_TIMEOUT_MS = 45e3;
var MIN_TOOL_TIMEOUT_MS = 5e3;
var MAX_TOOL_TIMEOUT_MS = 3e5;
function normalizeTimeout(timeoutMs) {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_TOOL_TIMEOUT_MS;
  }
  return Math.min(MAX_TOOL_TIMEOUT_MS, Math.max(MIN_TOOL_TIMEOUT_MS, timeoutMs));
}
function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId = null;
  return new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
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
function convertToAiSdkSchema(mcpSchema) {
  return jsonSchema(mcpSchema);
}
function createAiSdkTool(mcpTool, serverId, connectionManager) {
  const toolName = mcpTool.name;
  return tool({
    description: mcpTool.description ?? "",
    inputSchema: convertToAiSdkSchema(
      mcpTool.inputSchema ?? { type: "object" }
    ),
    execute: async (args) => {
      if (DEBUG) console.log(`[MCP Tool] Calling: ${toolName}`, args);
      try {
        const client = await connectionManager.getClient(serverId);
        const timeoutMs = normalizeTimeout(client.config.timeout);
        const result = await withTimeout(
          client.callTool(toolName, args, {
            timeoutMs
          }),
          timeoutMs,
          `MCP tool '${toolName}' timed out after ${timeoutMs}ms`
        );
        if (result.structuredContent !== void 0) {
          return result.structuredContent;
        }
        const textContent = result.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
        if (textContent) {
          try {
            return JSON.parse(textContent);
          } catch {
            return textContent;
          }
        }
        return result;
      } catch (error) {
        console.error(`[MCP Tool] Error calling ${toolName}:`, error);
        throw error;
      }
    }
  });
}
async function createToolsetFromMcp(connectionManager, selectedTools) {
  const toolset = {};
  for (const { tool: mcpTool, serverId } of selectedTools) {
    toolset[mcpTool.name] = createAiSdkTool(
      mcpTool,
      serverId,
      connectionManager
    );
  }
  return toolset;
}
async function createFullToolsetFromMcp(registry, connectionManager) {
  const toolset = {};
  const states = registry.listServerStates();
  const entries = Array.from(states.entries());
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const [serverId, state] = entry;
    if (state.config.enabled === false) continue;
    if (!state.tools) continue;
    for (const mcpTool of state.tools) {
      toolset[mcpTool.name] = createAiSdkTool(
        mcpTool,
        serverId,
        connectionManager
      );
    }
  }
  return toolset;
}
async function loadMcpTools(options) {
  const { registry, connectionManager, serverIds, connect = true } = options;
  const servers = registry.listServers();
  const targetServers = serverIds ? servers.filter((s) => serverIds.includes(s.id)) : servers.filter((s) => s.enabled !== false);
  if (connect) {
    const connectPromises = targetServers.map(
      (server) => connectionManager.getClient(server.id).catch((error) => {
        console.error(`Failed to connect to ${server.id}:`, error);
        return null;
      })
    );
    await Promise.all(connectPromises);
  }
  return createFullToolsetFromMcp(registry, connectionManager);
}

// src/integration/prompt.ts
function generateMcpToolsPrompt(tools) {
  if (tools.length === 0) {
    return "";
  }
  const lines = [
    "## Available Tools",
    "",
    "You have access to the following tools:",
    ""
  ];
  for (const item of tools) {
    const tool2 = "tool" in item ? item.tool : item;
    lines.push(`### ${tool2.name}`);
    if (tool2.description) {
      lines.push(tool2.description);
    }
    if (tool2.inputSchema.properties) {
      const props = tool2.inputSchema.properties;
      const required = tool2.inputSchema.required || [];
      lines.push("");
      lines.push("**Parameters:**");
      for (const [name, schema] of Object.entries(props)) {
        const isRequired = required.includes(name);
        const typeStr = schema.type ?? "any";
        const descStr = schema.description ? ` - ${schema.description}` : "";
        const reqStr = isRequired ? " (required)" : "";
        lines.push(`- \`${name}\`: ${typeStr}${reqStr}${descStr}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
function generateToolsSummary(tools) {
  if (tools.length === 0) {
    return "No tools available.";
  }
  const toolNames = tools.map((item) => {
    const tool2 = "tool" in item ? item.tool : item;
    return tool2.name;
  });
  return `Available tools: ${toolNames.join(", ")}`;
}
function generateToolResultPrompt(toolName, result, isError = false) {
  const prefix = isError ? "Tool Error" : "Tool Result";
  const resultStr = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  return `### ${prefix}: ${toolName}

\`\`\`
${resultStr}
\`\`\``;
}
function generateServerStatusPrompt(serverStates, options = {}) {
  const {
    includeToolCounts = true,
    includeStatus = true,
    includeDomains = true
  } = options;
  const lines = ["## MCP Servers", ""];
  const entries = serverStates instanceof Map ? Array.from(serverStates.entries()) : Object.entries(serverStates);
  for (const [id, state] of entries) {
    const parts = [];
    if (includeStatus) {
      parts.push(`status: ${state.status}`);
    }
    if (includeDomains && state.config.domain) {
      parts.push(`domain: ${state.config.domain}`);
    }
    if (includeToolCounts && state.metadata) {
      parts.push(`tools: ${state.metadata.toolCount}`);
    }
    const name = state.config.name ?? id;
    lines.push(`- **${name}** (${parts.join(", ")})`);
  }
  return lines.join("\n");
}
export {
  createFullToolsetFromMcp,
  createToolsetFromMcp,
  generateMcpToolsPrompt,
  generateServerStatusPrompt,
  generateToolResultPrompt,
  generateToolsSummary,
  loadMcpTools
};
//# sourceMappingURL=index.mjs.map