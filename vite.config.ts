import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import pkg from './package.json';

// The patch number is the git commit count since this minor's base tag
// (vX.Y-base, laid on the commit that bumped package.json to X.Y.0-dev — see
// CLAUDE.md release policy): dev builds show vX.Y.<count>-dev, release-branch
// builds vX.Y.<count> — the patch resets at every minor bump, and hotfix
// commits on a release/X.Y branch (the base tag is an ancestor) bump the
// production version automatically. Deterministic: rebuilding the same commit
// yields the same number. package.json keeps X.Y.0[-dev]; only major.minor
// are hand-maintained. Falls back to the total commit count if the base tag
// is unreachable (shallow clone, missing tag fetch) — a too-big patch number
// beats a build failure.
function buildVersion(devTools: boolean): string {
  const suffix = pkg.version.endsWith('-dev') || devTools ? '-dev' : '';
  const [major, minor] = pkg.version.split('.');
  const git = (cmd: string) =>
    execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  try {
    let count: string;
    try {
      count = git(`git rev-list --count v${major}.${minor}-base..HEAD`);
    } catch {
      count = git('git rev-list --count HEAD');
    }
    return `${major}.${minor}.${count}${suffix}`;
  } catch {
    return pkg.version; // no git available (e.g. tarball build)
  }
}

export default defineConfig(({ command, mode }) => {
  // Dev-configured builds (`npm run build:dev` → --mode dev) and the dev server
  // compile the dev console in; the default prod build replaces __DEV_TOOLS__
  // with false so the dynamic import in main.ts — and the whole src/dev/ chunk —
  // is dead-code-eliminated from dist/. CI verifies the exclusion with a grep.
  const devTools = command === 'serve' || mode === 'dev' || mode === 'development';
  return {
    base: './', // dist/index.html works from file:// or any subpath
    define: {
      __APP_VERSION__: JSON.stringify(buildVersion(devTools)),
      __DEV_TOOLS__: JSON.stringify(devTools),
    },
  };
});
