/**
 * Tool Orchestration Module
 *
 * Defines workflow patterns for composing tools into pipelines.
 * Supports sequential, parallel, and conditional execution.
 */

import type { McpToolWireFormat, McpDomain } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execution mode for a workflow step
 */
export type ExecutionMode = "sequential" | "parallel" | "conditional";

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: Error;
  duration: number;
}

/**
 * A single step in a workflow
 */
export interface WorkflowStep {
  id: string;
  toolName: string;
  description?: string;
  /** Input mapping: how to get inputs from previous step outputs */
  inputMapping?: Record<string, string>;
  /** Condition for execution (for conditional mode) */
  condition?: (context: WorkflowContext) => boolean;
  /** Timeout in ms */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

/**
 * A workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  /** Domain(s) this workflow applies to */
  domains: McpDomain[];
  /** Steps in execution order */
  steps: WorkflowStep[];
  /** Execution mode */
  mode: ExecutionMode;
  /** Initial input schema */
  inputSchema?: Record<string, unknown>;
  /** Expected output schema */
  outputSchema?: Record<string, unknown>;
}

/**
 * Context passed through workflow execution
 */
export interface WorkflowContext {
  /** Workflow ID */
  workflowId: string;
  /** Current step index */
  currentStepIndex: number;
  /** Results from previous steps */
  stepResults: Map<string, ToolExecutionResult>;
  /** Accumulated data */
  data: Record<string, unknown>;
  /** Start timestamp */
  startTime: number;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Result of workflow execution
 */
export interface WorkflowResult {
  workflowId: string;
  success: boolean;
  stepResults: ToolExecutionResult[];
  data: Record<string, unknown>;
  duration: number;
  error?: Error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Port for executing individual tools
 */
export interface ToolExecutorPort {
  execute(
    toolName: string,
    input: Record<string, unknown>,
    options?: { timeout?: number; signal?: AbortSignal },
  ): Promise<ToolExecutionResult>;
}

/**
 * Port for workflow execution
 */
export interface WorkflowExecutorPort {
  execute(
    workflow: Workflow,
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<WorkflowResult>;
}

/**
 * Port for workflow registry
 */
export interface WorkflowRegistryPort {
  register(workflow: Workflow): void;
  get(workflowId: string): Workflow | undefined;
  getByDomain(domain: McpDomain): Workflow[];
  list(): Workflow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-defined Workflow Templates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Web research workflow: search → scrape → extract
 */
export const WEB_RESEARCH_WORKFLOW: Workflow = {
  id: "web-research",
  name: "Web Research",
  description:
    "Search the web, scrape results, and extract relevant information",
  domains: ["web"],
  mode: "sequential",
  steps: [
    {
      id: "search",
      toolName: "web-search",
      description: "Search for relevant pages",
    },
    {
      id: "scrape",
      toolName: "web-scrape",
      description: "Scrape content from search results",
      inputMapping: {
        urls: "search.data.urls",
      },
    },
    {
      id: "extract",
      toolName: "web-extract",
      description: "Extract structured data from scraped content",
      inputMapping: {
        content: "scrape.data.content",
      },
    },
  ],
};

/**
 * Data analysis workflow: fetch → transform → visualize
 */
export const DATA_ANALYSIS_WORKFLOW: Workflow = {
  id: "data-analysis",
  name: "Data Analysis",
  description: "Fetch data, transform it, and create visualizations",
  domains: ["data"],
  mode: "sequential",
  steps: [
    {
      id: "fetch",
      toolName: "data-fetch",
      description: "Fetch raw data",
    },
    {
      id: "transform",
      toolName: "data-transform",
      description: "Clean and transform data",
      inputMapping: {
        data: "fetch.data.result",
      },
    },
    {
      id: "visualize",
      toolName: "data-visualize",
      description: "Create visualization",
      inputMapping: {
        data: "transform.data.result",
      },
    },
  ],
};

/**
 * File management workflow: list → filter → process
 */
export const FILE_MANAGEMENT_WORKFLOW: Workflow = {
  id: "file-management",
  name: "File Management",
  description: "List files, filter by criteria, and process them",
  domains: ["files"],
  mode: "sequential",
  steps: [
    {
      id: "list",
      toolName: "list-files",
      description: "List files in directory",
    },
    {
      id: "filter",
      toolName: "filter-files",
      description: "Filter files by criteria",
      inputMapping: {
        files: "list.data.files",
      },
    },
    {
      id: "process",
      toolName: "process-files",
      description: "Process filtered files",
      inputMapping: {
        files: "filter.data.files",
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Registry Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a workflow registry
 */
export function createWorkflowRegistry(): WorkflowRegistryPort {
  const workflows = new Map<string, Workflow>();

  return {
    register(workflow: Workflow): void {
      workflows.set(workflow.id, workflow);
    },

    get(workflowId: string): Workflow | undefined {
      return workflows.get(workflowId);
    },

    getByDomain(domain: McpDomain): Workflow[] {
      return Array.from(workflows.values()).filter((w) =>
        w.domains.includes(domain),
      );
    },

    list(): Workflow[] {
      return Array.from(workflows.values());
    },
  };
}

/**
 * Create a registry pre-populated with default workflows
 */
export function createDefaultWorkflowRegistry(): WorkflowRegistryPort {
  const registry = createWorkflowRegistry();
  registry.register(WEB_RESEARCH_WORKFLOW);
  registry.register(DATA_ANALYSIS_WORKFLOW);
  registry.register(FILE_MANAGEMENT_WORKFLOW);
  return registry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Executor Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve input mapping using context data
 */
function resolveInputMapping(
  mapping: Record<string, string> | undefined,
  context: WorkflowContext,
): Record<string, unknown> {
  if (!mapping) return {};

  const result: Record<string, unknown> = {};

  for (const [key, path] of Object.entries(mapping)) {
    const parts = path.split(".");
    const stepId = parts[0];
    const dataPath = parts.slice(1);

    const stepResult = context.stepResults.get(stepId);
    if (stepResult?.data) {
      let value: unknown = stepResult.data;
      for (const part of dataPath) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }
      result[key] = value;
    }
  }

  return result;
}

/**
 * Create a workflow executor
 */
export function createWorkflowExecutor(
  toolExecutor: ToolExecutorPort,
): WorkflowExecutorPort {
  return {
    async execute(
      workflow: Workflow,
      input: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<WorkflowResult> {
      const startTime = Date.now();
      const context: WorkflowContext = {
        workflowId: workflow.id,
        currentStepIndex: 0,
        stepResults: new Map(),
        data: { ...input },
        startTime,
        signal: options?.signal,
      };

      const stepResults: ToolExecutionResult[] = [];
      let lastError: Error | undefined;

      try {
        if (workflow.mode === "sequential") {
          // Sequential execution
          for (const step of workflow.steps) {
            if (options?.signal?.aborted) {
              throw new Error("Workflow aborted");
            }

            // Check condition
            if (step.condition && !step.condition(context)) {
              continue;
            }

            // Resolve inputs
            const stepInput = {
              ...context.data,
              ...resolveInputMapping(step.inputMapping, context),
            };

            // Execute with retry
            let result: ToolExecutionResult | undefined;
            let attempts = 0;
            const maxAttempts = step.retry?.maxAttempts ?? 1;

            while (attempts < maxAttempts && !result?.success) {
              if (attempts > 0) {
                await new Promise((r) =>
                  setTimeout(r, step.retry?.backoffMs ?? 1000),
                );
              }
              attempts++;

              result = await toolExecutor.execute(step.toolName, stepInput, {
                timeout: step.timeout,
                signal: options?.signal,
              });
            }

            if (result) {
              context.stepResults.set(step.id, result);
              stepResults.push(result);

              if (result.data) {
                context.data = { ...context.data, [step.id]: result.data };
              }

              if (!result.success) {
                lastError = result.error;
                break;
              }
            }

            context.currentStepIndex++;
          }
        } else if (workflow.mode === "parallel") {
          // Parallel execution
          const promises = workflow.steps.map(async (step) => {
            if (step.condition && !step.condition(context)) {
              return null;
            }

            const stepInput = {
              ...context.data,
              ...resolveInputMapping(step.inputMapping, context),
            };

            return toolExecutor.execute(step.toolName, stepInput, {
              timeout: step.timeout,
              signal: options?.signal,
            });
          });

          const results = await Promise.all(promises);

          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result) {
              const step = workflow.steps[i];
              context.stepResults.set(step.id, result);
              stepResults.push(result);

              if (result.data) {
                context.data = { ...context.data, [step.id]: result.data };
              }

              if (!result.success && !lastError) {
                lastError = result.error;
              }
            }
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      return {
        workflowId: workflow.id,
        success: !lastError,
        stepResults,
        data: context.data,
        duration: Date.now() - startTime,
        error: lastError,
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Dependency Graph
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tool dependency definition
 */
export interface ToolDependency {
  toolName: string;
  /** Tools that must run before this tool */
  dependsOn: string[];
  /** Tools that can run after this tool */
  enables: string[];
}

/**
 * Port for managing tool dependencies
 */
export interface ToolDependencyGraphPort {
  /** Add a dependency */
  addDependency(toolName: string, dependsOn: string): void;
  /** Get direct dependencies */
  getDependencies(toolName: string): string[];
  /** Get all transitive dependencies */
  getAllDependencies(toolName: string): string[];
  /** Check if a tool can run given completed tools */
  canRun(toolName: string, completedTools: Set<string>): boolean;
  /** Get tools that are now runnable */
  getRunnableTools(completedTools: Set<string>, allTools: string[]): string[];
}

/**
 * Create a tool dependency graph
 */
export function createToolDependencyGraph(): ToolDependencyGraphPort {
  const dependencies = new Map<string, Set<string>>();

  const getAllDeps = (
    toolName: string,
    visited = new Set<string>(),
  ): string[] => {
    if (visited.has(toolName)) return [];
    visited.add(toolName);

    const direct = dependencies.get(toolName) ?? new Set();
    const all = new Set(direct);

    for (const dep of direct) {
      for (const transitive of getAllDeps(dep, visited)) {
        all.add(transitive);
      }
    }

    return Array.from(all);
  };

  return {
    addDependency(toolName: string, dependsOn: string): void {
      if (!dependencies.has(toolName)) {
        dependencies.set(toolName, new Set());
      }
      dependencies.get(toolName)!.add(dependsOn);
    },

    getDependencies(toolName: string): string[] {
      return Array.from(dependencies.get(toolName) ?? []);
    },

    getAllDependencies(toolName: string): string[] {
      return getAllDeps(toolName);
    },

    canRun(toolName: string, completedTools: Set<string>): boolean {
      const deps = this.getDependencies(toolName);
      return deps.every((dep) => completedTools.has(dep));
    },

    getRunnableTools(
      completedTools: Set<string>,
      allTools: string[],
    ): string[] {
      return allTools.filter(
        (tool) =>
          !completedTools.has(tool) && this.canRun(tool, completedTools),
      );
    },
  };
}
