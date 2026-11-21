// bump.mjs — one-command version bump: files + build + commit + tag.
// Usage: node bump.mjs <major.minor.patch>   or   npm run bump -- 2.4.0
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const next = process.argv[2];
if (!next || !/^\d+\.\d+\.\d+$/.test(next)) {
    console.error('Usage: node bump.mjs <major.minor.patch>');
    process.exit(1);
}

const tag = `v${next}`;
try {
    execFileSync('git', ['rev-parse', '-q', `refs/tags/${tag}`], { stdio: 'ignore' });
    console.error(`Tag ${tag} already exists. Aborting (no files changed).`);
    process.exit(1);
} catch {
    // tag not present — continue
}

const edit = (file, transform) => {
    const before = readFileSync(file, 'utf8');
    const after = transform(before);
    if (after !== before) writeFileSync(file, after);
};

let current = '(unknown)';
edit('package.json', (t) => {
    current = t.match(/"version"\s*:\s*"([^"]+)"/)?.[1] ?? current;
    t = t.replace(/"version"\s*:\s*"[^"]+"/, `"version": "${next}"`);
    return t.replace(/("versionCode"\s*:\s*)(\d+)/, (_, key, n) => `${key}${Number(n) + 1}`);
});
edit('manifest.json', (t) => t.replace(/"version"\s*:\s*"[^"]+"/, `"version": "${next}"`));
let rootVersions = 0;
edit('package-lock.json', (t) => t.replace(/"version"\s*:\s*"[^"]+"/g,
    (match) => (++rootVersions <= 2 ? `"version": "${next}"` : match)));

console.log(`${current} -> ${next} (versionCode +1)`);
// On Windows npm is npm.cmd and execFileSync does not resolve it without a
// shell. git.exe resolves directly on all platforms, so only npm needs this.
const npmShell = process.platform === 'win32';
execFileSync('npm', ['run', 'build'], { stdio: 'inherit', shell: npmShell });
execFileSync('git', ['add', 'package.json', 'manifest.json', 'package-lock.json'], { stdio: 'inherit' });
execFileSync('git', ['commit', '-m', `chore: bump version to ${next}`], { stdio: 'inherit' });
execFileSync('git', ['tag', '-a', tag, '-m', tag], { stdio: 'inherit' });
console.log(`${tag} created at HEAD`);
