# Changelog

## 3.0.0

- Move the GitHub Action runtime from Node 12 to Node 24.
- Replace private YAML Language Server imports with its public language-service API.
- Add `.yaml-schema.json` as an editor-independent configuration file while preserving automatic
  `.vscode/settings.json` fallback and the existing action inputs and outputs.
- Accept comments and trailing commas in configuration files.
- Emit validation failures as file and line annotations.
- Replace webpack with `@vercel/ncc` and add strict TypeScript, ESLint, Prettier, and Vitest checks.
- Test the packaged action on Linux, macOS, and Windows and add automated dependency updates.
