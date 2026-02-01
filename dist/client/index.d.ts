export { a as McpClient, M as McpConnectionManager, b as createConnectionManager, c as createMcpClient } from '../connection-CtoHJQn2.js';
import '../registry-BbMCFsfH.js';
import 'zod';

type ModuleLoader = () => Promise<unknown>;
/**
 * Register a local module loader for use with MCP local transport.
 */
declare function registerLocalModuleLoader(moduleName: string, loader: ModuleLoader): void;

export { registerLocalModuleLoader };
