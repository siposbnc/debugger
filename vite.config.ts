import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import pkg from './package.json';

// The patch number is the git commit count: dev builds show vX.Y.<count>-dev,
// release-branch builds vX.Y.<count> — so hotfix commits on a release/X.Y
// branch bump the production version automatically. Deterministic: rebuilding
// the same commit yields the same number. package.json keeps X.Y.0[-dev];
// only major.minor are hand-maintained (see CLAUDE.md release policy).
function buildVersion(devTools: boolean): string {
  const suffix = pkg.version.endsWith('-dev') || devTools ? '-dev' : '';
  try {
    const count = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const [major, minor] = pkg.version.split('.');
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
