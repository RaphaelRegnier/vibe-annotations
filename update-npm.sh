#!/bin/bash
# Script to update the claude-annotations-server npm package on GitHub

set -e  # Exit on error

echo "🚀 Updating claude-annotations-server npm package..."
echo ""

# Check if we're in the right directory
if [ ! -d "local-server" ]; then
    echo "❌ Error: local-server directory not found"
    echo "Please run this script from the claude-annotations root directory"
    exit 1
fi

# Check if npm-package remote exists
if ! git remote | grep -q "npm-package"; then
    echo "❌ Error: npm-package remote not found"
    echo "Run: git remote add npm-package https://github.com/RaphaelRegnier/claude-annotations-server.git"
    exit 1
fi

echo "📦 Splitting local-server/ subdirectory..."
SPLIT_COMMIT=$(git subtree split --prefix=local-server HEAD)
echo "Split commit: $SPLIT_COMMIT"

echo ""
echo "🔄 Pushing to npm package repository..."
git push npm-package $SPLIT_COMMIT:main --force

echo ""
echo "✅ NPM package updated successfully!"
echo ""
echo "🧪 To test the update:"
echo "   npm uninstall -g claude-annotations-server"
echo "   npm install -g git+https://github.com/RaphaelRegnier/claude-annotations-server.git"
echo "   claude-annotations-server --version"