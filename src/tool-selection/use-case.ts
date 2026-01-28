// ─────────────────────────────────────────────────────────────────────────────
// Tool Selection Use Case
// Pure business logic for selecting tools based on user query
// ─────────────────────────────────────────────────────────────────────────────

import type {
  MCPTool,
  ToolScore,
  SelectionContext,
  ToolSelectionConfig,
  KeywordExtractorPort,
  DomainInferrerPort,
  ToolScorerPort,
  ToolSelectorPort,
} from "./ports";
import { DEFAULT_SELECTION_CONFIG } from "./ports";

/**
 * Create a SelectionContext from a query using injected ports
 */
export function createSelectionContext(
  query: string,
  keywordExtractor: KeywordExtractorPort,
  domainInferrer: DomainInferrerPort,
): SelectionContext {
  return {
    query,
    keywords: keywordExtractor.extractKeywords(query),
    domains: domainInferrer.inferDomains(query),
  };
}

/**
 * Main use case: Select tools for a query
 * Orchestrates keyword extraction, domain inference, and scoring
 */
export function selectToolsForQuery(
  tools: MCPTool[],
  query: string,
  deps: {
    keywordExtractor: KeywordExtractorPort;
    domainInferrer: DomainInferrerPort;
    toolScorer: ToolScorerPort;
  },
  config: Partial<ToolSelectionConfig> = {},
): ToolScore[] {
  const fullConfig = { ...DEFAULT_SELECTION_CONFIG, ...config };

  // Build selection context
  const context = createSelectionContext(
    query,
    deps.keywordExtractor,
    deps.domainInferrer,
  );

  // Score all tools
  const scores = deps.toolScorer.scoreTools(tools, context, fullConfig);

  // Filter by minimum score and limit
  return scores
    .filter((s) => s.score >= fullConfig.minScore)
    .slice(0, fullConfig.maxTools);
}

/**
 * Create a ToolSelectorPort implementation using dependency injection
 */
export function createToolSelector(deps: {
  keywordExtractor: KeywordExtractorPort;
  domainInferrer: DomainInferrerPort;
  toolScorer: ToolScorerPort;
}): ToolSelectorPort {
  return {
    selectTools(
      tools: MCPTool[],
      query: string,
      config?: Partial<ToolSelectionConfig>,
    ): ToolScore[] {
      return selectToolsForQuery(tools, query, deps, config);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword Index Implementation (Performance Optimization)
// ─────────────────────────────────────────────────────────────────────────────

import type { KeywordIndexPort, MCPTool as ToolType } from "./ports";
import { extractKeywordsFromSources } from "./keyword-extractor";

/**
 * In-memory keyword index for fast tool lookup
 * Pre-builds an inverted index: keyword -> tool names
 */
export function createKeywordIndex(): KeywordIndexPort {
  // keyword -> Set of tool names
  const index = new Map<string, Set<string>>();
  let indexed = false;

  return {
    buildIndex(tools: ToolType[]): void {
      index.clear();

      for (const tool of tools) {
        // Extract keywords from tool name and description
        const keywords = extractKeywordsFromSources([
          tool.name,
          tool.description || "",
        ]);

        for (const keyword of keywords) {
          if (!index.has(keyword)) {
            index.set(keyword, new Set());
          }
          index.get(keyword)!.add(tool.name);
        }
      }

      indexed = true;
    },

    getToolsForKeyword(keyword: string): string[] {
      const toolNames = index.get(keyword.toLowerCase());
      return toolNames ? Array.from(toolNames) : [];
    },

    isIndexed(): boolean {
      return indexed;
    },

    clearIndex(): void {
      index.clear();
      indexed = false;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter Implementations (Connect ports to existing implementations)
// ─────────────────────────────────────────────────────────────────────────────

import { extractKeywords } from "./keyword-extractor";
import { inferDomains } from "./domain-inferrer";
import { scoreTool as scoreToolImpl, filterAndSortTools } from "./tool-scorer";
import type { McpToolWireFormat } from "../types";

/**
 * Adapter: Existing keyword extractor as KeywordExtractorPort
 */
export function createKeywordExtractorAdapter(): KeywordExtractorPort {
  return {
    extractKeywords(query: string): string[] {
      return extractKeywords(query);
    },
  };
}

/**
 * Adapter: Existing domain inferrer as DomainInferrerPort
 */
export function createDomainInferrerAdapter(): DomainInferrerPort {
  return {
    inferDomains(query: string): string[] {
      // Extract keywords first, then infer domains
      const keywords = extractKeywords(query);
      return inferDomains(keywords);
    },
  };
}

/**
 * Adapter: Existing tool scorer as ToolScorerPort
 */
export function createToolScorerAdapter(): ToolScorerPort {
  return {
    scoreTool(
      tool: McpToolWireFormat,
      context: SelectionContext,
      config: ToolSelectionConfig,
    ): ToolScore {
      // Use existing implementation - adapt to new interface
      const result = scoreToolImpl(
        tool,
        "default", // serverId - not tracked in port interface
        undefined, // serverDomain
        undefined, // serverTags
        context.keywords,
        context.domains,
        { prompt: context.query },
      );
      return {
        tool,
        score: result.score,
        breakdown: {
          keywordScore:
            result.matchReasons.filter(
              (r) => r.startsWith("name:") || r.startsWith("desc:"),
            ).length * 0.1,
          domainScore:
            result.matchReasons.filter((r) => r.startsWith("domain:")).length *
            0.2,
          contextScore: 0, // Not implemented in current scorer
        },
      };
    },

    scoreTools(
      tools: McpToolWireFormat[],
      context: SelectionContext,
      config: ToolSelectionConfig,
    ): ToolScore[] {
      // Score each tool individually
      const scores: ToolScore[] = tools.map((tool) => {
        const result = scoreToolImpl(
          tool,
          "default",
          undefined,
          undefined,
          context.keywords,
          context.domains,
          { prompt: context.query },
        );
        return {
          tool,
          score: result.score,
          breakdown: {
            keywordScore:
              result.matchReasons.filter(
                (r) => r.startsWith("name:") || r.startsWith("desc:"),
              ).length * 0.1,
            domainScore:
              result.matchReasons.filter((r) => r.startsWith("domain:"))
                .length * 0.2,
            contextScore: 0,
          },
        };
      });

      // Sort by score descending and filter
      return filterAndSortTools(
        scores.map((s) => ({
          tool: s.tool,
          serverId: "default",
          score: s.score,
          matchReasons: [],
        })),
        config.minScore,
        config.maxTools,
      ).map((sorted) => {
        const original = scores.find((s) => s.tool.name === sorted.tool.name);
        return (
          original || {
            tool: sorted.tool,
            score: sorted.score,
            breakdown: { keywordScore: 0, domainScore: 0, contextScore: 0 },
          }
        );
      });
    },
  };
}

/**
 * Create a fully-wired ToolSelectorPort using default adapters
 */
export function createDefaultToolSelector(): ToolSelectorPort {
  return createToolSelector({
    keywordExtractor: createKeywordExtractorAdapter(),
    domainInferrer: createDomainInferrerAdapter(),
    toolScorer: createToolScorerAdapter(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Cache Implementation (7.2.4 - LRU Cache)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  QueryCachePort,
  CachedQueryResult,
  SemanticScorerPort,
  SemanticScore,
  HybridScorerPort,
} from "./ports";

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_SIZE = 100;

/**
 * Create an LRU query cache
 */
export function createQueryCache(maxSize = DEFAULT_MAX_SIZE): QueryCachePort {
  const cache = new Map<string, CachedQueryResult>();
  let hits = 0;
  let misses = 0;

  // LRU eviction helper
  const evictOldest = () => {
    if (cache.size >= maxSize) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
  };

  return {
    get(query: string): CachedQueryResult | undefined {
      const result = cache.get(query);

      if (!result) {
        misses++;
        return undefined;
      }

      // Check expiration
      if (Date.now() > result.timestamp + result.ttl) {
        cache.delete(query);
        misses++;
        return undefined;
      }

      // Move to end (most recently used)
      cache.delete(query);
      cache.set(query, result);
      hits++;

      return result;
    },

    set(query: string, tools: ToolScore[], ttl = DEFAULT_TTL): void {
      evictOldest();
      cache.set(query, {
        query,
        tools,
        timestamp: Date.now(),
        ttl,
      });
    },

    clear(): void {
      cache.clear();
      hits = 0;
      misses = 0;
    },

    stats() {
      return { size: cache.size, hits, misses };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Scorer Placeholder (7.4 - Future Embeddings)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a placeholder semantic scorer (returns empty results)
 * Replace this with actual embedding service integration
 */
export function createNoopSemanticScorer(): SemanticScorerPort {
  return {
    async scoreSemanticSimilarity(
      _query: string,
      _tools: MCPTool[],
    ): Promise<SemanticScore[]> {
      // Placeholder: no semantic scoring available
      return [];
    },

    isAvailable(): boolean {
      return false;
    },
  };
}

/**
 * Create a mock semantic scorer for testing
 * Uses simple string similarity (Jaccard index)
 */
export function createMockSemanticScorer(): SemanticScorerPort {
  const tokenize = (text: string): Set<string> =>
    new Set(text.toLowerCase().split(/\W+/).filter(Boolean));

  const jaccardSimilarity = (a: Set<string>, b: Set<string>): number => {
    const intersection = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);
    return union.size > 0 ? intersection.size / union.size : 0;
  };

  return {
    async scoreSemanticSimilarity(
      query: string,
      tools: MCPTool[],
    ): Promise<SemanticScore[]> {
      const queryTokens = tokenize(query);

      return tools.map((tool) => {
        const toolText = `${tool.name} ${tool.description || ""}`;
        const toolTokens = tokenize(toolText);
        const similarity = jaccardSimilarity(queryTokens, toolTokens);

        return {
          tool,
          similarity,
          confidence: 0.5, // Low confidence for mock scorer
        };
      });
    },

    isAvailable(): boolean {
      return true;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hybrid Scorer (Keyword + Semantic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a hybrid scorer that combines keyword and semantic scoring
 */
export function createHybridScorer(deps: {
  keywordScorer: ToolScorerPort;
  semanticScorer: SemanticScorerPort;
}): HybridScorerPort {
  return {
    async scoreTools(
      tools: MCPTool[],
      context: SelectionContext,
      config: ToolSelectionConfig & { semanticWeight?: number },
    ): Promise<ToolScore[]> {
      const semanticWeight = config.semanticWeight ?? 0.3;
      const keywordWeight = 1 - semanticWeight;

      // Always compute keyword scores
      const keywordScores = deps.keywordScorer.scoreTools(
        tools,
        context,
        config,
      );
      const keywordMap = new Map(keywordScores.map((s) => [s.tool.name, s]));

      // Try semantic scoring if available
      if (deps.semanticScorer.isAvailable()) {
        try {
          const semanticScores =
            await deps.semanticScorer.scoreSemanticSimilarity(
              context.query,
              tools,
            );

          // Combine scores
          return keywordScores.map((ks) => {
            const semantic = semanticScores.find(
              (s) => s.tool.name === ks.tool.name,
            );
            const semanticScore = semantic?.similarity ?? 0;

            return {
              tool: ks.tool,
              score: ks.score * keywordWeight + semanticScore * semanticWeight,
              breakdown: {
                ...ks.breakdown,
                contextScore: semanticScore,
              },
            };
          });
        } catch {
          // Fall back to keyword-only on error
          return keywordScores;
        }
      }

      // Semantic not available, return keyword scores
      return keywordScores;
    },
  };
}
