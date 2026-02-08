export { M as McpClient, b as McpConnectionManager, a as createConnectionManager, c as createMcpClient } from '../connection-Da54v4n5.js';
import '../registry-BAQ8HZXb.js';
import '../types-DQ55WHu1.js';
import 'zod';

type ModuleLoader = () => Promise<unknown>;
/**
 * Register a local module loader for use with MCP local transport.
 */
declare function registerLocalModuleLoader(moduleName: string, loader: ModuleLoader): void;

export { registerLocalModuleLoader };
