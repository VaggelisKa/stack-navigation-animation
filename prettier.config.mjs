// Prettier configuration for the whole workspace.
//
// Named `.mjs` for the same reason `eslint.config.mjs` is: the repository root
// has no `"type": "module"`, so a bare `prettier.config.js` would be parsed as
// CommonJS.
//
// Formatting and linting are kept apart. ESLint here carries no stylistic
// rules -- it catches mistakes, Prettier decides layout -- so there is nothing
// for the two to argue about and no `eslint-config-prettier` to install.

/** @type {import('prettier').Config} */
export default {
  // The default 80 is narrower than this codebase has ever been: half its
  // statements are wider, and the explanatory comments read better unbroken.
  printWidth: 100,
  // What every source file already used before Prettier arrived.
  singleQuote: true,
  // `core.autocrlf=true` hands Windows checkouts CRLF; committing LF keeps the
  // formatted output identical on every platform and out of the diff.
  endOfLine: 'lf',
  // Every template literal is left as written. The Angular templates in this
  // repository are inline and laid out by hand -- Prettier's whitespace-safe
  // HTML output has to move the closing bracket rather than the whitespace
  // (`</a
  // >`), which is correct and unreadable.
  embeddedLanguageFormatting: 'off',
};
