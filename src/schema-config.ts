import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';

export type SchemaMap = Record<string, string[]>;

export interface LoadedSchemaConfig {
  schemas: SchemaMap;
  source?: string;
}

export const defaultConfigFiles = ['.yaml-schema.json', '.vscode/settings.json'] as const;

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function parseJsonc(source: string, label: string): unknown {
  const errors: ParseError[] = [];
  const value: unknown = parse(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (errors.length > 0) {
    const details = errors.map((error) => printParseErrorCode(error.error)).join(', ');
    throw new Error(`Could not parse ${label}: ${details}.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPatternArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((pattern) => typeof pattern === 'string' && pattern.trim() !== '')
  );
}

function toSchemaMap(value: unknown, label: string): SchemaMap {
  if (!isRecord(value)) {
    throw new Error(`${label} must contain an object of schema URIs and file patterns.`);
  }

  const candidate = 'yaml.schemas' in value ? value['yaml.schemas'] : value;
  if (!isRecord(candidate)) {
    throw new Error(`The yaml.schemas value in ${label} must be an object.`);
  }

  const schemas: SchemaMap = {};
  for (const [schemaUri, patternsValue] of Object.entries(candidate)) {
    if (schemaUri.trim() === '') {
      throw new Error(`${label} contains an empty schema URI.`);
    }

    const patterns = typeof patternsValue === 'string' ? [patternsValue] : patternsValue;
    if (!isPatternArray(patterns)) {
      throw new Error(`Schema ${schemaUri} in ${label} must map to a string or string array.`);
    }

    schemas[schemaUri] = patterns;
  }

  return schemas;
}

async function findConfigFile(
  workspaceRoot: string,
  requestedFile: string,
): Promise<string | undefined> {
  if (requestedFile !== '') {
    const resolved = path.isAbsolute(requestedFile)
      ? requestedFile
      : path.resolve(workspaceRoot, requestedFile);

    if (!(await isFile(resolved))) {
      throw new Error(`Schema settings file not found: ${requestedFile}`);
    }

    return resolved;
  }

  for (const candidate of defaultConfigFiles) {
    const resolved = path.resolve(workspaceRoot, candidate);
    if (await isFile(resolved)) {
      return resolved;
    }
  }

  return undefined;
}

export async function loadSchemaConfig(
  workspaceRoot: string,
  requestedFile: string,
  inlineJson: string,
): Promise<LoadedSchemaConfig> {
  const configFile = await findConfigFile(workspaceRoot, requestedFile);
  let fileSchemas: SchemaMap = {};

  if (configFile) {
    const contents = await readFile(configFile, 'utf8');
    fileSchemas = toSchemaMap(parseJsonc(contents, configFile), configFile);
  }

  const inlineSchemas =
    inlineJson.trim() === ''
      ? {}
      : toSchemaMap(parseJsonc(inlineJson, 'yamlSchemasJson'), 'yamlSchemasJson');
  const schemas = { ...fileSchemas, ...inlineSchemas };

  if (Object.keys(schemas).length === 0) {
    throw new Error(
      `No schema mappings found. Add ${defaultConfigFiles[0]}, ${defaultConfigFiles[1]}, or yamlSchemasJson.`,
    );
  }

  return {
    schemas,
    source: configFile
      ? path.relative(workspaceRoot, configFile) || path.basename(configFile)
      : undefined,
  };
}
