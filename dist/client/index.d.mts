export { a as McpClient, M as McpConnectionManager, b as createConnectionManager, c as createMcpClient } from '../connection-BL2HzUoc.mjs';
import '../registry-BbMCFsfH.mjs';
import 'zod';

type ModuleLoader = () => Promise<unknown>;
/**
 * Register a local module loader for use with MCP local transport.
 */
declare function registerLocalModuleLoader(moduleName: string, loader: ModuleLoader): void;

export { registerLocalModuleLoader };
