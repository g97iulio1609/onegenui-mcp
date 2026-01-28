import type { z } from "zod";
import { zodToJsonSchema as zodToJsonSchemaLib } from "zod-to-json-schema";
import type { JsonSchema } from "./types";

/**
 * Options for Zod to JSON Schema conversion.
 */
export interface ZodToMcpSchemaOptions {
  /**
   * Target JSON Schema version.
   * @default "jsonSchema7"
   */
  target?: "jsonSchema7" | "jsonSchema2019-09" | "openApi3";
  /**
   * Enable support for recursive schemas using $ref.
   * @default false
   */
  useReferences?: boolean;
  /**
   * Name for the schema (used in $ref paths).
   */
  name?: string;
}

/**
 * Convert a Zod schema to JSON Schema format for MCP inputSchema.
 *
 * Uses zod-to-json-schema internally with MCP-optimized defaults.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { zodToMcpSchema } from '@onegenui/mcp';
 *
 * const params = z.object({
 *   location: z.string().describe('City name'),
 *   units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
 * });
 *
 * const jsonSchema = zodToMcpSchema(params);
 * // {
 * //   type: 'object',
 * //   properties: {
 * //     location: { type: 'string', description: 'City name' },
 * //     units: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' }
 * //   },
 * //   required: ['location']
 * // }
 * ```
 */
export function zodToMcpSchema(
  schema: z.ZodTypeAny,
  options: ZodToMcpSchemaOptions = {},
): JsonSchema {
  const { target = "jsonSchema7", useReferences = false, name } = options;

  // Cast to any to work around Zod v4 type differences with zod-to-json-schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = zodToJsonSchemaLib(schema as any, {
    target,
    $refStrategy: useReferences ? "root" : "none",
    name,
  });

  // Clean up the result for MCP format
  // Remove $schema and definitions if not using references
  if (!useReferences) {
    const cleaned = { ...result } as JsonSchema;
    delete cleaned.$schema;
    delete cleaned.$id;

    // If there's a definitions wrapper, unwrap it
    if (name && cleaned.definitions?.[name]) {
      const inner = cleaned.definitions[name] as JsonSchema;
      delete cleaned.definitions;
      return { ...cleaned, ...inner };
    }

    // CRITICAL: Gemini requires type: "object" for function parameters
    // Ensure the schema always has type: "object"
    if (!cleaned.type) {
      cleaned.type = "object";
    }
    if (cleaned.type !== "object") {
      // Wrap non-object schemas in an object
      return {
        type: "object",
        properties: { value: cleaned },
        required: ["value"],
      };
    }

    return cleaned;
  }

  // For referenced schemas, also ensure type: "object"
  const refResult = result as JsonSchema;
  if (!refResult.type) {
    refResult.type = "object";
  }

  return refResult;
}

/**
 * Create an empty object schema for tools with no parameters.
 * This follows the MCP specification recommendation.
 */
export function emptyInputSchema(): JsonSchema {
  return {
    type: "object",
    properties: {},
    additionalProperties: false,
  };
}

/**
 * Merge multiple JSON schemas into a single object schema.
 * Useful for combining base schemas with extensions.
 */
export function mergeSchemas(...schemas: JsonSchema[]): JsonSchema {
  const merged: JsonSchema = {
    type: "object",
    properties: {},
    required: [],
  };

  for (const schema of schemas) {
    if (schema.properties) {
      merged.properties = { ...merged.properties, ...schema.properties };
    }
    if (schema.required && Array.isArray(schema.required)) {
      const existing = merged.required as string[];
      const combined = [...existing, ...schema.required];
      // Deduplicate using object keys
      const unique: Record<string, true> = {};
      for (const item of combined) {
        unique[item] = true;
      }
      merged.required = Object.keys(unique);
    }
  }

  // Clean up empty required array
  if ((merged.required as string[]).length === 0) {
    delete merged.required;
  }

  return merged;
}

/**
 * Validate that a JSON Schema is compatible with MCP requirements.
 * Returns validation errors if any.
 */
export function validateMcpSchema(schema: JsonSchema): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // MCP requires object type for inputSchema
  if (schema.type !== "object") {
    errors.push(
      `inputSchema must have type 'object', got '${schema.type ?? "undefined"}'`,
    );
  }

  // Check for unsupported features
  if (schema.$ref && !schema.$defs && !schema.definitions) {
    errors.push("$ref used without $defs or definitions");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract metadata from a Zod schema for tool selection.
 * Looks for .describe() calls and extracts keywords.
 */
export function extractSchemaMetadata(schema: z.ZodTypeAny): {
  description?: string;
  keywords: string[];
} {
  const keywords: string[] = [];
  let description: string | undefined;

  // Try to get description from the schema
  try {
    // Access the _def property which contains schema metadata
    const def = (schema as unknown as { _def?: { description?: string } })._def;
    if (def?.description) {
      description = def.description;
      // Extract keywords from description
      const words = description.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3 && !stopWords[word]) {
          keywords.push(word);
        }
      }
    }
  } catch {
    // Ignore errors from accessing internal properties
  }

  return { description, keywords };
}

// Common stop words to filter from keyword extraction
const STOP_WORDS = [
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "been",
  "be",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
] as const;

const stopWords: Record<string, true> = {};
for (let i = 0; i < STOP_WORDS.length; i++) {
  const word = STOP_WORDS[i];
  if (word) {
    stopWords[word] = true;
  }
}
