import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSchemaConfig } from '../src/schema-config.js';

const temporaryDirectories: string[] = [];

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), 'validate-yaml-schema-config-'));
  temporaryDirectories.push(workspace);
  return workspace;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('loadSchemaConfig', () => {
  it('auto-detects a dedicated JSONC mapping file', async () => {
    const workspace = await createWorkspace();
    await writeFile(
      path.join(workspace, '.yaml-schema.json'),
      `{
        // Comments and trailing commas are supported.
        "./schema.json": ["/*.yml"],
      }`,
    );

    await expect(loadSchemaConfig(workspace, '', '')).resolves.toEqual({
      schemas: { './schema.json': ['/*.yml'] },
      source: '.yaml-schema.json',
    });
  });

  it('supports VS Code settings and lets inline mappings override them', async () => {
    const workspace = await createWorkspace();
    await writeFile(
      path.join(workspace, 'settings.json'),
      JSON.stringify({ 'yaml.schemas': { './old.json': '*.yaml', './shared.json': 'old.yml' } }),
    );

    const config = await loadSchemaConfig(
      workspace,
      'settings.json',
      JSON.stringify({ './shared.json': ['new.yml'] }),
    );

    expect(config.schemas).toEqual({
      './old.json': ['*.yaml'],
      './shared.json': ['new.yml'],
    });
  });

  it('falls back to the legacy VS Code settings location', async () => {
    const workspace = await createWorkspace();
    await mkdir(path.join(workspace, '.vscode'));
    await writeFile(
      path.join(workspace, '.vscode', 'settings.json'),
      JSON.stringify({ 'yaml.schemas': { './schema.json': '*.yaml' } }),
    );

    await expect(loadSchemaConfig(workspace, '', '')).resolves.toEqual({
      schemas: { './schema.json': ['*.yaml'] },
      source: '.vscode/settings.json',
    });
  });

  it('rejects missing schema mappings with an actionable error', async () => {
    const workspace = await createWorkspace();
    await expect(loadSchemaConfig(workspace, '', '')).rejects.toThrow('No schema mappings found');
  });
});
