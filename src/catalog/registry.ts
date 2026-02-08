/**
 * MCP App Catalog Registry
 *
 * Static registry of pre-configured MCP server templates
 * that users can browse and install from the marketplace.
 */
import type { McpAppCatalogEntry } from "./types";

// =============================================================================
// Catalog entries
// =============================================================================

export const MCP_APP_CATALOG: readonly McpAppCatalogEntry[] = [
  {
    id: "github",
    name: "GitHub",
    description:
      "Access repositories, issues, pull requests, and code search. Manage your GitHub workflow directly through AI.",
    icon: "github",
    category: "development",
    transport: "stdio",
    configTemplate: {
      transport: "stdio",
      name: "GitHub",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
      domain: "vcs",
      tags: ["git", "github", "code", "repository", "issues", "pull-requests"],
    },
    requiredEnvVars: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    oauthConfig: {
      authUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      scopes: ["repo", "read:org"],
    },
  },
  {
    id: "filesystem",
    name: "Filesystem",
    description:
      "Read, write, and manage files on your local filesystem. Navigate directories, search for files, and edit content.",
    icon: "folder",
    category: "filesystem",
    transport: "stdio",
    configTemplate: {
      transport: "stdio",
      name: "Filesystem",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      domain: "files",
      tags: ["files", "filesystem", "directory", "read", "write"],
    },
    requiredEnvVars: [],
  },
  {
    id: "sqlite",
    name: "SQLite",
    description:
      "Query and manage SQLite databases. Run SQL queries, inspect schemas, and perform data analysis on local databases.",
    icon: "database",
    category: "data",
    transport: "stdio",
    configTemplate: {
      transport: "stdio",
      name: "SQLite",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sqlite", ""],
      domain: "data",
      tags: ["database", "sql", "sqlite", "query", "data"],
    },
    requiredEnvVars: [],
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description:
      "Search the web using the Brave Search API. Get real-time search results, news, and web content for research.",
    icon: "search",
    category: "productivity",
    transport: "stdio",
    configTemplate: {
      transport: "stdio",
      name: "Brave Search",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: "" },
      domain: "web",
      tags: ["search", "web", "brave", "internet", "research"],
    },
    requiredEnvVars: ["BRAVE_API_KEY"],
  },
  {
    id: "fetch",
    name: "Fetch",
    description:
      "Fetch and extract content from any URL. Retrieve web pages, APIs, and online resources for analysis.",
    icon: "globe",
    category: "productivity",
    transport: "stdio",
    configTemplate: {
      transport: "stdio",
      name: "Fetch",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-fetch"],
      domain: "web",
      tags: ["fetch", "http", "url", "web", "api", "scrape"],
    },
    requiredEnvVars: [],
  },
] as const;

// =============================================================================
// Catalog query helpers
// =============================================================================

/**
 * Get all catalog entries.
 */
export function getAllCatalogEntries(): readonly McpAppCatalogEntry[] {
  return MCP_APP_CATALOG;
}

/**
 * Get a single catalog entry by ID.
 */
export function getCatalogEntry(id: string): McpAppCatalogEntry | undefined {
  return MCP_APP_CATALOG.find((entry) => entry.id === id);
}

/**
 * Filter catalog entries by category.
 */
export function getCatalogByCategory(
  category: McpAppCatalogEntry["category"],
): readonly McpAppCatalogEntry[] {
  return MCP_APP_CATALOG.filter((entry) => entry.category === category);
}

/**
 * Search catalog entries by name or description.
 */
export function searchCatalog(query: string): readonly McpAppCatalogEntry[] {
  const lower = query.toLowerCase();
  return MCP_APP_CATALOG.filter(
    (entry) =>
      entry.name.toLowerCase().includes(lower) ||
      entry.description.toLowerCase().includes(lower),
  );
}
