#!/usr/bin/env tsx
/**
 * Watch ~/Documents/Photos_raw/ for images, resize the long side to 1024px,
 * and save as <name>_small.<ext> in ~/Documents/Photos_raw/processed/.
 *
 * HEIC/HEIF files are converted to JPEG via macOS `sips` before resizing,
 * since sharp's bundled libvips lacks HEIC codec support.
 */

import sharp from "sharp";
import chokidar from "chokidar";
import path from "path";
import fs from "fs";
import os from "os";
import { execFileSync } from "child_process";

const RAW_DIR = path.join(os.homedir(), "Documents", "Photos_raw");
const OUT_DIR = path.join(RAW_DIR, "processed");
const MAX_LONG_SIDE = 1024;

const SHARP_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const HEIC_EXTS = new Set([".heic", ".heif"]);
const IMAGE_EXTS = new Set([...SHARP_EXTS, ...HEIC_EXTS]);

function isImage(filePath: string): boolean {
  return IMAGE_EXTS.has(path.extname(filePath).toLowerCase());
}

function isHeic(filePath: string): boolean {
  return HEIC_EXTS.has(path.extname(filePath).toLowerCase());
}

function convertHeicToJpeg(heicPath: string): string {
  const base = path.basename(heicPath, path.extname(heicPath));
  const tmpJpeg = path.join(OUT_DIR, `${base}_tmp.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", heicPath, "--out", tmpJpeg], {
    stdio: "pipe",
  });
  return tmpJpeg;
}

async function processImage(filePath: string): Promise<void> {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const outExt = isHeic(filePath) ? ".jpg" : ext;
  const outPath = path.join(OUT_DIR, `${base}_small${outExt}`);

  if (fs.existsSync(outPath)) {
    console.log(`  skip (already processed): ${path.basename(outPath)}`);
    return;
  }

  let inputPath = filePath;
  let tmpFile: string | null = null;

  if (isHeic(filePath)) {
    console.log(`  converting HEIC → JPEG via sips…`);
    inputPath = convertHeicToJpeg(filePath);
    tmpFile = inputPath;
  }

  try {
    const meta = await sharp(inputPath).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    if (w === 0 || h === 0) {
      console.log(`  skip (cannot read dimensions): ${filePath}`);
      return;
    }

    const longSide = Math.max(w, h);
    if (longSide <= MAX_LONG_SIDE) {
      await sharp(inputPath).rotate().toFile(outPath);
      console.log(`  copied (already small ${w}x${h}): ${path.basename(outPath)}`);
    } else {
      await sharp(inputPath)
        .rotate()
        .resize({ width: MAX_LONG_SIDE, height: MAX_LONG_SIDE, fit: "inside", withoutEnlargement: true })
        .toFile(outPath);
      const outMeta = await sharp(outPath).metadata();
      console.log(`  resized ${w}x${h} → ${outMeta.width}x${outMeta.height}: ${path.basename(outPath)}`);
    }
  } finally {
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

const queue: string[] = [];
let processing = false;

async function drainQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const filePath = queue.shift()!;
    console.log(`processing: ${path.basename(filePath)}`);
    try {
      await processImage(filePath);
    } catch (err) {
      console.error(`  error processing ${path.basename(filePath)}:`, err);
    }
    console.log();
  }
  processing = false;
}

function handleFile(filePath: string): void {
  if (!isImage(filePath)) return;
  if (filePath.startsWith(OUT_DIR)) return;
  queue.push(filePath);
  drainQueue();
}

// ---- main ----

fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log(`Watching: ${RAW_DIR}`);
console.log(`Output:   ${OUT_DIR}`);
console.log(`Max long side: ${MAX_LONG_SIDE}px\n`);

const watcher = chokidar.watch(RAW_DIR, {
  ignored: [OUT_DIR, /(^|[/\\])\./],
  persistent: true,
  ignoreInitial: false,
  depth: 0,
});

watcher.on("add", handleFile);

watcher.on("ready", () => {
  console.log("\nInitial scan complete. Watching for new images… (Ctrl+C to stop)\n");
});

process.on("SIGINT", () => {
  console.log("\nStopping watcher.");
  watcher.close();
  process.exit(0);
});
