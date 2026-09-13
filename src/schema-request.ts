import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const remoteProtocols = new Set(['http:', 'https:']);

export function normalizeSchemaUri(workspaceRoot: string, schemaUri: string): string {
  if (path.isAbsolute(schemaUri)) {
    return pathToFileURL(schemaUri).toString();
  }

  try {
    return new URL(schemaUri).toString();
  } catch {
    return pathToFileURL(path.resolve(workspaceRoot, schemaUri)).toString();
  }
}

export function createSchemaRequestService(
  workspaceRoot: string,
): (uri: string) => Promise<string> {
  return async (uri: string): Promise<string> => {
    const normalizedUri = normalizeSchemaUri(workspaceRoot, uri);
    const parsedUri = new URL(normalizedUri);

    if (parsedUri.protocol === 'file:') {
      try {
        return await readFile(fileURLToPath(parsedUri), 'utf8');
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not read schema ${uri}: ${reason}`, { cause: error });
      }
    }

    if (remoteProtocols.has(parsedUri.protocol)) {
      const response = await fetch(parsedUri, {
        headers: {
          accept: 'application/schema+json, application/json',
          'user-agent': 'SoftCreatR/validate-yaml-schema',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new Error(`Could not fetch schema ${uri}: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    }

    throw new Error(`Unsupported schema URI protocol: ${parsedUri.protocol}`);
  };
}

export const workspaceContext = {
  resolveRelativePath(relativePath: string, resource: string): string {
    return new URL(relativePath, resource).toString();
  },
};
