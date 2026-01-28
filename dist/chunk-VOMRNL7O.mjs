// src/registry/env-resolver.ts
function resolveEnvVars(value) {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] ?? "";
  });
}
function resolveServerEnv(config) {
  if (config.transport === "stdio") {
    const resolvedEnv = {};
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        resolvedEnv[key] = resolveEnvVars(value);
      }
    }
    return {
      ...config,
      command: resolveEnvVars(config.command),
      args: config.args?.map(resolveEnvVars),
      env: Object.keys(resolvedEnv).length > 0 ? resolvedEnv : void 0
    };
  }
  if (config.transport === "http") {
    const resolvedHeaders = {};
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        resolvedHeaders[key] = resolveEnvVars(value);
      }
    }
    return {
      ...config,
      url: resolveEnvVars(config.url),
      headers: Object.keys(resolvedHeaders).length > 0 ? resolvedHeaders : void 0
    };
  }
  if (config.transport === "local") {
    return {
      ...config,
      module: resolveEnvVars(config.module),
      toolsetExport: config.toolsetExport ? resolveEnvVars(config.toolsetExport) : void 0
    };
  }
  return config;
}

export {
  resolveEnvVars,
  resolveServerEnv
};
//# sourceMappingURL=chunk-VOMRNL7O.mjs.map