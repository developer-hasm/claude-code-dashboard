#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Post-build helper for the Next.js standalone bundle.
//
// `next build` produces .next/standalone but does NOT copy:
//   1. .next/static/  — static assets, served at /_next/static/*
//   2. better-sqlite3's `Release/better_sqlite3.node` native binding
//
// This script fixes both. It also fails loudly (exit 1) if the binding is
// missing in node_modules at all, so the issue is caught at build time
// rather than at first /api/stats call.
//
// Idempotent: safe to re-run. If interrupted, just re-run `npm run build`.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// ── Constants ────────────────────────────────────────────────────────────

const STANDALONE = '.next/standalone';
const STANDALONE_SERVER = path.join(STANDALONE, 'server.js');

const SQLITE_PKG = path.join('node_modules', 'better-sqlite3');
const SQLITE_BUILD_REL = path.join('build', 'Release', 'better_sqlite3.node');

const SQLITE_BINDING_SRC = path.join(SQLITE_PKG, SQLITE_BUILD_REL);
const SQLITE_BINDING_DEST = path.join(STANDALONE, SQLITE_PKG, SQLITE_BUILD_REL);

const STATIC_SRC = '.next/static';
const STATIC_DEST = path.join(STANDALONE, '.next/static');

// ── Step 0: sanity-check that next build actually produced a standalone ───

if (!fs.existsSync(path.join(root, STANDALONE_SERVER))) {
  console.error(
    `[postbuild] ${STANDALONE_SERVER} not found — did "next build" run, ` +
      `and is "output: 'standalone'" set in next.config?`,
  );
  process.exit(1);
}

// ── Step 1: verify better-sqlite3 native binding exists in source ─────────
//
// Differentiate the two failure modes so the user gets actionable advice:
// - node_modules/better-sqlite3 itself missing  → run `npm install`
// - package present but build/Release missing   → run `npm rebuild better-sqlite3`

if (!fs.existsSync(path.join(root, SQLITE_PKG, 'package.json'))) {
  console.error(
    `[postbuild] better-sqlite3 is not installed at ${SQLITE_PKG}/. ` +
      `Run 'npm install' before building.`,
  );
  process.exit(1);
}

if (!fs.existsSync(path.join(root, SQLITE_BINDING_SRC))) {
  console.error(
    `[postbuild] better-sqlite3 native binding missing at:\n` +
      `[postbuild]   ${SQLITE_BINDING_SRC}\n` +
      `[postbuild] Recovery: 'npm rebuild better-sqlite3' (or, if the prebuild ` +
      `CDN is unreachable, 'npm rebuild better-sqlite3 --build-from-source' ` +
      `which requires a C++ toolchain).`,
  );
  process.exit(1);
}

// ── Step 2: copy required assets into the standalone bundle ───────────────
//
// Add a new entry here if a future native dep needs the same workaround.
// `kind: 'file'` copies a single file (cheap; e.g. just the .node binding).
// `kind: 'dir'`  copies an entire tree (Next's static assets are many files).

const COPIES = [
  { kind: 'dir',  src: STATIC_SRC,           dest: STATIC_DEST,           required: true },
  { kind: 'file', src: SQLITE_BINDING_SRC,   dest: SQLITE_BINDING_DEST,   required: true },
];

let hadError = false;

for (const { kind, src, dest, required } of COPIES) {
  const srcPath = path.join(root, src);
  const destPath = path.join(root, dest);

  if (!fs.existsSync(srcPath)) {
    const level = required ? 'ERROR' : 'warn';
    console.error(`[postbuild] ${level}: source missing, skipping: ${srcPath}`);
    if (required) hadError = true;
    continue;
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.rmSync(destPath, { recursive: true, force: true });

  if (kind === 'file') {
    fs.copyFileSync(srcPath, destPath);
  } else {
    fs.cpSync(srcPath, destPath, { recursive: true });
  }
  console.log(`[postbuild] copied ${src} -> ${dest}`);
}

if (hadError) {
  console.error('[postbuild] one or more required sources were missing — see above.');
  process.exit(1);
}

console.log('[postbuild] done');
