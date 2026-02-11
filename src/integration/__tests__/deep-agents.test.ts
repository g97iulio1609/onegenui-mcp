import { describe, it, expect, vi } from "vitest";
import { createMcpExecutor } from "../deep-agents.js";

// =============================================================================
// Helpers
// =============================================================================

function createMockConnectionManager(overrides?: {
  callToolResult?: unknown;
  callToolError?: Error;
  getClientError?: Error;
}) {
  const mockClient = {
    config: { timeout: 30_000 },
    callTool: overrides?.callToolError
      ? vi.fn().mockRejectedValue(overrides.callToolError)
      : vi.fn().mockResolvedValue(
          overrides?.callToolResult ?? {
            content: [{ type: "text", text: "tool result" }],
            isError: false,
          },
        ),
  };
  return {
    getClient: overrides?.getClientError
      ? vi.fn().mockRejectedValue(overrides.getClientError)
      : vi.fn().mockResolvedValue(mockClient),
    _mockClient: mockClient,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("createMcpExecutor", () => {
  it("should return an executor function", () => {
    const cm = createMockConnectionManager();
    const executor = createMcpExecutor(cm as any);
    expect(typeof executor).toBe("function");
  });

  it("should call getClient with the serverId", async () => {
    const cm = createMockConnectionManager();
    const executor = createMcpExecutor(cm as any);

    await executor("my-server", "search", { query: "test" });

    expect(cm.getClient).toHaveBeenCalledWith("my-server");
  });

  it("should call callTool with the correct arguments", async () => {
    const cm = createMockConnectionManager();
    const executor = createMcpExecutor(cm as any);

    await executor("srv", "search", { query: "hello" });

    expect(cm._mockClient.callTool).toHaveBeenCalledWith(
      "search",
      { query: "hello" },
      { timeoutMs: 30_000 },
    );
  });

  it("should return text content from successful tool call", async () => {
    const cm = createMockConnectionManager({
      callToolResult: {
        content: [{ type: "text", text: "search results" }],
        isError: false,
      },
    });
    const executor = createMcpExecutor(cm as any);

    const result = await executor("srv", "search", {});

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toBe("search results");
  });

  it("should return error content when tool reports isError", async () => {
    const cm = createMockConnectionManager({
      callToolResult: {
        content: [{ type: "text", text: "something went wrong" }],
        isError: true,
      },
    });
    const executor = createMcpExecutor(cm as any);

    const result = await executor("srv", "broken", {});

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("something went wrong");
  });

  it("should handle structuredContent response", async () => {
    const cm = createMockConnectionManager({
      callToolResult: {
        content: [],
        isError: false,
        structuredContent: { key: "value" },
      },
    });
    const executor = createMcpExecutor(cm as any);

    const result = await executor("srv", "tool", {});

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toBe(JSON.stringify({ key: "value" }));
  });

  it("should catch exceptions and return isError", async () => {
    const cm = createMockConnectionManager({
      callToolError: new Error("connection lost"),
    });
    const executor = createMcpExecutor(cm as any);

    const result = await executor("srv", "tool", {});

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("connection lost");
  });

  it("should catch getClient errors and return isError", async () => {
    const cm = createMockConnectionManager({
      getClientError: new Error("server not found"),
    });
    const executor = createMcpExecutor(cm as any);

    const result = await executor("unknown-srv", "tool", {});

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("server not found");
  });

  it("should pass empty object when args is null", async () => {
    const cm = createMockConnectionManager();
    const executor = createMcpExecutor(cm as any);

    await executor("srv", "tool", null);

    expect(cm._mockClient.callTool).toHaveBeenCalledWith(
      "tool",
      {},
      expect.any(Object),
    );
  });

  it("should use default timeout when client config has no timeout", async () => {
    const mockClient = {
      config: {},
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "ok" }],
        isError: false,
      }),
    };
    const cm = {
      getClient: vi.fn().mockResolvedValue(mockClient),
    };
    const executor = createMcpExecutor(cm as any);

    await executor("srv", "tool", {});

    expect(mockClient.callTool).toHaveBeenCalledWith(
      "tool",
      {},
      { timeoutMs: 45_000 },
    );
  });
});
