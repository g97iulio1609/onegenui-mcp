/**
 * MCP Security Module
 * 
 * Provides security controls for MCP command execution:
 * - Command whitelist validation
 * - Path sanitization
 * - Environment variable sandboxing
 * - Timeout enforcement
 */

/**
 * Allowed commands for stdio transport
 * Only these commands can be executed via MCP
 */
export const ALLOWED_COMMANDS = new Set([
  // Node.js
  "node",
  "npx",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  
  // Python
  "python",
  "python3",
  "pip",
  "pip3",
  "uv",
  "uvx",
  
  // Other common runtimes
  "deno",
  "go",
  "ruby",
  
  // MCP-specific
  "mcp-server-fetch",
  "mcp-server-filesystem",
  "mcp-server-sqlite",
]);

/**
 * Dangerous environment variables that should not be passed through
 */
const BLOCKED_ENV_VARS = new Set([
  "PATH", // Prevent PATH manipulation
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
]);

/**
 * Allowed environment variables that can be passed
 */
const ALLOWED_ENV_VARS = new Set([
  "NODE_ENV",
  "HOME",
  "USER",
  "LANG",
  "LC_ALL",
  "TZ",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  // API keys are allowed (user's responsibility)
]);

export interface SecurityValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a command for MCP execution
 */
export function validateCommand(command: string): SecurityValidationResult {
  // Extract base command (first word)
  const parts = command.split(/\s+/);
  const baseCommand = parts[0] ?? "";
  const pathParts = baseCommand.split("/");
  const commandName = pathParts[pathParts.length - 1] ?? baseCommand;
  
  if (!ALLOWED_COMMANDS.has(commandName)) {
    return {
      valid: false,
      error: `Command '${commandName}' is not in the allowed commands whitelist. Allowed: ${Array.from(ALLOWED_COMMANDS).join(", ")}`,
    };
  }
  
  // Check for shell injection patterns
  const dangerousPatterns = [
    /[;&|`$()]/,  // Shell metacharacters
    /\.\./,       // Path traversal
    /\/etc\//,    // System paths
    /\/proc\//,
    /\/sys\//,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return {
        valid: false,
        error: `Command contains potentially dangerous pattern: ${pattern.toString()}`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Validate command arguments
 */
export function validateArgs(args: string[]): SecurityValidationResult {
  for (const arg of args) {
    // Check for shell injection in arguments
    if (/[;&|`$()]/.test(arg) && !arg.startsWith("-")) {
      return {
        valid: false,
        error: `Argument '${arg}' contains shell metacharacters`,
      };
    }
    
    // Check for path traversal
    if (arg.includes("..") && !arg.startsWith("-")) {
      return {
        valid: false,
        error: `Argument '${arg}' contains path traversal`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Sanitize environment variables for subprocess
 * Only allows safe variables
 */
export function sanitizeEnv(
  env?: Record<string, string>,
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  if (!env) return sanitized;
  
  for (const [key, value] of Object.entries(env)) {
    // Block dangerous variables
    if (BLOCKED_ENV_VARS.has(key)) {
      continue;
    }
    
    // Allow explicitly allowed or prefixed with allowed patterns
    if (
      ALLOWED_ENV_VARS.has(key) ||
      key.startsWith("OPENAI_") ||
      key.startsWith("ANTHROPIC_") ||
      key.startsWith("GOOGLE_") ||
      key.startsWith("GEMINI_") ||
      key.startsWith("MCP_")
    ) {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Default timeout for tool calls (30 seconds)
 */
export const DEFAULT_TOOL_TIMEOUT_MS = 30_000;

/**
 * Maximum timeout for tool calls (5 minutes)
 */
export const MAX_TOOL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Validate timeout value
 */
export function validateTimeout(timeoutMs?: number): number {
  if (timeoutMs === undefined) {
    return DEFAULT_TOOL_TIMEOUT_MS;
  }
  
  if (timeoutMs <= 0) {
    return DEFAULT_TOOL_TIMEOUT_MS;
  }
  
  return Math.min(timeoutMs, MAX_TOOL_TIMEOUT_MS);
}

/**
 * Add a command to the allowed list at runtime
 * Use with caution - should only be called during app initialization
 */
export function allowCommand(command: string): void {
  ALLOWED_COMMANDS.add(command);
}

/**
 * Check if a command is allowed
 */
export function isCommandAllowed(command: string): boolean {
  const commandName = command.split("/").pop() ?? command;
  return ALLOWED_COMMANDS.has(commandName);
}
