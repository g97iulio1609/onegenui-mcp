import { describe, it, expect } from "vitest";
import { scoreTool, filterAndSortTools, type ScoredTool } from "../tool-scorer";
import type { McpToolWireFormat } from "../../types";

describe("tool-scorer", () => {
  const createMockTool = (
    name: string,
    description?: string,
  ): McpToolWireFormat => ({
    name,
    description,
    inputSchema: { type: "object" as const },
  });

  describe("scoreTool", () => {
    it("should score higher for name keyword matches", () => {
      const tool = createMockTool("read_file", "Reads a file");
      const result = scoreTool(
        tool,
        "server1",
        "files",
        [],
        ["read", "file"],
        ["files"],
        { prompt: "read file" },
      );
      expect(result.score).toBeGreaterThan(0);
      expect(result.matchReasons.length).toBeGreaterThan(0);
    });

    it("should score higher for domain match", () => {
      const tool = createMockTool("list_files", "Lists files");
      const result = scoreTool(
        tool,
        "server1",
        "files",
        [],
        ["list"],
        ["files", "vcs"],
        { prompt: "list" },
      );
      expect(result.matchReasons.some((r) => r.includes("domain"))).toBe(true);
    });

    it("should score higher for primary domain", () => {
      const tool = createMockTool("tool1", "A tool");
      const primaryResult = scoreTool(
        tool,
        "server1",
        "files",
        [],
        [],
        ["files", "vcs"],
        { prompt: "" },
      );
      const secondaryResult = scoreTool(
        tool,
        "server1",
        "vcs",
        [],
        [],
        ["files", "vcs"],
        { prompt: "" },
      );
      expect(primaryResult.score).toBeGreaterThan(secondaryResult.score);
    });

    it("should handle tag matching", () => {
      const tool = createMockTool("tool1", "A tool");
      const result = scoreTool(
        tool,
        "server1",
        undefined,
        ["filesystem", "storage"],
        ["file"],
        [],
        { prompt: "file" },
      );
      expect(result.matchReasons.some((r) => r.includes("tag"))).toBe(true);
    });

    it("should apply priority domain boost", () => {
      const tool = createMockTool("tool1", "A tool");
      const withPriority = scoreTool(tool, "server1", "files", [], [], [], {
        prompt: "",
        priorityDomains: ["files"],
      });
      const withoutPriority = scoreTool(tool, "server1", "files", [], [], [], {
        prompt: "",
      });
      expect(withPriority.score).toBeGreaterThan(withoutPriority.score);
    });

    it("should exclude tools from excluded domains", () => {
      const tool = createMockTool("tool1", "A tool");
      const result = scoreTool(
        tool,
        "server1",
        "files",
        [],
        ["file"],
        ["files"],
        { prompt: "file", excludeDomains: ["files"] },
      );
      expect(result.score).toBe(0);
      expect(result.matchReasons[0]).toContain("excluded");
    });

    it("should cap score at 1", () => {
      const tool = createMockTool(
        "file_read_write_delete",
        "Read write delete files filesystem",
      );
      const result = scoreTool(
        tool,
        "server1",
        "files",
        ["file", "storage", "io"],
        ["file", "read", "write", "delete", "filesystem"],
        ["files"],
        { prompt: "file read write delete", priorityDomains: ["files"] },
      );
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe("filterAndSortTools", () => {
    it("should filter tools below minimum score", () => {
      const tools: ScoredTool[] = [
        {
          tool: createMockTool("t1"),
          serverId: "s1",
          score: 0.5,
          matchReasons: [],
        },
        {
          tool: createMockTool("t2"),
          serverId: "s1",
          score: 0.1,
          matchReasons: [],
        },
        {
          tool: createMockTool("t3"),
          serverId: "s1",
          score: 0.05,
          matchReasons: [],
        },
      ];
      const filtered = filterAndSortTools(tools, 0.1, 10);
      expect(filtered.length).toBe(2);
      expect(filtered.find((t) => t.tool.name === "t3")).toBeUndefined();
    });

    it("should sort by score descending", () => {
      const tools: ScoredTool[] = [
        {
          tool: createMockTool("t1"),
          serverId: "s1",
          score: 0.3,
          matchReasons: [],
        },
        {
          tool: createMockTool("t2"),
          serverId: "s1",
          score: 0.7,
          matchReasons: [],
        },
        {
          tool: createMockTool("t3"),
          serverId: "s1",
          score: 0.5,
          matchReasons: [],
        },
      ];
      const sorted = filterAndSortTools(tools, 0, 10);
      expect(sorted[0].tool.name).toBe("t2");
      expect(sorted[1].tool.name).toBe("t3");
      expect(sorted[2].tool.name).toBe("t1");
    });

    it("should limit to maxTools", () => {
      const tools: ScoredTool[] = [
        {
          tool: createMockTool("t1"),
          serverId: "s1",
          score: 0.5,
          matchReasons: [],
        },
        {
          tool: createMockTool("t2"),
          serverId: "s1",
          score: 0.4,
          matchReasons: [],
        },
        {
          tool: createMockTool("t3"),
          serverId: "s1",
          score: 0.3,
          matchReasons: [],
        },
        {
          tool: createMockTool("t4"),
          serverId: "s1",
          score: 0.2,
          matchReasons: [],
        },
      ];
      const limited = filterAndSortTools(tools, 0, 2);
      expect(limited.length).toBe(2);
    });
  });
});
