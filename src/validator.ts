import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { glob } from 'glob';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  getLanguageService,
  SchemaPriority,
  type Diagnostic,
  type LanguageSettings,
} from 'yaml-language-server';
import type { SchemaMap } from './schema-config.js';
import {
  createSchemaRequestService,
  normalizeSchemaUri,
  workspaceContext,
} from './schema-request.js';

export interface ValidationResult {
  diagnostics: Diagnostic[];
  filePath: string;
  valid: boolean;
}

function normalizeGlobPattern(pattern: string): string {
  const normalized = pattern.replaceAll('\\', '/');
  return normalized.startsWith('/') ? normalized.slice(1) : normalized;
}

async function findYamlFiles(workspaceRoot: string, schemas: SchemaMap): Promise<string[]> {
  const patterns = [...new Set(Object.values(schemas).flat())];
  const matches = await Promise.all(
    patterns.map((pattern) =>
      glob(normalizeGlobPattern(pattern), {
        cwd: workspaceRoot,
        dot: true,
        ignore: ['.git/**', 'node_modules/**'],
        matchBase: true,
        nodir: true,
      }),
    ),
  );

  return [...new Set(matches.flat())].sort();
}

export async function validateWorkspace(
  workspaceRoot: string,
  schemas: SchemaMap,
): Promise<ValidationResult[]> {
  const languageService = getLanguageService({
    schemaRequestService: createSchemaRequestService(workspaceRoot),
    workspaceContext,
  });
  const settings: LanguageSettings = {
    completion: false,
    customTags: [],
    format: false,
    hover: false,
    isKubernetes: false,
    schemas: Object.entries(schemas).map(([uri, fileMatch]) => ({
      fileMatch,
      priority: SchemaPriority.Settings,
      uri: normalizeSchemaUri(workspaceRoot, uri),
    })),
    validate: true,
  };
  languageService.configure(settings);

  const filePaths = await findYamlFiles(workspaceRoot, schemas);
  return await Promise.all(
    filePaths.map(async (filePath): Promise<ValidationResult> => {
      const absolutePath = path.resolve(workspaceRoot, filePath);
      const relativePath = path.relative(workspaceRoot, absolutePath);
      if (relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
        throw new Error(`A configured pattern matched a file outside the workspace: ${filePath}`);
      }

      const contents = await readFile(absolutePath, 'utf8');
      const document = TextDocument.create(
        pathToFileURL(absolutePath).toString(),
        'yaml',
        0,
        contents,
      );
      const diagnostics = await languageService.doValidation(document, false);

      return {
        diagnostics,
        filePath: relativePath.split(path.sep).join('/'),
        valid: diagnostics.length === 0,
      };
    }),
  );
}
