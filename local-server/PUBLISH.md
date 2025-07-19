# Publishing claude-annotations-server

This package is configured as a private npm package. Here's how to publish it:

## Option 1: Publish to npm (private)

1. Make sure you're logged in to npm:
   ```bash
   npm login
   ```

2. Publish as a private package (requires paid npm account):
   ```bash
   npm publish
   ```

## Option 2: Publish to GitHub Package Registry

1. Update package.json with your GitHub repository:
   ```json
   "name": "@yourusername/claude-annotations-server",
   "publishConfig": {
     "registry": "https://npm.pkg.github.com"
   }
   ```

2. Create a GitHub personal access token with `write:packages` scope.

3. Login to GitHub Package Registry:
   ```bash
   npm login --registry=https://npm.pkg.github.com
   # Username: YOUR_GITHUB_USERNAME
   # Password: YOUR_GITHUB_TOKEN
   ```

4. Publish:
   ```bash
   npm publish
   ```

## Option 3: Install from Git (no publishing needed)

Users can install directly from your git repository:
```bash
npm install -g git+https://github.com/yourusername/claude-annotations-server.git
```

## Option 4: Local Testing

For local testing before publishing:
```bash
# In the package directory
npm link

# Now you can use it globally
claude-annotations-server start
```

## Pre-publish Checklist

- [ ] Update version in package.json
- [ ] Test all CLI commands work
- [ ] Update README if needed
- [ ] Commit all changes
- [ ] Tag the release: `git tag v0.1.0`