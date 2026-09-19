// Flat ESLint config for the whole workspace.
//
// Named `.mjs` rather than `.js` because the repository root has no
// `"type": "module"`: a bare `eslint.config.js` here would be parsed as CommonJS.
//
// The rule set is deliberately small. It is here to catch mistakes -- an unused
// symbol, a floating `case`, an Angular lifecycle method spelled wrong -- not to
// impose a style: layout belongs to Prettier (see `prettier.config.mjs`) and
// nothing below reformats code, so the two never disagree.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.angular/**',
      '**/out-tsc/**',
      'apps/angular-demo/e2e/shots/**',
    ],
  },

  // ---- every source file ---------------------------------------------------
  {
    files: ['**/*.{ts,mts,cts,js,mjs,cjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      // An unused argument that documents a callback's shape (`(_event) => ...`)
      // is intentional; an unused local is not.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // The library reaches into DOM corners the lib.dom types do not describe
      // (vendor-prefixed viewport bits, a host's own stack object). Those casts
      // are deliberate and reviewed, so this is a nudge rather than a gate.
      '@typescript-eslint/no-explicit-any': 'warn',
      // `cond ? (a = x) : (b = y)` as a statement is a branch, not a dropped
      // value; the numeric helpers use it to keep a bisection step on one line.
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true }],
    },
  },

  // ---- Node-side scripts and the e2e suites --------------------------------
  // The e2e files run in Node but their `page.evaluate` bodies are browser code,
  // so both sets of globals are legal in the same file.
  {
    files: ['**/scripts/**/*.mjs', 'apps/angular-demo/e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      // The suites read as a transcript: `s` and `mid` are re-assigned at every
      // step so each block looks like the one before it, and the last write in a
      // section is often only there for symmetry. That is the point, not a bug.
      'no-useless-assignment': 'off',
    },
  },
  {
    files: ['packages/core/test/**/*.ts'],
    rules: {
      // The tests spell the arithmetic out (`500 > 400 ? 400 : 500`) so the
      // expected number reads like the formula it comes from.
      'no-constant-condition': 'off',
      // The DOM stub these tests run against is deliberately untyped: it fakes
      // only the handful of properties a case touches, so every handle into it
      // is an `any` on purpose. The nudge belongs on source, not here.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ---- library and app sources --------------------------------------------
  {
    files: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['packages/core/test/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // ---- Angular -------------------------------------------------------------
  // TypeScript rules only; the templates in this repository are inline and the
  // Angular compiler already type-checks them with `strictTemplates`.
  {
    files: ['packages/angular/src/**/*.ts', 'apps/angular-demo/src/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      // A directive selected by attribute has to alias: `stackNavSwipeBack` is
      // the attribute an app writes, `swipeBack` is what the class calls it. The
      // same goes for a component input whose public name (`id`) would otherwise
      // shadow a derived member. Aliasing is the API here, not an accident.
      '@angular-eslint/no-input-rename': 'off',
      '@angular-eslint/no-output-rename': 'off',
    },
  },
);
