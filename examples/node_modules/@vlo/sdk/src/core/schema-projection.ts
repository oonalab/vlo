/**
 * The projection of a JSON Schema that a content hash covers.
 *
 * A schema's hash is its version, so only what changes *which values the schema accepts*
 * may move it. Annotation keywords (JSON Schema 2020-12 §9) describe a schema to humans
 * and tools without constraining instances, so they are stripped before hashing: editing a
 * `.describe()` label or a `.default()` must not re-version an activity under live runs.
 * The full schema, annotations included, is what the host registers and what forms render.
 *
 * This projection is a cross-SDK contract: any SDK that computes a `schema_ref` applies the
 * same rule, and `fixtures/schema-hash/` holds the golden cases they all must reproduce.
 * Changing the rule bumps {@link SCHEMA_HASH_VERSION}, never the rule alone.
 */

import type { Json } from "../kernel/protocol.ts";

/** Version tag folded into every activity and signal hash. Bump when the projection changes. */
export const SCHEMA_HASH_VERSION = 1;

/** Keywords removed from every schema object before hashing, at any depth. */
export const ANNOTATION_KEYWORDS: readonly string[] = [
  "$schema",
  "$id",
  "$comment",
  "title",
  "description",
  "examples",
  "default",
  "deprecated",
  "readOnly",
  "writeOnly",
];

/**
 * Keywords whose value is a map from a user-chosen name to a schema. The names are opaque
 * (a property may be called `default`), only the values are schemas.
 */
export const NAMED_SCHEMA_MAPS: readonly string[] = [
  "properties",
  "patternProperties",
  "dependentSchemas",
  "$defs",
  "definitions",
];

const STRIPPED = new Set(ANNOTATION_KEYWORDS);
const NAMED_MAPS = new Set(NAMED_SCHEMA_MAPS);

/**
 * Returns a copy of `schema` with every annotation keyword removed from every schema
 * object in it. Arrays are walked (`anyOf`, `prefixItems`, …) in order; the entries of a
 * name-keyed map (`properties`, `$defs`, …) keep their names and have their values
 * projected; scalars pass through. The input is never mutated.
 */
export function projectSchema(schema: Json): Json {
  if (Array.isArray(schema)) return schema.map(projectSchema);
  if (schema === null || typeof schema !== "object") return schema;

  const projected: { [key: string]: Json } = {};
  for (const [key, value] of Object.entries(schema)) {
    if (STRIPPED.has(key)) continue;
    projected[key] = NAMED_MAPS.has(key) ? projectNamedMap(value) : projectSchema(value);
  }
  return projected;
}

function projectNamedMap(map: Json): Json {
  if (map === null || typeof map !== "object" || Array.isArray(map)) return map;
  const projected: { [key: string]: Json } = {};
  for (const [name, schema] of Object.entries(map)) projected[name] = projectSchema(schema);
  return projected;
}
