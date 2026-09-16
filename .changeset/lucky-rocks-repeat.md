---
'@stacknav/core': patch
'@stacknav/angular': patch
---

Both packages now ship the MIT `LICENSE` inside their tarball and are published
with npm provenance. The manifests have always said MIT, but the file the terms
actually live in was only in the repository: anyone reading the package from a
`node_modules` directory, a vendored copy or an offline mirror had the badge and
not the text. The release workflow now signs each publish, so npm can show what
commit and what workflow run a version was built from.
