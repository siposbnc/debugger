/// <reference types="vite/client" />

// Injected by `define` in vite.config.ts: package.json version, with the
// patch number replaced by the git commit count on -dev builds (v0.2.113-dev).
declare const __APP_VERSION__: string;

// True on the dev server and dev-configured builds (vite build --mode dev);
// false on prod builds, where it dead-code-eliminates the dev console import.
declare const __DEV_TOOLS__: boolean;
