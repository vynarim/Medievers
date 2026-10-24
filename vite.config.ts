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

/**
 * pnpm's global virtual store does not link @firebase/app, a peer dependency, next to
 * @firebase/database and @firebase/auth: point them at the copy firebase itself uses.
 */
const firebaseApp = resolve(dirname(realpathSync('node_modules/firebase')), '@firebase/app');

export default defineConfig(({ command }) => ({
  define: {
    // The dev server always says 'dev', so two local tabs meet whatever the working tree holds.
    'import.meta.env.VITE_BUILD': JSON.stringify(command === 'serve' ? 'dev' : buildHash()),
  },
  resolve: {
    alias: [{ find: /^@firebase\/app$/, replacement: firebaseApp }],
  },
  build: {
    target: 'es2023',
    chunkSizeWarningLimit: 2000,
  },
}));
