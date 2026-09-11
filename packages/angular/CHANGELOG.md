# @stacknav/angular

## 0.1.1

### Patch Changes

- [#8](https://github.com/VaggelisKa/stack-navigation-animation/pull/8) [`9c60641`](https://github.com/VaggelisKa/stack-navigation-animation/commit/9c606419044e6f4eb5aed5c486e7bb3b7eadc59e) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Fix the published package and take `@stacknav/core` as a regular dependency.
  
  The `files: ["dist"]` field was copied into the built `dist/package.json`, so the
  tarball packed from `dist` contained only the manifest and the README — none of
  the actual code. Dropping the field ships `fesm2022/` and `types/` as intended.
  
  `@stacknav/core` moves from `peerDependencies` to `dependencies`, published as a
  caret range rather than the exact pin that `workspace:*` resolved to. Installing
  `@stacknav/angular` now brings the matching core along with it.
