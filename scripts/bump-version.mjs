/**
 * Bump `package.json` version based on the commit message.
 *
 * Why `post-commit` hook?
 * - We need the *final* commit message to decide MAJOR/MINOR/PATCH.
 * - `commit-msg` can validate the message, but Git does not include index changes made
 *   inside `commit-msg` in the same commit. So we bump after the commit and then
 *   immediately `--amend` (once) to include the updated version files.
 *
 * This script:
 * - Reads the commit message from either:
 *   - a file (e.g. `.git/COMMIT_EDITMSG`), or
 *   - the last commit message (`git log -1 --pretty=%B`)
 * - Determines MAJOR/MINOR/PATCH based on prefixes (SemVer)
 * - Updates `package.json` (source of truth) and keeps `package-lock.json` root version in sync
 * - Stages the updated files
 *
 * Disable:
 * - `BTM_VERSION_BUMP=0 git commit ...`
 * - or `HUSKY=0 git commit ...`
 */
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import semver from 'semver';

function usageAndExit() {
  console.error(
    [
      'Usage:',
      '  node scripts/bump-version.mjs --from-last-commit',
      '  node scripts/bump-version.mjs --message-file <path>',
      '  node scripts/bump-version.mjs <path>    # shorthand for --message-file'
    ].join('\n')
  );
  process.exit(2);
}

function getFirstUserLine(commitMsgText) {
  const lines = commitMsgText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue; // git comments
    return trimmed;
  }
  return '';
}

function inferBumpTypeFromCommitMessage(subjectLine) {
  // MAJOR: explicit BREAKING prefix or Conventional Commits "!" marker
  if (/^BREAKING:/i.test(subjectLine)) return 'major';
  if (/^[\w-]+(\([^)]+\))?!:/.test(subjectLine)) return 'major';

  // MINOR / PATCH
  if (/^feat(\([^)]+\))?:/i.test(subjectLine)) return 'minor';
  if (/^fix(\([^)]+\))?:/i.test(subjectLine)) return 'patch';

  // Default
  return 'patch';
}

async function main() {
  if (process.env.BTM_VERSION_BUMP === '0') return;

  const args = process.argv.slice(2);
  if (args.length === 0) usageAndExit();

  let commitMsgText = '';
  if (args[0] === '--from-last-commit') {
    commitMsgText = execFileSync('git', ['log', '-1', '--pretty=%B'], { encoding: 'utf8' });
  } else {
    const commitMsgPath = args[0] === '--message-file' ? args[1] : args[0];
    if (!commitMsgPath) usageAndExit();
    commitMsgText = await fs.readFile(commitMsgPath, 'utf8');
  }

  const subject = getFirstUserLine(commitMsgText);
  const bumpType = inferBumpTypeFromCommitMessage(subject);

  const pkgPath = new URL('../package.json', import.meta.url);
  const pkgText = await fs.readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgText);

  const current = pkg?.version;
  const valid = semver.valid(current);
  if (!valid) {
    console.error(
      `Version bump aborted: package.json version is not valid semver: ${JSON.stringify(current)}`
    );
    process.exit(1);
  }

  const next = semver.inc(valid, bumpType);
  if (!next) {
    console.error(`Version bump aborted: could not bump version ${valid} with ${bumpType}.`);
    process.exit(1);
  }

  if (next === valid) return;

  pkg.version = next;
  await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  // Keep npm lockfile's root version in sync (nice-to-have, avoids confusing diffs).
  // Note: lockfile sync is NOT a source of truth; `package.json` is.
  try {
    const lockPath = new URL('../package-lock.json', import.meta.url);
    const lockText = await fs.readFile(lockPath, 'utf8');
    const lock = JSON.parse(lockText);
    if (typeof lock === 'object' && lock) {
      if (typeof lock.version === 'string') lock.version = next;
      if (lock.packages && typeof lock.packages === 'object' && lock.packages['']) {
        if (typeof lock.packages[''].version === 'string') lock.packages[''].version = next;
      }
      await fs.writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
    }
  } catch {
    // Ignore if lockfile doesn't exist or can't be parsed.
  }

  // Keep extension manifest version in sync (Chrome uses this as the extension version).
  try {
    const manifestPath = new URL('../public/manifest.json', import.meta.url);
    const manifestText = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestText);
    if (manifest && typeof manifest === 'object') {
      if (typeof manifest.version === 'string') {
        manifest.version = next;
        await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      }
    }
  } catch {
    // Ignore if manifest doesn't exist or can't be parsed.
  }

  execFileSync('git', ['add', 'package.json', 'package-lock.json', 'public/manifest.json'], {
    stdio: 'inherit'
  });

  console.log(`Version bumped: ${valid} -> ${next} (${bumpType})`);
}

await main();
