#!/usr/bin/env node
/**
 * patch-claude.mjs — personal Claude Code build.
 *
 * Routing splices come from claude-code-hybrid-router (per-provider model
 * routing); this adds the subagent task-lifecycle QoL splices on top
 * (retention, pinning, detaching, the [p] markers).
 *
 * Usage: node patch-claude.mjs <input> <output.js> [--providers <file.json>]
 *   <input> = native claude binary or extracted bundle
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extractBundle, extractNatives, patch as patchRouting } from 'claude-code-subagent-models';
import { patchQoL } from './patch-qol.mjs';

function findBun() {
  for (const p of [process.env.HOME + '/.bun/bin/bun', 'bun']) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch {}
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const pi = args.indexOf('--providers');
  const [inPath, outPath] = args.filter((a, i) => a !== '--providers' && args[i - 1] !== '--providers');
  if (!inPath || !outPath) {
    console.error('usage: node patch-claude.mjs <input> <output.js> [--providers <file.json>]');
    process.exit(1);
  }

  let providers = null;
  if (pi >= 0 && args[pi + 1]) {
    const cfg = JSON.parse(fs.readFileSync(args[pi + 1], 'utf8'));
    providers = cfg.providers || cfg;
  }

  const { bundle, bunfsStart } = extractBundle(inPath);
  let out = bundle;
  const nativesDir = bunfsStart >= 0 ? pathJoin(dirname(outPath), 'natives') : null;
  const claudeBin = bunfsStart >= 0 ? inPath : null;
  const r = patchRouting(out, providers, null, nativesDir, claudeBin);
  out = r.out;
  if (!r.patched) console.log('routing: unchanged (already patched)');

  const q = patchQoL(out);
  out = q.out;
  if (!q.patched) console.log('qol: unchanged (already patched)');

  fs.writeFileSync(outPath, out);
  console.log(`patched: ${out.length} bytes -> ${outPath}`);

  // native addons: extract from the binary so the bundle runs under plain bun
  const natives = extractNatives(inPath, nativesDir);
  if (natives.length) console.log(`natives: ${natives.length} addons -> ${nativesDir}`);

  const bun = findBun();
  if (!bun) return;
  try {
    execFileSync(bun, ['build', outPath, '--no-bundle', '--outfile=/dev/null'], { stdio: 'pipe' });
    console.log('parse ok');
  } catch {
    fs.unlinkSync(outPath);
    throw new Error('VERIFY FAILED: patched bundle does not parse — output removed');
  }
  try {
    const ver = execFileSync(bun, [outPath, '--version'], { stdio: 'pipe' }).toString().trim();
    console.log(`boot ok: ${ver}`);
  } catch (e) {
    console.warn('WARNING: boot check failed: ' + e.message);
  }
}

function pathJoin(...parts) {
  return parts.join('/').replace(/\\/g, '/');
}

function dirname(p) {
  const i = p.lastIndexOf('/');
  return i > 0 ? p.slice(0, i) : '.';
}

main();
