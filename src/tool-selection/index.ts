/**
 * Tool Selection Module
 *
 * Modular tool selection for MCP servers using keyword and domain matching.
 */

// Re-export constants
export { STOP_WORDS } from "./constants";

// Re-export keyword extraction
export {
  extractKeywords,
  extractKeywordsFromSources,
} from "./keyword-extractor";

// Re-export domain inference
export {
  DOMAIN_KEYWORDS,
  inferDomains,
  domainMatches,
} from "./domain-inferrer";

// Re-export tool scoring
export {
  type ScoredTool,
  type ToolSelectionContext,
  scoreTool,
  filterAndSortTools,
} from "./tool-scorer";

// Re-export ports (hexagonal architecture)
export {
  type MCPTool,
  type ToolScore,
  type SelectionContext,
  type ToolSelectionConfig,
  type KeywordExtractorPort,
  type DomainInferrerPort,
  type ToolScorerPort,
  type ToolSelectorPort,
  type KeywordIndexPort,
  // 7.2.4 Query caching
  type CachedQueryResult,
  type QueryCachePort,
  // 7.4 Future embeddings
  type SemanticScore,
  type SemanticScorerPort,
  type HybridScorerPort,
  DEFAULT_SELECTION_CONFIG,
} from "./ports";

// Re-export use cases and adapters
export {
  createSelectionContext,
  selectToolsForQuery,
  createToolSelector,
  createKeywordIndex,
  createKeywordExtractorAdapter,
  createDomainInferrerAdapter,
  createToolScorerAdapter,
  createDefaultToolSelector,
  // 7.2.4 Query caching
  createQueryCache,
  // 7.4 Semantic scoring
  createNoopSemanticScorer,
  createMockSemanticScorer,
  createHybridScorer,
} from "./use-case";

// Re-export tool orchestration (7.3)
export {
  // Types
  type ExecutionMode,
  type ToolExecutionResult,
  type WorkflowStep,
  type Workflow,
  type WorkflowContext,
  type WorkflowResult,
  type ToolDependency,
  // Ports
  type ToolExecutorPort,
  type WorkflowExecutorPort,
  type WorkflowRegistryPort,
  type ToolDependencyGraphPort,
  // Pre-defined workflows
  WEB_RESEARCH_WORKFLOW,
  DATA_ANALYSIS_WORKFLOW,
  FILE_MANAGEMENT_WORKFLOW,
  // Factories
  createWorkflowRegistry,
  createDefaultWorkflowRegistry,
  createWorkflowExecutor,
  createToolDependencyGraph,
} from "./orchestration";

// Re-export types from parent
export type { McpDomain, McpToolWireFormat, McpServerState } from "../types";
