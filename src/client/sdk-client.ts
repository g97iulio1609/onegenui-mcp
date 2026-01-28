import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  McpServerConfig,
  McpServerConfigStdio,
  McpServerConfigHttp,
  McpToolWireFormat,
  McpToolResult,
  McpPromptDefinition,
  McpPromptMessage,
  McpResourceDefinition,
  McpResourceContent,
} from "../types";
import type { McpClient } from "./client";

/**
 * Custom transport that avoids sending the mcp-protocol-version header.
 */
class CompatibleHTTPClientTransport extends StreamableHTTPClientTransport {
  setProtocolVersion(version: string): void {
    // Intentionally ignore protocol version
  }
}

/**
 * Create an MCP client for remote servers (stdio or http).
 */
export function createSdkClient(
  config: McpServerConfigStdio | McpServerConfigHttp,
): McpClient {
  let sdkClient: Client | null = null;
  let isConnected = false;

  return {
    config,

    get connected(): boolean {
      return isConnected;
    },

    async connect(): Promise<void> {
      if (isConnected && sdkClient) {
        return;
      }

      sdkClient = new Client({
        name: `json-render-mcp-${config.id}`,
        version: "1.0.0",
      });

      let transport;

      if (config.transport === "stdio") {
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: config.env,
          cwd: config.cwd,
        });
      } else if (config.transport === "http") {
        transport = new CompatibleHTTPClientTransport(new URL(config.url), {
          requestInit: {
            headers: config.headers,
          },
        });
      } else {
        throw new Error(
          `Unknown transport type: ${(config as McpServerConfig).transport}`,
        );
      }

      await sdkClient.connect(transport);
      isConnected = true;
    },

    async disconnect(): Promise<void> {
      if (sdkClient && isConnected) {
        await sdkClient.close();
        sdkClient = null;
        isConnected = false;
      }
    },

    async listTools(): Promise<McpToolWireFormat[]> {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }

      const result = await sdkClient.listTools();
      return result.tools.map((tool) => ({
        name: tool.name,
        title: (tool as { title?: string }).title,
        description: tool.description,
        inputSchema: tool.inputSchema as McpToolWireFormat["inputSchema"],
      }));
    },

    async callTool(
      name: string,
      args: Record<string, unknown>,
    ): Promise<McpToolResult> {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }

      const result = await sdkClient.callTool({ name, arguments: args });

      return {
        content: (
          result.content as Array<{
            type: string;
            text?: string;
            data?: string;
            mimeType?: string;
            resource?: McpResourceContent;
          }>
        ).map((c) => {
          if (c.type === "text") {
            return { type: "text" as const, text: c.text ?? "" };
          }
          if (c.type === "image") {
            return {
              type: "image" as const,
              data: c.data ?? "",
              mimeType: c.mimeType ?? "",
            };
          }
          return {
            type: "resource" as const,
            resource: c.resource as McpResourceContent,
          };
        }),
        structuredContent: (result as { structuredContent?: unknown })
          .structuredContent,
        isError: (result as { isError?: boolean }).isError,
      };
    },

    async listPrompts(): Promise<McpPromptDefinition[]> {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }

      const result = await sdkClient.listPrompts();
      return result.prompts.map((prompt) => ({
        name: prompt.name,
        title: (prompt as { title?: string }).title,
        description: prompt.description,
        arguments: prompt.arguments?.map((arg) => ({
          name: arg.name,
          description: arg.description,
          required: arg.required,
        })),
      }));
    },

    async getPrompt(
      name: string,
      args?: Record<string, string>,
    ): Promise<McpPromptMessage[]> {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }

      const result = await sdkClient.getPrompt({ name, arguments: args });

      return result.messages.map((msg) => {
        const content = msg.content;
        if (content.type === "text") {
          return {
            role: msg.role,
            content: { type: "text" as const, text: content.text },
          };
        }
        if (content.type === "image") {
          return {
            role: msg.role,
            content: {
              type: "image" as const,
              data: content.data,
              mimeType: content.mimeType,
            },
          };
        }
        return {
          role: msg.role,
          content: {
            type: "resource" as const,
            resource: (content as { resource: McpResourceContent }).resource,
          },
        };
      });
    },

    async listResources(): Promise<McpResourceDefinition[]> {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }

      const result = await sdkClient.listResources();
      return result.resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      }));
    },

    async readResource(uri: string): Promise<McpResourceContent[]> {
      if (!sdkClient || !isConnected) {
        throw new Error("Client not connected");
      }

      const result = await sdkClient.readResource({ uri });
      return result.contents.map((content) => ({
        uri: content.uri,
        mimeType: content.mimeType,
        text: (content as { text?: string }).text,
        blob: (content as { blob?: string }).blob,
      }));
    },
  };
}
