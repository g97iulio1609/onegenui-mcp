// ─────────────────────────────────────────────────────────────────────────────
// Tool Selector Ports
// Hexagonal architecture interfaces for MCP tool selection
// ─────────────────────────────────────────────────────────────────────────────

import type { McpToolWireFormat } from "../types";

/**
 * Alias for tool type (used throughout this module)
 */
export type MCPTool = McpToolWireFormat;

/**
 * Score result from a tool scorer
 */
export interface ToolScore {
  /** The tool being scored */
  tool: MCPTool;
  /** Overall score (0-1) */
  score: number;
  /** Breakdown of score components */
  breakdown?: {
    /** Keyword match score */
    keywordScore: number;
    /** Domain relevance score */
    domainScore: number;
    /** Context relevance score */
    contextScore: number;
  };
}

/**
 * Selection context for scoring tools
 */
export interface SelectionContext {
  /** The user's query/prompt */
  query: string;
  /** Extracted keywords from the query */
  keywords: string[];
  /** Detected domain(s) */
  domains: string[];
  /** Conversation history (optional) */
  conversationHistory?: string[];
  /** User preferences (optional) */
  userPreferences?: Record<string, unknown>;
}

/**
 * Configuration for tool selection
 */
export interface ToolSelectionConfig {
  /** Maximum number of tools to return */
  maxTools: number;
  /** Minimum score threshold (0-1) */
  minScore: number;
  /** Weight for keyword matching */
  keywordWeight: number;
  /** Weight for domain relevance */
  domainWeight: number;
  /** Weight for context relevance */
  contextWeight: number;
}

/**
 * Default selection configuration
 */
export const DEFAULT_SELECTION_CONFIG: ToolSelectionConfig = {
  maxTools: 10,
  minScore: 0.1,
  keywordWeight: 0.4,
  domainWeight: 0.35,
  contextWeight: 0.25,
};

// ─────────────────────────────────────────────────────────────────────────────
// Port Interfaces (Hexagonal Architecture)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Port for extracting keywords from user queries
 */
export interface KeywordExtractorPort {
  /**
   * Extract keywords from a query string
   * @param query - The user's query
   * @returns Array of extracted keywords (lowercase, deduplicated)
   */
  extractKeywords(query: string): string[];
}

/**
 * Port for inferring domain(s) from user queries
 */
export interface DomainInferrerPort {
  /**
   * Infer relevant domains from a query
   * @param query - The user's query
   * @returns Array of inferred domain names
   */
  inferDomains(query: string): string[];
}

/**
 * Port for scoring individual tools
 */
export interface ToolScorerPort {
  /**
   * Score a single tool against the selection context
   * @param tool - The tool to score
   * @param context - The selection context
   * @param config - Configuration for scoring weights
   * @returns Tool score with breakdown
   */
  scoreTool(
    tool: MCPTool,
    context: SelectionContext,
    config: ToolSelectionConfig,
  ): ToolScore;

  /**
   * Score multiple tools (batch operation for efficiency)
   * @param tools - Tools to score
   * @param context - The selection context
   * @param config - Configuration for scoring weights
   * @returns Sorted array of tool scores (highest first)
   */
  scoreTools(
    tools: MCPTool[],
    context: SelectionContext,
    config: ToolSelectionConfig,
  ): ToolScore[];
}

/**
 * Port for selecting tools based on user query
 */
export interface ToolSelectorPort {
  /**
   * Select the most relevant tools for a user query
   * @param tools - Available tools to select from
   * @param query - The user's query
   * @param config - Optional configuration overrides
   * @returns Selected tools with scores
   */
  selectTools(
    tools: MCPTool[],
    query: string,
    config?: Partial<ToolSelectionConfig>,
  ): ToolScore[];
}

/**
 * Port for caching keyword indices
 */
export interface KeywordIndexPort {
  /**
   * Build keyword index for a set of tools
   * @param tools - Tools to index
   */
  buildIndex(tools: MCPTool[]): void;

  /**
   * Get tools matching a keyword
   * @param keyword - Keyword to search
   * @returns Array of tool names matching the keyword
   */
  getToolsForKeyword(keyword: string): string[];

  /**
   * Check if index is built
   */
  isIndexed(): boolean;

  /**
   * Clear the index
   */
  clearIndex(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Caching Port (7.2.4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cached query result
 */
export interface CachedQueryResult {
  /** The query that was cached */
  query: string;
  /** Selected tools */
  tools: ToolScore[];
  /** Timestamp when cached */
  timestamp: number;
  /** Time-to-live in milliseconds */
  ttl: number;
}

/**
 * Port for caching query results
 */
export interface QueryCachePort {
  /**
   * Get cached result for a query
   * @param query - The query to look up
   * @returns Cached result or undefined if not found/expired
   */
  get(query: string): CachedQueryResult | undefined;

  /**
   * Set cached result for a query
   * @param query - The query to cache
   * @param tools - The selected tools
   * @param ttl - Time-to-live in milliseconds (default: 5 minutes)
   */
  set(query: string, tools: ToolScore[], ttl?: number): void;

  /**
   * Clear the cache
   */
  clear(): void;

  /**
   * Get cache statistics
   */
  stats(): { size: number; hits: number; misses: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Scorer Port (7.4 - Future Embeddings)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semantic similarity score result
 */
export interface SemanticScore {
  /** The tool being scored */
  tool: MCPTool;
  /** Semantic similarity score (0-1) */
  similarity: number;
  /** Confidence of the similarity (0-1) */
  confidence?: number;
}

/**
 * Port for semantic/embedding-based tool scoring
 * This is a placeholder for future embedding integration
 */
export interface SemanticScorerPort {
  /**
   * Score tools based on semantic similarity to query
   * @param query - The user's query
   * @param tools - Tools to score
   * @returns Array of tools with semantic similarity scores
   */
  scoreSemanticSimilarity(
    query: string,
    tools: MCPTool[],
  ): Promise<SemanticScore[]>;

  /**
   * Check if the semantic scorer is available
   * (Embedding service might not always be available)
   */
  isAvailable(): boolean;

  /**
   * Get embedding for a text (for debugging/caching)
   * @param text - Text to embed
   * @returns Embedding vector or undefined if not available
   */
  getEmbedding?(text: string): Promise<number[] | undefined>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined Hybrid Scorer Port
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Port for hybrid scoring (keyword + semantic)
 */
export interface HybridScorerPort {
  /**
   * Score tools using hybrid approach
   * Falls back to keyword-only if semantic is unavailable
   * @param tools - Tools to score
   * @param context - Selection context
   * @param config - Configuration
   * @returns Tool scores combining keyword and semantic scores
   */
  scoreTools(
    tools: MCPTool[],
    context: SelectionContext,
    config: ToolSelectionConfig & {
      /** Weight for semantic similarity (default: 0.3) */
      semanticWeight?: number;
    },
  ): Promise<ToolScore[]>;
}
