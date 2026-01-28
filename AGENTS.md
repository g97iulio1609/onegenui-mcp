# AGENTS.md - @onegenui/mcp

Model Context Protocol (MCP) integration for OneGenUI. Connects AI-generated UIs to external tools.

## Purpose

This package provides:
- **MCP Client**: Connect to MCP servers via stdio/SSE
- **Tool Registry**: Discover, cache, and manage available tools
- **Tool Selection**: AI-assisted tool selection based on user query
- **AI SDK Integration**: Convert MCP tools to Vercel AI SDK format

## File Structure

```
src/
├── index.ts              # Public exports
├── types.ts              # MCP-related types
├── schema.ts             # Zod schemas
├── define.ts             # Tool definition helpers
├── registry.ts           # Tool registry (NEEDS REFACTORING)
├── selection.ts          # Tool selection logic (NEEDS REFACTORING)
├── client/
│   ├── index.ts
│   └── client.ts         # MCP client implementation
└── integration/
    └── index.ts          # AI SDK integration
```

## Key Exports

```typescript
// Client
export { MCPClient } from './client';

// Registry
export { ToolRegistry, createToolRegistry } from './registry';

// Selection
export { selectTools, scoreToolRelevance } from './selection';

// Integration with AI SDK
export { mcpToolsToAISDK } from './integration';

// Types
export type { MCPTool, MCPServer, ToolSelection } from './types';
```

## MCP Server Configuration

```json
// mcp.config.json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/path"]
    },
    "weather": {
      "url": "http://localhost:8080/sse"
    }
  }
}
```

## Development Guidelines

- Support both stdio and SSE transports
- Cache tool schemas for performance
- Handle server disconnections gracefully
- Provide type-safe tool invocation
- Log tool calls for debugging

## Refactoring Priorities (from toBeta.md)

| File | LOC | Priority | Action |
|------|-----|----------|--------|
| `selection.ts` | 565 | P0 | Extract scoring, filtering, caching |
| `registry.ts` | 536 | P1 | Split discovery, caching, management |
| `client/client.ts` | 453 | P1 | Extract connection, messaging |

## Future: Package Consolidation

From `toBeta.md`, this package will merge with `@onegenui/web-search` into `@onegenui/tools`:

```
@onegenui/tools (consolidated)
├── mcp/        # This package (client, registry, selection)
├── search/     # Web search from web-search package
├── browsing/   # Content extraction
└── ports/      # Hexagonal interfaces
```

## Testing

```bash
pnpm --filter @onegenui/mcp type-check
pnpm --filter @onegenui/mcp build
```

## Dependencies

- `@modelcontextprotocol/sdk` ^1.12.0
- `zod-to-json-schema` for schema conversion
- `ai` ^5.0.0 || ^6.0.0 (peer, optional)
- `zod` ^4.0.0 (peer)
