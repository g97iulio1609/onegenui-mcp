export { M as McpClient, b as McpConnectionManager, a as createConnectionManager, c as createMcpClient } from '../connection-CKrhf0sP.mjs';
import '../registry-tZBjXpIH.mjs';
import '../types-DQ55WHu1.mjs';
import 'zod';

type ModuleLoader = () => Promise<unknown>;
/**
 * Register a local module loader for use with MCP local transport.
 */
declare function registerLocalModuleLoader(moduleName: string, loader: ModuleLoader): void;

export { registerLocalModuleLoader };
