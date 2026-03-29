# CLAUDE.md — AI Agent Configuration for contedra/toolkit

## Language

This is a public repository. All code, comments, commit messages, PR descriptions, and documentation must be in English.

## Project Overview

Monorepo for Conteditor ecosystem tools:
- `@contedra/core` — Firebase connection and Zod schema generation from model definition JSON
- `@contedra/astro-loader-firestore` — Astro Content Layer loader for Firestore
- `@contedra/md-importer` — CLI tool to import Markdown files into Firestore

## Commands

- `pnpm test` — Run all tests
- `pnpm build` — Build all packages
- `pnpm lint` — Run linter

## Release Process

**IMPORTANT: Do NOT include version bumps in PRs.** The release script handles versioning.

Release flow:
1. Merge PR to main
2. Owner runs `./scripts/release.sh patch|minor|major`
3. Script bumps all package versions, commits, tags, pushes, and creates a GitHub release
4. CI publishes to npm on tag push

Why: Including version changes in PRs causes double-bump when the release script runs afterward (e.g., PR bumps to 0.1.1, then `release.sh patch` bumps again to 0.1.2, skipping the intended version).

## Coding Conventions

- TypeScript, ESM
- Tests: Vitest
- Package manager: pnpm (monorepo with workspaces)
