# Updating the NPM Package

This document explains how to update the `claude-annotations-server` npm package on GitHub.

## Overview

The server code lives in `local-server/` subdirectory of this main repository, but is published as a separate npm package at:
https://github.com/RaphaelRegnier/claude-annotations-server

## How to Update the NPM Package

### 1. Make changes in main repository
```bash
# Edit files in local-server/ directory
# Test changes locally:
cd local-server
node bin/cli.js start --daemon
node bin/cli.js status
node bin/cli.js stop
```

### 2. Commit changes to main repository
```bash
# From root directory
git add .
git commit -m "Update server: your changes here"
```

### 3. Push changes to npm package repository
```bash
# Push only the local-server/ subdirectory to npm package repo
git push npm-package `git subtree split --prefix=local-server HEAD`:main --force
```

### 4. Update version (optional)
If this is a new release:
```bash
cd local-server
npm version patch  # or minor/major
git add package.json package-lock.json
git commit -m "Bump version to $(npm list --depth=0 | head -1 | awk '{print $1}' | cut -d@ -f2)"
# Then repeat step 3 to push version update
```

## Verification

Test that the updated package works:
```bash
# Uninstall old version
npm uninstall -g claude-annotations-server

# Install from GitHub
npm install -g git+https://github.com/RaphaelRegnier/claude-annotations-server.git

# Test functionality
claude-annotations-server --version
claude-annotations-server start --daemon
claude-annotations-server status
claude-annotations-server stop
```

## One-time Setup (already done)

The git remote for the npm package repo was set up with:
```bash
git remote add npm-package https://github.com/RaphaelRegnier/claude-annotations-server.git
```

## Alternative: Simple Script

You can also create a script to automate this:
```bash
#!/bin/bash
# update-npm.sh
echo "Pushing local-server/ to npm package repository..."
git push npm-package `git subtree split --prefix=local-server HEAD`:main --force
echo "✅ NPM package updated!"
```

Then just run: `./update-npm.sh`