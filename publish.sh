#!/bin/bash

set -e

PKG_DIR="constellation-typescript"
PKG_JSON="$PKG_DIR/package.json"

# Check for jq
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this script. Please install jq (e.g. brew install jq or apt-get install jq)." >&2
  exit 1
fi

cd "$PKG_DIR"

# Show current version
VERSION=$(jq -r '.version' package.json)
echo "Current version: $VERSION"

# Choose bump type
echo "Which version bump? (patch/minor/major)"
read -r BUMP_TYPE

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Invalid bump type. Use patch, minor, or major." >&2
  exit 1
fi

# Bump version using npm
npm version "$BUMP_TYPE" --no-git-tag-version

NEW_VERSION=$(jq -r '.version' package.json)
echo "Bumped version: $NEW_VERSION"

# Build project
echo "Building package..."
npm run build

# Publish
echo "Publishing package to npm..."
npm publish

echo "Successfully published constellation-typescript@$NEW_VERSION"

# Commit and push the new version to GitHub
echo "Committing and pushing version bump to GitHub..."
git add package.json package-lock.json || true
git commit -m "Bump constellation-typescript to v$NEW_VERSION"
git tag "constellation-typescript-v$NEW_VERSION"
git push origin HEAD
git push origin "constellation-typescript-v$NEW_VERSION"

cd ..

