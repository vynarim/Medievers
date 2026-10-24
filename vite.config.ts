import { execSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';

/** The commit being built: two peers of an online match must run the same one (TECH_SPEC §8.3). */
function buildHash(): string {
  try {
    const rev = execSync('git rev-parse --short HEAD').toString().trim();
    const dirty = execSync('git status --porcelain').toString().trim() !== '';
    return dirty ? `${rev}+` : rev;
  } catch {
    return 'unknown';
  }
}

/** Day of the commit being built (YYYY-MM-DD), shown with its hash on the title screen. */
function buildDate(): string {
  try {
    return execSync('git log -1 --format=%cs').toString().trim();
  } catch {
    return '';
  }
}

/**
 * pnpm's global virtual store does not link @firebase/app, a peer dependency, next to
 * @firebase/database and @firebase/auth: point them at the copy firebase itself uses.
 */
const firebaseApp = resolve(dirname(realpathSync('node_modules/firebase')), '@firebase/app');

export default defineConfig(({ command }) => ({
  define: {
    // The dev server always says 'dev', so two local tabs meet whatever the working tree holds.
    'import.meta.env.VITE_BUILD': JSON.stringify(command === 'serve' ? 'dev' : buildHash()),
    // The version on the title screen: the commit (and its day), on the dev server too, so the
    // published site and the working copy can be told apart at a glance.
    'import.meta.env.VITE_COMMIT': JSON.stringify(buildHash()),
    'import.meta.env.VITE_COMMIT_DATE': JSON.stringify(buildDate()),
    'import.meta.env.VITE_DEV': JSON.stringify(command === 'serve'),
  },
  resolve: {
    alias: [{ find: /^@firebase\/app$/, replacement: firebaseApp }],
  },
  build: {
    target: 'es2023',
    chunkSizeWarningLimit: 2000,
  },
}));
