/**
 * @onegenui/mcp/catalog — Client-safe catalog subpath
 *
 * This entry point exports ONLY the static app catalog data and types.
 * It has zero Node.js dependencies (no `fs`, `child_process`, etc.)
 * and is safe to import from "use client" components.
 */

export type {
  McpAppCatalogEntry,
  McpAppCategory,
  McpAppOAuthConfig,
} from "./types";

export {
  MCP_APP_CATALOG,
  getAllCatalogEntries,
  getCatalogEntry,
  getCatalogByCategory,
  searchCatalog,
} from "./registry";
