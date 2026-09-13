import path from 'node:path';
import * as core from '@actions/core';
import { loadSchemaConfig } from './schema-config.js';
import { validateWorkspace } from './validator.js';

export async function run(): Promise<void> {
  try {
    const workspaceRoot = path.resolve(process.env.GITHUB_WORKSPACE ?? process.cwd());
    const settingsFile = core.getInput('settingsFile');
    const yamlSchemasJson = core.getInput('yamlSchemasJson', { trimWhitespace: false });
    const failOnNoFiles = core.getBooleanInput('failOnNoFiles');
    const config = await loadSchemaConfig(workspaceRoot, settingsFile, yamlSchemasJson);

    if (config.source) {
      core.info(`Using schema mappings from ${config.source}.`);
    }

    const results = await validateWorkspace(workspaceRoot, config.schemas);
    const validFiles = results.filter((result) => result.valid).map((result) => result.filePath);
    const invalidFiles = results.filter((result) => !result.valid).map((result) => result.filePath);

    core.setOutput('validFiles', validFiles.join(','));
    core.setOutput('invalidFiles', invalidFiles.join(','));

    for (const result of results) {
      if (result.valid) {
        core.info(`Validated ${result.filePath}`);
        continue;
      }

      for (const diagnostic of result.diagnostics) {
        core.error(diagnostic.message, {
          endColumn: diagnostic.range.end.character + 1,
          endLine: diagnostic.range.end.line + 1,
          file: result.filePath,
          startColumn: diagnostic.range.start.character + 1,
          startLine: diagnostic.range.start.line + 1,
          title: 'YAML schema validation',
        });
      }
    }

    if (results.length === 0) {
      const message = 'No files matched the configured YAML schema patterns.';
      if (failOnNoFiles) {
        core.setFailed(message);
      } else {
        core.warning(message);
      }
    } else if (invalidFiles.length > 0) {
      core.setFailed(`Schema validation failed for ${invalidFiles.length} file(s).`);
    } else {
      core.info(`Validated ${validFiles.length} YAML file(s) successfully.`);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

void run();
