# @stacknav/angular

## 0.1.3

### Patch Changes

- Updated dependencies [[`228b6ab`](https://github.com/VaggelisKa/stack-navigation-animation/commit/228b6ab3ff514841e5a3a060a81db835d719eb6e), [`bbc1b20`](https://github.com/VaggelisKa/stack-navigation-animation/commit/bbc1b20ac9ef4f5b68cbb928e61cd94dd346fbaa)]:
  - @stacknav/core@0.3.1

## 0.1.2

### Patch Changes

- Updated dependencies [[`1f61fd8`](https://github.com/VaggelisKa/stack-navigation-animation/commit/1f61fd81a480e806474d751c0a4a1c1c91117dfa)]:
  - @stacknav/core@0.3.0

## 0.1.1

### Patch Changes

- [#8](https://github.com/VaggelisKa/stack-navigation-animation/pull/8) [`9c60641`](https://github.com/VaggelisKa/stack-navigation-animation/commit/9c606419044e6f4eb5aed5c486e7bb3b7eadc59e) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Fix the published package and take `@stacknav/core` as a regular dependency.
  
  The `files: ["dist"]` field was copied into the built `dist/package.json`, so the
  tarball packed from `dist` contained only the manifest and the README — none of
  the actual code. Dropping the field ships `fesm2022/` and `types/` as intended.
  
  `@stacknav/core` moves from `peerDependencies` to `dependencies`, published as a
  caret range rather than the exact pin that `workspace:*` resolved to. Installing
  `@stacknav/angular` now brings the matching core along with it.
