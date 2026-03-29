#!/bin/bash
set -euo pipefail

BUMP_TYPE=$1

if [ -z "$BUMP_TYPE" ]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major>"
  exit 1
fi

pnpm -r exec npm version "$BUMP_TYPE" --no-git-tag-version

VERSION=$(node -p "require('./packages/core/package.json').version")

git add -A
git commit -m "v$VERSION"
git tag "v$VERSION"
git push origin main --tags
gh release create "v$VERSION" --generate-notes
