import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import pkg from './package.json';

// Test builds (-dev suffix) replace the patch number with the git commit
// count — an incremental build version (v0.2.113-dev) that distinguishes
// test-server deployments while the semver sits still between releases.
// Deterministic: rebuilding the same commit yields the same number.
// Release versions (no -dev) pass through untouched.
function buildVersion(): string {
  if (!pkg.version.endsWith('-dev')) return pkg.version;
  try {
    const count = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const [major, minor] = pkg.version.split('.');
    return `${major}.${minor}.${count}-dev`;
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
