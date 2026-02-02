import { describe, it, expect } from "vitest";
import {
  ALLOWED_COMMANDS,
  validateCommand,
  validateArgs,
  sanitizeEnv,
  validateTimeout,
  allowCommand,
  isCommandAllowed,
  DEFAULT_TOOL_TIMEOUT_MS,
  MAX_TOOL_TIMEOUT_MS,
} from "./security";

describe("MCP Security", () => {
  describe("ALLOWED_COMMANDS", () => {
    it("includes standard Node.js commands", () => {
      expect(ALLOWED_COMMANDS.has("node")).toBe(true);
      expect(ALLOWED_COMMANDS.has("npx")).toBe(true);
      expect(ALLOWED_COMMANDS.has("npm")).toBe(true);
      expect(ALLOWED_COMMANDS.has("pnpm")).toBe(true);
    });

    it("includes Python commands", () => {
      expect(ALLOWED_COMMANDS.has("python")).toBe(true);
      expect(ALLOWED_COMMANDS.has("python3")).toBe(true);
      expect(ALLOWED_COMMANDS.has("uv")).toBe(true);
    });

    it("does not include dangerous commands", () => {
      expect(ALLOWED_COMMANDS.has("bash")).toBe(false);
      expect(ALLOWED_COMMANDS.has("sh")).toBe(false);
      expect(ALLOWED_COMMANDS.has("curl")).toBe(false);
      expect(ALLOWED_COMMANDS.has("rm")).toBe(false);
    });
  });

  describe("validateCommand", () => {
    it("allows whitelisted commands", () => {
      expect(validateCommand("node")).toEqual({ valid: true });
      expect(validateCommand("npx")).toEqual({ valid: true });
      expect(validateCommand("python3")).toEqual({ valid: true });
    });

    it("rejects non-whitelisted commands", () => {
      const result = validateCommand("bash");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not in the allowed commands whitelist");
    });

    it("extracts command from path", () => {
      expect(validateCommand("/usr/bin/node")).toEqual({ valid: true });
      expect(validateCommand("/usr/local/bin/npx")).toEqual({ valid: true });
    });

    it("detects shell metacharacters", () => {
      // The command "node; rm -rf /" is split by spaces, so "node;" becomes the command
      // which is not in whitelist (it includes the semicolon)
      const result = validateCommand("node; rm -rf /");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not in the allowed");
    });

    it("detects pipe injection", () => {
      const result = validateCommand("node | cat");
      expect(result.valid).toBe(false);
    });

    it("detects command substitution", () => {
      const result = validateCommand("node $(evil)");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateArgs", () => {
    it("allows normal arguments", () => {
      expect(validateArgs(["--version"])).toEqual({ valid: true });
      expect(validateArgs(["-m", "http.server"])).toEqual({ valid: true });
      expect(validateArgs(["index.js", "--port=3000"])).toEqual({ valid: true });
    });

    it("detects shell metacharacters in args", () => {
      const result = validateArgs(["file.js", "; rm -rf /"]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("shell metacharacters");
    });

    it("detects path traversal", () => {
      const result = validateArgs(["../../../etc/passwd"]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("path traversal");
    });

    it("allows flags with special chars", () => {
      expect(validateArgs(["--output=file.json"])).toEqual({ valid: true });
      expect(validateArgs(["-C", "/some/path"])).toEqual({ valid: true });
    });
  });

  describe("sanitizeEnv", () => {
    it("blocks PATH manipulation", () => {
      const result = sanitizeEnv({ PATH: "/evil/path:/usr/bin" });
      expect(result.PATH).toBeUndefined();
    });

    it("blocks LD_PRELOAD", () => {
      const result = sanitizeEnv({ LD_PRELOAD: "/evil.so" });
      expect(result.LD_PRELOAD).toBeUndefined();
    });

    it("allows NODE_ENV", () => {
      const result = sanitizeEnv({ NODE_ENV: "production" });
      expect(result.NODE_ENV).toBe("production");
    });

    it("allows API key prefixed vars", () => {
      const result = sanitizeEnv({
        OPENAI_API_KEY: "sk-xxx",
        ANTHROPIC_API_KEY: "sk-yyy",
        GOOGLE_API_KEY: "key",
      });
      expect(result.OPENAI_API_KEY).toBe("sk-xxx");
      expect(result.ANTHROPIC_API_KEY).toBe("sk-yyy");
      expect(result.GOOGLE_API_KEY).toBe("key");
    });

    it("allows MCP prefixed vars", () => {
      const result = sanitizeEnv({ MCP_SERVER_URL: "http://localhost" });
      expect(result.MCP_SERVER_URL).toBe("http://localhost");
    });

    it("returns empty object for undefined input", () => {
      expect(sanitizeEnv(undefined)).toEqual({});
    });
  });

  describe("validateTimeout", () => {
    it("returns default for undefined", () => {
      expect(validateTimeout(undefined)).toBe(DEFAULT_TOOL_TIMEOUT_MS);
    });

    it("returns default for zero", () => {
      expect(validateTimeout(0)).toBe(DEFAULT_TOOL_TIMEOUT_MS);
    });

    it("returns default for negative", () => {
      expect(validateTimeout(-1000)).toBe(DEFAULT_TOOL_TIMEOUT_MS);
    });

    it("caps at maximum", () => {
      expect(validateTimeout(10 * 60 * 1000)).toBe(MAX_TOOL_TIMEOUT_MS);
    });

    it("allows values within range", () => {
      expect(validateTimeout(60_000)).toBe(60_000);
    });
  });

  describe("allowCommand", () => {
    it("adds command to whitelist", () => {
      expect(isCommandAllowed("customtool")).toBe(false);
      allowCommand("customtool");
      expect(isCommandAllowed("customtool")).toBe(true);
    });
  });

  describe("isCommandAllowed", () => {
    it("returns true for whitelisted", () => {
      expect(isCommandAllowed("node")).toBe(true);
    });

    it("returns false for non-whitelisted", () => {
      expect(isCommandAllowed("evil")).toBe(false);
    });

    it("strips path from command", () => {
      expect(isCommandAllowed("/usr/bin/node")).toBe(true);
    });
  });
});
