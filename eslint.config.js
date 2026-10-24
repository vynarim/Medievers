import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Float transcendental functions differ across JS engines; src/sim/math provides integer replacements.
const FORBIDDEN_MATH = [
  'random',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'sqrt',
  'cbrt',
  'pow',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'hypot',
  'fround',
];

// Clocks, timers and host objects make the simulation depend on its environment.
const FORBIDDEN_GLOBALS = [
  'Date',
  'performance',
  'window',
  'document',
  'navigator',
  'globalThis',
  'self',
  'localStorage',
  'sessionStorage',
  'fetch',
  'crypto',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'requestAnimationFrame',
  'queueMicrotask',
];

const simGuard = {
  files: ['src/sim/**/*.ts'],
  rules: {
    'no-restricted-properties': [
      'error',
      ...FORBIDDEN_MATH.map((property) => ({
        object: 'Math',
        property,
        message: 'Non-deterministic in src/sim: use src/sim/math (LUT, isqrt, seeded PRNG).',
      })),
    ],
    'no-restricted-globals': [
      'error',
      ...FORBIDDEN_GLOBALS.map((name) => ({
        name,
        message: 'src/sim is pure: no clock, timer or host object. Time is counted in ticks.',
      })),
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
        message: 'Exponentiation is Math.pow: forbidden in src/sim.',
      },
      {
        selector: "MemberExpression[object.name='Math'][computed=true]",
        message: 'Computed Math access bypasses the src/sim guard.',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: '^phaser($|/)',
            message: 'src/sim must not depend on Phaser.',
          },
          {
            regex: '(^|/)(render|ui|net|app|input|ai)(/|$)',
            message: 'src/sim must not import render, ui, net, app, input or ai.',
          },
        ],
      },
    ],
  },
};

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['*.config.{js,ts}', 'tests/**/*.ts', 'tools/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  simGuard,
  prettier,
);
