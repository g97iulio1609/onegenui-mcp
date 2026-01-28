import {
  resolveEnvVars,
  resolveServerEnv
} from "./chunk-VOMRNL7O.mjs";

// src/schema.ts
import { zodToJsonSchema as zodToJsonSchemaLib } from "zod-to-json-schema";
function zodToMcpSchema(schema, options = {}) {
  const { target = "jsonSchema7", useReferences = false, name } = options;
  const result = zodToJsonSchemaLib(schema, {
    target,
    $refStrategy: useReferences ? "root" : "none",
    name
  });
  if (!useReferences) {
    const cleaned = { ...result };
    delete cleaned.$schema;
    delete cleaned.$id;
    if (name && cleaned.definitions?.[name]) {
      const inner = cleaned.definitions[name];
      delete cleaned.definitions;
      return { ...cleaned, ...inner };
    }
    if (!cleaned.type) {
      cleaned.type = "object";
    }
    if (cleaned.type !== "object") {
      return {
        type: "object",
        properties: { value: cleaned },
        required: ["value"]
      };
    }
    return cleaned;
  }
  const refResult = result;
  if (!refResult.type) {
    refResult.type = "object";
  }
  return refResult;
}
function emptyInputSchema() {
  return {
    type: "object",
    properties: {},
    additionalProperties: false
  };
}
function mergeSchemas(...schemas) {
  const merged = {
    type: "object",
    properties: {},
    required: []
  };
  for (const schema of schemas) {
    if (schema.properties) {
      merged.properties = { ...merged.properties, ...schema.properties };
    }
    if (schema.required && Array.isArray(schema.required)) {
      const existing = merged.required;
      const combined = [...existing, ...schema.required];
      const unique = {};
      for (const item of combined) {
        unique[item] = true;
      }
      merged.required = Object.keys(unique);
    }
  }
  if (merged.required.length === 0) {
    delete merged.required;
  }
  return merged;
}
function validateMcpSchema(schema) {
  const errors = [];
  if (schema.type !== "object") {
    errors.push(
      `inputSchema must have type 'object', got '${schema.type ?? "undefined"}'`
    );
  }
  if (schema.$ref && !schema.$defs && !schema.definitions) {
    errors.push("$ref used without $defs or definitions");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function extractSchemaMetadata(schema) {
  const keywords = [];
  let description;
  try {
    const def = schema._def;
    if (def?.description) {
      description = def.description;
      const words = description.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3 && !stopWords[word]) {
          keywords.push(word);
        }
      }
    }
  } catch {
  }
  return { description, keywords };
}
var STOP_WORDS = [
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "been",
  "be",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its"
];
var stopWords = {};
for (let i = 0; i < STOP_WORDS.length; i++) {
  const word = STOP_WORDS[i];
  if (word) {
    stopWords[word] = true;
  }
}

// src/define.ts
import { z } from "zod";
function defineMcpTool(config) {
  const { name, title, description, parameters, domain, tags, execute } = config;
  const inputSchema = zodToMcpSchema(parameters);
  return {
    name,
    title,
    description,
    parameters,
    inputSchema,
    domain,
    tags,
    execute
  };
}
function defineMcpPrompt(config) {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    arguments: config.arguments
  };
}
function defineMcpServer(config) {
  if (config.transport === "stdio") {
    const stdioConfig = {
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
      timeout: config.timeout
    };
    return stdioConfig;
  }
  const httpConfig = {
    id: config.id,
    name: config.name,
    transport: "http",
    url: config.url,
    headers: config.headers,
    domain: config.domain,
    tags: config.tags,
    enabled: config.enabled ?? true,
    timeout: config.timeout
  };
  return httpConfig;
}
function toolFromWireFormat(wireFormat, options) {
  const parameters = z.object({}).passthrough();
  return {
    name: wireFormat.name,
    title: wireFormat.title,
    description: wireFormat.description ?? "",
    parameters,
    inputSchema: wireFormat.inputSchema,
    outputSchema: wireFormat.outputSchema,
    domain: options?.domain,
    tags: options?.tags
  };
}
function extractToolMetadata(tool) {
  const keywords = [];
  const nameParts = tool.name.split("_");
  for (const part of nameParts) {
    if (part.length > 2) {
      keywords.push(part.toLowerCase());
    }
  }
  if (tool.description) {
    const words = tool.description.toLowerCase().split(/\s+/);
    for (const word of words) {
      const cleaned = word.replace(/[^a-z0-9]/g, "");
      if (cleaned.length > 3) {
        keywords.push(cleaned);
      }
    }
  }
  if (tool.tags) {
    for (const tag of tool.tags) {
      keywords.push(tag.toLowerCase());
    }
  }
  const uniqueKeywords = {};
  for (const kw of keywords) {
    uniqueKeywords[kw] = true;
  }
  return {
    name: tool.name,
    description: tool.description,
    domain: tool.domain,
    tags: tool.tags ?? [],
    keywords: Object.keys(uniqueKeywords)
  };
}

// src/registry.ts
import { readFileSync, existsSync, watch as fsWatch } from "fs";

// src/registry/config-parser.ts
function parseServerConfig(id, input) {
  const base = {
    id,
    name: input.name,
    domain: input.domain,
    tags: input.tags,
    enabled: input.enabled ?? true,
    timeout: input.timeout
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
      cwd: input.cwd
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
      toolsetExport: input.toolsetExport
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
      headers: input.headers
    };
  }
  throw new Error(`Server ${id}: unknown transport '${input.transport}'`);
}
function createServerState(config) {
  return {
    config,
    status: "disconnected"
  };
}
function computeMetadata(tools, serverDomain, serverTags) {
  const domains = {};
  const tags = {};
  const toolNames = [];
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
    domains: Object.keys(domains),
    tags: Object.keys(tags),
    toolNames,
    lastRefreshed: /* @__PURE__ */ new Date()
  };
}

// src/registry.ts
function createMcpRegistry(options = {}) {
  const {
    configPath,
    watchConfig = false,
    connection = {},
    selection = {}
  } = options;
  const servers = /* @__PURE__ */ new Map();
  const states = /* @__PURE__ */ new Map();
  const handlers = [];
  let watchController = null;
  const connectionConfig = {
    strategy: connection.strategy ?? "persistent",
    healthCheckInterval: connection.healthCheckInterval ?? 6e4,
    maxIdleTime: connection.maxIdleTime ?? 3e5,
    reconnectAttempts: connection.reconnectAttempts ?? 3
  };
  const selectionConfig = {
    maxToolsPerRequest: selection.maxToolsPerRequest ?? 10,
    strategy: selection.strategy ?? "keyword",
    priorityDomains: selection.priorityDomains
  };
  function emit(event) {
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in registry event handler:", error);
      }
    }
  }
  const registry = {
    connectionConfig,
    selectionConfig,
    add(server) {
      if (servers.has(server.id)) {
        throw new Error(`Server ${server.id} already exists`);
      }
      servers.set(server.id, server);
      states.set(server.id, createServerState(server));
      emit({ type: "server:added", serverId: server.id, config: server });
    },
    remove(serverId) {
      if (!servers.has(serverId)) {
        return;
      }
      servers.delete(serverId);
      states.delete(serverId);
      emit({ type: "server:removed", serverId });
    },
    update(serverId, updates) {
      const existing = servers.get(serverId);
      if (!existing) {
        throw new Error(`Server ${serverId} does not exist`);
      }
      const updated = {
        ...existing,
        ...updates,
        id: serverId
      };
      servers.set(serverId, updated);
      const state = states.get(serverId);
      if (state) {
        state.config = updated;
      }
      emit({ type: "server:updated", serverId, config: updated });
    },
    getServer(id) {
      return servers.get(id);
    },
    getServerState(id) {
      return states.get(id);
    },
    listServers() {
      return Array.from(servers.values());
    },
    listServerStates() {
      return new Map(states);
    },
    hasServer(id) {
      return servers.has(id);
    },
    setTools(serverId, tools) {
      const state = states.get(serverId);
      if (!state) {
        throw new Error(`Server ${serverId} does not exist`);
      }
      state.tools = tools;
      state.metadata = computeMetadata(
        tools,
        state.config.domain,
        state.config.tags
      );
      emit({ type: "tools:changed", serverId });
    },
    setPrompts(serverId, prompts) {
      const state = states.get(serverId);
      if (!state) {
        throw new Error(`Server ${serverId} does not exist`);
      }
      state.prompts = prompts;
    },
    setResources(serverId, resources) {
      const state = states.get(serverId);
      if (!state) {
        throw new Error(`Server ${serverId} does not exist`);
      }
      state.resources = resources;
    },
    setStatus(serverId, status, error) {
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
          error: error ?? "Unknown error"
        });
      }
    },
    loadFromConfig(path) {
      if (!existsSync(path)) {
        throw new Error(`Config file not found: ${path}`);
      }
      const content = readFileSync(path, "utf-8");
      const config = JSON.parse(content);
      if (!config.servers || typeof config.servers !== "object") {
        throw new Error("Config file must have a 'servers' object");
      }
      const currentIds = new Set(servers.keys());
      const newIds = /* @__PURE__ */ new Set();
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
    watchConfig(path) {
      registry.stopWatching();
      if (!existsSync(path)) {
        console.warn(
          `Config file not found, watching will start when created: ${path}`
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
    stopWatching() {
      if (watchController) {
        watchController.close();
        watchController = null;
      }
    },
    on(handler) {
      handlers.push(handler);
      return () => {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      };
    },
    emit
  };
  if (configPath && existsSync(configPath)) {
    registry.loadFromConfig(configPath);
    if (watchConfig) {
      registry.watchConfig(configPath);
    }
  }
  return registry;
}

// src/tool-selection/constants.ts
var STOP_WORDS2 = {
  the: true,
  a: true,
  an: true,
  and: true,
  or: true,
  but: true,
  in: true,
  on: true,
  at: true,
  to: true,
  for: true,
  of: true,
  with: true,
  by: true,
  from: true,
  as: true,
  is: true,
  was: true,
  are: true,
  were: true,
  been: true,
  be: true,
  have: true,
  has: true,
  had: true,
  do: true,
  does: true,
  did: true,
  will: true,
  would: true,
  could: true,
  should: true,
  may: true,
  might: true,
  must: true,
  shall: true,
  can: true,
  this: true,
  that: true,
  these: true,
  those: true,
  it: true,
  its: true,
  get: true,
  set: true,
  use: true,
  want: true,
  need: true,
  like: true,
  help: true,
  please: true,
  how: true,
  what: true,
  when: true,
  where: true,
  why: true,
  who: true
};

// src/tool-selection/keyword-extractor.ts
function extractKeywords(text) {
  const words = text.toLowerCase().split(/\s+/);
  const keywords = [];
  for (const word of words) {
    const cleaned = word.replace(/[^a-z0-9]/g, "");
    if (cleaned.length > 2 && !STOP_WORDS2[cleaned]) {
      keywords.push(cleaned);
    }
  }
  return keywords;
}

// src/tool-selection/domain-inferrer.ts
var DOMAIN_KEYWORDS = {
  files: [
    "file",
    "folder",
    "directory",
    "read",
    "write",
    "create",
    "delete",
    "move",
    "copy",
    "path",
    "filesystem",
    "storage",
    "upload",
    "download"
  ],
  vcs: [
    "git",
    "github",
    "commit",
    "branch",
    "merge",
    "pull",
    "push",
    "repository",
    "repo",
    "clone",
    "checkout",
    "diff",
    "pr",
    "issue",
    "code",
    "review"
  ],
  web: [
    "http",
    "https",
    "url",
    "fetch",
    "request",
    "response",
    "api",
    "rest",
    "graphql",
    "scrape",
    "crawl",
    "browser",
    "page",
    "website"
  ],
  data: [
    "database",
    "sql",
    "query",
    "table",
    "record",
    "insert",
    "update",
    "select",
    "mongodb",
    "postgres",
    "mysql",
    "redis",
    "cache",
    "data",
    "json"
  ],
  ops: [
    "deploy",
    "build",
    "run",
    "execute",
    "command",
    "shell",
    "terminal",
    "process",
    "service",
    "docker",
    "kubernetes",
    "container",
    "server",
    "monitor"
  ],
  comm: [
    "email",
    "message",
    "send",
    "notify",
    "slack",
    "discord",
    "chat",
    "sms",
    "notification",
    "alert",
    "webhook"
  ],
  finance: [
    "payment",
    "invoice",
    "billing",
    "stripe",
    "transaction",
    "money",
    "currency",
    "price",
    "subscription",
    "charge"
  ],
  security: [
    "auth",
    "login",
    "password",
    "token",
    "secret",
    "encrypt",
    "decrypt",
    "permission",
    "access",
    "oauth",
    "jwt",
    "credential"
  ],
  ai: [
    "ai",
    "ml",
    "model",
    "predict",
    "generate",
    "embed",
    "vector",
    "llm",
    "openai",
    "anthropic",
    "gemini",
    "inference"
  ],
  travel: [
    "flight",
    "flights",
    "airline",
    "airport",
    "booking",
    "travel",
    "trip",
    "destination",
    "departure",
    "arrival",
    "hotel",
    "hotels",
    "accommodation",
    "reservation",
    "itinerary",
    "vacation",
    "roundtrip",
    "oneway",
    "layover",
    "stopover",
    "passenger",
    "baggage",
    "luggage",
    "boarding",
    "ticket",
    "fare",
    "kiwi"
  ],
  custom: []
};
function inferDomains(keywords) {
  const domainScores = {
    files: 0,
    vcs: 0,
    web: 0,
    data: 0,
    ops: 0,
    comm: 0,
    finance: 0,
    security: 0,
    ai: 0,
    travel: 0,
    custom: 0
  };
  for (const keyword of keywords) {
    for (const domain of Object.keys(DOMAIN_KEYWORDS)) {
      const domainKeywords = DOMAIN_KEYWORDS[domain];
      for (const dk of domainKeywords) {
        if (keyword.includes(dk) || dk.includes(keyword)) {
          domainScores[domain]++;
        }
      }
    }
  }
  return Object.entries(domainScores).filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]).map(([domain]) => domain);
}

// src/selection.ts
function scoreTool(tool, serverId, serverDomain, serverTags, promptKeywords, inferredDomains, context) {
  let score = 0;
  const matchReasons = [];
  const toolKeywords = [];
  const nameParts = tool.name.split("_");
  for (const part of nameParts) {
    toolKeywords.push(part.toLowerCase());
  }
  if (tool.description) {
    const descKeywords = extractKeywords(tool.description);
    for (const kw of descKeywords) {
      toolKeywords.push(kw);
    }
  }
  if (tool.title) {
    const titleKeywords = extractKeywords(tool.title);
    for (const kw of titleKeywords) {
      toolKeywords.push(kw);
    }
  }
  let keywordMatches = 0;
  for (const promptKw of promptKeywords) {
    for (const toolKw of toolKeywords) {
      if (promptKw === toolKw) {
        keywordMatches++;
        matchReasons.push(`exact: ${promptKw}`);
      } else if (promptKw.includes(toolKw) || toolKw.includes(promptKw)) {
        keywordMatches += 0.5;
        matchReasons.push(`partial: ${promptKw}~${toolKw}`);
      }
    }
  }
  score += Math.min(keywordMatches * 0.1, 0.5);
  const effectiveDomain = serverDomain;
  if (effectiveDomain && inferredDomains.includes(effectiveDomain)) {
    const domainIndex = inferredDomains.indexOf(effectiveDomain);
    score += 0.3 - domainIndex * 0.05;
    matchReasons.push(`domain: ${effectiveDomain}`);
  }
  if (serverTags && serverTags.length > 0) {
    let tagMatches = 0;
    for (const tag of serverTags) {
      for (const promptKw of promptKeywords) {
        if (tag.toLowerCase() === promptKw) {
          tagMatches++;
          matchReasons.push(`tag: ${tag}`);
        }
      }
    }
    score += Math.min(tagMatches * 0.1, 0.2);
  }
  if (context.includeDomains && effectiveDomain) {
    if (context.includeDomains.includes(effectiveDomain)) {
      score += 0.2;
      matchReasons.push(`include: ${effectiveDomain}`);
    }
  }
  if (context.excludeDomains && effectiveDomain) {
    if (context.excludeDomains.includes(effectiveDomain)) {
      score = 0;
      matchReasons.length = 0;
      matchReasons.push(`excluded: ${effectiveDomain}`);
    }
  }
  return {
    tool,
    serverId,
    score: Math.min(score, 1),
    // Cap at 1
    matchReasons
  };
}
function selectToolsForPrompt(serverStates, context, options = {}) {
  const {
    maxTools = 10,
    minScore = 0.1,
    includePriorityDomains = true
  } = options;
  const promptKeywords = extractKeywords(context.prompt);
  if (context.currentFile) {
    const fileKeywords = extractKeywords(context.currentFile);
    for (const kw of fileKeywords) {
      promptKeywords.push(kw);
    }
  }
  if (context.userIntent) {
    const intentKeywords = extractKeywords(context.userIntent);
    for (const kw of intentKeywords) {
      promptKeywords.push(kw);
    }
  }
  const inferredDomains = inferDomains(promptKeywords);
  const scoredTools = [];
  const entries = serverStates instanceof Map ? Array.from(serverStates.entries()) : Object.entries(serverStates);
  for (const [serverId, state] of entries) {
    if (state.config.enabled === false) continue;
    if (state.status === "error") continue;
    if (!state.tools || state.tools.length === 0) continue;
    for (const tool of state.tools) {
      const scored = scoreTool(
        tool,
        serverId,
        state.config.domain,
        state.config.tags,
        promptKeywords,
        inferredDomains,
        context
      );
      if (scored.score >= minScore) {
        scoredTools.push(scored);
      }
    }
  }
  scoredTools.sort((a, b) => b.score - a.score);
  return scoredTools.slice(0, maxTools);
}
function getAllTools(serverStates) {
  const tools = [];
  const entries = serverStates instanceof Map ? Array.from(serverStates.entries()) : Object.entries(serverStates);
  for (const [serverId, state] of entries) {
    if (state.config.enabled === false) continue;
    if (!state.tools) continue;
    for (const tool of state.tools) {
      tools.push({ tool, serverId });
    }
  }
  return tools;
}
function getToolsByDomain(serverStates, domain) {
  const tools = [];
  const entries = serverStates instanceof Map ? Array.from(serverStates.entries()) : Object.entries(serverStates);
  for (const [serverId, state] of entries) {
    if (state.config.enabled === false) continue;
    if (state.config.domain !== domain) continue;
    if (!state.tools) continue;
    for (const tool of state.tools) {
      tools.push({ tool, serverId });
    }
  }
  return tools;
}
export {
  createMcpRegistry,
  defineMcpPrompt,
  defineMcpServer,
  defineMcpTool,
  emptyInputSchema,
  extractSchemaMetadata,
  extractToolMetadata,
  getAllTools,
  getToolsByDomain,
  mergeSchemas,
  resolveEnvVars,
  resolveServerEnv,
  selectToolsForPrompt,
  toolFromWireFormat,
  validateMcpSchema,
  zodToMcpSchema
};
//# sourceMappingURL=index.mjs.map