import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import pkg from './package.json';

// The patch number is the git commit count: dev builds show vX.Y.<count>-dev,
// release-branch builds vX.Y.<count> — so hotfix commits on a release/X.Y
// branch bump the production version automatically. Deterministic: rebuilding
// the same commit yields the same number. package.json keeps X.Y.0[-dev];
// only major.minor are hand-maintained (see CLAUDE.md release policy).
function buildVersion(): string {
  try {
    const count = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const [major, minor] = pkg.version.split('.');
    const suffix = pkg.version.endsWith('-dev') ? '-dev' : '';
    return `${major}.${minor}.${count}${suffix}`;
  } catch {
    return pkg.version; // no git available (e.g. tarball build)
  }
}

export default defineConfig({
  base: './', // dist/index.html works from file:// or any subpath
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion()),
  },
});
