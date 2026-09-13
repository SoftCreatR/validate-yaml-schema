# Validate YAML Schema

Validate YAML files against JSON Schemas in a GitHub Actions workflow. Validation is powered by the
same YAML language service used by Red Hat's VS Code YAML extension, but this action does not
require VS Code or a `.vscode` directory.

## Usage

Add a `.yaml-schema.json` file to your repository. Its keys are remote schema URLs or local schema
paths, and its values are file patterns:

```json
{
  "https://json.schemastore.org/github-workflow.json": [".github/workflows/*.yml"],
  "./schemas/config.schema.json": ["config/**/*.yaml"]
}
```

Then run the action after checking out the repository:

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: SoftCreatR/validate-yaml-schema@v3
```

Comments and trailing commas are accepted in configuration files. Remote HTTP(S) schemas, absolute
paths, `file:` URLs, and paths relative to the repository root are supported.

## Inputs

### `settingsFile`

Path to a schema mapping file. When omitted, the action looks for `.yaml-schema.json` first and then
`.vscode/settings.json`.

Both the direct format shown above and the VS Code-compatible `yaml.schemas` format are accepted:

```json
{
  "yaml.schemas": {
    "./schemas/config.schema.json": ["config/**/*.yaml"]
  }
}
```

### `yamlSchemasJson`

Inline schema mappings. These are merged with mappings from the configuration file and take
precedence when the same schema URI occurs in both:

```yaml
- uses: SoftCreatR/validate-yaml-schema@v3
  with:
    yamlSchemasJson: |
      {
        "https://json.schemastore.org/composer.json": ["composer.json"]
      }
```

### `failOnNoFiles`

Fail if no configured pattern matches a file. The default is `false` for compatibility with earlier
versions; otherwise the action emits a warning.

## Outputs

- `validFiles`: comma-separated list of files that passed validation
- `invalidFiles`: comma-separated list of files that failed validation

Validation errors are emitted as GitHub annotations with file, line, and column information.

## Migrating from v2

Version 3 uses the Node 24 action runtime. Existing `settingsFile`, `yamlSchemasJson`,
`.vscode/settings.json`, `validFiles`, and `invalidFiles` integrations remain supported. You can
keep your current VS Code settings or move the `yaml.schemas` mapping into `.yaml-schema.json` and
remove the editor-specific wrapper.

## Development

Node.js 24 and npm are required.

```shell
npm ci
npm run check
npm run build
```

The generated files in `lib/` are committed because GitHub Actions runs the bundle directly. Rebuild
them after changing source or dependencies.

## Acknowledgements

This project began by adapting logic from
[OrRosenblatt/validate-json-action](https://github.com/OrRosenblatt/validate-json-action) and
[redhat-developer/yaml-language-server](https://github.com/redhat-developer/yaml-language-server).

## License

[CC0 1.0 Universal](LICENSE.md)
