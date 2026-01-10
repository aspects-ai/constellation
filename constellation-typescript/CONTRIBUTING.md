# Contributing to ConstellationFS

## Development Setup

```bash
npm install
npm run dev      # Start watch mode
npm test         # Run tests
```

## Code Quality

Before submitting changes:

```bash
npm run typecheck    # Must pass
npm run lint         # Must pass
npm run test:run     # Must pass
```

## Code Style

- **No semicolons**, single quotes
- Strict TypeScript (no `any`)
- Use Zod for configuration validation
- Throw `FileSystemError` or `DangerousOperationError` for errors

## Testing

- Tests in `tests/` directory
- Use Vitest (`npm test`)
- Always setup/teardown `ConstellationFS.setConfig()` in tests that create backends

## Pull Requests

1. Create a feature branch
2. Make changes with passing tests
3. Run `npm run lint && npm run typecheck && npm run test:run`
4. Submit PR with clear description

## Releasing

Maintainers use `./publish.sh` from the repo root to:
- Bump version (patch/minor/major)
- Build and publish to npm
- Create git tag and push
