import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  base: './', // dist/index.html works from file:// or any subpath
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
