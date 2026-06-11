// Test-server deploy: builds the dev-configured bundle locally and uploads it
// with the Netlify CLI — no Netlify build minutes are consumed (CI builds on
// the site are expected to be stopped; the local .netlify/ link from
// `netlify init`/`netlify link` is all the upload needs).
//
//   npm run deploy:test          refuses a dirty working tree
//   npm run deploy:test -- --dirty   deploy anyway (version may not match a commit)
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const out = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

// The deployed version string is derived from the commit (vite.config.ts) —
// an uncommitted tree would lie about what's on the test server.
const dirty = out('git status --porcelain') !== '';
if (dirty && !process.argv.includes('--dirty')) {
  console.error('deploy:test: working tree is dirty — commit first, or pass -- --dirty to override.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [major, minor] = pkg.version.split('.');
let count;
try { count = out(`git rev-list --count v${major}.${minor}-base..HEAD`); }
catch { count = out('git rev-list --count HEAD'); }
const sha = out('git rev-parse --short HEAD');
console.log(`deploy:test → v${major}.${minor}.${count}-dev (${sha}${dirty ? ', DIRTY TREE' : ''})`);

run('npm run build:dev');
run('netlify deploy --prod --dir=dist');
