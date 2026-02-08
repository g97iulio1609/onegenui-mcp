import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/client/index.ts", "src/integration/index.ts", "src/catalog/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["zod", "ai", "@modelcontextprotocol/sdk", "chokidar"],
});
