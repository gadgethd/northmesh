# Contributing to NorthMesh

Thank you for your interest in contributing to NorthMesh!

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before creating a bug report:
1. Check the [issue tracker](https://github.com/gadgethd/northmesh/issues) to see if the issue already exists
2. Update to the latest version to see if the issue persists

When filing a bug report, include:
- Your environment (OS, Node version, Docker version)
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or screenshots

### Suggesting Features

We welcome feature suggestions! Please:
1. Check if the feature already exists or is planned
2. Describe the feature and its benefits
3. Provide use cases

### Pull Requests

1. **Fork the repository** and create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Follow the coding style**:
   - TypeScript for all new code
   - 2-space indentation
   - Run `npm run lint` before committing

3. **Write meaningful commit messages**:
   ```
   feat: add new node visualization layer
   fix: resolve WebSocket reconnection issue
   docs: update installation instructions
   ```

4. **Keep commits atomic** - each commit should represent a single logical change

5. **Update documentation** if needed:
   - Update README.md if adding new features
   - Add comments for complex code
   - Update SPEC.md if architecture changes

6. **Test your changes**:
   ```bash
   cd frontend && npm run build
   cd ../backend && npm run build
   ```

7. **Submit a Pull Request** with:
   - Clear description of changes
   - Link to related issues
   - Screenshots for UI changes

## Development Setup

```bash
# Clone your fork
git clone https://github.com/gadgethd/northmesh.git
cd northmesh

# Add upstream remote
git remote add upstream https://github.com/gadgethd/northmesh.git

# Create a feature branch
git checkout -b feature/amazing-feature

# Make changes and commit
git add .
git commit -m "feat: add amazing feature"

# Push to your fork
git push origin feature/amazing-feature

# Open a Pull Request
```

## Code Review Process

- All submissions require review via Pull Request
- PRs are reviewed within 1 week
- Address review feedback by pushing new commits
- Once approved, your PR will be merged

## Questions?

Feel free to:
- Open an issue for questions
- Join the discussion in the issue tracker

Thank you for contributing!
