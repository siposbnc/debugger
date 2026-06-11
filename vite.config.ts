import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  base: './', // dist/index.html works from file:// or any subpath
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Build timestamp (UTC) — the semver alone can't distinguish test-server
    // deployments between releases. In dev this is the server start time.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
});
