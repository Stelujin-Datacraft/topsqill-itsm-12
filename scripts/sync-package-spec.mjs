#!/usr/bin/env node
// Copies packages/package-spec/src into apps that are built from their own folder
// (the backend Docker build only sees backend/). Run after editing package-spec:
//   node scripts/sync-package-spec.mjs          write the copies
//   node scripts/sync-package-spec.mjs --check  fail if a copy is out of date (CI)
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'packages/package-spec/src');
const targets = [join(root, 'backend/src/packages/spec')];
const header = '// Generated from packages/package-spec/src by scripts/sync-package-spec.mjs. Do not edit.\n';
const check = process.argv.includes('--check');

const files = readdirSync(source).filter((file) => file.endsWith('.ts'));
let stale = [];

for (const target of targets) {
  if (!check) {
    if (existsSync(target)) rmSync(target, { recursive: true });
    mkdirSync(target, { recursive: true });
  }
  for (const file of files) {
    const expected = header + readFileSync(join(source, file), 'utf8');
    const path = join(target, file);
    if (check) {
      if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) stale.push(path);
    } else {
      writeFileSync(path, expected);
    }
  }
  if (check && existsSync(target)) {
    for (const file of readdirSync(target)) if (!files.includes(file)) stale.push(join(target, file));
  }
}

if (check && stale.length) {
  console.error(`package-spec copies are out of date:\n  ${stale.join('\n  ')}\nRun: node scripts/sync-package-spec.mjs`);
  process.exit(1);
}
console.log(check ? 'package-spec copies are up to date' : `package-spec synced to ${targets.length} target(s)`);
