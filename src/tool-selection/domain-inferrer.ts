/**
 * Domain inference from keywords
 */

import type { McpDomain } from "../types";

/**
 * Domain keyword mappings for inference
 */
export const DOMAIN_KEYWORDS: Record<McpDomain, string[]> = {
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
    "download",
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
    "review",
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
    "website",
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
    "json",
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
    "monitor",
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
    "webhook",
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
    "charge",
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
    "credential",
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
    "inference",
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
    "kiwi",
  ],
  custom: [],
};

/**
 * Infer relevant domains from prompt keywords
 * Returns domains sorted by relevance score
 */
export function inferDomains(keywords: string[]): McpDomain[] {
  const domainScores: Record<McpDomain, number> = {
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
    custom: 0,
  };

  for (const keyword of keywords) {
    for (const domain of Object.keys(DOMAIN_KEYWORDS) as McpDomain[]) {
      const domainKeywords = DOMAIN_KEYWORDS[domain];
      for (const dk of domainKeywords) {
        if (keyword.includes(dk) || dk.includes(keyword)) {
          domainScores[domain]++;
        }
      }
    }
  }

  // Return domains with score > 0, sorted by score descending
  return Object.entries(domainScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([domain]) => domain as McpDomain);
}

/**
 * Check if a domain matches any of the inferred domains
 */
export function domainMatches(
  domain: McpDomain | undefined,
  inferredDomains: McpDomain[],
): { matches: boolean; rank: number } {
  if (!domain) return { matches: false, rank: -1 };

  const rank = inferredDomains.indexOf(domain);
  return { matches: rank >= 0, rank };
}
