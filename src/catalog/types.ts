/**
 * MCP App Catalog Types
 *
 * Defines the schema for marketplace entries that users can browse
 * and install as MCP server configurations.
 */
import type {
  McpServerConfigStdio,
  McpServerConfigHttp,
} from "../types";

// =============================================================================
// Category taxonomy
// =============================================================================

export type McpAppCategory =
  | "productivity"
  | "development"
  | "data"
  | "communication"
  | "filesystem";

// =============================================================================
// OAuth configuration (for apps requiring authentication)
// =============================================================================

export interface McpAppOAuthConfig {
  /** OAuth2 authorization URL */
  authUrl: string;
  /** OAuth2 token exchange URL */
  tokenUrl: string;
  /** Required OAuth scopes */
  scopes: string[];
}

// =============================================================================
// Config template: distribute Omit over the union
// =============================================================================

type McpServerConfigTemplate =
  | Omit<McpServerConfigStdio, "id"> & { id?: string }
  | Omit<McpServerConfigHttp, "id"> & { id?: string };

// =============================================================================
// Catalog entry
// =============================================================================

export interface McpAppCatalogEntry {
  /** Unique catalog entry identifier */
  id: string;
  /** Human-readable app name */
  name: string;
  /** Short description of what the app provides */
  description: string;
  /** SVG icon path or emoji */
  icon: string;
  /** App category for filtering */
  category: McpAppCategory;
  /** Transport protocol used by this app */
  transport: "stdio" | "http";
  /** Pre-configured server config template */
  configTemplate: McpServerConfigTemplate;
  /** Environment variables the user must provide */
  requiredEnvVars?: string[];
  /** OAuth configuration if app requires auth */
  oauthConfig?: McpAppOAuthConfig;
}
