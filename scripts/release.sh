#!/bin/bash
set -euo pipefail

BUMP_TYPE=$1

if [ -z "$BUMP_TYPE" ]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major>"
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  echo "Error: run releases from main (current: $current_branch)"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree must be clean before release"
  exit 1
fi

pnpm -r exec npm version "$BUMP_TYPE" --no-git-tag-version

VERSION=$(node -p "require('./packages/core/package.json').version")

git add -A
git commit -m "v$VERSION"
git tag "v$VERSION"
git push origin main --tags
gh release create "v$VERSION" --generate-notes
