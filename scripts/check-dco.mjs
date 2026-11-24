// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
// DCO check: every commit of a range must carry a "Signed-off-by: Name <email>" line (CONTRIBUTING.md).
// Usage: node scripts/check-dco.mjs <base> <head>     (merge commits are skipped)
import { execFileSync } from 'node:child_process';

const [base, head] = process.argv.slice(2);
if (!base || !head) {
  console.error('Usage: node scripts/check-dco.mjs <base> <head>');
  process.exit(2);
}
const SIGNOFF = /^Signed-off-by: .+ <[^<>@\s]+@[^<>\s]+>$/m;
const shas = execFileSync('git', ['rev-list', '--no-merges', `${base}..${head}`], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const missing = [];
for (const sha of shas) {
  const message = execFileSync('git', ['show', '-s', '--format=%B', sha], { encoding: 'utf8' });
  if (!SIGNOFF.test(message)) missing.push(`${sha.slice(0, 10)} ${message.split('\n')[0]}`);
}
if (missing.length > 0) {
  console.error(`Commits without a DCO sign-off (use: git commit -s):\n${missing.map((m) => ` - ${m}`).join('\n')}`);
  process.exit(1);
}
console.log(`DCO: ${shas.length} commit(s) signed off`);
