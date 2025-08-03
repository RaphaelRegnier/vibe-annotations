#!/bin/bash
# Script to update the vibe-annotations-server npm package on GitHub

set -e  # Exit on error

echo "🚀 Updating vibe-annotations-server npm package..."
echo ""

# Check if we're in the right directory
if [ ! -d "local-server" ]; then
    echo "❌ Error: local-server directory not found"
    echo "Please run this script from the vibe-annotations root directory"
    exit 1
fi

# Check if npm-package remote exists
if ! git remote | grep -q "npm-package"; then
    echo "❌ Error: npm-package remote not found"
    echo "Run: git remote add npm-package https://github.com/RaphaelRegnier/vibe-annotations-server.git"
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
echo "   npm uninstall -g vibe-annotations-server"
echo "   npm install -g git+https://github.com/RaphaelRegnier/vibe-annotations-server.git"
echo "   vibe-annotations-server --version"