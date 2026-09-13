import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateWorkspace } from '../src/validator.js';

const temporaryDirectories: string[] = [];

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), 'validate-yaml-schema-validation-'));
  temporaryDirectories.push(workspace);
  return workspace;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('validateWorkspace', () => {
  it('validates matching files with a local schema and reports diagnostics', async () => {
    const workspace = await createWorkspace();
    await writeFile(
      path.join(workspace, 'schema.json'),
      JSON.stringify({
        additionalProperties: false,
        properties: { name: { type: 'string' } },
        required: ['name'],
        type: 'object',
      }),
    );
    await writeFile(path.join(workspace, 'valid.yml'), 'name: example\n');
    await writeFile(path.join(workspace, 'invalid.yml'), 'name: 42\n');

    const results = await validateWorkspace(workspace, { './schema.json': ['/*.yml'] });

    expect(results.map(({ filePath, valid }) => ({ filePath, valid }))).toEqual([
      { filePath: 'invalid.yml', valid: false },
      { filePath: 'valid.yml', valid: true },
    ]);
    expect(results[0]?.diagnostics[0]?.message).toContain('string');
  });

  it('resolves relative references from local schemas', async () => {
    const workspace = await createWorkspace();
    await mkdir(path.join(workspace, 'schemas'));
    await writeFile(
      path.join(workspace, 'schemas', 'schema.json'),
      JSON.stringify({ $ref: './definitions.json#/$defs/config' }),
    );
    await writeFile(
      path.join(workspace, 'schemas', 'definitions.json'),
      JSON.stringify({
        $defs: {
          config: {
            properties: { enabled: { type: 'boolean' } },
            required: ['enabled'],
            type: 'object',
          },
        },
      }),
    );
    await writeFile(path.join(workspace, 'config.yaml'), 'enabled: true\n');

    const results = await validateWorkspace(workspace, {
      './schemas/schema.json': ['config.yaml'],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.valid).toBe(true);
  });

  it('returns an empty result when no configured pattern matches', async () => {
    const workspace = await createWorkspace();
    await writeFile(path.join(workspace, 'schema.json'), JSON.stringify({ type: 'object' }));

    await expect(
      validateWorkspace(workspace, { './schema.json': ['missing/**/*.yml'] }),
    ).resolves.toEqual([]);
  });
});
