#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Build the README demo GIF from the captured frames in docs/.demo-frames/.
//
// Pipeline:
//   1. Generate an optimized palette from the frames
//   2. Use that palette to encode an animated GIF
//
// Output: docs/screenshots/demo.gif
//
// To regenerate end-to-end:
//   - Make sure the dashboard is running locally on http://127.0.0.1:19280
//   - npx playwright test e2e/demo-frames.spec.ts
//   - node scripts/build-demo-gif.mjs
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const ROOT = process.cwd();
const FRAMES_DIR = path.join(ROOT, 'docs', '.demo-frames');
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots');
const OUT_GIF = path.join(OUT_DIR, 'demo.gif');
const PALETTE = path.join(FRAMES_DIR, 'palette.png');

if (!ffmpegPath) {
  console.error('[build-demo-gif] ffmpeg-static did not provide a binary path.');
  process.exit(1);
}

if (!fs.existsSync(FRAMES_DIR)) {
  console.error(`[build-demo-gif] frames dir missing: ${FRAMES_DIR}`);
  console.error('Run `npx playwright test e2e/demo-frames.spec.ts` first.');
  process.exit(1);
}

const frames = fs.readdirSync(FRAMES_DIR).filter((n) => /^\d{3}\.png$/.test(n));
if (frames.length === 0) {
  console.error(`[build-demo-gif] no frames in ${FRAMES_DIR}`);
  process.exit(1);
}
console.log(`[build-demo-gif] ${frames.length} frames found`);

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Step 1: palette generation ────────────────────────────────────────────

const FPS = 8;          // GIF frame rate (low to keep file size reasonable)
const SCALE_W = 960;    // GIF width; height is auto-scaled

function ffmpeg(args) {
  console.log(`[ffmpeg] ${args.join(' ')}`);
  execFileSync(ffmpegPath, args, { stdio: 'inherit' });
}

ffmpeg([
  '-y',
  '-framerate', String(FPS),
  '-i', path.join(FRAMES_DIR, '%03d.png'),
  '-vf', `fps=${FPS},scale=${SCALE_W}:-1:flags=lanczos,palettegen=stats_mode=diff`,
  PALETTE,
]);

// ── Step 2: encode GIF using the palette ─────────────────────────────────

ffmpeg([
  '-y',
  '-framerate', String(FPS),
  '-i', path.join(FRAMES_DIR, '%03d.png'),
  '-i', PALETTE,
  '-lavfi', `fps=${FPS},scale=${SCALE_W}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
  '-loop', '0',
  OUT_GIF,
]);

const gifSize = fs.statSync(OUT_GIF).size;
const sizeKb = (gifSize / 1024).toFixed(0);
console.log(`[build-demo-gif] wrote ${OUT_GIF} (${sizeKb} KB)`);
